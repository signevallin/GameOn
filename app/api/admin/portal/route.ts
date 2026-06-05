import { NextResponse } from 'next/server';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';
import { getSubscription } from '@/lib/subscription';
import { stripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://playgameon.app';

export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const sub = await getSubscription(admin.userId);

  if (!sub.stripe_customer_id) {
    return NextResponse.json(
      { error: 'No active subscription found.' },
      { status: 404 }
    );
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${BASE_URL}/play`,
  });

  return NextResponse.json({ url: session.url });
}
