import { NextResponse } from 'next/server';
import { captureError } from '@/lib/observability';
import { checkRateLimit, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// Receives errors from the client-side error boundaries so they reach the same
// capture pipeline (structured log + optional webhook alert) as server errors.
export async function POST(req: Request) {
  // Cap per IP so a misbehaving/hostile client can't flood the alert channel.
  const rl = await checkRateLimit(`client-error:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) return NextResponse.json({ ok: true }, { status: 202 });

  const body = await req.json().catch(() => ({}));
  const message = typeof body?.message === 'string' ? body.message.slice(0, 500) : 'Unknown client error';
  const digest = typeof body?.digest === 'string' ? body.digest.slice(0, 100) : undefined;
  const where = typeof body?.where === 'string' ? body.where.slice(0, 100) : undefined;

  await captureError(new Error(message), { source: 'client', digest, where });
  return NextResponse.json({ ok: true });
}
