import { useState, useEffect, useCallback } from 'react';
import type { FormEvent } from 'react';
import type { DarkWebMention } from '../types/osint';
import { Pagination } from '../components/Pagination';

type MentionRow = DarkWebMention & {
  entityValue?: string;
  status?: 'open' | 'investigating' | 'resolved';
};

const severityOptions = ['low', 'medium', 'high', 'critical'] as const;
const statusOptions = ['open', 'investigating', 'resolved'] as const;
const entityTypeOptions = ['person', 'phone', 'email', 'username', 'organization', 'location', 'crypto_wallet', 'social_account', 'vehicle', 'document'];

const emptyMention = {
  marketPlace: '', listingTitle: '', description: '', entityType: 'email',
  entityValue: '', severity: 'medium', price: '', currency: '', seller: '',
  datePosted: '', dataTypes: '', verified: false, sourceUrl: '',
};

export const DarkWebIntelligencePage = () => {
  const [mentions, setMentions] = useState<MentionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<'all' | DarkWebMention['severity']>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | string>('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyMention);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<{ highRisk: number; verified: number; openItems: number }>({ highRisk: 0, verified: 0, openItems: 0 });

  const loadMentions = useCallback(async (loadPage = page, loadLimit = limit) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(loadPage));
      params.set('limit', String(loadLimit));
      if (filterSeverity !== 'all') params.set('severity', filterSeverity);
      if (filterStatus !== 'all') params.set('status', filterStatus);
      
      const response = await fetch(`/api/dark-web?${params.toString()}`);
      if (!response.ok) throw new Error('Dark web intelligence request failed');
      const data = await response.json();
      setMentions(data.mentions ?? []);
      setTotalPages(data.totalPages || 1);
      setTotalCount(data.total || 0);
      setPage(loadPage);
      setLimit(loadLimit);
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Error loading dark web intelligence:', err);
      setError(err instanceof Error ? err.message : 'Failed to load mentions');
    } finally {
      setLoading(false);
    }
  }, [page, limit, filterSeverity, filterStatus]);

  useEffect(() => {
    void loadMentions(1, limit);
  }, [filterSeverity, filterStatus]);

  useEffect(() => {
    void loadMentions();
  }, [loadMentions]);

  const saveMention = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        ...form,
        dataTypes: form.dataTypes.split(',').map(tag => tag.trim()).filter(Boolean),
        price: form.price || undefined,
        currency: form.currency || undefined,
        seller: form.seller || undefined,
        datePosted: form.datePosted || undefined,
        sourceUrl: form.sourceUrl || undefined,
      };
      const response = await fetch('/api/dark-web', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save mention');
      setMentions(prev => [data.mention, ...prev]);
      setShowForm(false);
      setForm(emptyMention);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save mention');
    } finally {
      setSaving(false);
    }
  };

  const updateMention = async (id: string, patch: Record<string, unknown>) => {
    try {
      const response = await fetch(`/api/dark-web?id=${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Update failed');
      setMentions(prev => prev.map(mention => mention.id === id ? data.mention : mention));
    } catch (err) {
      console.error('Update failed:', err);
    }
  };

  const filteredMentions = mentions.filter(mention => {
    const severityMatch = filterSeverity === 'all' || mention.severity === filterSeverity;
    const statusMatch = filterStatus === 'all' || mention.status === filterStatus;
    return severityMatch && statusMatch;
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/20 text-red-300';
      case 'high': return 'bg-orange-500/20 text-orange-300';
      case 'medium': return 'bg-yellow-500/20 text-yellow-300';
      case 'low': return 'bg-green-500/20 text-green-300';
      default: return 'bg-police-600/20 text-police-300';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved': return 'bg-green-500/20 text-green-300';
      case 'investigating': return 'bg-yellow-500/20 text-yellow-300';
      default: return 'bg-blue-500/20 text-blue-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between space-x-4">
        <div>
          <h1 className="text-2xl font-bold text-gradient">Dark Web Intelligence</h1>
          <p className="text-police-400">Monitoring dark web activity and data leaks from your database</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => void loadMentions(1)} className="btn-secondary px-4 py-2">
            Refresh Data
          </button>
          <button onClick={() => setShowForm(true)} className="btn-accent px-4 py-2">
            Add Mention
          </button>
        </div>
      </div>

      {/* Operational Warning */}
      <div className="bg-yellow-900/50 border border-yellow-700/50 text-yellow-300 text-sm px-4 py-3">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c.77-1.333-.262-3-1.732-3z"></path>
          </svg>
          <span>
            <strong>LEGAL NOTICE:</strong> Never access real dark web marketplaces. Any listings are recorded
            manually by investigators through lawful channels only.
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      {/* Add Mention Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form onSubmit={saveMention} className="card w-full max-w-2xl space-y-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Record Dark Web Mention</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-police-400 hover:text-white">Close</button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-sm text-police-300">Marketplace *
                <input className="input-field mt-1 w-full" required value={form.marketPlace} onChange={e => setForm({ ...form, marketPlace: e.target.value })} placeholder="e.g. DarkWebExchange" />
              </label>
              <label className="text-sm text-police-300">Listing title *
                <input className="input-field mt-1 w-full" required value={form.listingTitle} onChange={e => setForm({ ...form, listingTitle: e.target.value })} />
              </label>
              <label className="text-sm text-police-300 md:col-span-2">Description *
                <textarea className="input-field mt-1 w-full" rows={2} required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </label>
              <label className="text-sm text-police-300">Entity type
                <select className="input-field mt-1 w-full" value={form.entityType} onChange={e => setForm({ ...form, entityType: e.target.value })}>
                  {entityTypeOptions.map(type => <option key={type} value={type}>{type.replace('_', ' ')}</option>)}
                </select>
              </label>
              <label className="text-sm text-police-300">Entity value
                <input className="input-field mt-1 w-full" value={form.entityValue} onChange={e => setForm({ ...form, entityValue: e.target.value })} placeholder="Identifier the mention refers to" />
              </label>
              <label className="text-sm text-police-300">Severity
                <select className="input-field mt-1 w-full" value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}>
                  {severityOptions.map(severity => <option key={severity} value={severity}>{severity}</option>)}
                </select>
              </label>
              <label className="text-sm text-police-300">Data types (comma separated)
                <input className="input-field mt-1 w-full" value={form.dataTypes} onChange={e => setForm({ ...form, dataTypes: e.target.value })} placeholder="email, name, password" />
              </label>
              <label className="text-sm text-police-300">Price
                <input className="input-field mt-1 w-full" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
              </label>
              <label className="text-sm text-police-300">Currency
                <input className="input-field mt-1 w-full" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} placeholder="BTC / USD" />
              </label>
              <label className="text-sm text-police-300">Seller
                <input className="input-field mt-1 w-full" value={form.seller} onChange={e => setForm({ ...form, seller: e.target.value })} />
              </label>
              <label className="text-sm text-police-300">Date posted
                <input className="input-field mt-1 w-full" type="date" value={form.datePosted} onChange={e => setForm({ ...form, datePosted: e.target.value })} />
              </label>
              <label className="flex items-center gap-2 text-sm text-police-300">
                <input type="checkbox" checked={form.verified} onChange={e => setForm({ ...form, verified: e.target.checked })} /> Verified
              </label>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <label className="text-sm text-police-300">Source URL
                <input className="input-field mt-1 w-full" value={form.sourceUrl} onChange={e => setForm({ ...form, sourceUrl: e.target.value })} placeholder="Reference / lawful source" />
              </label>
            </div>
            {formError && <p className="rounded border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300">{formError}</p>}
            <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? 'Saving...' : 'Save Mention'}</button>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 bg-police-900/50 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <span className="text-police-400">Severity:</span>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value as any)}
            className="input-field"
          >
            <option value="all">All Levels</option>
            {severityOptions.map(severity => <option key={severity} value={severity}>{severity}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-police-400">Status:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input-field"
          >
            <option value="all">All</option>
            {statusOptions.map(status => <option key={status} value={status}>{status}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-police-400">Showing:</span>
          <span className="text-police-300 font-medium">{filteredMentions.length} mentions</span>
          <span className="text-police-500">of</span>
          <span className="text-police-300 font-medium">{totalCount} total</span>
        </div>
      </div>

      {/* Mentions List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center text-police-500 py-8">Loading dark web intelligence...</div>
        ) : filteredMentions.length > 0 ? (
          filteredMentions.map((mention) => (
            <div key={mention.id} className="card card-hover p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 flex items-center justify-center rounded-lg
                    ${mention.severity === 'critical' ? 'bg-red-500/20' :
                    mention.severity === 'high' ? 'bg-orange-500/20' :
                    mention.severity === 'medium' ? 'bg-yellow-500/20' : 'bg-green-500/20'}
                  `}>
                    <svg className="h-5 w-5 text-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c.77-1.333-.262-3-1.732-3z"></path>
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-medium text-white">{mention.listingTitle}</h4>
                    <p className="text-police-400 text-sm">
                      Marketplace: {mention.marketPlace} •
                      {mention.datePosted ? new Date(mention.datePosted).toLocaleDateString() : 'Date not available'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs ${getSeverityColor(mention.severity)}`}>
                    {mention.severity.charAt(0).toUpperCase() + mention.severity.slice(1)}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs ${getStatusColor(mention.status ?? 'open')}`}>
                    {(mention.status ?? 'open').charAt(0).toUpperCase() + (mention.status ?? 'open').slice(1)}
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-police-400">{mention.description}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(mention.dataTypes ?? []).map((type) => (
                    <span key={type} className="bg-police-800/50 px-2 py-0.5 rounded text-xs">{type}</span>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-police-400 text-sm">
                  {mention.price && (
                    <span><span className="text-police-300">Price:</span> <span className="font-medium">{mention.price} {mention.currency || ''}</span></span>
                  )}
                  <span><span className="text-police-300">Seller:</span> <span className="font-medium">{mention.seller || 'Unknown'}</span></span>
                  <span>
                    <span className="text-police-300">Entity:</span>{' '}
                    <span className="font-medium text-white">
                      {mention.entityType?.replace('_', ' ')}: {mention.entityValue || 'Manual entry'}
                    </span>
                  </span>
                  <span>
                    <span className="text-police-300">Verified:</span>{' '}
                    <span className={`px-2 py-0.5 rounded-full text-xs ${mention.verified ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                      {mention.verified ? 'Yes' : 'No'}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-police-800">
                  <button
                    onClick={() => void updateMention(mention.id, { verified: !mention.verified })}
                    className="text-sm text-accent-cyan hover:text-accent-400"
                  >
                    {mention.verified ? 'Mark Unverified' : 'Mark Verified'}
                  </button>
                  <select
                    value={mention.status ?? 'open'}
                    onChange={(e) => void updateMention(mention.id, { status: e.target.value })}
                    className="input-field text-sm px-2 py-1"
                  >
                    {statusOptions.map(status => <option key={status} value={status}>{status}</option>)}
                  </select>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center text-police-500 py-8">
            <p>No dark web mentions found.</p>
            <p className="mt-2 text-sm">Use "Add Mention" to record a lawful dark web or data leak finding.</p>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalCount={totalCount}
          limit={limit}
          onPageChange={(newPage) => { void loadMentions(newPage); }}
          onLimitChange={(newLimit) => { void loadMentions(1, newLimit); }}
        />
      )}

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card card-hover p-4">
          <h3 className="text-lg font-semibold text-white mb-3">Total Mentions</h3>
          <p className="text-2xl font-bold text-accent-cyan">{totalCount}</p>
          <p className="text-police-400 text-sm">Records</p>
        </div>
        <div className="card card-hover p-4">
          <h3 className="text-lg font-semibold text-white mb-3">High Risk</h3>
          <p className="text-2xl font-bold text-accent-cyan">
            {stats.highRisk}
          </p>
          <p className="text-police-400 text-sm">Severity</p>
        </div>
        <div className="card card-hover p-4">
          <h3 className="text-lg font-semibold text-white mb-3">Verified</h3>
          <p className="text-2xl font-bold text-accent-cyan">{stats.verified}</p>
          <p className="text-police-400 text-sm">Confirmed</p>
        </div>
        <div className="card card-hover p-4">
          <h3 className="text-lg font-semibold text-white mb-3">Open Items</h3>
          <p className="text-2xl font-bold text-accent-cyan">
            {stats.openItems}
          </p>
          <p className="text-police-400 text-sm">Under review</p>
        </div>
      </div>
    </div>
  );
};

export default DarkWebIntelligencePage;