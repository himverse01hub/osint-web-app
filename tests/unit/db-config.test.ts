import { describe, expect, it } from 'vitest';
import { isDatabaseConfigured, requireDatabase } from '../../api/_lib/db';

/**
 * db.ts reads DATABASE_URL at module load and never throws on import —
 * only requireDatabase() guards access. Tests adapt to whichever state
 * the environment is in (CI runs without DATABASE_URL).
 */
describe('db configuration guard', () => {
  it('exposes a boolean configured flag', () => {
    expect(typeof isDatabaseConfigured).toBe('boolean');
  });

  it('refuses to hand out a client when DATABASE_URL is missing', () => {
    if (isDatabaseConfigured) return; // environment has credentials: nothing to prove
    expect(() => requireDatabase()).toThrow('DATABASE_URL is not configured');
  });

  it('returns a callable tagged-template client when configured', () => {
    if (!isDatabaseConfigured) return; // CI path: covered by the guard test above
    expect(typeof requireDatabase()).toBe('function');
  });
});