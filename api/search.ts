import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'node:crypto';
import { requireDatabase } from './_lib/db.js';
import { requireAuth } from './_lib/guard.js';

type SearchType = 'person' | 'phone' | 'email' | 'username' | 'organization' | 'crypto_wallet' | 'location' | 'all';

type SearchEntity = {
  id: string;
  type: string;
  value: string;
  label: string;
  confidence: number;
  source: string;
  sourceName: string;
  sourceUrl?: string;
  discoveredAt: string;
  verified: boolean;
  tags: string[];
  metadata: Record<string, unknown>;
};

const requestTimeout = 8000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const fetchJson = async (url: string, init?: RequestInit, options: { timeout?: number; retries?: number } = {}) => {
  const timeout = options.timeout ?? requestTimeout;
  const retries = options.retries ?? 1;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      const retriable = response.status === 429 || response.status === 408 || (response.status >= 500 && response.status < 600);
      if (retriable && attempt < retries) {
        clearTimeout(timer);
        await sleep(1200 * (attempt + 1));
        continue;
      }
      if (response.status === 429) throw new Error('rate limited by provider (HTTP 429)');
      if (!response.ok) throw new Error(`Upstream request failed: ${response.status}`);
      return await response.json();
    } catch (error) {
      clearTimeout(timer);
      if (error instanceof Error && error.name === 'AbortError') {
        if (attempt < retries) {
          await sleep(800);
          continue;
        }
        throw new Error(`provider timed out after ${timeout}ms`);
      }
      if (attempt < retries) {
        await sleep(800);
        continue;
      }
      throw error;
    }
  }
  throw new Error('Upstream provider unreachable');
};

const emptyEntity = (entity: Omit<SearchEntity, 'discoveredAt'>): SearchEntity => ({
  ...entity,
  discoveredAt: new Date().toISOString(),
});

async function searchLocalEntities(database: any, type: SearchType, value: string, limit = 25, offset = 0): Promise<SearchEntity[]> {
  const pattern = `%${value}%`;
  const typeFilter = type === 'all' ? database`AND TRUE` : database`AND type = ${type}`;
  const rows = await database`
    SELECT id, type, value, label, confidence, source,
           source_name AS "sourceName", source_url AS "sourceUrl",
           discovered_at AS "discoveredAt", verified, metadata
    FROM entities
    WHERE label ILIKE ${pattern} OR value ILIKE ${pattern}
    ${typeFilter}
    ORDER BY confidence DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  return rows.map((row: any) => ({
    id: row.id,
    type: row.type,
    value: row.value,
    label: row.label,
    confidence: row.confidence,
    source: row.source ?? 'other',
    sourceName: row.sourceName ?? 'Local database',
    sourceUrl: row.sourceUrl ?? undefined,
    discoveredAt: row.discoveredAt,
    verified: row.verified,
    tags: row.metadata?.tags ?? [],
    metadata: { ...(row.metadata ?? {}), local: true },
  }));
}

async function searchLocations(query: string): Promise<SearchEntity[]> {
  const nominatimUrl = new URL('https://nominatim.openstreetmap.org/search');
  nominatimUrl.searchParams.set('format', 'jsonv2');
  nominatimUrl.searchParams.set('limit', '10');
  nominatimUrl.searchParams.set('q', query);
  nominatimUrl.searchParams.set('accept-language', 'en');

  try {
    const locations = await fetchJson(nominatimUrl.toString(), {
      headers: {
        'User-Agent': 'HaryanaPoliceOSINT/1.0 (haryana-police-osint web application)',
        'Accept': 'application/json',
        'Accept-Language': 'en',
      },
    }, { timeout: 5000, retries: 0 });

    return locations.map((location: any) => emptyEntity({
      id: `osm-${location.place_id}`,
      type: 'location',
      value: location.display_name,
      label: location.display_name,
      confidence: 80,
      source: 'other',
      sourceName: 'OpenStreetMap Nominatim',
      sourceUrl: location.osm_type && location.osm_id
        ? `https://www.openstreetmap.org/${location.osm_type}/${location.osm_id}`
        : undefined,
      verified: false,
      tags: ['geolocation', 'public_data'],
      metadata: {
        latitude: location.lat,
        longitude: location.lon,
        category: location.type,
      },
    }));
  } catch {
    const photonUrl = new URL('https://photon.komoot.io/api/');
    photonUrl.searchParams.set('q', query);
    photonUrl.searchParams.set('limit', '10');
    photonUrl.searchParams.set('lang', 'en');

    const data = await fetchJson(photonUrl.toString(), {
      headers: { 'User-Agent': 'HaryanaPoliceOSINT/1.0 (haryana-police-osint web application)' },
    }, { timeout: 5000, retries: 0 });

    return (data.features ?? []).flatMap((feature: any, index: number) => {
      const id = feature.properties?.osm_id ?? index;
      const label = feature.properties?.name ? `${feature.properties.name}, ${feature.properties?.extent ?? feature.properties?.city ?? feature.properties?.country ?? ''}`.replace(/,\s*$/, '').trim() : feature.properties?.label;
      if (!label) return [];
      return [emptyEntity({
        id: `photon-${feature.properties?.osm_type ?? ''}-${id}`,
        type: 'location',
        value: label,
        label,
        confidence: 75,
        source: 'other',
        sourceName: 'OpenStreetMap (Photon)',
        sourceUrl: feature.properties?.osm_type && feature.properties?.osm_id
          ? `https://www.openstreetmap.org/${feature.properties.osm_type}/${feature.properties.osm_id}`
          : undefined,
        verified: false,
        tags: ['geolocation', 'public_data'],
        metadata: {
          latitude: feature.geometry?.coordinates?.[1],
          longitude: feature.geometry?.coordinates?.[0],
          category: feature.properties?.type,
        },
      })];
    });
  }
}

