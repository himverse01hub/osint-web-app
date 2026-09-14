import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import entitiesHandler from '../../api/entities';
import searchHandler from '../../api/search';

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
    url: '/api/test',
    query: options.query ?? {},
    body: options.body,
    headers: {},
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

/** Tagged-template database stub routed on the SQL text. */
const fakeDb = (route: (query: string) => unknown): any => {
  const fn = (strings: TemplateStringsArray) => Promise.resolve(route(strings.join('?')));
  fn.unsafe = (text: string) => ({ text });
  return fn;
};

const entityRow = {
  id: 'e1',
  type: 'person',
  value: 'Rahul Verma',
  label: 'Rahul Verma',
  confidence: 70,
  source: 'other',
  sourceName: 'Investigator entry',
  sourceUrl: null,
  discoveredAt: '2026-09-14T00:00:00Z',
  verified: false,
  metadata: { tags: ['demo'], phone: '+91-90000-00000' },
};

const entitiesDb = (options: { idRows?: unknown[]; metadataRows?: unknown[]; deleteRows?: unknown[] } = {}) =>
  fakeDb((query) => {
    if (query.includes('COUNT(*)')) return [{ total: '1' }];
    if (query.includes('SELECT metadata FROM entities')) return options.metadataRows ?? [{ metadata: { tags: ['old'] } }];
    if (query.includes('INSERT INTO entities')) return [entityRow];
    if (query.includes('UPDATE entities')) return [entityRow];
    if (query.includes('DELETE FROM entities')) return options.deleteRows ?? [{ id: 'e1' }];
    if (query.includes('FROM entities WHERE id =')) return options.idRows ?? [entityRow];
    if (query.includes('ORDER BY discovered_at')) return [entityRow];
    if (query.includes('FROM relationships')) return [];
    return [];
  });

