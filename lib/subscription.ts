import { createClient } from '@supabase/supabase-js';

export type SubscriptionTier = 'free' | 'pro' | 'studio';

export type Subscription = {
  plan: SubscriptionTier;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  current_period_end: string | null;
  stripe_customer_id: string | null;
};

/** Server-side: fetch subscription for a user (uses service role key). */
export async function getSubscription(userId: string): Promise<Subscription> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from('subscriptions')
    .select('plan, status, current_period_end, stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!data || data.status === 'canceled') {
    return { plan: 'free', status: 'active', current_period_end: null, stripe_customer_id: null };
  }

  return data as Subscription;
}

/** Server-side: upsert subscription after a Stripe webhook event. */
export async function upsertSubscription(params: {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  plan: SubscriptionTier;
  status: Subscription['status'];
  currentPeriodEnd: Date;
}) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await supabase.from('subscriptions').upsert(
    {
      user_id: params.userId,
      stripe_customer_id: params.stripeCustomerId,
      stripe_subscription_id: params.stripeSubscriptionId,
      plan: params.plan,
      status: params.status,
      current_period_end: params.currentPeriodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
}

/** Feature limits per plan. */
export const LIMITS = {
  free:   { maxTeams: 5,         customMissions: false, powerups: false, pdfReports: false },
  pro:    { maxTeams: Infinity,  customMissions: true,  powerups: true,  pdfReports: true  },
  studio: { maxTeams: Infinity,  customMissions: true,  powerups: true,  pdfReports: true  },
} satisfies Record<SubscriptionTier, { maxTeams: number; customMissions: boolean; powerups: boolean; pdfReports: boolean }>;
