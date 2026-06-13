import { NextResponse } from 'next/server';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';
import { getSubscription } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const sub = await getSubscription(admin.userId);
  return NextResponse.json({
    plan: sub.plan,
    status: sub.status,
    current_period_end: sub.current_period_end,
    stripe_managed: typeof sub.stripe_customer_id === 'string' && sub.stripe_customer_id.startsWith('cus_'),
  });
}
