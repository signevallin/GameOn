import { NextRequest } from 'next/server';
import { stripe } from '@/lib/stripe';
import { upsertSubscription } from '@/lib/subscription';
import type { SubscriptionTier } from '@/lib/subscription';
import type Stripe from 'stripe';

export const dynamic = 'force-dynamic';

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

/** In Stripe API ≥ 2025-05-28.basil, current_period_end lives on the first item. */
function getPeriodEnd(subscription: Stripe.Subscription): Date {
  const item = subscription.items.data[0];
  const ts = item?.current_period_end ?? subscription.billing_cycle_anchor;
  return new Date(ts * 1000);
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    return Response.json({ error: 'Missing stripe-signature header.' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'subscription') break;

        const userId = session.metadata?.supabase_user_id;
        const plan = session.metadata?.plan as SubscriptionTier | undefined;
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

        if (!userId || !plan || !customerId || !subscriptionId) {
          console.error('[webhook] checkout.session.completed: missing metadata', { userId, plan, customerId, subscriptionId });
          break;
        }

        // Fetch full subscription to get items (needed for period end in new API)
        const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ['items'],
        });

        await upsertSubscription({
          userId,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          plan,
          status: subscription.status as 'active' | 'canceled' | 'past_due' | 'trialing',
          currentPeriodEnd: getPeriodEnd(subscription),
        });

        // ── Send welcome email ────────────────────────────────────────────
        const customerEmail = typeof session.customer_details?.email === 'string'
          ? session.customer_details.email
          : null;

        if (customerEmail && process.env.RESEND_API_KEY) {
          const { Resend } = await import('resend');
          const resend = new Resend(process.env.RESEND_API_KEY);
          const planLabel = plan === 'studio' ? 'Studio' : 'Pro';
          await resend.emails.send({
            from: 'GameOn <hello@playgameon.app>',
            to: customerEmail,
            subject: `Welcome to GameOn ${planLabel}! 🎉`,
            html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0D1520;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0D1520;padding:48px 24px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#162030;border-radius:16px;overflow:hidden;border:1px solid rgba(124,189,212,0.15);">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#1a2d42,#162030);padding:40px 48px 32px;border-bottom:1px solid rgba(124,189,212,0.1);">
          <p style="margin:0;font-size:26px;font-weight:800;letter-spacing:-0.03em;color:#DCE4EE;">Game<span style="color:#7CBDD4;">On</span></p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:40px 48px;">
          <h1 style="margin:0 0 16px;font-size:24px;font-weight:800;color:#DCE4EE;letter-spacing:-0.02em;">Welcome to ${planLabel}! 🎉</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#8FA8C0;">Your subscription is now active. Here's what you have access to:</p>
          <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
            <tr><td style="padding:6px 0;font-size:14px;color:#7CBDD4;font-weight:700;">✓</td><td style="padding:6px 0 6px 10px;font-size:14px;color:#DCE4EE;">Unlimited teams per game</td></tr>
            <tr><td style="padding:6px 0;font-size:14px;color:#7CBDD4;font-weight:700;">✓</td><td style="padding:6px 0 6px 10px;font-size:14px;color:#DCE4EE;">Custom mission builder</td></tr>
            <tr><td style="padding:6px 0;font-size:14px;color:#7CBDD4;font-weight:700;">✓</td><td style="padding:6px 0 6px 10px;font-size:14px;color:#DCE4EE;">Power-ups (sabotage, double points &amp; more)</td></tr>
            <tr><td style="padding:6px 0;font-size:14px;color:#7CBDD4;font-weight:700;">✓</td><td style="padding:6px 0 6px 10px;font-size:14px;color:#DCE4EE;">PDF results reports</td></tr>
          </table>
          <a href="https://playgameon.app/play" style="display:inline-block;padding:14px 28px;background:#7CBDD4;color:#0D1520;font-weight:800;font-size:15px;border-radius:999px;text-decoration:none;">Start creating →</a>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:24px 48px;border-top:1px solid rgba(124,189,212,0.1);">
          <p style="margin:0;font-size:12px;color:#4A6580;line-height:1.6;">Questions? Reply to this email or contact us at <a href="mailto:hello@playgameon.app" style="color:#7CBDD4;">hello@playgameon.app</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
          }).catch(err => console.error('[webhook] email error:', err));
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;
        const plan = subscription.metadata?.plan as SubscriptionTier | undefined;
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

        if (!userId || !plan) {
          console.error('[webhook] customer.subscription.updated: missing metadata', { userId, plan });
          break;
        }

        await upsertSubscription({
          userId,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
          plan,
          status: subscription.status as 'active' | 'canceled' | 'past_due' | 'trialing',
          currentPeriodEnd: getPeriodEnd(subscription),
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

        if (!userId) {
          console.error('[webhook] customer.subscription.deleted: missing supabase_user_id metadata');
          break;
        }

        await upsertSubscription({
          userId,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
          plan: 'free',
          status: 'canceled',
          currentPeriodEnd: getPeriodEnd(subscription),
        });

        // ── Send cancellation email ────────────────────────────────────
        if (process.env.RESEND_API_KEY) {
          try {
            const { createClient } = await import('@supabase/supabase-js');
            const adminSupabase = createClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.SUPABASE_SERVICE_ROLE_KEY!
            );
            const { data: { user } } = await adminSupabase.auth.admin.getUserById(userId);
            const cancelEmail = user?.email;
            if (cancelEmail) {
              const { Resend } = await import('resend');
              const resend = new Resend(process.env.RESEND_API_KEY);
              await resend.emails.send({
                from: 'GameOn <hello@playgameon.app>',
                to: cancelEmail,
                subject: 'Your GameOn subscription has been cancelled',
                html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0D1520;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0D1520;padding:48px 24px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#162030;border-radius:16px;overflow:hidden;border:1px solid rgba(124,189,212,0.15);">
        <tr><td style="background:linear-gradient(135deg,#1a2d42,#162030);padding:40px 48px 32px;border-bottom:1px solid rgba(124,189,212,0.1);">
          <p style="margin:0;font-size:26px;font-weight:800;letter-spacing:-0.03em;color:#DCE4EE;">Game<span style="color:#7CBDD4;">On</span></p>
        </td></tr>
        <tr><td style="padding:40px 48px;">
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#DCE4EE;letter-spacing:-0.02em;">Subscription cancelled</h1>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#8FA8C0;">Your GameOn subscription has been cancelled. You'll keep access until the end of your current billing period.</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#8FA8C0;">If this was a mistake or you'd like to come back, you can reactivate at any time.</p>
          <a href="https://playgameon.app/play" style="display:inline-block;padding:14px 28px;background:#7CBDD4;color:#0D1520;font-weight:800;font-size:15px;border-radius:999px;text-decoration:none;">Reactivate →</a>
        </td></tr>
        <tr><td style="padding:24px 48px;border-top:1px solid rgba(124,189,212,0.1);">
          <p style="margin:0;font-size:12px;color:#4A6580;line-height:1.6;">Questions? Contact us at <a href="mailto:hello@playgameon.app" style="color:#7CBDD4;">hello@playgameon.app</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
              }).catch(err => console.error('[webhook] cancellation email error:', err));
            }
          } catch (err) {
            console.error('[webhook] cancellation email lookup error:', err);
          }
        }
        break;
      }

      default:
        // Unhandled event — return 200 to avoid Stripe retries
        break;
    }
  } catch (err) {
    console.error('[webhook] handler error:', err);
    return Response.json({ error: 'Internal server error.' }, { status: 500 });
  }

  return Response.json({ received: true });
}