async function searchWikidata(query: string, entityType: SearchType): Promise<SearchEntity[]> {
  const url = new URL('https://www.wikidata.org/w/api.php');
  url.searchParams.set('action', 'wbsearchentities');
  url.searchParams.set('search', query);
  url.searchParams.set('language', 'en');
  url.searchParams.set('uselang', 'en');
  url.searchParams.set('limit', '10');
  url.searchParams.set('format', 'json');
  const data = await fetchJson(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'HaryanaPoliceOSINT/1.0 (haryana-police-osint web application)' },
  }, { timeout: 5000, retries: 0 });

  return (data.search ?? []).map((item: any) => emptyEntity({
    id: `wikidata-${item.id}`,
    type: entityType === 'organization' ? 'organization' : 'person',
    value: item.label,
    label: item.label,
    confidence: 72,
    source: 'public_records',
    sourceName: 'Wikidata',
    sourceUrl: `https://www.wikidata.org/wiki/${item.id}`,
    verified: false,
    tags: ['knowledge_graph', 'public_data'],
    metadata: { description: item.description ?? '' },
  }));
}

async function searchWikipedia(query: string, entityType: SearchType): Promise<SearchEntity[]> {
  const url = new URL('https://en.wikipedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('list', 'search');
  url.searchParams.set('srsearch', query);
  url.searchParams.set('srlimit', '6');
  url.searchParams.set('srnamespace', '0');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');

  const data = await fetchJson(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'HaryanaPoliceOSINT/1.0 (haryana-police-osint web application)' },
  }, { timeout: 5000, retries: 0 });

  return (data.query?.search ?? []).map((item: any) => emptyEntity({
    id: `wiki-${item.pageid}`,
    type: entityType === 'organization' ? 'organization' : 'person',
    value: item.title,
    label: item.title,
    confidence: 70,
    source: 'public_records',
    sourceName: 'Wikipedia',
    sourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
    verified: false,
    tags: ['knowledge_graph', 'public_data'],
    metadata: { description: item.snippet?.replace(/<\/?[^>]+>/g, '') ?? '', wikiSnippet: true },
  }));
}

async function searchNews(query: string): Promise<SearchEntity[]> {
  const url = new URL('https://api.gdeltproject.org/api/v2/doc/doc');
  url.searchParams.set('query', `"${query}"`);
  url.searchParams.set('mode', 'artlist');
  url.searchParams.set('format', 'json');
  url.searchParams.set('maxrecords', '5');
  url.searchParams.set('sort', 'HybridRel');
  url.searchParams.set('timespan', '1y');
  const data = await fetchJson(url.toString(), {}, { timeout: 3000, retries: 0 });

  return (data.articles ?? []).map((article: any, index: number) => emptyEntity({
    id: `gdelt-${index}-${article.url}`,
    type: 'document',
    value: article.title,
    label: article.title,
    confidence: 65,
    source: 'news',
    sourceName: article.domain || 'GDELT',
    sourceUrl: article.url,
    verified: false,
    tags: ['news', 'public_data'],
    metadata: {
      domain: article.domain,
      language: article.language,
      publishedAt: article.seendate,
    },
  }));
}

