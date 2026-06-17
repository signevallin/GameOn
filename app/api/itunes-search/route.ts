// app/api/itunes-search/route.ts
import { NextResponse } from 'next/server';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim();
  if (!q) return NextResponse.json({ error: 'Missing q.' }, { status: 400 });

  const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=15&lang=en_us`;
  const res = await fetch(itunesUrl, { headers: { 'User-Agent': 'GameOn/1.0' } });
  if (!res.ok) return NextResponse.json({ error: 'iTunes API error.' }, { status: 502 });

  const json = await res.json();
  return NextResponse.json({ results: json.results ?? [] });
}
