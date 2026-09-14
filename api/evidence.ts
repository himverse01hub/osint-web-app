import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash, randomUUID } from 'node:crypto';
import { requireDatabase } from './_lib/db.js';
import { requireAuth } from './_lib/guard.js';

const allowedTypes = new Set(['image', 'video', 'pdf', 'document', 'screenshot', 'webpage', 'text', 'hash', 'url']);
const maxEvidenceBytes = 10_000_000;
const sha256Pattern = /^[a-f0-9]{64}$/;
const custodyActions = new Set(['collected', 'transferred', 'sealed', 'accessed', 'verified']);

/**
 * Malware-scanning interface point (spec §19: "Malware scanning interface").
 * Configure EVIDENCE_SCAN_ENDPOINT (an authorized AV/malware service that accepts
 * { sha256 }) to enable scanning. Until then evidence stays in 'pending' state —
 * it is never silently marked clean without an actual scan.
 */
export async function scanEvidence(sha256: string): Promise<'pending' | 'clean' | 'flagged'> {
  const endpoint = process.env.EVIDENCE_SCAN_ENDPOINT;
  if (!endpoint) return 'pending';
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha256 }),
    });
    if (!response.ok) return 'pending';
    const data = await response.json();
    return data?.status === 'clean' || data?.status === 'flagged' ? data.status : 'pending';
  } catch (error) {
    console.error('Evidence malware scan failed:', error);
    return 'pending';
  }
}

