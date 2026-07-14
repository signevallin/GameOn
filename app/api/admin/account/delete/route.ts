import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';
import { deleteAccountData } from '@/lib/account-data';
import { stripe } from '@/lib/stripe';
import { captureError } from '@/lib/observability';

export const dynamic = 'force-dynamic';

// GDPR right to erasure: permanently deletes the caller's account and all of
// its data. Irreversible — requires the caller to confirm by typing their own
// email address, and only ever touches the caller's own data.
export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: { user } } = await supabase.auth.admin.getUserById(admin.userId);
  const email = user?.email ?? null;

  const body = await req.json().catch(() => ({}));
  const confirmEmail = typeof body?.confirmEmail === 'string' ? body.confirmEmail.trim().toLowerCase() : '';
  if (!email || confirmEmail !== email.toLowerCase()) {
    return NextResponse.json(
      { error: 'Type your account email exactly to confirm deletion.' },
      { status: 400 }
    );
  }

  // Cancel any Stripe subscription first (best-effort — never block deletion).
  try {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('user_id', admin.userId)
      .maybeSingle();
    if (sub?.stripe_subscription_id) {
      await stripe.subscriptions.cancel(sub.stripe_subscription_id);
    }
  } catch (err) {
    await captureError(err, { route: '/api/admin/account/delete', step: 'stripe-cancel', userId: admin.userId });
  }

  try {
    await deleteAccountData(supabase, admin.userId);
    const { error } = await supabase.auth.admin.deleteUser(admin.userId);
    if (error) throw error;
  } catch (err) {
    await captureError(err, { route: '/api/admin/account/delete', step: 'delete', userId: admin.userId });
    return NextResponse.json({ error: 'Could not fully delete the account. Please contact hello@rivalry.se.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
