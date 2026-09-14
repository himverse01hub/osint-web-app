import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'node:crypto';
import evidenceHandler, { scanEvidence } from '../../api/evidence';

const { dbState } = vi.hoisted(() => ({ dbState: { impl: undefined as unknown } }));

vi.mock('../../api/_lib/db', () => ({
  isDatabaseConfigured: true,
  sql: null,
  requireDatabase: () => {
    if (!dbState.impl) throw new Error('DATABASE_URL is not configured');
    return dbState.impl;
  },
}));

const makeRequest = (options: { method?: string; query?: Record<string, string>; body?: unknown } = {}) =>
  ({
    method: options.method ?? 'GET',
    url: '/api/evidence',
    query: options.query ?? {},
    body: options.body,
    headers: { cookie: 'hp_osint_session=tok123' },
  }) as unknown as VercelRequest;

const makeResponse = () => {
  const state: { status?: number; body?: any; ended: boolean } = { ended: false };
  const response = {
    status(code: number) {
      state.status = code;
      return response;
    },
    json(payload: unknown) {
      state.body = payload;
      return response;
    },
    end() {
      state.ended = true;
      return response;
    },
  };
  return { response: response as unknown as VercelResponse, state };
};

const fakeDb = (route: (query: string) => unknown): any => {
  const fn = (strings: TemplateStringsArray) => Promise.resolve(route(strings.join('?')));
  fn.unsafe = (text: string) => ({ text });
  return fn;
};

/** Records SQL text routed through the stub so tests can assert audit writes. */
const evidenceDb = () => {
  const calls: { q: string; values: unknown[] }[] = [];
  const rows = {
    session: [{ id: 'u1', name: 'Demo Officer', email: 'demo@haryanapolice.gov.in', role: 'investigator', username: 'demo_officer', badge_number: 'HP-1', phone: '', department: null, rank: null, lastLogin: null }],
    insert: [{ id: 'ev1', caseId: 'c1', evidenceType: 'image', title: 'Screenshot', description: null, sha256: 'x', source: 'web', sourceUrl: null, collectedBy: 'Investigator', fileName: null, mimeType: null, sizeBytes: 11, scanStatus: 'pending', chainOfCustody: [], createdAt: '2026-09-14T00:00:00Z', updatedAt: '2026-09-14T00:00:00Z' }],
    existing: [{ chainOfCustody: [{ action: 'collected', by: 'Investigator', at: '2026-09-14T00:00:00Z' }] }],
  };
  const route = (query: string) => {
    if (query.includes('FROM sessions')) return rows.session;
    if (query.includes('INSERT INTO evidence')) return rows.insert;
    if (query.includes('UPDATE evidence')) return rows.insert;
    if (query.includes('SELECT chain_of_custody')) return rows.existing;
    if (query.includes('FROM evidence WHERE case_id')) return rows.insert;
    if (query.includes('FROM evidence ORDER BY')) return rows.insert;
    if (query.includes('INSERT INTO audit_logs')) return [];
    return [];
  };
  // Tagged-template stub that keeps both static text and interpolated values for assertions.
  const db = (strings: TemplateStringsArray, ...values: unknown[]): any => {
    const q = strings.reduce((acc, part, i) => acc + part + (i < values.length ? '?' : ''), '');
    calls.push({ q, values });
    return Promise.resolve(route(q));
  };
  db.unsafe = (text: string) => ({ text });
  return { db, calls, rows };
};

