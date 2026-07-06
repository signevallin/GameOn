// lib/stripe-webhook.ts
//
// Pure, dependency-injected handling of Stripe webhook events. The route wires
// in the real Stripe/Supabase/Resend implementations; tests wire in fakes. This
// keeps the money-path decision logic (which plan/status to store, which email
// to send) fully testable without network or a database.

import type Stripe from 'stripe';
import { planFromPriceId } from './stripe';
import type { SubscriptionTier } from './subscription';

export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing';
export type EmailKind = 'welcome' | 'cancellation' | 'payment_failed';

export type UpsertParams = {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  plan: SubscriptionTier;
  status: SubscriptionStatus;
  currentPeriodEnd: Date;
};

export type WebhookDeps = {
  upsertSubscription(params: UpsertParams): Promise<void>;
  retrieveSubscription(id: string): Promise<Stripe.Subscription>;
  getUserEmail(userId: string): Promise<string | null>;
  sendEmail(kind: EmailKind, to: string, opts: { plan?: SubscriptionTier }): Promise<void>;
};

/** In Stripe API ≥ 2025-05-28.basil, current_period_end lives on the first item. */
export function getPeriodEnd(subscription: Stripe.Subscription): Date {
  const item = subscription.items.data[0];
  const ts = item?.current_period_end ?? subscription.billing_cycle_anchor;
  return new Date(ts * 1000);
}

/** The plan a subscription reflects: active price id first, checkout metadata as fallback. */
export function resolvePlan(subscription: Stripe.Subscription): SubscriptionTier | undefined {
  const fromPrice = planFromPriceId(subscription.items.data[0]?.price?.id);
  if (fromPrice) return fromPrice;
  return subscription.metadata?.plan as SubscriptionTier | undefined;
}

function customerIdOf(c: string | { id: string } | null | undefined): string | undefined {
  if (!c) return undefined;
  return typeof c === 'string' ? c : c.id;
}

/**
 * Applies a (verified, de-duplicated) Stripe event via the injected deps.
 * Returns a short action string describing what it did — handy for logging and
 * assertions.
 */
export async function applyStripeEvent(event: Stripe.Event, deps: WebhookDeps): Promise<{ action: string }> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== 'subscription') return { action: 'ignored:not-subscription' };

      const userId = session.metadata?.supabase_user_id;
      const plan = session.metadata?.plan as SubscriptionTier | undefined;
      const customerId = customerIdOf(session.customer as never);
      const subscriptionId = typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id;

      if (!userId || !plan || !customerId || !subscriptionId) {
        return { action: 'skipped:missing-metadata' };
      }

      const subscription = await deps.retrieveSubscription(subscriptionId);
      await deps.upsertSubscription({
        userId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        plan,
        status: subscription.status as SubscriptionStatus,
        currentPeriodEnd: getPeriodEnd(subscription),
      });

      const email = typeof session.customer_details?.email === 'string' ? session.customer_details.email : null;
      if (email) await deps.sendEmail('welcome', email, { plan });
      return { action: 'checkout' };
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.supabase_user_id;
      const plan = resolvePlan(subscription);
      const customerId = customerIdOf(subscription.customer as never);

      if (!userId || !plan || !customerId) return { action: 'skipped:missing-metadata' };

      await deps.upsertSubscription({
        userId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        plan,
        status: subscription.status as SubscriptionStatus,
        currentPeriodEnd: getPeriodEnd(subscription),
      });
      return { action: 'updated' };
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.supabase_user_id;
      const customerId = customerIdOf(subscription.customer as never);
      if (!userId || !customerId) return { action: 'skipped:missing-metadata' };

      await deps.upsertSubscription({
        userId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        plan: 'free',
        status: 'canceled',
        currentPeriodEnd: getPeriodEnd(subscription),
      });

      const email = await deps.getUserEmail(userId);
      if (email) await deps.sendEmail('cancellation', email, {});
      return { action: 'deleted' };
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const email = invoice.customer_email;
      if (email) await deps.sendEmail('payment_failed', email, {});
      return { action: 'payment_failed' };
    }

    default:
      return { action: 'ignored' };
  }
}
