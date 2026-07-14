import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';
import { exportAccountData } from '@/lib/account-data';

export const dynamic = 'force-dynamic';

// GDPR data portability: returns everything held for the caller's own account
// as a downloadable JSON file. Scoped to admin.userId — never another tenant.
export async function GET(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: { user } } = await supabase.auth.admin.getUserById(admin.userId);
  const bundle = await exportAccountData(supabase, admin.userId, user?.email ?? null);

  return new NextResponse(JSON.stringify(bundle, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="gameon-account-data.json"',
      'Cache-Control': 'no-store',
    },
  });
}
