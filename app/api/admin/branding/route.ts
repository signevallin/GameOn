// app/api/admin/branding/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export type BrandingSettings = {
  brand_logo_url: string | null;
  brand_primary_color: string | null;
  brand_name: string | null;
  apply_to_all_games: boolean;
  onboarded_at: string | null;
};

/** GET — fetch branding settings for the current admin */
export async function GET(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const { data } = await adminClient()
    .from('admin_branding')
    .select('brand_logo_url, brand_primary_color, brand_name, apply_to_all_games, onboarded_at')
    .eq('user_id', admin.userId)
    .maybeSingle();

  return NextResponse.json<BrandingSettings>({
    brand_logo_url: data?.brand_logo_url ?? null,
    brand_primary_color: data?.brand_primary_color ?? null,
    brand_name: data?.brand_name ?? null,
    apply_to_all_games: data?.apply_to_all_games ?? false,
    onboarded_at: data?.onboarded_at ?? null,
  });
}

/** PUT — save branding settings */
export async function PUT(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const body: Partial<BrandingSettings> = await req.json();

  const { error } = await adminClient()
    .from('admin_branding')
    .upsert({
      user_id: admin.userId,
      brand_logo_url: body.brand_logo_url ?? null,
      brand_primary_color: body.brand_primary_color ?? null,
      brand_name: body.brand_name ?? null,
      apply_to_all_games: body.apply_to_all_games ?? false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
