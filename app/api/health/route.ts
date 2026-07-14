import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Unauthenticated liveness/readiness probe for uptime monitors. Reports whether
// the app can reach its database. Returns 200 when healthy, 503 when not — no
// internal details are leaked either way.
export async function GET() {
  const startedAt = Date.now();

  let db: 'ok' | 'error' = 'ok';
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    // Cheap round-trip: count-only, single row, no data returned.
    const { error } = await supabase
      .from('games')
      .select('id', { head: true, count: 'exact' })
      .limit(1);
    if (error) db = 'error';
  } catch {
    db = 'error';
  }

  const healthy = db === 'ok';
  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      db,
      latency_ms: Date.now() - startedAt,
      time: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503, headers: { 'Cache-Control': 'no-store' } }
  );
}
