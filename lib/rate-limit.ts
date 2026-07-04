// lib/rate-limit.ts
//
// Lightweight fixed-window rate limiter with no external dependencies.
//
// NOTE: state lives in-process, so on a multi-instance/serverless deployment
// each instance keeps its own counters — this is a best-effort throttle that
// blunts brute-force and runaway-spend abuse, not a hard global guarantee. For
// a strict global limit, back this with Upstash Redis (@upstash/ratelimit) and
// keep the same call sites.

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

/**
 * Records a hit for `key` and reports whether it is within `limit` per
 * `windowMs`. Call once per request you want to count.
 */
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
