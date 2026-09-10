import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireDatabase } from './_lib/db.js';

const STOPWORDS = new Set([
  'a', 'an', 'the', 'to', 'of', 'for', 'with', 'and', 'or', 'in', 'on', 'at',
  'me', 'my', 'find', 'show', 'list', 'get', 'all', 'any', 'are', 'is', 'please',
  'this', 'that', 'these', 'those', 'linked', 'associated', 'connected', 'related',
  'accounts', 'connections', 'profile', 'between', 'two', 'persons', 'people',
]);

function extractSubject(query: string, contextLabel: string | null): string | null {
  if (contextLabel) return contextLabel;
  const tokens = query
    .toLowerCase()
    .replace(/[?,.\!]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
  return tokens.sort((a, b) => b.length - a.length)[0] ?? null;
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST' && request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const database = requireDatabase();
    const body = request.body ?? {};
    const query = String(body.query ?? request.query.q ?? '').trim();
    const contextEntityId = body.contextEntityId ? String(body.contextEntityId) : undefined;

    if (!query) return response.status(400).json({ error: 'query is required' });

    const queryLower = query.toLowerCase();
    const [entityRows, relationshipRows] = await Promise.all([
      database`
        SELECT id, type, value, label, confidence, source, source_name AS "sourceName",
               source_url AS "sourceUrl", discovered_at AS "discoveredAt", verified, metadata
        FROM entities ORDER BY discovered_at DESC LIMIT 1000
      `,
      database`SELECT * FROM relationships ORDER BY created_at DESC LIMIT 2000`,
    ]);

    let entities = entityRows.map((row) => ({
      ...(row.metadata ?? {}),
      id: row.id, type: row.type, value: row.value, label: row.label,
      confidence: row.confidence, source: row.source, sourceName: row.sourceName,
      sourceUrl: row.sourceUrl ?? undefined, discoveredAt: row.discoveredAt,
      verified: row.verified, tags: row.metadata?.tags ?? [], metadata: row.metadata ?? {},
    }));

    let subject: any = null;
    if (contextEntityId) {
      subject = entities.find((entity) => entity.id === contextEntityId) ?? null;
    }
    if (!subject) {
      const subjectLabel = extractSubject(query, null);
      if (subjectLabel) {
        subject = entities.find((entity) =>
          entity.label.toLowerCase().includes(subjectLabel) ||
          entity.value.toLowerCase().includes(subjectLabel)
        ) ?? null;
      }
    }

    const connected = new Set<string>();
    const subjectRelationships = subject ? relationshipRows.filter((rel) =>
      rel.source_entity_id === subject.id || rel.target_entity_id === subject.id
    ) : [];
    const relatedIds = new Set<string>();
    for (const rel of subjectRelationships) {
      connected.add(rel.source_entity_id);
      connected.add(rel.target_entity_id);
      relatedIds.add(rel.source_entity_id === subject.id ? rel.target_entity_id : rel.source_entity_id);
    }
    const relatedEntities = entities.filter((entity) => relatedIds.has(entity.id));

    let metadataType = 'entity_search';
    let confidence = 0.6;
    if (/crypto|wallet|blockchain|bitcoin|ether/.test(queryLower)) metadataType = 'crypto_analysis';
    else if (/social|profile|username|facebook|twitter|linkedin/.test(queryLower)) metadataType = 'social_media_summary';
    else if (/connect|relationship|network|between|graph/.test(queryLower)) metadataType = 'relationship_analysis';
    else if (/summar|activit|overview|digest/.test(queryLower)) metadataType = 'activity_summary';
    else if (/phone/.test(queryLower)) metadataType = 'phone_lookup';
    else if (/organi[sz]ation|company|firm/.test(queryLower)) metadataType = 'organization_summary';

    const lines: string[] = [];
    if (subject) {
      subjectRelationships.length > 0 ? (confidence = 0.85) : (confidence = 0.7);
      lines.push(`Found "${subject.label}" (${subject.type.replace('_', ' ')} entity).`);
      lines.push('');
      lines.push(`The database currently holds ${entityRows.length} entities and ${relationshipRows.length} ${relationshipRows.length === 1 ? 'relationship' : 'relationships'}.`);
      lines.push(`"${subject.label}" has ${subjectRelationships.length} ${subjectRelationships.length === 1 ? 'connection' : 'connections'} to ${relatedEntities.length} other ${relatedEntities.length === 1 ? 'entity' : 'entities'}:`);
      lines.push('');
      relatedEntities.slice(0, 25).forEach((entity) => {
        lines.push(`• ${entity.label || entity.value} (${entity.type.replace('_', ' ')}): ${entity.confidence}% confidence, source ${entity.sourceName}`);
      });
      if (relatedEntities.length === 0) lines.push('• No related entities recorded yet. Use the Settings > Data Management page to add entities and relationships.');
    } else {
      const matches = entities.filter((entity) =>
        entity.label.toLowerCase().includes(queryLower.substring(0, 40)) ||
        entity.value.toLowerCase().includes(queryLower)
      );
      lines.push(`I could not find a specific entity matching that description in the database.`);
      lines.push('');
      lines.push(`However, here are the current database totals across all entities:`);
      lines.push('');
      lines.push(`• Persons: ${entities.filter((e) => e.type === 'person').length}`);
      lines.push(`• Phone numbers: ${entities.filter((e) => e.type === 'phone').length}`);
      lines.push(`• Emails: ${entities.filter((e) => e.type === 'email').length}`);
      lines.push(`• Usernames: ${entities.filter((e) => e.type === 'username').length}`);
      lines.push(`• Organizations: ${entities.filter((e) => e.type === 'organization').length}`);
      lines.push(`• Locations: ${entities.filter((e) => e.type === 'location').length}`);
      lines.push(`• Crypto wallets: ${entities.filter((e) => e.type === 'crypto_wallet').length}`);
      lines.push(`• Relationship records: ${relationshipRows.length}`);
      lines.push('');
      if (matches.length > 0) {
        lines.push(`Closest matches for "${query}":`);
        matches.slice(0, 5).forEach((entity) => lines.push(`• ${entity.label || entity.value} — ${entity.sourceName}`));
      } else {
        lines.push('Search OSINT for new leads, or add entities in Settings > Data Management, then ask again.');
      }
      confidence = 0.5;
    }

    return response.status(200).json({
      reply: lines.join('\n'),
      metadata: {
        type: metadataType,
        confidence,
        entityId: subject?.id,
        entityType: subject?.type,
      },
    });
  } catch (error) {
    console.error('Assistant request failed:', error);
    return response.status(503).json({ error: 'Assistant is unavailable' });
  }
}