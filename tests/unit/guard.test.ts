import { describe, expect, it } from 'vitest';
import type { VercelRequest } from '@vercel/node';
import { COOKIE_NAME } from '../../api/_lib/auth-helpers';
import { requireAuth, roleHas } from '../../api/_lib/guard';

const requestWithCookie = (cookie?: string) =>
  ({ method: 'GET', headers: cookie ? { cookie } : {} }) as unknown as VercelRequest;

const dbReturning = (rows: unknown[]) => (() => Promise.resolve(rows)) as any;

const sessionUserRow = {
  id: 'u1',
  name: 'Demo Officer',
  email: 'demo@haryanapolice.gov.in',
  role: 'investigator',
};

describe('requireAuth', () => {
  it('returns 401 without a session cookie', async () => {
    const result = await requireAuth(requestWithCookie(), dbReturning([sessionUserRow]));
    expect(result).toEqual({ ok: false, status: 401, error: 'Authentication required' });
  });

  it('returns 401 when the session token is unknown or expired', async () => {
    const result = await requireAuth(requestWithCookie(`${COOKIE_NAME}=gone`), dbReturning([]));
    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  it('returns the user when authenticated and permitted', async () => {
    const result = await requireAuth(
      requestWithCookie(`${COOKIE_NAME}=tok123`),
      dbReturning([sessionUserRow]),
      { permission: 'cases.view' },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.id).toBe('u1');
      expect(result.user.role).toBe('investigator');
    }
  });

  it('returns 403 when the role lacks the required permission', async () => {
    const result = await requireAuth(
      requestWithCookie(`${COOKIE_NAME}=tok123`),
      dbReturning([{ ...sessionUserRow, role: 'read_only' }]),
      { permission: 'cases.edit' },
    );
    expect(result).toEqual({ ok: false, status: 403, error: 'Missing required permission: cases.edit' });
  });
});

describe('roleHas permission matrix (spec §22 least privilege)', () => {
  it('read_only can view but never mutate', () => {
    expect(roleHas('read_only', 'dashboard.view')).toBe(true);
    expect(roleHas('read_only', 'search.execute')).toBe(true);
    expect(roleHas('read_only', 'cases.edit')).toBe(false);
    expect(roleHas('read_only', 'evidence.edit')).toBe(false);
    expect(roleHas('read_only', 'users.manage')).toBe(false);
  });

  it('investigator manages cases/evidence but cannot read audit logs or manage users', () => {
    expect(roleHas('investigator', 'cases.edit')).toBe(true);
    expect(roleHas('investigator', 'evidence.edit')).toBe(true);
    expect(roleHas('investigator', 'alerts.manage')).toBe(true);
    expect(roleHas('investigator', 'audit.view')).toBe(false);
    expect(roleHas('investigator', 'users.manage')).toBe(false);
  });

  it('supervisor gains audit.view; only admin tier gains users.manage', () => {
    expect(roleHas('supervisor', 'audit.view')).toBe(true);
    expect(roleHas('supervisor', 'users.manage')).toBe(false);
    expect(roleHas('admin', 'audit.view')).toBe(true);
    expect(roleHas('admin', 'users.manage')).toBe(true);
    expect(roleHas('super_admin', 'users.manage')).toBe(true);
  });

  it('degrades unknown or missing roles to read_only (deny by default)', () => {
    expect(roleHas('banana', 'dashboard.view')).toBe(true);
    expect(roleHas('banana', 'cases.edit')).toBe(false);
    expect(roleHas(null, 'search.execute')).toBe(true);
    expect(roleHas(undefined, 'cases.edit')).toBe(false);
  });
});
