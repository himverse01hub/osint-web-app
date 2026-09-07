import type { VercelRequest, VercelResponse } from '@vercel/node';

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

const fetchJson = async (url: string, init?: RequestInit) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeout);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`Upstream request failed: ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
};

const emptyEntity = (entity: Omit<SearchEntity, 'discoveredAt'>): SearchEntity => ({
  ...entity,
  discoveredAt: new Date().toISOString(),
});

async function searchLocations(query: string): Promise<SearchEntity[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '10');
  url.searchParams.set('q', query);

  const locations = await fetchJson(url.toString(), {
    headers: { 'User-Agent': 'HaryanaPoliceOSINT/1.0' },
  });

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
    headers: { Accept: 'application/json', 'User-Agent': 'HaryanaPoliceOSINT/1.0' },
  });

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

async function searchNews(query: string): Promise<SearchEntity[]> {
  const url = new URL('https://api.gdeltproject.org/api/v2/doc/doc');
  url.searchParams.set('query', query);
  url.searchParams.set('mode', 'artlist');
  url.searchParams.set('format', 'json');
  url.searchParams.set('maxrecords', '10');
  url.searchParams.set('sort', 'HybridRel');

  const data = await fetchJson(url.toString());
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

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const type = String(request.query.type || 'all') as SearchType;
  const value = String(request.query.value || '').trim();

  if (!value) return response.status(400).json({ error: 'Search value is required' });

  const shouldSearchLocations = type === 'location' || type === 'all';
  const shouldSearchNews = type !== 'crypto_wallet';
  const shouldSearchKnowledge = ['person', 'organization', 'username', 'all'].includes(type);
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

  if (shouldSearchLocations) addJob('OpenStreetMap Nominatim', searchLocations(value));
  if (shouldSearchKnowledge) addJob('Wikidata', searchWikidata(value, type));
  if (shouldSearchNews) addJob('GDELT', searchNews(value));

  const settled = await Promise.allSettled(jobs);
  const results = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : []);

  return response.status(200).json({
    query: { type, value },
    results,
    totalCount: results.length,
    executedAt: new Date().toISOString(),
    sources: sourceNames,
    sourceErrors,
  });
}
