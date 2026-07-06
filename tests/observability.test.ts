import { describe, it, expect } from 'vitest';
import { withErrorCapture } from '@/lib/observability';

// ERROR_WEBHOOK_URL is unset in tests, so captureError only logs (no network).
describe('withErrorCapture', () => {
  it('passes through the handler response on success', async () => {
    const handler = withErrorCapture('/api/test', async () =>
      Response.json({ ok: true }, { status: 200 })
    );
    const res = await handler();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('turns a thrown error into a clean 500 instead of propagating', async () => {
    const handler = withErrorCapture('/api/test', async () => {
      throw new Error('boom');
    });
    const res = await handler();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Internal server error.' });
  });

  it('forwards arguments to the wrapped handler', async () => {
    const handler = withErrorCapture('/api/test', async (n: number) =>
      Response.json({ doubled: n * 2 })
    );
    const res = await handler(21);
    expect(await res.json()).toEqual({ doubled: 42 });
  });
});
