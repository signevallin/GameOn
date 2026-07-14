// lib/observability.ts
//
// Central error capture. Today it writes a structured log line (picked up by
// the host's log drain — Vercel, etc.) and, when ERROR_WEBHOOK_URL is set,
// forwards a compact alert to a webhook (Slack/Discord/generic incoming-webhook
// URLs all accept a { text } body). This is a lightweight baseline; swapping in
// Sentry later is a one-line change inside captureError.

type Context = Record<string, unknown>;

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(typeof error === 'string' ? error : JSON.stringify(error));
}

/** Report an error. Never throws — reporting must not break the request. */
export async function captureError(error: unknown, context: Context = {}): Promise<void> {
  const err = toError(error);

  const record = {
    level: 'error',
    message: err.message,
    stack: err.stack,
    at: new Date().toISOString(),
    ...context,
  };

  // Structured line for log-based search/alerting.
  // eslint-disable-next-line no-console
  console.error('[capture]', JSON.stringify(record));

  const url = process.env.ERROR_WEBHOOK_URL;
  if (!url) return;

  try {
    const where = context.route ? ` at \`${String(context.route)}\`` : '';
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `🔴 Rivalry error${where}: ${err.message}` }),
      // Don't let a slow webhook hang the request.
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Swallow — a failed alert must never surface to the user.
  }
}

/**
 * Wraps an API route handler so any thrown error is captured and turned into a
 * clean 500, instead of leaking a stack trace. Auth/validation code that
 * returns Responses directly is unaffected.
 */
export function withErrorCapture<A extends unknown[]>(
  route: string,
  handler: (...args: A) => Promise<Response>
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (error) {
      await captureError(error, { route });
      return Response.json({ error: 'Internal server error.' }, { status: 500 });
    }
  };
}
