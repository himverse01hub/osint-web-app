import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes } from 'node:crypto';
import { requireDatabase } from './_lib/db.js';
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
      const setup = await hasCredentials(database);
      if (!setup) return response.status(200).json({ user: defaultUser(), needsSetup: true });

      const rows = await database`
        SELECT id, email, name, username, role, department, rank, phone,
               badge_number AS "badgeNumber", password_hash AS "passwordHash", created_at AS "createdAt", last_login AS "lastLogin"
        FROM users WHERE username = ${username} LIMIT 1
      `;
      const userRow = rows[0];
      if (!userRow || !verifyPassword(password, userRow.passwordHash)) {
        return response.status(401).json({ error: 'Invalid username or password' });
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