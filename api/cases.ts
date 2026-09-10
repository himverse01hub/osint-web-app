import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'node:crypto';
import { requireDatabase } from './_lib/db.js';

const allowedStatuses = new Set(['open', 'active', 'closed', 'archived']);
const allowedPriorities = new Set(['low', 'medium', 'high', 'critical']);

const toCase = (row: any, files: any[] = []) => ({
  id: row.id,
  caseNumber: row.caseNumber,
  title: row.title,
  description: row.description ?? '',
  status: row.status,
  priority: row.priority,
  assignedTo: row.assignedTo ?? null,
  tags: row.tags ?? [],
  entities: row.entities ?? [],
  files,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  coAccused: row.coAccused ?? [],
  phone: row.phone ?? '',
  email: row.email ?? '',
  address: row.address ?? '',
  anyId: row.anyId ?? '',
});

const toFileSummary = (row: any) => ({
  id: row.id,
  caseId: row.caseId,
  fileName: row.fileName,
  mimeType: row.mimeType,
  sizeBytes: row.sizeBytes,
  uploadedBy: row.uploadedBy ?? null,
  createdAt: row.createdAt,
});

const listFiles = async (database: ReturnType<typeof requireDatabase>, caseId: string) => {
  const rows = await database`
    SELECT id, case_id AS "caseId", file_name AS "fileName", mime_type AS "mimeType",
           size_bytes AS "sizeBytes", uploaded_by AS "uploadedBy", created_at AS "createdAt"
    FROM case_files
    WHERE case_id = ${caseId}
    ORDER BY created_at DESC
  `;
  return rows.map(toFileSummary);
};

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    const database = requireDatabase();

    if (request.method === 'GET') {
      const id = String(request.query.id ?? '').trim();
      const fileId = String(request.query.fileId ?? '').trim();

      if (request.query.file === '1' && fileId) {
        const rows = await database`
          SELECT id, case_id AS "caseId", file_name AS "fileName", mime_type AS "mimeType",
                 size_bytes AS "sizeBytes", data, uploaded_by AS "uploadedBy", created_at AS "createdAt"
          FROM case_files WHERE id = ${fileId} LIMIT 1
        `;
        if (!rows[0]) return response.status(404).json({ error: 'File not found' });
        return response.status(200).json({ file: { ...toFileSummary(rows[0]), data: rows[0].data } });
      }

      if (id) {
        const rows = await database`
          SELECT id, case_number AS "caseNumber", title, description, status, priority,
                 assigned_to AS "assignedTo", tags, co_accused AS "coAccused", phone, email,
                 address, any_id AS "anyId",
                 created_at AS "createdAt", updated_at AS "updatedAt",
                 COALESCE((
                   SELECT jsonb_agg(entity_id) FROM case_entities WHERE case_entities.case_id = cases.id
                 ), '[]'::jsonb) AS entities
          FROM cases WHERE id = ${id} LIMIT 1
        `;
        if (!rows[0]) return response.status(404).json({ error: 'Case not found' });
        const files = await listFiles(database, id);
        return response.status(200).json({ case: toCase(rows[0], files) });
      }

      const page = Math.max(1, parseInt(String(request.query.page || '1'), 10));
      const limit = Math.min(100, Math.max(1, parseInt(String(request.query.limit || '50'), 10)));
      const offset = (page - 1) * limit;
      const statusFilter = request.query.status && allowedStatuses.has(String(request.query.status))
        ? database`WHERE status = ${String(request.query.status)}`
        : database``;
      const priorityFilter = request.query.priority && allowedPriorities.has(String(request.query.priority))
        ? (Boolean(statusFilter) ? database`AND priority = ${String(request.query.priority)}` : database`WHERE priority = ${String(request.query.priority)}`)
        : database``;
      const whereClause = statusFilter || priorityFilter;

      const [rows, countRows] = await Promise.all([
        database`
          SELECT id, case_number AS "caseNumber", title, description, status, priority,
                 assigned_to AS "assignedTo", tags, co_accused AS "coAccused", phone, email,
                 address, any_id AS "anyId",
                 created_at AS "createdAt", updated_at AS "updatedAt",
                 COALESCE((
                   SELECT jsonb_agg(entity_id) FROM case_entities WHERE case_entities.case_id = cases.id
                 ), '[]'::jsonb) AS entities
          FROM cases ${whereClause}
          ORDER BY updated_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
        database`
          SELECT COUNT(*) as total FROM cases ${whereClause}
        `,
      ]);
      const total = parseInt(countRows[0]?.total || '0', 10);
      return response.status(200).json({ 
        cases: rows.map(row => toCase(row)),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      });
    }

    if (request.method === 'POST' && request.query.upload === '1') {
      const caseId = String(request.query.id ?? '').trim();
      const body = request.body ?? {};
      const fileName = String(body.fileName ?? '').trim();
      const mimeType = String(body.mimeType ?? 'application/octet-stream');
      const data = String(body.data ?? '');
      const sizeBytes = Number(body.sizeBytes ?? 0);

      if (!caseId) return response.status(400).json({ error: 'Case id is required' });
      if (!fileName) return response.status(400).json({ error: 'File name is required' });
      if (!data) return response.status(400).json({ error: 'File content is missing' });
      if (sizeBytes > MAX_UPLOAD_BYTES) return response.status(400).json({ error: 'File exceeds the 8 MB upload limit' });

      const caseRows = await database`SELECT id FROM cases WHERE id = ${caseId} LIMIT 1`;
      if (!caseRows[0]) return response.status(404).json({ error: 'Case not found' });

      const fileId = randomUUID();
      await database`
        INSERT INTO case_files (id, case_id, file_name, mime_type, size_bytes, data, uploaded_by)
        VALUES (${fileId}, ${caseId}, ${fileName}, ${mimeType}, ${sizeBytes}, ${data},
                ${body.uploadedBy ? String(body.uploadedBy) : null})
      `;
      const fileRows = await database`
        SELECT id, case_id AS "caseId", file_name AS "fileName", mime_type AS "mimeType",
               size_bytes AS "sizeBytes", uploaded_by AS "uploadedBy", created_at AS "createdAt"
        FROM case_files WHERE id = ${fileId} LIMIT 1
      `;
      return response.status(201).json({ file: toFileSummary(fileRows[0]) });
    }

    if (request.method === 'POST') {
      const body = request.body ?? {};
      const caseNumber = String(body.caseNumber ?? '').trim();
      const title = String(body.title ?? '').trim();
      const status = String(body.status ?? 'open');
      const priority = String(body.priority ?? 'medium');
      const description = body.description === undefined ? null : String(body.description);
      const tags = Array.isArray(body.tags) ? body.tags.map((tag: unknown) => String(tag)) : [];
      const entities = Array.isArray(body.entities) ? body.entities.map((id: unknown) => String(id)).filter(Boolean) : [];
      const coAccused = Array.isArray(body.coAccused) ? body.coAccused.map((name: unknown) => String(name)).filter(Boolean) : [];
      const phone = body.phone === undefined ? null : String(body.phone).trim();
      const email = body.email === undefined ? null : String(body.email).trim();
      const address = body.address === undefined ? null : String(body.address).trim();
      const anyId = body.anyId === undefined ? null : String(body.anyId).trim();

      if (!caseNumber || !title) {
        return response.status(400).json({ error: 'caseNumber and title are required' });
      }
      if (!allowedStatuses.has(status) || !allowedPriorities.has(priority)) {
        return response.status(400).json({ error: 'Invalid case status or priority' });
      }

      const caseId = randomUUID();
      const [created] = await database`
        INSERT INTO cases (id, case_number, title, description, status, priority, assigned_to, tags, co_accused, phone, email, address, any_id)
        VALUES (
          ${caseId}, ${caseNumber}, ${title}, ${description}, ${status}, ${priority},
          ${body.assignedTo ? String(body.assignedTo) : null}, ${JSON.stringify(tags)},
          ${JSON.stringify(coAccused)}, ${phone}, ${email}, ${address}, ${anyId}
        )
        RETURNING id, case_number AS "caseNumber", title, description, status, priority,
                  assigned_to AS "assignedTo", tags, co_accused AS "coAccused", phone, email, address, any_id,
                  created_at AS "createdAt", updated_at AS "updatedAt"
      `;

      for (const entityId of entities) {
        await database`
          INSERT INTO case_entities (case_id, entity_id) VALUES (${caseId}, ${entityId})
          ON CONFLICT (case_id, entity_id) DO NOTHING
        `.catch(() => undefined);
      }

      return response.status(201).json({ case: toCase({ ...created, entities }) });
    }

    if (request.method === 'PATCH') {
      const id = String(request.query.id ?? '').trim();
      if (!id) return response.status(400).json({ error: 'Case id is required' });

      const body = request.body ?? {};
      const status = body.status === undefined ? null : String(body.status);
      const priority = body.priority === undefined ? null : String(body.priority);
      if (status && !allowedStatuses.has(status)) {
        return response.status(400).json({ error: 'Invalid case status' });
      }
      if (priority && !allowedPriorities.has(priority)) {
        return response.status(400).json({ error: 'Invalid case priority' });
      }

      const tags = Array.isArray(body.tags) ? body.tags.map((tag: unknown) => String(tag)) : null;
      const title = body.title === undefined ? null : String(body.title).trim();
      const description = body.description === undefined ? null : String(body.description);
      const assignedTo = body.assignedTo === undefined || body.assignedTo === null
        ? null
        : String(body.assignedTo).trim() || null;
      const coAccused = Array.isArray(body.coAccused) ? body.coAccused.map((name: unknown) => String(name)).filter(Boolean) : null;
      const phone = body.phone === undefined ? null : String(body.phone).trim() || null;
      const email = body.email === undefined ? null : String(body.email).trim() || null;
      const address = body.address === undefined ? null : String(body.address).trim() || null;
      const anyId = body.anyId === undefined ? null : String(body.anyId).trim() || null;

      if (assignedTo) {
        const assignedUser = await database`SELECT id FROM users WHERE id = ${assignedTo} LIMIT 1`;
        if (!assignedUser[0]) return response.status(400).json({ error: 'Select a valid investigator from the Assigned To list.' });
      }

      const [updated] = await database`
        UPDATE cases
        SET status = COALESCE(${status}, status),
            priority = COALESCE(${priority}, priority),
        title = COALESCE(${title}, title),
        description = COALESCE(${description}, description),
        assigned_to = ${assignedTo},
            tags = COALESCE(${tags ? JSON.stringify(tags) : null}, tags),
            co_accused = COALESCE(${coAccused !== null ? JSON.stringify(coAccused) : null}, co_accused),
            phone = COALESCE(${phone}, phone),
            email = COALESCE(${email}, email),
            address = COALESCE(${address}, address),
            any_id = COALESCE(${anyId}, any_id),
            updated_at = NOW()
        WHERE id = ${id}
        RETURNING id, case_number AS "caseNumber", title, description, status, priority,
                  assigned_to AS "assignedTo", tags, co_accused AS "coAccused", phone, email, address, any_id,
                  created_at AS "createdAt", updated_at AS "updatedAt"
      `;

      if (!updated) return response.status(404).json({ error: 'Case not found' });

      if (Array.isArray(body.entities)) {
        const entityIds = Array.from(new Set(body.entities.map((value: unknown) => String(value)).filter(Boolean)));
        await database`DELETE FROM case_entities WHERE case_id = ${id}`;
        for (const entityId of entityIds) {
          await database`
            INSERT INTO case_entities (case_id, entity_id) VALUES (${id}, ${entityId})
            ON CONFLICT (case_id, entity_id) DO NOTHING
          `.catch(() => undefined);
        }
      }

      const refreshedRows = await database`
        SELECT id, case_number AS "caseNumber", title, description, status, priority,
               assigned_to AS "assignedTo", tags, co_accused AS "coAccused", phone, email,
               address, any_id AS "anyId",
               created_at AS "createdAt", updated_at AS "updatedAt",
               COALESCE((
                 SELECT jsonb_agg(entity_id) FROM case_entities WHERE case_entities.case_id = cases.id
               ), '[]'::jsonb) AS entities
        FROM cases WHERE id = ${id} LIMIT 1
      `;

      return response.status(200).json({ case: toCase(refreshedRows[0]) });
    }

    if (request.method === 'DELETE') {
      const fileId = String(request.query.fileId ?? '').trim();
      const id = String(request.query.id ?? '').trim();

      if (request.query.file === '1' && fileId && id) {
        const result = await database`
          DELETE FROM case_files WHERE id = ${fileId} AND case_id = ${id}
          RETURNING id
        `;
        if (!result[0]) return response.status(404).json({ error: 'File not found' });
        return response.status(200).json({ success: true });
      }

      if (id) {
        const result = await database`
          DELETE FROM cases WHERE id = ${id} RETURNING id
        `;
        if (!result[0]) return response.status(404).json({ error: 'Case not found' });
        return response.status(204).send(undefined);
      }

      return response.status(400).json({ error: 'Case id is required' });
    }

    return response.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Cases request failed:', error);
    return response.status(503).json({ error: 'Cases are unavailable' });
  }
}