const toEvidence = (row: any) => ({
  id: row.id,
  caseId: row.caseId,
  evidenceType: row.evidenceType,
  title: row.title,
  description: row.description ?? undefined,
  sha256: row.sha256,
  source: row.source,
  sourceUrl: row.sourceUrl ?? undefined,
  collectedBy: row.collectedBy ?? undefined,
  fileName: row.fileName ?? undefined,
  mimeType: row.mimeType ?? undefined,
  sizeBytes: row.sizeBytes ?? 0,
  scanStatus: row.scanStatus,
  chainOfCustody: row.chainOfCustody ?? [],
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    const database = requireDatabase();
    const auth = await requireAuth(request, database, { permission: request.method === 'GET' ? 'evidence.view' : 'evidence.edit' });
    if (!auth.ok) return response.status(auth.status).json({ error: auth.error });

    if (request.method === 'GET') {
      const caseId = String(request.query.caseId ?? '').trim();
      const rows = caseId
        ? await database`
            SELECT id, case_id AS "caseId", evidence_type AS "evidenceType", title, description, sha256,
                   source, source_url AS "sourceUrl", collected_by AS "collectedBy", file_name AS "fileName",
                   mime_type AS "mimeType", size_bytes AS "sizeBytes", scan_status AS "scanStatus",
                   chain_of_custody AS "chainOfCustody", created_at AS "createdAt", updated_at AS "updatedAt"
            FROM evidence WHERE case_id = ${caseId} ORDER BY created_at DESC LIMIT 200
          `
        : await database`
            SELECT id, case_id AS "caseId", evidence_type AS "evidenceType", title, description, sha256,
                   source, source_url AS "sourceUrl", collected_by AS "collectedBy", file_name AS "fileName",
                   mime_type AS "mimeType", size_bytes AS "sizeBytes", scan_status AS "scanStatus",
                   chain_of_custody AS "chainOfCustody", created_at AS "createdAt", updated_at AS "updatedAt"
            FROM evidence ORDER BY created_at DESC LIMIT 200
          `;
      return response.status(200).json({ evidence: rows.map(toEvidence) });
    }

    const body = request.body ?? {};
    const collectedBy = String(body.collectedBy ?? 'Investigator').trim();

    if (request.method === 'POST') {
      const evidenceType = String(body.evidenceType ?? 'document').trim();
      const title = String(body.title ?? '').trim();
      const source = String(body.source ?? '').trim();
      if (!allowedTypes.has(evidenceType) || !title || !source) {
        return response.status(400).json({ error: 'evidenceType, title, and source are required' });
      }

      let sha256 = String(body.sha256 ?? '').trim().toLowerCase();
      let sizeBytes = Number(body.sizeBytes ?? 0);
      if (body.contentBase64 !== undefined) {
        const raw = Buffer.from(String(body.contentBase64), 'base64');
        if (raw.byteLength === 0) return response.status(400).json({ error: 'contentBase64 could not be decoded' });
        if (raw.byteLength > maxEvidenceBytes) return response.status(413).json({ error: 'Evidence exceeds 10 MB' });
        sha256 = createHash('sha256').update(raw).digest('hex');
        sizeBytes = raw.byteLength;
      }
      if (!sha256Pattern.test(sha256)) {
        return response.status(400).json({ error: 'sha256 must be a 64-character hex digest or provide contentBase64' });
      }

      const scanStatus = await scanEvidence(sha256);
      const custodyEntry = [{ action: 'collected', by: collectedBy, at: new Date().toISOString() }];
      const [created] = await database`
        INSERT INTO evidence (id, case_id, evidence_type, title, description, sha256, source, source_url,
                              collected_by, file_name, mime_type, size_bytes, scan_status, chain_of_custody)
        VALUES (${randomUUID()}, ${body.caseId ? String(body.caseId).trim() : null}, ${evidenceType}, ${title},
          ${body.description === undefined ? null : String(body.description).trim()}, ${sha256}, ${source},
          ${body.sourceUrl ? String(body.sourceUrl).trim() : null}, ${collectedBy},
          ${body.fileName ? String(body.fileName).trim() : null}, ${body.mimeType ? String(body.mimeType).trim() : null},
          ${Number.isFinite(sizeBytes) ? Math.max(0, Math.floor(sizeBytes)) : 0}, ${scanStatus},
          ${JSON.stringify(custodyEntry)}::jsonb)
        RETURNING id, case_id AS "caseId", evidence_type AS "evidenceType", title, description, sha256,
          source, source_url AS "sourceUrl", collected_by AS "collectedBy", file_name AS "fileName",
          mime_type AS "mimeType", size_bytes AS "sizeBytes", scan_status AS "scanStatus",
          chain_of_custody AS "chainOfCustody", created_at AS "createdAt", updated_at AS "updatedAt"
      `;
      await database`
        INSERT INTO audit_logs (id, action, resource_type, resource_id, metadata)
        VALUES (${randomUUID()}, 'UPLOAD_EVIDENCE', 'evidence', ${created.id},
          ${JSON.stringify({ sha256, scanStatus, caseId: created.caseId ?? null, collectedBy })}::jsonb)
      `;
      return response.status(201).json({ evidence: toEvidence(created) });
    }

    if (request.method === 'PATCH') {
      const id = String(request.query.id ?? '').trim();
      if (!id) return response.status(400).json({ error: 'Evidence id is required' });
      const action = String(body.action ?? '').trim();
      const note = body.note === undefined ? '' : String(body.note).trim();
      if (!custodyActions.has(action)) {
        return response.status(400).json({ error: 'action must be one of collected, transferred, sealed, accessed, verified' });
      }
      const [existing] = await database`
        SELECT chain_of_custody AS "chainOfCustody" FROM evidence WHERE id = ${id}
      `;
      if (!existing) return response.status(404).json({ error: 'Evidence not found' });
      // Append-only custody chain: entries are never edited or removed.
      const nextChain = [
        ...((existing.chainOfCustody as unknown[]) ?? []),
        { action, by: collectedBy, at: new Date().toISOString(), ...(note ? { note } : {}) },
      ];
      const [updated] = await database`
        UPDATE evidence SET chain_of_custody = ${JSON.stringify(nextChain)}::jsonb, updated_at = NOW()
        WHERE id = ${id}
        RETURNING id, case_id AS "caseId", evidence_type AS "evidenceType", title, description, sha256,
          source, source_url AS "sourceUrl", collected_by AS "collectedBy", file_name AS "fileName",
          mime_type AS "mimeType", size_bytes AS "sizeBytes", scan_status AS "scanStatus",
          chain_of_custody AS "chainOfCustody", created_at AS "createdAt", updated_at AS "updatedAt"
      `;
      await database`
        INSERT INTO audit_logs (id, action, resource_type, resource_id, metadata)
        VALUES (${randomUUID()}, 'EVIDENCE_CUSTODY', 'evidence', ${id},
          ${JSON.stringify({ action, collectedBy, note: note || null })}::jsonb)
      `;
      return response.status(200).json({ evidence: toEvidence(updated) });
    }

    return response.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Evidence request failed:', error);
    return response.status(503).json({ error: 'Evidence service is unavailable' });
  }
}
