import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      // Mirror the "@/*" -> "./*" path alias from tsconfig.json.
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    // PLANS in lib/stripe.ts reads these at module load; give them known values
    // so planFromPriceId has something to map.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
      STRIPE_PRO_PRICE_ID: 'price_pro_test',            // yearly (legacy fallback)
      STRIPE_STUDIO_PRICE_ID: 'price_studio_test',       // yearly (legacy fallback)
      STRIPE_PRO_PRICE_ID_MONTHLY: 'price_pro_monthly_test',
      STRIPE_STUDIO_PRICE_ID_MONTHLY: 'price_studio_monthly_test',
    },
  },
});