beforeEach(() => {
  dbState.impl = undefined;
  delete process.env.EVIDENCE_SCAN_ENDPOINT;
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('scanEvidence', () => {
  it('stays pending when no scan endpoint is configured', async () => {
    expect(await scanEvidence('a'.repeat(64))).toBe('pending');
  });

  it('maps scanner verdicts and failures to safe states', async () => {
    process.env.EVIDENCE_SCAN_ENDPOINT = 'https://scanner.example/api';
    vi.stubGlobal('fetch', async () => ({ ok: true, status: 200, json: async () => ({ status: 'clean' }) }));
    expect(await scanEvidence('b'.repeat(64))).toBe('clean');

    vi.stubGlobal('fetch', async () => ({ ok: true, status: 200, json: async () => ({ status: 'flagged' }) }));
    expect(await scanEvidence('b'.repeat(64))).toBe('flagged');

    vi.stubGlobal('fetch', async () => {
      throw new Error('scanner offline');
    });
    expect(await scanEvidence('b'.repeat(64))).toBe('pending');

    vi.stubGlobal('fetch', async () => ({ ok: false, status: 502, json: async () => ({}) }));
    expect(await scanEvidence('b'.repeat(64))).toBe('pending');
  });
});

describe('evidence handler', () => {
  it('computes SHA-256 server-side from content and seeds the custody chain', async () => {
    const { db, calls } = evidenceDb();
    dbState.impl = db;
    const content = Buffer.from('HP-OI evidence payload');
    const expected = createHash('sha256').update(content).digest('hex');

    const { response, state } = makeResponse();
    await evidenceHandler(
      makeRequest({
        method: 'POST',
        body: { evidenceType: 'image', title: 'Screenshot', source: 'web', caseId: 'c1', contentBase64: content.toString('base64') },
      }),
      response,
    );
    expect(state.status).toBe(201);
    expect(state.body.evidence).toMatchObject({ id: 'ev1', caseId: 'c1', sha256: 'x', sizeBytes: 11, scanStatus: 'pending' });
    const insert = calls.find((c) => c.q.includes('INSERT INTO evidence'));
    expect(insert).toBeDefined();
    expect(insert?.values).toContain(expected);
    expect(calls.some((c) => c.q.includes('UPLOAD_EVIDENCE'))).toBe(true);
  });

  it('rejects invalid payloads and oversized uploads', async () => {
    dbState.impl = evidenceDb().db;
    const cases = [
      { body: { evidenceType: 'hologram', title: 'x', source: 'web' }, status: 400 },
      { body: { evidenceType: 'image', source: 'web' }, status: 400 },
      { body: { evidenceType: 'image', title: 'x' }, status: 400 },
      { body: { evidenceType: 'image', title: 'x', source: 'web', sha256: 'nothex' }, status: 400 },
      { body: { evidenceType: 'image', title: 'x', source: 'web', contentBase64: Buffer.alloc(10_000_001).toString('base64') }, status: 413 },
      { body: { evidenceType: 'image', title: 'x', source: 'web', contentBase64: '!!!!' }, status: 400 },
    ];
    for (const testCase of cases) {
      const { response, state } = makeResponse();
      await evidenceHandler(makeRequest({ method: 'POST', body: testCase.body }), response);
      expect(state.status).toBe(testCase.status);
    }
  });

  it('appends custody actions immutably and audits EVIDENCE_CUSTODY', async () => {
    const { db, calls } = evidenceDb();
    dbState.impl = db;
    const { response, state } = makeResponse();
    await evidenceHandler(
      makeRequest({ method: 'PATCH', query: { id: 'ev1' }, body: { action: 'sealed', collectedBy: 'SI Rao', note: 'court seal' } }),
      response,
    );
    expect(state.status).toBe(200);
    const update = calls.find((c) => c.q.includes('UPDATE evidence'));
    expect(update).toBeDefined();
    const chain = JSON.parse(String(update?.values[0])) as Array<{ action: string; by: string; note?: string }>;
    expect(chain).toHaveLength(2); // prior 'collected' entry preserved, new entry appended
    expect(chain[0]).toMatchObject({ action: 'collected', by: 'Investigator' });
    expect(chain[1]).toMatchObject({ action: 'sealed', by: 'SI Rao', note: 'court seal' });
    expect(calls.some((c) => c.q.includes('EVIDENCE_CUSTODY'))).toBe(true);
  });

  it('enforces PATCH guard rails and lists evidence with optional case filter', async () => {
    const { db } = evidenceDb();
    dbState.impl = db;

    const noId = makeResponse();
    await evidenceHandler(makeRequest({ method: 'PATCH', body: { action: 'sealed' } }), noId.response);
    expect(noId.state.status).toBe(400);

    const badAction = makeResponse();
    await evidenceHandler(
      makeRequest({ method: 'PATCH', query: { id: 'ev1' }, body: { action: 'delete' } }),
      badAction.response,
    );
    expect(badAction.state.status).toBe(400);

    const listed = makeResponse();
    await evidenceHandler(makeRequest({ query: { caseId: 'c1' } }), listed.response);
    expect(listed.state.status).toBe(200);
    expect(listed.state.body.evidence[0].id).toBe('ev1');

    const unfiltered = makeResponse();
    await evidenceHandler(makeRequest(), unfiltered.response);
    expect(unfiltered.state.status).toBe(200);
    expect(unfiltered.state.body.evidence).toHaveLength(1);

    const bad = makeResponse();
    await evidenceHandler(makeRequest({ method: 'PUT' }), bad.response);
    expect(bad.state.status).toBe(405);
  });

  it('maps database failures to 503', async () => {
    dbState.impl = fakeDb(() => {
      throw new Error('connection refused');
    });
    const { response, state } = makeResponse();
    await evidenceHandler(makeRequest(), response);
    expect(state.status).toBe(503);
    expect(state.body.error).toBe('Evidence service is unavailable');
  });
});

