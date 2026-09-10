import { useState, useEffect, useCallback } from 'react';
import { EntityType } from '../types/osint';
import { Pagination } from './Pagination';

interface EntityRow {
  id: string;
  type: EntityType;
  value: string;
  label: string;
  confidence: number;
  source: string;
  sourceName: string;
  verified: boolean;
  discoveredAt: string;
  tags: string[];
  coAccused?: string[];
  phone?: string;
  email?: string;
  address?: string;
  anyId?: string;
}

const ENTITY_TYPES: Array<{ key: EntityType; label: string }> = [
  { key: 'person', label: 'Person' },
  { key: 'phone', label: 'Phone Number' },
  { key: 'email', label: 'Email Address' },
  { key: 'username', label: 'Username' },
  { key: 'organization', label: 'Organization' },
  { key: 'location', label: 'Location' },
  { key: 'crypto_wallet', label: 'Crypto Wallet' },
  { key: 'social_account', label: 'Social Account' },
  { key: 'vehicle', label: 'Vehicle' },
  { key: 'document', label: 'Document' },
];

const SOURCES = ['social_media', 'news', 'public_records', 'forum', 'database', 'dark_web', 'leaked_data', 'government', 'corporate', 'other', 'blockchain', 'intelligence'];

const emptyForm = {
  type: 'person' as EntityType,
  value: '',
  label: '',
  source: 'other',
  confidence: 60,
  verified: false,
  coAccused: [] as string[],
  phone: '',
  email: '',
  address: '',
  anyId: '',
};