beforeEach(() => {
  dbState.impl = undefined;
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('entities handler', () => {
  it('creates a valid entity and maps the returned row', async () => {
    dbState.impl = entitiesDb();
    const { response, state } = makeResponse();
    await entitiesHandler(
      makeRequest({
        method: 'POST',
        body: { type: 'person', value: '  Rahul Verma  ', source: 'other', confidence: 70, tags: ['demo'] },
      }),
      response,
    );
    expect(state.status).toBe(201);
    expect(state.body.entity).toMatchObject({
      id: 'e1',
      type: 'person',
      value: 'Rahul Verma',
      confidence: 70,
      sourceName: 'Investigator entry',
      tags: ['demo'],
    });
  });

  it('rejects invalid type, invalid source and non-integer confidence', async () => {
    dbState.impl = entitiesDb();
    for (const body of [
      { type: 'banana', value: 'x', label: 'x', source: 'other', confidence: 50 },
      { type: 'person', value: 'x', label: 'x', source: 'banana', confidence: 50 },
      { type: 'person', value: 'x', label: 'x', source: 'other', confidence: 12.5 },
      { type: 'person', value: 'x', label: 'x', source: 'other', confidence: 101 },
    ]) {
      const { response, state } = makeResponse();
      await entitiesHandler(makeRequest({ method: 'POST', body }), response);
      expect(state.status).toBe(400);
      expect(state.body.error).toMatch(/required|confidence/);
    }
  });

  it('enforces PATCH validation rules', async () => {
    dbState.impl = entitiesDb();
    const noId = makeResponse();
    await entitiesHandler(makeRequest({ method: 'PATCH', body: { type: 'person' } }), noId.response);
    expect(noId.state.status).toBe(400);
    expect(noId.state.body.error).toBe('Entity id is required');

    const badType = makeResponse();
    await entitiesHandler(
      makeRequest({ method: 'PATCH', query: { id: 'e1' }, body: { type: 'banana' } }),
      badType.response,
    );
    expect(badType.state.status).toBe(400);
    expect(badType.state.body.error).toBe('Invalid entity type');

    const ok = makeResponse();
    await entitiesHandler(
      makeRequest({ method: 'PATCH', query: { id: 'e1' }, body: { confidence: 80, verified: true } }),
      ok.response,
    );
    expect(ok.state.status).toBe(200);
    expect(ok.state.body.entity.confidence).toBe(70);
  });

  it('returns 404 when the entity does not exist (GET and DELETE)', async () => {
    dbState.impl = entitiesDb({ idRows: [], deleteRows: [] });
    const get = makeResponse();
    await entitiesHandler(makeRequest({ query: { id: 'missing' } }), get.response);
    expect(get.state.status).toBe(404);

    const del = makeResponse();
    await entitiesHandler(makeRequest({ method: 'DELETE', query: { id: 'missing' } }), del.response);
    expect(del.state.status).toBe(404);
  });

  it('lists entities with pagination metadata and clamped limits', async () => {
    dbState.impl = entitiesDb();
    const listed = makeResponse();
    await entitiesHandler(makeRequest({ query: { limit: '500' } }), listed.response);
    expect(listed.state.status).toBe(200);
    expect(listed.state.body).toMatchObject({ total: 1, page: 1, limit: 100, totalPages: 1 });
    expect(listed.state.body.entities[0].id).toBe('e1');
  });

  it('deletes an entity with 204 and rejects unknown methods with 405', async () => {
    dbState.impl = entitiesDb();
    const del = makeResponse();
    await entitiesHandler(makeRequest({ method: 'DELETE', query: { id: 'e1' } }), del.response);
    expect(del.state.status).toBe(204);
    expect(del.state.ended).toBe(true);

    const bad = makeResponse();
    await entitiesHandler(makeRequest({ method: 'PUT' }), bad.response);
    expect(bad.state.status).toBe(405);
  });

  it('maps database failures to 503 instead of crashing', async () => {
    dbState.impl = fakeDb(() => {
      throw new Error('connection refused');
    });
    const { response, state } = makeResponse();
    await entitiesHandler(makeRequest(), response);
    expect(state.status).toBe(503);
    expect(state.body.error).toBe('Entities are unavailable');
  });
});

describe('search handler', () => {
  const jsonResponse = (payload: unknown) => ({ ok: true, status: 200, json: async () => payload });

  it('rejects missing value with 400 and unknown methods with 405', async () => {
    dbState.impl = fakeDb(() => []);
    const empty = makeResponse();
    await searchHandler(makeRequest({ query: {} }), empty.response);
    expect(empty.state.status).toBe(400);
    expect(empty.state.body.error).toBe('Search value is required');

    const bad = makeResponse();
    await searchHandler(makeRequest({ method: 'POST', query: { value: 'rahul' } }), bad.response);
    expect(bad.state.status).toBe(405);
  });

  it('merges local results first, dedupes providers, and persists upserts', async () => {
    let upserts = 0;
    let searchRuns = 0;
    dbState.impl = fakeDb((query) => {
      if (query.includes('FROM entities') && query.includes('ILIKE')) return [entityRow];
      if (query.includes('INSERT INTO search_runs')) {
        searchRuns += 1;
        return [];
      }
      if (query.includes('INSERT INTO entities')) {
        upserts += 1;
        return [];
      }
      return [];
    });
    vi.stubGlobal('fetch', async (input: any) => {
      const url = String(input instanceof URL ? input : input);
      if (url.includes('wikidata.org')) {
        return jsonResponse({ search: [{ id: 'Q1', label: 'Rahul Verma', description: 'duplicate of local' }] });
      }
      if (url.includes('wikipedia.org')) {
        return jsonResponse({ query: { search: [{ pageid: 7, title: 'Rahul Sharma OSINT profile', snippet: '<b>Rahul</b>' }] } });
      }
      if (url.includes('gdeltproject.org')) return jsonResponse({ articles: [] });
      if (url.includes('nominatim')) return jsonResponse([]);
      throw new Error(`unexpected fetch: ${url}`);
    });

    const { response, state } = makeResponse();
    await searchHandler(makeRequest({ query: { value: 'rahul', type: 'person' } }), response);
    expect(state.status).toBe(200);
    const body = state.body;
    expect(body.query).toEqual({ type: 'person', value: 'rahul' });
    // Local row comes first and is flagged as local
    expect(body.results[0]).toMatchObject({ id: 'e1', value: 'Rahul Verma', metadata: { local: true } });
    // Wikidata duplicate of the local value is dropped; Wikipedia's distinct result survives
    expect(body.results.some((r: any) => r.sourceName === 'Wikidata')).toBe(false);
    expect(body.results.some((r: any) => r.sourceName === 'Wikipedia')).toBe(true);
    expect(body.totalCount).toBe(2);
    expect(body.totalPages).toBe(1);
    expect(body.sources).toEqual(expect.arrayContaining(['Wikipedia', 'Wikidata', 'Local database']));
    expect(body.sourceErrors).toEqual([]);
    // Persistence: one search_run, one upsert for the surviving external entity only
    expect(searchRuns).toBe(1);
    expect(upserts).toBe(1);
  });

  it('keeps searching when a provider fails and reports the source error', async () => {
    dbState.impl = fakeDb((query) => {
      if (query.includes('FROM entities') && query.includes('ILIKE')) return [];
      if (query.includes('INSERT INTO')) return [];
      return [];
    });
    vi.stubGlobal('fetch', async (input: any) => {
      const url = String(input instanceof URL ? input : input);
      if (url.includes('wikipedia.org')) throw new Error('wikipedia down');
      if (url.includes('wikidata.org')) return jsonResponse({ search: [] });
      if (url.includes('gdeltproject.org')) return jsonResponse({ articles: [] });
      if (url.includes('nominatim')) return jsonResponse([]);
      throw new Error(`unexpected fetch: ${url}`);
    });

    const { response, state } = makeResponse();
    await searchHandler(makeRequest({ query: { value: 'rahul', type: 'person' } }), response);
    expect(state.status).toBe(200);
    expect(state.body.results).toEqual([]);
    expect(state.body.sourceErrors.some((e: string) => e.startsWith('Wikipedia: wikipedia down'))).toBe(true);
    expect(state.body.sources).toContain('Local database');
  });

  it('routes IPv4 values to the threat-intel provider and maps the entity', async () => {
    dbState.impl = fakeDb((query) => {
      if (query.includes('FROM entities') && query.includes('ILIKE')) return [];
      if (query.includes('INSERT INTO')) return [];
      return [];
    });
    vi.stubGlobal('fetch', async (input: any) => {
      const url = String(input instanceof URL ? input : input);
      if (url.includes('ipwho.is')) {
        return jsonResponse({
          success: true,
          ip: '8.8.8.8',
          city: 'Mountain View',
          country: 'United States',
          connection: { asn: 15169, org: 'Google LLC' },
        });
      }
      if (url.includes('wikidata.org') || url.includes('wikipedia.org') || url.includes('gdeltproject.org')) {
        return jsonResponse({});
      }
      if (url.includes('nominatim')) return jsonResponse([]);
      throw new Error(`unexpected fetch: ${url}`);
    });

    const { response, state } = makeResponse();
    await searchHandler(makeRequest({ query: { value: '8.8.8.8', type: 'person' } }), response);
    expect(state.status).toBe(200);
    const threat = state.body.results.find((r: any) => r.id === 'threat-ip-8.8.8.8');
    expect(threat).toMatchObject({
      type: 'location',
      confidence: 62,
      source: 'threat_intel',
      sourceName: 'IPWho.is',
      metadata: { asn: 15169, org: 'Google LLC', country: 'United States' },
    });
  });
});


