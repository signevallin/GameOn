// lib/rate-limit.ts
//
// Fixed-window rate limiting with two backends:
//
// 1. **Upstash Redis (REST)** — used automatically when UPSTASH_REDIS_REST_URL
//    and UPSTASH_REDIS_REST_TOKEN are set. Gives a strict *global* limit across
//    all serverless instances. No SDK needed — one pipelined REST call.
// 2. **In-memory** — fallback when Upstash isn't configured (or errors). State
//    is per-instance, so on serverless it's a best-effort throttle only.
//
// Redis failures fail OPEN (request allowed): availability of the product
// beats strictness of the limiter.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Opportunistic cleanup so the map doesn't grow unbounded on a long-lived
// instance. Runs at most once per minute, on access.
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/** In-memory fixed window (exported for tests; call sites use checkRateLimit). */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return { ok: false, remaining: 0, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
  }
  return { ok: true, remaining: limit - existing.count, retryAfterSeconds: 0 };
}

/**
 * Upstash-backed fixed window: INCR the key and set its expiry on first hit,
 * in one pipelined request. Exported for tests (fetch injectable).
 * Returns null when the request fails — the caller falls back to in-memory.
 */
export async function upstashRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  fetchImpl: typeof fetch = fetch
): Promise<RateLimitResult | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const res = await fetchImpl(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['INCR', `rl:${key}`],
        ['PEXPIRE', `rl:${key}`, String(windowMs), 'NX'],
        ['PTTL', `rl:${key}`],
      ]),
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;

    const results = (await res.json()) as Array<{ result?: unknown; error?: string }>;
    const count = Number(results[0]?.result);
    const ttlMs = Number(results[2]?.result);
    if (!Number.isFinite(count)) return null;

    if (count > limit) {
      const retryAfterSeconds = Number.isFinite(ttlMs) && ttlMs > 0 ? Math.ceil(ttlMs / 1000) : Math.ceil(windowMs / 1000);
      return { ok: false, remaining: 0, retryAfterSeconds };
    }
    return { ok: true, remaining: limit - count, retryAfterSeconds: 0 };
  } catch {
    return null;
  }
}

/**
 * The rate limiter call sites use: strict global limit via Upstash when
 * configured, per-instance in-memory otherwise (and as fail-open fallback).
 */
export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const global = await upstashRateLimit(key, limit, windowMs);
  if (global) return global;
  return rateLimit(key, limit, windowMs);
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

/** Builds a 429 JSON response with a Retry-After header. */
export function tooManyRequests(retryAfterSeconds: number): Response {
  return Response.json(
    { error: 'Too many requests. Please slow down and try again shortly.' },
    { status: 429, headers: { 'Retry-After': String(Math.max(1, retryAfterSeconds)) } }
  );
}
