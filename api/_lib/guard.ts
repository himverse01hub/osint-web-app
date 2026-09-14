import type { VercelRequest } from '@vercel/node';
import { activeUser, normalizeRole, ROLE_PERMISSIONS } from './auth-helpers.js';
import type { requireDatabase } from './db.js';

export type AuthUser = NonNullable<Awaited<ReturnType<typeof activeUser>>>;

export type GuardResult =
  | { ok: true; user: AuthUser }
  | { ok: false; status: 401 | 403; error: string };

/**
 * Authenticates the caller via session cookie and enforces the optional
 * role-based permission (spec §22 RBAC, least privilege). Unknown or legacy
 * roles degrade to read_only (deny by default).
 */
export async function requireAuth(
  request: VercelRequest,
  database: ReturnType<typeof requireDatabase>,
  options: { permission?: string } = {},
): Promise<GuardResult> {
  const user = await activeUser(request, database);
  if (!user) return { ok: false, status: 401, error: 'Authentication required' };
  if (options.permission && !roleHas(user.role, options.permission)) {
    return { ok: false, status: 403, error: `Missing required permission: ${options.permission}` };
  }
  return { ok: true, user };
}

export function roleHas(role: unknown, permission: string): boolean {
  const permissions = ROLE_PERMISSIONS[normalizeRole(role)] ?? [];
  return permissions.includes(permission);
}
