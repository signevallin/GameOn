import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe';
import { upsertSubscription } from '@/lib/subscription';
import { captureError } from '@/lib/observability';
import { applyStripeEvent, type WebhookDeps, type EmailKind } from '@/lib/stripe-webhook';
import type { SubscriptionTier } from '@/lib/subscription';
import type Stripe from 'stripe';

export const dynamic = 'force-dynamic';

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Records an event id and reports whether it is new. Returns false when the
 * event was already processed (duplicate Stripe retry) so the handler can skip
 * side effects like emails.
 */
async function markEventProcessed(event: Stripe.Event): Promise<boolean> {
  const { error } = await adminSupabase()
    .from('stripe_events')
    .insert({ id: event.id, type: event.type });
  if (error) {
    // 23505 = unique_violation → we've already handled this event id.
    if ((error as { code?: string }).code === '23505') return false;
    // Unknown error: process anyway rather than silently drop a real event.
    console.error('[webhook] stripe_events insert error:', error);
  }
  return true;
}

const SHELL = (title: string, bodyHtml: string) => `
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
        <tr><td style="padding:40px 48px;">${bodyHtml}</td></tr>
        <tr><td style="padding:24px 48px;border-top:1px solid rgba(124,189,212,0.1);">
          <p style="margin:0;font-size:12px;color:#4A6580;line-height:1.6;">Questions? Contact us at <a href="mailto:hello@playgameon.app" style="color:#7CBDD4;">hello@playgameon.app</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

function emailContent(kind: EmailKind, plan?: SubscriptionTier): { subject: string; html: string } {
  if (kind === 'welcome') {
    const planLabel = plan === 'studio' ? 'Studio' : 'Pro';
    return {
      subject: `Welcome to GameOn ${planLabel}! 🎉`,
      html: SHELL(planLabel, `
        <h1 style="margin:0 0 16px;font-size:24px;font-weight:800;color:#DCE4EE;letter-spacing:-0.02em;">Welcome to ${planLabel}! 🎉</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#8FA8C0;">Your subscription is now active. Here's what you have access to:</p>
        <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
          <tr><td style="padding:6px 0;font-size:14px;color:#7CBDD4;font-weight:700;">✓</td><td style="padding:6px 0 6px 10px;font-size:14px;color:#DCE4EE;">Unlimited teams per game</td></tr>
          <tr><td style="padding:6px 0;font-size:14px;color:#7CBDD4;font-weight:700;">✓</td><td style="padding:6px 0 6px 10px;font-size:14px;color:#DCE4EE;">Custom mission builder</td></tr>
          <tr><td style="padding:6px 0;font-size:14px;color:#7CBDD4;font-weight:700;">✓</td><td style="padding:6px 0 6px 10px;font-size:14px;color:#DCE4EE;">Power-ups (sabotage, double points &amp; more)</td></tr>
          <tr><td style="padding:6px 0;font-size:14px;color:#7CBDD4;font-weight:700;">✓</td><td style="padding:6px 0 6px 10px;font-size:14px;color:#DCE4EE;">PDF results reports</td></tr>
        </table>
        <a href="https://playgameon.app/play" style="display:inline-block;padding:14px 28px;background:#7CBDD4;color:#0D1520;font-weight:800;font-size:15px;border-radius:999px;text-decoration:none;">Start creating →</a>`),
    };
  }
  if (kind === 'payment_failed') {
    return {
      subject: 'Action needed: your GameOn payment failed',
      html: SHELL('Payment failed', `
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#DCE4EE;letter-spacing:-0.02em;">Your payment didn't go through</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#8FA8C0;">We couldn't charge your card for your GameOn subscription. Paid features are paused until the payment succeeds. Please update your payment method to keep your access.</p>
        <a href="https://playgameon.app/play" style="display:inline-block;padding:14px 28px;background:#7CBDD4;color:#0D1520;font-weight:800;font-size:15px;border-radius:999px;text-decoration:none;">Update payment method →</a>`),
    };
  }
  return {
    subject: 'Your GameOn subscription has been cancelled',
    html: SHELL('Subscription cancelled', `
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#DCE4EE;letter-spacing:-0.02em;">Subscription cancelled</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#8FA8C0;">Your GameOn subscription has been cancelled. You'll keep access until the end of your current billing period.</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#8FA8C0;">If this was a mistake or you'd like to come back, you can reactivate at any time.</p>
      <a href="https://playgameon.app/play" style="display:inline-block;padding:14px 28px;background:#7CBDD4;color:#0D1520;font-weight:800;font-size:15px;border-radius:999px;text-decoration:none;">Reactivate →</a>`),
  };
}

function realDeps(): WebhookDeps {
  return {
    upsertSubscription,
    retrieveSubscription: (id) => stripe.subscriptions.retrieve(id, { expand: ['items'] }),
    getUserEmail: async (userId) => {
      const { data: { user } } = await adminSupabase().auth.admin.getUserById(userId);
      return user?.email ?? null;
    },
    sendEmail: async (kind, to, opts) => {
      if (!process.env.RESEND_API_KEY) return;
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { subject, html } = emailContent(kind, opts.plan);
      await resend.emails
        .send({ from: 'GameOn <hello@playgameon.app>', to, subject, html })
        .catch((err) => console.error('[webhook] email error:', err));
    },
  };
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

  // Idempotency: skip events we've already handled (Stripe retries at-least-once).
  if (!(await markEventProcessed(event))) {
    return Response.json({ received: true, duplicate: true });
  }

  try {
    await applyStripeEvent(event, realDeps());
  } catch (err) {
    // A failing webhook means subscription state can silently drift — capture it.
    await captureError(err, { route: '/api/stripe/webhook', event_type: event.type, event_id: event.id });
    return Response.json({ error: 'Internal server error.' }, { status: 500 });
  }

  return Response.json({ received: true });
}