const isIPv4 = (value: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(value.trim());
const isHash = (value: string) => /^[a-fA-F0-9]{32}$/.test(value) || /^[a-fA-F0-9]{40}$/.test(value) || /^[a-fA-F0-9]{64}$/.test(value);
const isDomainLike = (value: string) => /^(?!-)[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$/i.test(value.trim()) && !/\s/.test(value);

async function searchThreatIntel(query: string): Promise<SearchEntity[]> {
  const value = query.trim();
  const out: SearchEntity[] = [];

  if (isIPv4(value)) {
    const data = await fetchJson(`https://ipwho.is/${encodeURIComponent(value)}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'HaryanaPoliceOSINT/1.0 (haryana-police-osint web application)' },
    }, { timeout: 4000, retries: 0 });
    if (data?.success === false) throw new Error(data?.message || 'IP lookup failed');
    out.push(emptyEntity({
      id: `threat-ip-${value}`,
      type: 'location',
      value: `${data.ip ?? value} — ${data.city ?? ''} ${data.country ?? ''}`.trim(),
      label: `${data.ip ?? value} (${data.country ?? 'unknown country'})`,
      confidence: 62,
      source: 'threat_intel',
      sourceName: 'IPWho.is',
      verified: false,
      tags: ['threat_intel', 'ip_reputation'],
      metadata: { ip: data.ip, asn: data.connection?.asn, org: data.connection?.org, isp: data.connection?.isp, city: data.city, country: data.country },
    }));
    return out;
  }

  if (isHash(value)) {
    const response = await fetch('https://mb-api.abuse.ch/api/v1/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'HaryanaPoliceOSINT/1.0 (haryana-police-osint web application)' },
      body: new URLSearchParams({ query: 'get_info', hash: value }).toString(),
    });
    if (!response.ok) throw new Error(`MalwareBazaar request failed: ${response.status}`);
    const data = await response.json();
    if (data?.query_status !== 'ok' || !data?.data?.length) return [];
    return data.data.slice(0, 5).map((sample: any, index: number) => emptyEntity({
      id: `threat-hash-${value}-${index}`,
      type: 'document',
      value: sample.sha256_hash || sample.sha1_hash || sample.md5_hash || value,
      label: `${sample.file_name || 'malware sample'} (${sample.file_type || 'unknown type'})`,
      confidence: 68,
      source: 'threat_intel',
      sourceName: 'MalwareBazaar',
      verified: false,
      tags: ['threat_intel', 'malware_hash'],
      metadata: { signature: sample.signature, fileType: sample.file_type, firstSeen: sample.first_seen, tags: sample.tags },
    }));
  }

  if (isDomainLike(value)) {
    const data = await fetchJson(`https://urlscan.io/api/v1/search/?q=${encodeURIComponent(`domain:${value}`)}&size=5`, {
      headers: { Accept: 'application/json', 'User-Agent': 'HaryanaPoliceOSINT/1.0 (haryana-police-osint web application)' },
    }, { timeout: 4000, retries: 0 });
    return (data.results ?? []).map((scan: any, index: number) => emptyEntity({
      id: `threat-urlscan-${index}-${scan._id ?? value}`,
      type: 'document',
      value: scan.page?.url || value,
      label: scan.page?.url || value,
      confidence: 60,
      source: 'threat_intel',
      sourceName: 'urlscan.io',
      sourceUrl: scan.result || undefined,
      verified: false,
      tags: ['threat_intel', 'url_scan'],
      metadata: { country: scan.page?.country, ip: scan.page?.ip, server: scan.page?.server },
    }));
  }

  return [];
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireAuth(request, requireDatabase(), { permission: 'search.execute' })
    .catch(() => ({ ok: false as const, status: 503 as const, error: 'Search is unavailable' }));
  if (!auth.ok) return response.status(auth.status).json({ error: auth.error });

  const type = String(request.query.type || 'all') as SearchType;
  const value = String(request.query.value || '').trim();
  const page = Math.max(1, parseInt(String(request.query.page || '1'), 10));
  const limit = Math.min(50, Math.max(1, parseInt(String(request.query.limit || '25'), 10)));
  const offset = (page - 1) * limit;

  if (!value) return response.status(400).json({ error: 'Search value is required' });

  const shouldSearchLocations = type === 'location' || type === 'all' || type === 'person' || type === 'organization';
  const shouldSearchNews = type !== 'crypto_wallet';
  const shouldSearchKnowledge = ['person', 'organization', 'username', 'all'].includes(type);
  const threatIntelOn = String(request.query.threatIntel ?? 'on') !== 'off';
  const shouldSearchThreatIntel = threatIntelOn && type !== 'crypto_wallet';
  const jobs: Promise<SearchEntity[]>[] = [];

  const sourceNames: string[] = [];
  const sourceErrors: string[] = [];
  const addJob = (name: string, job: Promise<SearchEntity[]>) => {
    sourceNames.push(name);
    jobs.push(job.catch((error) => {
      sourceErrors.push(`${name}: ${error instanceof Error ? error.message : 'request failed'}`);
      return [];
    }));
  };

  if (shouldSearchLocations) addJob('OpenStreetMap', searchLocations(value));
  if (shouldSearchKnowledge) {
    addJob('Wikidata', searchWikidata(value, type));
    addJob('Wikipedia', searchWikipedia(value, type));
  }
  if (shouldSearchNews) addJob('GDELT', searchNews(value));
  if (shouldSearchThreatIntel) addJob('Threat intel', searchThreatIntel(value));

  const settled = await Promise.allSettled(jobs);
  const externalResults = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  const executedAt = new Date().toISOString();

  let localResults: SearchEntity[] = [];
  try {
    const database = requireDatabase();
    sourceNames.push('Local database');
    localResults = await searchLocalEntities(database, type, value, limit, offset);
  } catch (error) {
    sourceErrors.push(`Local database: ${error instanceof Error ? error.message : 'request failed'}`);
  }

  const localValues = new Set(localResults.map((entity) => entity.value.toLowerCase()));
  const seenValues = new Set(localValues);
  const dedupedExternal = externalResults.filter((entity) => {
    const key = entity.value.toLowerCase();
    if (seenValues.has(key) || entity.value.length < 2) return false;
    seenValues.add(key);
    return true;
  });
  const allResults = [
    ...localResults,
    ...dedupedExternal,
  ];

  const totalCount = allResults.length;
  const totalPages = Math.ceil(totalCount / limit);
  const results = allResults.slice(offset, offset + limit);

  try {
    const database = requireDatabase();
    await database`
      INSERT INTO search_runs (id, search_type, search_value, result_count, sources)
      VALUES (${randomUUID()}, ${type}, ${value}, ${totalCount}, ${JSON.stringify(sourceNames)})
    `;

    for (const entity of dedupedExternal) {
      await database`
        INSERT INTO entities (
          id, type, value, label, confidence, source, source_name,
          source_url, verified, metadata, discovered_at
        )
        VALUES (
          ${entity.id}, ${entity.type}, ${entity.value}, ${entity.label},
          ${entity.confidence}, ${entity.source}, ${entity.sourceName},
          ${entity.sourceUrl ?? null}, ${entity.verified},
          ${JSON.stringify({ ...entity.metadata, tags: entity.tags })},
          ${entity.discoveredAt}
        )
        ON CONFLICT (type, value) DO UPDATE SET
          label = EXCLUDED.label,
          confidence = EXCLUDED.confidence,
          source = EXCLUDED.source,
          source_name = EXCLUDED.source_name,
          source_url = EXCLUDED.source_url,
          verified = EXCLUDED.verified,
          metadata = EXCLUDED.metadata,
          discovered_at = EXCLUDED.discovered_at
      `;
    }
  } catch (error) {
    console.error('Search history persistence failed:', error);
  }

  return response.status(200).json({
    query: { type, value },
    results,
    totalCount,
    totalPages,
    page,
    limit,
    executedAt,
    sources: sourceNames,
    sourceErrors,
  });
}
