import { describe, it, expect, vi, afterEach } from 'vitest';
import { rateLimit, clientIp, tooManyRequests } from '@/lib/rate-limit';

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