export const EntityManager = ({ onClose }: { onClose: () => void }) => {
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const load = useCallback(async (loadPage = page, loadLimit = limit) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/entities?page=${loadPage}&limit=${loadLimit}`);
      if (!response.ok) throw new Error('Could not load entities');
      const data = await response.json();
      setEntities((data.entities ?? []).filter((entity: EntityRow) => entity.sourceName === 'Investigator entry'));
      setTotalPages(data.totalPages ?? 1);
      setTotalCount(data.total ?? 0);
      setPage(loadPage);
      setLimit(loadLimit);
    } catch (err: any) {
      setError(err.message || 'Could not load entities');
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = query.trim()
    ? entities.filter(e =>
        e.label.toLowerCase().includes(query.toLowerCase()) ||
        e.value.toLowerCase().includes(query.toLowerCase()) ||
        e.type.toLowerCase().includes(query.toLowerCase()))
    : entities;

  const startAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setMessage('');
    setError('');
  };

  const startEdit = (entity: EntityRow) => {
    setEditingId(entity.id);
    setForm({
      type: entity.type,
      value: entity.value,
      label: entity.label,
      source: entity.source,
      confidence: entity.confidence,
      verified: entity.verified,
      coAccused: entity.coAccused ?? [],
      phone: entity.phone ?? '',
      email: entity.email ?? '',
      address: entity.address ?? '',
      anyId: entity.anyId ?? '',
    });
    setShowForm(true);
    setMessage('');
    setError('');
  };

  const saveEntity = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch(editingId ? `/api/entities?id=${encodeURIComponent(editingId)}` : '/api/entities', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          tags: [],
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save entity');
      setShowForm(false);
      setEditingId(null);
      setMessage(editingId ? 'Entity updated.' : 'Entity added.');
      setTimeout(() => setMessage(''), 4000);
      void load();
    } catch (err: any) {
      setError(err.message || 'Could not save entity');
    } finally {
      setSaving(false);
    }
  };

  const deleteEntity = async (id: string) => {
    if (!window.confirm('Delete this entity from the database?')) return;
    try {
      const response = await fetch(`/api/entities?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (response.status !== 204 && !response.ok) throw new Error('Could not delete entity');
      setMessage('Entity deleted.');
      setTimeout(() => setMessage(''), 4000);
      void load();
    } catch (err: any) {
      setError(err.message || 'Could not delete entity');
    }
  };

  const typeCounts = entities.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="card w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Entities</h2>
            <p className="text-police-400 text-sm">View, add, edit or delete discovered entities</p>
          </div>
          <button onClick={onClose} className="text-police-400 hover:text-white">Close</button>
        </div>

        {message && <p className="mb-3 rounded border border-accent-cyan/40 bg-accent-cyan/10 px-3 py-2 text-sm text-accent-cyan">{message}</p>}
        {error && <p className="mb-3 rounded border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</p>}

        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-police-800 px-3 py-1 text-police-300">{entities.length} total</span>
          {Object.entries(typeCounts).slice(0, 6).map(([type, count]) => (
            <span key={type} className="rounded-full bg-police-800/60 px-3 py-1 text-white/70">
              {type.replace('_', ' ')}: {count}
            </span>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Filter entities..."
            className="input-field w-full sm:max-w-xs"
          />
          <button onClick={startAdd} className="btn-accent px-4 py-2">Add Entity</button>
        </div>

        {showForm && (
          <form onSubmit={saveEntity} className="mb-4 space-y-3 rounded-lg bg-police-800/50 p-4">
            <h3 className="font-semibold text-white">{editingId ? 'Edit Entity' : 'Add New Entity'}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm text-police-300">Type
                <select
                  className="input-field mt-1 w-full"
                  value={form.type}
                  onChange={event => setForm({ ...form, type: event.target.value as EntityType })}
                >
                  {ENTITY_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </label>
              <label className="text-sm text-police-300">Value (raw data)
                <input className="input-field mt-1 w-full" required value={form.value}
                  onChange={event => setForm({ ...form, value: event.target.value })} placeholder="Phone, email, name..." />
              </label>
              <label className="text-sm text-police-300">Label (display name)
                <input className="input-field mt-1 w-full" value={form.label}
                  onChange={event => setForm({ ...form, label: event.target.value })} placeholder="Optional — defaults to value" />
              </label>
              <label className="text-sm text-police-300">Source
                <select
                  className="input-field mt-1 w-full"
                  value={form.source}
                  onChange={event => setForm({ ...form, source: event.target.value })}
                >
                  {SOURCES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </label>
              <label className="text-sm text-police-300">Confidence (0-100)
                <input type="number" min={0} max={100} className="input-field mt-1 w-full" value={form.confidence}
                  onChange={event => setForm({ ...form, confidence: Number(event.target.value) })} />
              </label>
              <label className="flex items-center gap-2 text-sm text-police-300">
                <input type="checkbox" checked={form.verified}
                  onChange={event => setForm({ ...form, verified: event.target.checked })} /> Verified
              </label>
            </div>
            <div>
              <label className="mb-1 block text-sm text-police-300">Co-Accused (one per line)</label>
              <textarea
                rows={3}
                className="input-field w-full"
                value={form.coAccused.join('\n')}
                onChange={event => setForm({ ...form, coAccused: event.target.value.split('\n').map(name => name.trim()).filter(Boolean) })}
                placeholder="Name 1\nName 2\nName 3"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm text-police-300">Phone
                <input className="input-field mt-1 w-full" value={form.phone}
                  onChange={event => setForm({ ...form, phone: event.target.value })} placeholder="+91-XXXXXXXXXX" />
              </label>
              <label className="text-sm text-police-300">Email ID
                <input type="email" className="input-field mt-1 w-full" value={form.email}
                  onChange={event => setForm({ ...form, email: event.target.value })} placeholder="email@example.com" />
              </label>
            </div>
            <label className="block text-sm text-police-300">Address
              <textarea rows={2} className="input-field mt-1 w-full" value={form.address}
                onChange={event => setForm({ ...form, address: event.target.value })} placeholder="Full address" />
            </label>
            <label className="block text-sm text-police-300">Any ID (Aadhaar, PAN, Passport, etc.)
              <input className="input-field mt-1 w-full" value={form.anyId}
                onChange={event => setForm({ ...form, anyId: event.target.value })} placeholder="ID number" />
            </label>
            <div className="flex items-center gap-3">
              <button type="submit" disabled={saving} className="btn-primary px-5 py-2">
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Entity'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary px-4 py-2">Cancel</button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="py-8 text-center text-police-400">Loading entities...</div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-police-500">{query ? 'No entities match your filter.' : 'No entities in the database yet. Add one above.'}</div>
        ) : (
          <div className="space-y-2">
            {filtered.map(entity => (
              <div key={entity.id} className="flex items-center gap-3 rounded-lg bg-police-800/50 p-3">
                <div className="flex-shrink-0">
                  <div className="h-9 w-9 flex items-center justify-center rounded-lg bg-police-900/60 text-accent-cyan">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      {entity.type === 'person' && <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></>}
                      {entity.type === 'phone' && <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 2v10.7a2 2 0 0 1-.28 1.395A5.985 5.985 0 0 0 10 9a5.985 5.985 0 0 0-1.326-.168 5 5 0 1 0-8.27 9.406"></path>}
                      {entity.type === 'email' && <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><line x1="22" y1="6" x2="12" y2="13"></line><line x1="2" y1="6" x2="12" y2="13"></line></>}
                      {entity.type === 'username' && <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>}
                      {entity.type === 'organization' && <><rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line></>}
                      {entity.type === 'location' && <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></>}
                      {entity.type === 'crypto_wallet' && <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>}
                      {entity.type === 'social_account' && <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>}
                      {entity.type === 'vehicle' && <path d="M5 17h14M5 17a2 2 0 1 0 0-4m14 4a2 2 0 1 1 0-4m0 4v-1.5a2 2 0 0 0-1.2-1.8L12 7H5a2 2 0 0 0-2 2v8h2m14-4V6a2 2 0 0 0-2-2h-4"></path>}
                      {entity.type === 'document' && <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></>}
                    </svg>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium text-white">{entity.label || entity.value}</p>
                  <p className="truncate text-xs text-police-500">
                    {entity.value} • {entity.source.replace('_', ' ')} • {entity.confidence}% • {entity.verified ? 'Verified' : 'Unverified'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => startEdit(entity)} className="btn-secondary px-3 py-1 text-xs">Edit</button>
                  <button onClick={() => void deleteEntity(entity.id)} className="rounded border border-red-800/60 px-3 py-1 text-xs text-red-300 hover:bg-red-950/40">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalCount={totalCount}
          limit={limit}
          onPageChange={(newPage) => { void load(newPage); }}
          onLimitChange={(newLimit) => { void load(1, newLimit); }}
        />
      )}
    </div>
  );
};

export default EntityManager;