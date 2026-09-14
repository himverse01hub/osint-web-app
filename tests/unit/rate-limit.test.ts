import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rateLimit, resetRateLimits } from '../../api/_lib/rate-limit';

describe('rateLimit', () => {
  beforeEach(() => {
    resetRateLimits();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests up to the limit and reports remaining', () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const result = rateLimit('key', { limit: 5, windowMs: 60_000 });
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4 - attempt);
      expect(result.retryAfterSec).toBe(0);
    }
  });

  it('blocks beyond the limit with a retry-after hint', () => {
    for (let attempt = 0; attempt < 5; attempt++) rateLimit('key', { limit: 5, windowMs: 60_000 });
    const blocked = rateLimit('key', { limit: 5, windowMs: 60_000 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(blocked.retryAfterSec).toBeLessThanOrEqual(60);
  });

  it('keeps keys isolated from each other', () => {
    for (let attempt = 0; attempt < 10; attempt++) rateLimit('user-a', { limit: 10, windowMs: 60_000 });
    expect(rateLimit('user-a', { limit: 10, windowMs: 60_000 }).allowed).toBe(false);
    expect(rateLimit('user-b', { limit: 10, windowMs: 60_000 }).allowed).toBe(true);
  });

  it('resets once the window elapses', () => {
    for (let attempt = 0; attempt < 3; attempt++) rateLimit('key', { limit: 3, windowMs: 60_000 });
    expect(rateLimit('key', { limit: 3, windowMs: 60_000 }).allowed).toBe(false);
    vi.advanceTimersByTime(60_001);
    const fresh = rateLimit('key', { limit: 3, windowMs: 60_000 });
    expect(fresh.allowed).toBe(true);
    expect(fresh.remaining).toBe(2);
  });
});
