import { NextRequest } from 'next/server';
import { stripe, PLANS, Plan, priceIdFor, isBillingInterval } from '@/lib/stripe';

export const dynamic = 'force-dynamic';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';
import { getSubscription } from '@/lib/subscription';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://playgameon.app';

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────
  let adminUser;
  try {
    adminUser = await validateAdminToken(req);
  } catch {
    return unauthorizedResponse();
  }

  const body = await req.json().catch(() => ({}));
  const plan = body.plan as Plan;
  // Default to monthly (the lower-commitment entry point) when unspecified.
  const interval = isBillingInterval(body.interval) ? body.interval : 'monthly';

  if (!plan || !(plan in PLANS)) {
    return Response.json({ error: 'Invalid plan.' }, { status: 400 });
  }

  const priceId = priceIdFor(plan, interval);
  if (!priceId) {
    return Response.json({ error: 'Plan not configured yet.' }, { status: 503 });
  }

  // ── Reuse existing Stripe customer if available ───────────────
  const sub = await getSubscription(adminUser.userId);
  let customerId = sub.stripe_customer_id ?? undefined;

  if (!customerId) {
    // Get the user's email from Supabase so we can pre-fill Stripe checkout
    const { createClient } = await import('@supabase/supabase-js');
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: { user } } = await adminSupabase.auth.admin.getUserById(adminUser.userId);
    const email = user?.email;

    if (email) {
      const customer = await stripe.customers.create({
        email,
        metadata: { supabase_user_id: adminUser.userId },
      });
      customerId = customer.id;
    }
  }

  // ── Create Stripe Checkout Session ────────────────────────────
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${BASE_URL}/play?upgraded=${plan}`,
    cancel_url: `${BASE_URL}/play`,
    metadata: { supabase_user_id: adminUser.userId, plan, interval },
    subscription_data: {
      metadata: { supabase_user_id: adminUser.userId, plan, interval },
    },
    locale: 'sv',
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
  });

  return Response.json({ url: session.url });
}
