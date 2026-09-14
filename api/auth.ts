import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes, randomUUID } from 'node:crypto';
import { requireDatabase } from './_lib/db.js';
import { rateLimit } from './_lib/rate-limit.js';
import { generateSecret, otpauthUri, verifyTotp } from './_lib/totp.js';
import {
  DEFAULT_PROFILE,
  activeUser,
  createSession,
  defaultUser,
  hasCredentials,
  hashPassword,
  parseCookies,
  setSessionCookie,
  toUser,
  verifyPassword,
  COOKIE_NAME,
} from './_lib/auth-helpers.js';

const USER_COLUMNS = `
  SELECT id, email, name, username, role, department, rank, phone,
         badge_number AS "badgeNumber", created_at AS "createdAt", last_login AS "lastLogin"
  FROM users
`;

const USER_ROLES = ['admin', 'investigator', 'analyst', 'supervisor'];

const cleanText = (value: unknown) => String(value ?? '').trim();

/** Best-effort audit trail for MFA lifecycle events (spec §23). */
const auditMfa = (database: any, userId: string, action: string) =>
  database`
    INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, metadata)
    VALUES (${randomUUID()}, ${userId}, ${action}, 'user', ${userId}, '{"mfa": true}'::jsonb)
  `.catch(() => undefined);

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    const database = requireDatabase();
    const url = request.url?.split('?')[0] ?? '';
    const method = (request.method ?? 'GET').toUpperCase();
    const username = String(request.body?.username ?? '').trim();
    const password = String(request.body?.password ?? '');

    if (url.endsWith('/me') || url.endsWith('/auth')) {
      if (url.endsWith('/auth') && method === 'POST') {
        return login();
      }
      const user = await activeUser(request, database);
      if (user) return response.status(200).json({ user, needsSetup: false });
      const setup = await hasCredentials(database);
      if (!setup) return response.status(200).json({ user: defaultUser(), needsSetup: true });
      return response.status(401).json({ error: 'Not authenticated' });
    }

    if (url.endsWith('/login') && method === 'POST') {
      return login();
    }

    if (url.endsWith('/logout')) {
      const token = parseCookies(request.headers.cookie)[COOKIE_NAME];
      if (token) {
        await database`DELETE FROM sessions WHERE token = ${token}`.catch(() => undefined);
      }
      setSessionCookie(request, response, 'deleted', 0);
      return response.status(200).json({ success: true });
    }

    // Unauthenticated: exchanges a short-lived challenge (from login) + TOTP
    // code for a real session. Challenges are single-use and expire in 5 min.
    if (url.endsWith('/mfa/verify') && method === 'POST') {
      const challengeToken = String(request.body?.challengeToken ?? '').trim();
      const code = String(request.body?.totp ?? '').trim();
      if (!challengeToken || !code) {
        return response.status(400).json({ error: 'challengeToken and totp are required' });
      }
      const ip = String(request.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || 'unknown';
      const gate = rateLimit(`mfa:${ip}`, { limit: 10, windowMs: 60_000 });
      if (!gate.allowed) {
        response.setHeader('Retry-After', String(gate.retryAfterSec));
        return response.status(429).json({ error: 'Too many verification attempts. Please try again shortly.' });
      }
      const challenges = await database`
        SELECT user_id AS "userId", expires_at AS "expiresAt"
        FROM mfa_challenges WHERE token = ${challengeToken} LIMIT 1
      `;
      // Single-use: consume the challenge regardless of the verification result.
      await database`DELETE FROM mfa_challenges WHERE token = ${challengeToken}`.catch(() => undefined);
      const challenge = challenges[0];
      if (!challenge || new Date(challenge.expiresAt).getTime() <= Date.now()) {
        return response.status(401).json({ error: 'MFA challenge expired. Please sign in again.' });
      }
      const rows = await database`
        SELECT id, email, name, username, role, department, rank, phone,
               badge_number AS "badgeNumber", mfa_enabled AS "mfaEnabled",
               mfa_secret AS "mfaSecret", created_at AS "createdAt", last_login AS "lastLogin"
        FROM users WHERE id = ${challenge.userId} LIMIT 1
      `;
      const userRow = rows[0];
      if (!userRow || !userRow.mfaEnabled || !verifyTotp(userRow.mfaSecret ?? '', code)) {
        void auditMfa(database, challenge.userId, 'MFA_LOGIN_FAILED').catch(() => undefined);
        return response.status(401).json({ error: 'Invalid verification code' });
      }
      await database`UPDATE users SET last_login = NOW() WHERE id = ${userRow.id}`.catch(() => undefined);
      await createSession(database, request, response, userRow.id);
      void auditMfa(database, userRow.id, 'MFA_LOGIN_SUCCESS');
      return response.status(200).json({ user: toUser(userRow) });
    }

    if (url.endsWith('/mfa')) {
      const current = await activeUser(request, database);
      if (!current) return response.status(401).json({ error: 'Not authenticated' });

      if (method === 'GET') {
        const rows = await database`SELECT mfa_enabled AS "mfaEnabled" FROM users WHERE id = ${current.id} LIMIT 1`;
        return response.status(200).json({ mfaEnabled: Boolean(rows[0]?.mfaEnabled) });
      }

      if (method === 'POST') {
        const action = String(request.body?.action ?? '').trim();
        const code = String(request.body?.totp ?? '').trim();
        const rows = await database`
          SELECT username, mfa_enabled AS "mfaEnabled", mfa_secret AS "mfaSecret"
          FROM users WHERE id = ${current.id} LIMIT 1
        `;
        const row = rows[0];
        if (!row) return response.status(404).json({ error: 'User not found' });

        if (action === 'setup') {
          const secret = generateSecret();
          await database`
            UPDATE users SET mfa_secret = ${secret}, mfa_enabled = false, mfa_enrolled_at = NULL
            WHERE id = ${current.id}
          `;
          return response.status(200).json({ secret, otpauthUri: otpauthUri(secret, row.username || current.id) });
        }

        if (action === 'enable') {
          if (!row.mfaSecret) return response.status(400).json({ error: 'Run setup first to generate a secret' });
          if (row.mfaEnabled) return response.status(400).json({ error: 'MFA is already enabled' });
          if (!verifyTotp(row.mfaSecret, code)) {
            return response.status(400).json({ error: 'Invalid verification code — check your authenticator and try again' });
          }
          await database`UPDATE users SET mfa_enabled = true, mfa_enrolled_at = NOW() WHERE id = ${current.id}`;
          void auditMfa(database, current.id, 'MFA_ENABLED');
          return response.status(200).json({ mfaEnabled: true });
        }

        if (action === 'disable') {
          if (!row.mfaEnabled) return response.status(400).json({ error: 'MFA is not enabled' });
          if (!verifyTotp(row.mfaSecret ?? '', code)) {
            return response.status(400).json({ error: 'Invalid verification code' });
          }
          await database`
            UPDATE users SET mfa_enabled = false, mfa_secret = NULL, mfa_enrolled_at = NULL
            WHERE id = ${current.id}
          `;
          void auditMfa(database, current.id, 'MFA_DISABLED');
          return response.status(200).json({ mfaEnabled: false });
        }

        return response.status(400).json({ error: 'action must be setup, enable, or disable' });
      }

      return response.status(405).json({ error: 'Method not allowed' });
    }

    if (url.endsWith('/credentials') && method === 'POST') {
      if (username.length < 3) return response.status(400).json({ error: 'Username must be at least 3 characters' });
      if (password.length < 4) return response.status(400).json({ error: 'Password must be at least 4 characters' });

      const existing = await database`
        SELECT id, email, name, role, department, rank, phone, badge_number FROM users ORDER BY created_at ASC LIMIT 1
      `;
      const userRow = existing[0];
      const hash = hashPassword(password);

      if (userRow) {
        await database`
          UPDATE users SET username = ${username}, password_hash = ${hash} WHERE id = ${userRow.id}
        `;
      } else {
        const id = 'user_001';
        await database`
          INSERT INTO users (id, email, name, username, password_hash, role, department, rank)
          VALUES (${id}, ${DEFAULT_PROFILE.email}, ${DEFAULT_PROFILE.name}, ${username}, ${hash},
                  ${DEFAULT_PROFILE.role}, ${DEFAULT_PROFILE.department}, ${DEFAULT_PROFILE.rank})
        `.catch(() => undefined);
        await database`
          UPDATE users SET username = ${username}, password_hash = ${hash} WHERE id = ${id}
        `;
      }

      const userId = userRow ? userRow.id : 'user_001';
      await createSession(database, request, response, userId);

      const updated = await database`
        SELECT id, email, name, username, role, department, rank, phone, badge_number AS "badgeNumber", last_login AS "lastLogin"
        FROM users WHERE id = ${userId} LIMIT 1
      `;
      if (updated[0]) return response.status(200).json({ user: toUser(updated[0]), needsSetup: false });
      return response.status(200).json({ user: { ...defaultUser(), username }, needsSetup: false });
    }

    if (url.endsWith('/profile') && method === 'PATCH') {
      const current = await activeUser(request, database);
      if (!current) return response.status(401).json({ error: 'Not authenticated' });

      const name = cleanText(request.body?.name) || current.name;
      const email = cleanText(request.body?.email) || current.email;
      const department = cleanText(request.body?.department);
      const rank = cleanText(request.body?.rank);
      const phone = cleanText(request.body?.phone);
      const badgeNumber = cleanText(request.body?.badgeNumber);

      await database`
        UPDATE users
        SET name = ${name}, email = ${email}, department = ${department || null},
            rank = ${rank || null}, phone = ${phone || null}, badge_number = ${badgeNumber || null}
        WHERE id = ${current.id}
      `.catch(() => undefined);

      const updated = await database`${database.unsafe(USER_COLUMNS)} WHERE id = ${current.id} LIMIT 1`;
      return response.status(200).json({ user: updated[0] ? toUser(updated[0]) : current });
    }

    if (url.endsWith('/users')) {
      const bootstrap = !(await hasCredentials(database));
      const current = bootstrap ? null : await activeUser(request, database);
      if (!bootstrap && !current) return response.status(401).json({ error: 'Not authenticated' });
      if (bootstrap && method !== 'POST') return response.status(401).json({ error: 'Not authenticated' });
      const userId = cleanText(request.query.id);

      if (method === 'GET') {
        const rows = await database`${database.unsafe(USER_COLUMNS)} ORDER BY created_at ASC`;
        return response.status(200).json({ users: rows.map((row: any) => toUser(row)) });
      }

      if (method === 'POST') {
        const newUsername = cleanText(request.body?.username);
        const newPassword = String(request.body?.password ?? '');
        const name = cleanText(request.body?.name);
        const email = cleanText(request.body?.email) || `${newUsername || 'user'}@haryanapolice.local`;
        const role = USER_ROLES.includes(cleanText(request.body?.role)) ? cleanText(request.body?.role) : 'investigator';
        const department = cleanText(request.body?.department);
        const rank = cleanText(request.body?.rank);
        const phone = cleanText(request.body?.phone);
        const badgeNumber = cleanText(request.body?.badgeNumber);

        if (newUsername.length < 3) return response.status(400).json({ error: 'Username must be at least 3 characters' });
        if (newPassword.length < 4) return response.status(400).json({ error: 'Password must be at least 4 characters' });
        if (!name) return response.status(400).json({ error: 'Full name is required' });

        const id = `user_${randomBytes(6).toString('hex')}`;
        const hash = hashPassword(newPassword);
        try {
          await database`
            INSERT INTO users (id, email, name, username, password_hash, role, department, rank, phone, badge_number, last_login)
            VALUES (${id}, ${email}, ${name}, ${newUsername}, ${hash}, ${role}, ${department || null},
                    ${rank || null}, ${phone || null}, ${badgeNumber || null}, ${new Date().toISOString()})
          `;
        } catch (error: any) {
          if (error?.code === '23505') return response.status(409).json({ error: 'That username or email is already in use' });
          throw error;
        }
        const rows = await database`${database.unsafe(USER_COLUMNS)} WHERE id = ${id} LIMIT 1`;
        return response.status(201).json({ user: rows[0] ? toUser(rows[0]) : undefined });
      }

      if (method === 'PATCH') {
        if (!userId) return response.status(400).json({ error: 'User id is required' });
        const target = await database`${database.unsafe(USER_COLUMNS)} WHERE id = ${userId} LIMIT 1`;
        if (!target[0]) return response.status(404).json({ error: 'User not found' });

        const name = cleanText(request.body?.name) || target[0].name;
        const email = cleanText(request.body?.email) || target[0].email;
        const role = USER_ROLES.includes(cleanText(request.body?.role)) ? cleanText(request.body?.role) : target[0].role;
        const department = cleanText(request.body?.department);
        const rank = cleanText(request.body?.rank);
        const phone = cleanText(request.body?.phone);
        const badgeNumber = cleanText(request.body?.badgeNumber);
        const newPassword = String(request.body?.password ?? '');

        if (newPassword && newPassword.length < 4) return response.status(400).json({ error: 'Password must be at least 4 characters' });

        const hash = newPassword ? hashPassword(newPassword) : null;
        try {
          await database`
            UPDATE users
            SET name = ${name}, email = ${email}, role = ${role},
                department = ${department || null}, rank = ${rank || null},
                phone = ${phone || null}, badge_number = ${badgeNumber || null},
                password_hash = COALESCE(${hash}, password_hash)
            WHERE id = ${userId}
          `;
        } catch (error: any) {
          if (error?.code === '23505') return response.status(409).json({ error: 'That username or email is already in use' });
          throw error;
        }
        void database`
          DELETE FROM sessions WHERE user_id = ${userId} AND token <> ${parseCookies(request.headers.cookie)[COOKIE_NAME] ?? ''}
        `.catch(() => undefined);
        const rows = await database`${database.unsafe(USER_COLUMNS)} WHERE id = ${userId} LIMIT 1`;
        return response.status(200).json({ user: toUser(rows[0]) });
      }

      if (method === 'DELETE') {
        if (!userId) return response.status(400).json({ error: 'User id is required' });
        if (userId === current?.id && request.query.self !== '1') return response.status(400).json({ error: 'You cannot delete your own profile' });
        try {
          if (userId === current?.id) {
            await database`DELETE FROM sessions WHERE user_id = ${userId}`;
          }
          await database`DELETE FROM users WHERE id = ${userId}`;
        } catch (error: any) {
          if (error?.code === '23503') return response.status(400).json({ error: 'This user is assigned to open cases. Reassign the case first.' });
          throw error;
        }
        return response.status(204).end();
      }

      return response.status(405).json({ error: 'Method not allowed' });
    }

    return response.status(404).json({ error: 'Not found' });

    async function login() {
      if (!username || !password) return response.status(400).json({ error: 'Username and password are required' });
      // Brute-force brake: 10 attempts/min per username, 30/min per source IP.
      const ip = String(request.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || 'unknown';
      const userGate = rateLimit(`login:user:${username.toLowerCase()}`, { limit: 10, windowMs: 60_000 });
      const ipGate = rateLimit(`login:ip:${ip}`, { limit: 30, windowMs: 60_000 });
      if (!userGate.allowed || !ipGate.allowed) {
        const retryAfterSec = Math.max(userGate.retryAfterSec, ipGate.retryAfterSec);
        response.setHeader('Retry-After', String(retryAfterSec));
        return response.status(429).json({ error: 'Too many login attempts. Please try again shortly.' });
      }
      const setup = await hasCredentials(database);
      if (!setup) return response.status(200).json({ user: defaultUser(), needsSetup: true });

      const rows = await database`
        SELECT id, email, name, username, role, department, rank, phone,
               badge_number AS "badgeNumber", password_hash AS "passwordHash",
               mfa_enabled AS "mfaEnabled", created_at AS "createdAt", last_login AS "lastLogin"
        FROM users WHERE username = ${username} LIMIT 1
      `;
      const userRow = rows[0];
      if (!userRow || !verifyPassword(password, userRow.passwordHash)) {
        return response.status(401).json({ error: 'Invalid username or password' });
      }
      // MFA-enabled accounts never receive a session from credentials alone:
      // they must complete a short-lived TOTP challenge (spec §22).
      if (userRow.mfaEnabled) {
        const challengeToken = randomBytes(32).toString('hex');
        await database`
          INSERT INTO mfa_challenges (token, user_id, expires_at)
          VALUES (${challengeToken}, ${userRow.id}, NOW() + INTERVAL '5 minutes')
        `;
        return response.status(200).json({ mfaRequired: true, challengeToken });
      }
      await database`
        UPDATE users SET last_login = NOW() WHERE id = ${userRow.id}
      `.catch(() => undefined);
      await createSession(database, request, response, userRow.id);
      return response.status(200).json({ user: toUser(userRow), needsSetup: false });
    }
  } catch (error) {
    console.error('Auth handler failed:', error);
    return response.status(503).json({ error: 'Authentication service is unavailable' });
  }
}