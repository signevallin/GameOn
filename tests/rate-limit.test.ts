import { describe, it, expect, vi, afterEach } from 'vitest';
import { rateLimit, upstashRateLimit, checkRateLimit, clientIp, tooManyRequests } from '@/lib/rate-limit';

afterEach(() => {
  vi.useRealTimers();
});

describe('rateLimit', () => {
  it('allows requests up to the limit, then blocks', () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      expect(rateLimit(key, 3, 60_000).ok).toBe(true);
    }
    const blocked = rateLimit(key, 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('reports the remaining budget', () => {
    const key = `test-${Math.random()}`;
    expect(rateLimit(key, 2, 60_000).remaining).toBe(1);
    expect(rateLimit(key, 2, 60_000).remaining).toBe(0);
  });

  it('resets after the window elapses', () => {
    vi.useFakeTimers();
    const key = `test-${Math.random()}`;
    expect(rateLimit(key, 1, 1_000).ok).toBe(true);
    expect(rateLimit(key, 1, 1_000).ok).toBe(false);
    vi.advanceTimersByTime(1_001);
    expect(rateLimit(key, 1, 1_000).ok).toBe(true);
  });

  it('tracks keys independently', () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    expect(rateLimit(a, 1, 60_000).ok).toBe(true);
    expect(rateLimit(a, 1, 60_000).ok).toBe(false);
    expect(rateLimit(b, 1, 60_000).ok).toBe(true);
  });
});

describe('upstashRateLimit', () => {
  const env = { UPSTASH_REDIS_REST_URL: 'https://redis.test', UPSTASH_REDIS_REST_TOKEN: 'tok' };

  function withEnv<T>(fn: () => T): T {
    const prev = { url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN };
    process.env.UPSTASH_REDIS_REST_URL = env.UPSTASH_REDIS_REST_URL;
    process.env.UPSTASH_REDIS_REST_TOKEN = env.UPSTASH_REDIS_REST_TOKEN;
    try { return fn(); } finally {
      if (prev.url === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
      else process.env.UPSTASH_REDIS_REST_URL = prev.url;
      if (prev.token === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
      else process.env.UPSTASH_REDIS_REST_TOKEN = prev.token;
    }
  }

  function redisResponse(count: number, ttlMs: number) {
    return new Response(JSON.stringify([{ result: count }, { result: 1 }, { result: ttlMs }]), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }

  it('returns null when Upstash is not configured', async () => {
    expect(await upstashRateLimit('k', 5, 1000, vi.fn())).toBeNull();
  });

  it('allows requests under the limit', async () => {
    await withEnv(async () => {
      const fetchMock = vi.fn().mockResolvedValue(redisResponse(3, 800));
      const res = await upstashRateLimit('k', 5, 1000, fetchMock);
      expect(res).toEqual({ ok: true, remaining: 2, retryAfterSeconds: 0 });
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe('https://redis.test/pipeline');
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body[0]).toEqual(['INCR', 'rl:k']);
    });
  });

  it('blocks over the limit with Retry-After from the key TTL', async () => {
    await withEnv(async () => {
      const fetchMock = vi.fn().mockResolvedValue(redisResponse(6, 2400));
      const res = await upstashRateLimit('k', 5, 60_000, fetchMock);
      expect(res).toEqual({ ok: false, remaining: 0, retryAfterSeconds: 3 });
    });
  });

  it('fails open (null) on network errors and non-200s', async () => {
    await withEnv(async () => {
      expect(await upstashRateLimit('k', 5, 1000, vi.fn().mockRejectedValue(new Error('down')))).toBeNull();
      expect(await upstashRateLimit('k', 5, 1000, vi.fn().mockResolvedValue(new Response('x', { status: 500 })))).toBeNull();
    });
  });
});

describe('checkRateLimit', () => {
  it('falls back to the in-memory limiter when Upstash is unavailable', async () => {
    const key = `fallback-${Math.random()}`;
    expect((await checkRateLimit(key, 1, 60_000)).ok).toBe(true);
    expect((await checkRateLimit(key, 1, 60_000)).ok).toBe(false);
  });
});

describe('clientIp', () => {
  it('uses the first x-forwarded-for entry', () => {
    const req = new Request('https://x.test', {
      headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' },
    });
    expect(clientIp(req)).toBe('203.0.113.7');
  });

  it('falls back to x-real-ip', () => {
    const req = new Request('https://x.test', { headers: { 'x-real-ip': '198.51.100.2' } });
    expect(clientIp(req)).toBe('198.51.100.2');
  });

  it('returns "unknown" when no ip header is present', () => {
    expect(clientIp(new Request('https://x.test'))).toBe('unknown');
  });
});

describe('tooManyRequests', () => {
  it('returns a 429 with a Retry-After header', () => {
    const res = tooManyRequests(12);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('12');
  });

  it('clamps Retry-After to at least 1 second', () => {
    expect(tooManyRequests(0).headers.get('Retry-After')).toBe('1');
  });
});
