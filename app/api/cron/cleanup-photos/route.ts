import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cleanupExpiredPhotos } from '@/lib/photo-cleanup';
import { captureError } from '@/lib/observability';

export const dynamic = 'force-dynamic';
// Storage deletes across many games can take a moment.
export const maxDuration = 60;

// Daily job (see vercel.json crons) enforcing the 30-day photo retention
// promise from the privacy policy. Vercel Cron calls this with
// `Authorization: Bearer ${CRON_SECRET}` when the CRON_SECRET env var is set.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('Authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const result = await cleanupExpiredPhotos(supabase);
    console.log('[cleanup-photos]', JSON.stringify(result));
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    // A silently failing cleanup means we breach the retention promise — alert.
    await captureError(err, { route: '/api/cron/cleanup-photos' });
    return NextResponse.json({ error: 'Cleanup failed.' }, { status: 500 });
  }
}
