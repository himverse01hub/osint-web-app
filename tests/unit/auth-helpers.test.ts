import { describe, expect, it } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  COOKIE_NAME,
  SESSION_DAYS,
  DEFAULT_PROFILE,
  toUser,
  defaultUser,
  hashPassword,
  verifyPassword,
  parseCookies,
  setSessionCookie,
  activeUser,
  hasCredentials,
  createSession,
} from '../../api/_lib/auth-helpers';
import type { requireDatabase } from '../../api/_lib/db';

type Db = ReturnType<typeof requireDatabase>;

/** Minimal request/response stubs — auth-helpers only touches these surfaces. */
const fakeRequest = (headers: Record<string, string> = {}) =>
  ({ headers }) as unknown as VercelRequest;

const fakeResponse = () => {
  const store: Record<string, unknown> = {};
  return {
    store,
    response: {
      setHeader: (name: string, value: unknown) => {
        store[name] = value;
      },
    } as unknown as VercelResponse,
  };
};

/** The database parameter is an injected tagged-template function — stub it. */
const dbReturning = (rows: unknown[]) => (async () => rows) as unknown as Db;

describe('hashPassword / verifyPassword (scrypt, timing-safe)', () => {
  it('round-trips a correct password', () => {
    const stored = hashPassword('Haryana@2026');
    expect(stored).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    expect(verifyPassword('Haryana@2026', stored)).toBe(true);
  });

  it('rejects wrong passwords without throwing', () => {
    const stored = hashPassword('Haryana@2026');
    expect(verifyPassword('haryana@2026', stored)).toBe(false);
    expect(verifyPassword('', stored)).toBe(false);
    expect(verifyPassword('Haryana@2026', null)).toBe(false);
    expect(verifyPassword('Haryana@2026', undefined)).toBe(false);
  });

  it('rejects malformed or corrupted stored hashes', () => {
    expect(verifyPassword('pw', 'no-colon-part')).toBe(false);
    expect(verifyPassword('pw', ':')).toBe(false);
    expect(verifyPassword('pw', 'abcd1234:zz-not-hex')).toBe(false);
    expect(verifyPassword('pw', 'abcd1234:00')).toBe(false);
  });

  it('salts every hash uniquely', () => {
    const a = hashPassword('same-password');
    const b = hashPassword('same-password');
    expect(a).not.toBe(b);
    expect(verifyPassword('same-password', a)).toBe(true);
    expect(verifyPassword('same-password', b)).toBe(true);
  });
});

describe('parseCookies', () => {
  it('parses multiple cookies and decodes URI components', () => {
    expect(parseCookies('a=1; hp_osint_session=tok%2F123')).toEqual({
      a: '1',
      hp_osint_session: 'tok/123',
    });
  });

  it('trims whitespace around names and values', () => {
    expect(parseCookies('  hp_osint_session = abc ; x=1 ')).toEqual({
      hp_osint_session: 'abc',
      x: '1',
    });
  });

  it('returns an empty object for missing or malformed headers', () => {
    expect(parseCookies(undefined)).toEqual({});
    expect(parseCookies('')).toEqual({});
    expect(parseCookies('novalue')).toEqual({});
  });
});

describe('toUser (DB row → API user)', () => {
  it('maps snake_case columns and applies defaults', () => {
    const user = toUser({
      id: 'u1',
      name: 'Demo Officer',
      email: 'demo@haryanapolice.gov.in',
      username: null,
      badge_number: 'HP-1',
      role: null,
      lastLogin: '2026-09-01T10:00:00Z',
    });
    expect(user).toMatchObject({
      id: 'u1',
      badgeNumber: 'HP-1',
      role: 'investigator',
      phone: '',
      username: undefined,
      lastLogin: '2026-09-01T10:00:00.000Z',
    });
    expect(user.permissions).toContain('search.execute');
    expect(user.permissions).toContain('audit.view');
  });

  it('prefers camelCase badgeNumber and falls back to the service default', () => {
    expect(toUser({ id: 'u2', name: 'x', email: 'x@y.z', badgeNumber: 'HP-2' }).badgeNumber).toBe('HP-2');
    expect(toUser({ id: 'u3', name: 'x', email: 'x@y.z' }).badgeNumber).toBe('HP-2024-0087');
  });

  it('falls back to a valid recent ISO lastLogin when the row has none', () => {
    const user = toUser({ id: 'u4', name: 'x', email: 'x@y.z' });
    expect(Number.isNaN(new Date(user.lastLogin).getTime())).toBe(false);
  });

  it('defaultUser mirrors the seeded demo profile', () => {
    const user = defaultUser();
    expect(user.id).toBe(DEFAULT_PROFILE.id);
    expect(user.role).toBe('investigator');
    expect(user.badgeNumber).toBe('HP-2024-0087');
  });
});

describe('setSessionCookie (HttpOnly, SameSite, conditional Secure)', () => {
  it('marks the cookie Secure behind HTTPS and encodes the token', () => {
    const { response, store } = fakeResponse();
    setSessionCookie(fakeRequest({ 'x-forwarded-proto': 'https' }), response, 'tok en/1', 60);
    const cookie = store['Set-Cookie'] as string;
    expect(cookie).toBe(`${COOKIE_NAME}=tok%20en%2F1; Path=/; HttpOnly; SameSite=Lax; Max-Age=60; Secure`);
  });

  it('omits Secure on plain HTTP', () => {
    const { response, store } = fakeResponse();
    setSessionCookie(fakeRequest({}), response, 'tok', 60);
    const cookie = store['Set-Cookie'] as string;
    expect(cookie).toContain('HttpOnly');
    expect(cookie).not.toContain('Secure');
  });

  it('uses the 30-day session lifetime constant', () => {
    expect(SESSION_DAYS).toBe(30);
    expect(SESSION_DAYS * 24 * 60 * 60).toBe(2_592_000);
  });
});

describe('activeUser / hasCredentials / createSession (mocked database)', () => {
  it('resolves the session user via cookie token', async () => {
    const request = fakeRequest({ cookie: `${COOKIE_NAME}=tok123` });
    const user = await activeUser(request, dbReturning([
      { id: 'u1', name: 'Demo Officer', email: 'demo@haryanapolice.gov.in', role: 'investigator' },
    ]));
    expect(user?.id).toBe('u1');
    expect(user?.permissions.length).toBeGreaterThan(0);
  });

  it('returns null without a session cookie or when the session is gone', async () => {
    expect(await activeUser(fakeRequest({}), dbReturning([{ id: 'u1' }]))).toBeNull();
    expect(
      await activeUser(fakeRequest({ cookie: `${COOKIE_NAME}=tok123` }), dbReturning([])),
    ).toBeNull();
  });

  it('hasCredentials reflects whether any usable login exists', async () => {
    expect(await hasCredentials(dbReturning([{ count: 2 }]))).toBe(true);
    expect(await hasCredentials(dbReturning([{ count: 0 }]))).toBe(false);
    expect(await hasCredentials(dbReturning([]))).toBe(false);
  });

  it('createSession mints a 64-hex token and sets the long-lived cookie', async () => {
    const { response, store } = fakeResponse();
    const token = await createSession(
      dbReturning([]),
      fakeRequest({ 'x-forwarded-proto': 'https' }),
      response,
      'u1',
    );
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    const cookie = store['Set-Cookie'] as string;
    expect(cookie).toContain(`${COOKIE_NAME}=${token}`);
    expect(cookie).toContain(`Max-Age=${SESSION_DAYS * 24 * 60 * 60}`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
  });
});