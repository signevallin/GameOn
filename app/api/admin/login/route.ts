import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { password } = await req.json();
  const expected = process.env.ADMIN_PASSWORD ?? 'admin2026';

  if (password !== expected) {
    return NextResponse.json({ error: 'Wrong password.' }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
