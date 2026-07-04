// lib/env.ts
//
// Central place to read environment variables so a missing required var fails
// with a clear message at the point of use, instead of a cryptic
// "Cannot read properties of undefined" deep inside a request handler.
//
// Import `requireEnv` in server code instead of `process.env.X!`.

/** Required server-side vars. Throws a descriptive error if unset. */
export function requireEnv(name: RequiredEnvVar): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in your deployment env (see .env.example).`
    );
  }
  return value;
}

/** Optional vars — returns undefined when unset (feature simply disabled). */
export function optionalEnv(name: OptionalEnvVar): string | undefined {
  return process.env[name] || undefined;
}

export type RequiredEnvVar =
  | 'NEXT_PUBLIC_SUPABASE_URL'
  | 'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  | 'SUPABASE_SERVICE_ROLE_KEY';

export type OptionalEnvVar =
  | 'ANTHROPIC_API_KEY'
  | 'GOOGLE_TRANSLATE_API_KEY'
  | 'RESEND_API_KEY'
  | 'STRIPE_SECRET_KEY'
  | 'STRIPE_WEBHOOK_SECRET'
  | 'STRIPE_PRO_PRICE_ID'
  | 'STRIPE_STUDIO_PRICE_ID'
  | 'NEXT_PUBLIC_BASE_URL';

/**
 * The core vars the app cannot run without. Call once at startup (e.g. from an
 * instrumentation hook) to fail fast on a misconfigured deployment.
 */
export const CORE_REQUIRED_VARS: RequiredEnvVar[] = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];

export function assertCoreEnv(): void {
  const missing = CORE_REQUIRED_VARS.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        `The app cannot start. See .env.example.`
    );
  }
}
