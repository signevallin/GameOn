// instrumentation.ts
// Runs once when the server process starts. We use it to fail fast with a clear
// message when core environment variables are missing, rather than surfacing
// opaque runtime errors on the first request.

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { assertCoreEnv } = await import('./lib/env');
    assertCoreEnv();
  }
}
