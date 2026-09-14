import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { requireDatabase } from './db.js';

export const COOKIE_NAME = 'hp_osint_session';
export const SESSION_DAYS = 30;

export const DEFAULT_PROFILE = {
  id: 'user_001',
  name: 'Inspector Vikram Singh',
  email: 'vikram.singh@haryanapolice.gov.in',
  badgeNumber: 'HP-2024-0087',
  phone: '',
  role: 'investigator' as const,
  department: 'Criminal Investigation Department',
  rank: 'Inspector',
};

/** Role -> permission tiers (spec §22). Least privilege: unknown roles fall back to read_only. */
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  read_only: [
    'dashboard.view', 'search.execute', 'profile.view', 'graph.view',
    'alerts.view', 'cases.view', 'evidence.view',
  ],
  analyst: [
    'dashboard.view', 'search.execute', 'profile.view', 'profile.edit', 'graph.view', 'graph.edit',
    'alerts.view', 'cases.view', 'cases.edit', 'evidence.view', 'evidence.edit',
    'reports.generate', 'darkweb.view',
  ],
  investigator: [
    'dashboard.view', 'search.execute', 'profile.view', 'profile.edit', 'graph.view', 'graph.edit',
    'alerts.view', 'alerts.manage', 'cases.view', 'cases.edit', 'evidence.view', 'evidence.edit',
    'reports.generate', 'reports.export', 'darkweb.view',
  ],
  supervisor: [
    'dashboard.view', 'search.execute', 'profile.view', 'profile.edit', 'graph.view', 'graph.edit',
    'alerts.view', 'alerts.manage', 'cases.view', 'cases.edit', 'evidence.view', 'evidence.edit',
    'reports.generate', 'reports.export', 'darkweb.view', 'audit.view',
  ],
  admin: [
    'dashboard.view', 'search.execute', 'profile.view', 'profile.edit', 'graph.view', 'graph.edit',
    'alerts.view', 'alerts.manage', 'cases.view', 'cases.edit', 'evidence.view', 'evidence.edit',
    'reports.generate', 'reports.export', 'darkweb.view', 'audit.view',
    'settings.manage', 'users.manage',
  ],
  super_admin: [
    'dashboard.view', 'search.execute', 'profile.view', 'profile.edit', 'graph.view', 'graph.edit',
    'alerts.view', 'alerts.manage', 'cases.view', 'cases.edit', 'evidence.view', 'evidence.edit',
    'reports.generate', 'reports.export', 'darkweb.view', 'audit.view',
    'settings.manage', 'users.manage',
  ],
};

export function normalizeRole(role: unknown): string {
  const value = String(role ?? '').trim().toLowerCase();
  return ROLE_PERMISSIONS[value] ? value : 'read_only';
}

export function toUser(row: any) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    username: row.username ?? undefined,
    badgeNumber: row.badgeNumber ?? row.badge_number ?? 'HP-2024-0087',
    phone: row.phone ?? '',
    role: normalizeRole(row.role),
    department: row.department ?? undefined,
    rank: row.rank ?? undefined,
    lastLogin: row.lastLogin ? new Date(row.lastLogin).toISOString() : new Date().toISOString(),
    permissions: ROLE_PERMISSIONS[normalizeRole(row.role)],
  };
}

export const defaultUser = () => toUser({ ...DEFAULT_PROFILE });

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string | null | undefined) {
  if (!password || !stored) return false;
  const [salt, hex] = String(stored).split(':');
  if (!salt || !hex) return false;
  const expected = Buffer.from(hex, 'hex');
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function parseCookies(header: string | undefined) {
  const found: Record<string, string> = {};
  if (!header) return found;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    found[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return found;
}

export function setSessionCookie(request: VercelRequest, response: VercelResponse, token: string, maxAgeSeconds: number) {
  const secure = (request.headers['x-forwarded-proto'] ?? 'http') === 'https';
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (secure) parts.push('Secure');
  response.setHeader('Set-Cookie', parts.join('; '));
}

export async function activeUser(request: VercelRequest, database: ReturnType<typeof requireDatabase>) {
  const token = parseCookies(request.headers.cookie)[COOKIE_NAME];
  if (!token) return null;
  const rows = await database`
    SELECT u.id, u.email, u.name, u.username, u.role, u.department, u.rank,
           u.phone, u.badge_number AS "badgeNumber", u.last_login AS "lastLogin"
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ${token} AND s.expires_at > NOW()
    LIMIT 1
  `;
  return rows[0] ? toUser(rows[0]) : null;
}

export async function hasCredentials(database: ReturnType<typeof requireDatabase>) {
  const rows = await database`
    SELECT COUNT(*)::int AS count FROM users
    WHERE username IS NOT NULL AND password_hash IS NOT NULL
  `;
  return (rows[0]?.count ?? 0) > 0;
}

export async function createSession(database: ReturnType<typeof requireDatabase>, request: VercelRequest, response: VercelResponse, userId: string) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await database`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (${token}, ${userId}, ${expiresAt.toISOString()})
  `;
  setSessionCookie(request, response, token, SESSION_DAYS * 24 * 60 * 60);
  return token;
}