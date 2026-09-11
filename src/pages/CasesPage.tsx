import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { InvestigationCase } from '../types/osint';
import { Pagination } from '../components/Pagination';

type CaseForm = {
  caseNumber: string;
  title: string;
  description: string;
  status: InvestigationCase['status'];
  priority: InvestigationCase['priority'];
  coAccused?: string[];
  phone?: string;
  email?: string;
  address?: string;
  anyId?: string;
};

const emptyForm: CaseForm = {
  caseNumber: '',
  title: '',
  description: '',
  status: 'open',
  priority: 'medium',
  coAccused: [],
  phone: '',
  email: '',
  address: '',
  anyId: '',
};

export const CasesPage = () => {
  const [cases, setCases] = useState<InvestigationCase[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<InvestigationCase['priority'] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingCase, setEditingCase] = useState<InvestigationCase | null>(null);
  const [form, setForm] = useState<CaseForm>(emptyForm);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [modalSearch, setModalSearch] = useState('');

  const loadCases = async (loadPage = page, loadLimit = limit) => {
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(loadPage));
      params.set('limit', String(loadLimit));
      if (selectedPriority) params.set('priority', selectedPriority);
      
      const response = await fetch(`/api/cases?${params.toString()}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not load cases');
      setCases(data.cases ?? []);
      setTotalPages(data.totalPages || 1);
      setTotalCount(data.total || 0);
      setPage(loadPage);
      setLimit(loadLimit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load cases');
    }
  };

  useEffect(() => { void loadCases(1, limit); }, [selectedPriority]);

  useEffect(() => { void loadCases(); }, []);

  const openCreate = () => {
    setEditingCase(null);
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  };

  const openEdit = (caseItem: InvestigationCase) => {
    setEditingCase(caseItem);
    setForm({
      caseNumber: caseItem.caseNumber,
      title: caseItem.title,
      description: caseItem.description || '',
      status: caseItem.status,
      priority: caseItem.priority,
      coAccused: caseItem.coAccused ?? [],
      phone: caseItem.phone ?? '',
      email: caseItem.email ?? '',
      address: caseItem.address ?? '',
      anyId: caseItem.anyId ?? '',
    });
    setError('');
    setShowForm(true);
  };

  const saveCase = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(editingCase ? `/api/cases?id=${encodeURIComponent(editingCase.id)}` : '/api/cases', {
        method: editingCase ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not save case');
      setShowForm(false);
      setNotice(editingCase ? 'Case updated successfully.' : 'Case created successfully.');
      await loadCases();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save case');
    } finally {
      setSaving(false);
    }
  };

  const removeCase = async (caseItem: InvestigationCase) => {
    if (!window.confirm(`Remove case ${caseItem.caseNumber}? This cannot be undone.`)) return;
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/cases?id=${encodeURIComponent(caseItem.id)}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not remove case');
      setCases(current => current.filter(item => item.id !== caseItem.id));
      setNotice('Case removed successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove case');
    }
  };

  const clearSearch = () => {
    setQuery('');
    setAppliedQuery('');
  };

  const filteredCases = cases.filter((caseItem) => {
    const searchText = appliedQuery.trim().toLowerCase();
    const matchesSearch = !searchText || [caseItem.caseNumber, caseItem.title, caseItem.description]
      .some((value) => String(value ?? '').toLowerCase().includes(searchText));
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-accent-cyan">Investigation workspace</p>
          <h1 className="mt-1 text-3xl font-bold text-white">Case Management</h1>
          <p className="mt-1 text-police-400">Create, edit, review, and remove investigation cases.</p>
        </div>
        <button onClick={openCreate} className="btn-accent px-4 py-2">Create Case</button>
      </div>

      {notice && <div className="rounded border border-green-700 bg-green-950/30 px-4 py-3 text-sm text-green-300">{notice}</div>}
      {error && <div className="rounded border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-300">{error}</div>}

      <form className="card p-4" onSubmit={(event) => { event.preventDefault(); setAppliedQuery(query); }}>
        <label htmlFor="investigation-search" className="mb-2 block text-sm text-police-300">Search cases</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input id="investigation-search" value={query} onChange={(event) => setQuery(event.target.value)} className="input-field w-full" placeholder="Search by case number, title, status or priority" />
          <div className="flex gap-2 sm:flex-shrink-0">
            <button type="submit" className="btn-primary px-4 py-2">Search</button>
            <button type="button" onClick={clearSearch} className="btn-secondary px-4 py-2">Clear</button>
          </div>
        </div>
      </form>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(['critical', 'high', 'medium', 'low'] as const).map((priority) => (
          <button
            key={priority}
            type="button"
            onClick={() => {
              const newPriority = selectedPriority === priority ? null : priority;
              setSelectedPriority(newPriority);
              setShowCaseModal(!!newPriority);
            }}
            className={`card p-4 text-left transition-colors hover:border-accent-cyan ${selectedPriority === priority ? 'border-accent-cyan bg-accent-cyan/10' : ''}`}
            aria-pressed={selectedPriority === priority}
          >
            <p className="capitalize text-police-400">{priority}</p>
            <p className="mt-1 text-2xl font-bold text-white">{cases.filter((caseItem) => caseItem.priority === priority).length}</p>
          </button>
        ))}
      </div>

      {showCaseModal && selectedPriority && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="card w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-police-700">
              <h2 className="text-xl font-semibold text-white capitalize">{selectedPriority} Priority Cases</h2>
              <button onClick={() => { setShowCaseModal(false); setModalSearch(''); }} className="text-police-400 hover:text-white text-2xl">&times;</button>
            </div>
            <div className="p-4 border-b border-police-700">
              <input
                type="text"
                className="input-field w-full"
                placeholder="Type case number, title, or keyword to search..."
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="overflow-x-auto flex-1">
              {!modalSearch.trim() ? (
                <div className="p-8 text-center text-police-500">
                  <p className="text-lg mb-2">No search query</p>
                  <p className="text-sm">Type above to search for cases</p>
                </div>
              ) : (
                <table className="table min-w-[600px]">
                  <thead><tr><th>Case</th><th>Status</th><th>Priority</th><th>Updated</th><th className="text-right">Actions</th></tr></thead>
                  <tbody>
                    {filteredCases
                      .filter((caseItem) => {
                        const search = modalSearch.toLowerCase();
                        return [
                          caseItem.caseNumber,
                          caseItem.title,
                          caseItem.description,
                          caseItem.status,
                          caseItem.priority,
                        ].some((value) => String(value ?? '').toLowerCase().includes(search));
                      })
                      .map((caseItem) => (
                        <tr key={caseItem.id}>
                          <td><Link to={`/case/${caseItem.id}`} className="font-semibold text-white hover:text-accent-cyan">{caseItem.caseNumber}</Link><p className="text-xs text-police-500">{caseItem.title}</p></td>
                          <td><span className="badge badge-info capitalize">{caseItem.status}</span></td>
                          <td><span className={`badge capitalize ${caseItem.priority === 'critical' ? 'badge-danger' : caseItem.priority === 'high' ? 'badge-warning' : 'badge-primary'}`}>{caseItem.priority}</span></td>
                          <td className="text-sm text-police-400">{new Date(caseItem.updatedAt).toLocaleDateString()}</td>
                          <td><div className="flex justify-end gap-2"><button onClick={() => openEdit(caseItem)} className="btn-secondary px-3 py-1.5 text-sm">Edit</button><button onClick={() => void removeCase(caseItem)} className="btn-danger px-3 py-1.5 text-sm">Remove</button></div></td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="p-4 border-t border-police-700 flex justify-between items-center">
              <p className="text-sm text-police-400">
                {modalSearch.trim()
                  ? `${filteredCases.filter((caseItem) => [caseItem.caseNumber, caseItem.title, caseItem.description, caseItem.status, caseItem.priority].some((value) => String(value ?? '').toLowerCase().includes(modalSearch.toLowerCase()))).length} matching case(s)`
                  : `${cases.filter((caseItem) => caseItem.priority === selectedPriority).length} total case(s)`}
              </p>
              <button onClick={() => { setShowCaseModal(false); setModalSearch(''); }} className="btn-secondary px-4 py-2">Close</button>
            </div>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalCount={totalCount}
          limit={limit}
          onPageChange={(newPage) => { void loadCases(newPage); }}
          onLimitChange={(newLimit) => { void loadCases(1, newLimit); }}
        />
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form onSubmit={saveCase} className="card w-full max-w-lg space-y-4 p-6">
            <div className="flex items-center justify-between"><h2 className="text-xl font-semibold text-white">{editingCase ? 'Edit Case' : 'Create Case'}</h2><button type="button" onClick={() => setShowForm(false)} className="text-police-400 hover:text-white">Close</button></div>
            <div><label htmlFor="case-number" className="mb-2 block text-sm text-police-300">Case Number</label><input id="case-number" required value={form.caseNumber} onChange={(event) => setForm({ ...form, caseNumber: event.target.value })} className="input-field w-full" placeholder="CASE-2026-0001" /></div>
            <div><label htmlFor="case-title" className="mb-2 block text-sm text-police-300">Case Title</label><input id="case-title" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="input-field w-full" placeholder="Investigation title" /></div>
            <div><label htmlFor="case-description" className="mb-2 block text-sm text-police-300">Description</label><textarea id="case-description" rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="input-field w-full" placeholder="Add case context" /></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label htmlFor="case-status" className="text-sm text-police-300">Status<select id="case-status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as CaseForm['status'] })} className="input-field mt-2 w-full"><option value="open">Open</option><option value="active">Active</option><option value="closed">Closed</option><option value="archived">Archived</option></select></label><label htmlFor="case-priority" className="text-sm text-police-300">Priority<select id="case-priority" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as CaseForm['priority'] })} className="input-field mt-2 w-full"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label></div>
                        <div><label htmlFor="case-coaccused" className="mb-2 block text-sm text-police-300">Co-Accused (one per line)</label><textarea id="case-coaccused" rows={3} value={form.coAccused?.join('\n') ?? ''} onChange={(event) => setForm({ ...form, coAccused: event.target.value.split('\n').map(s => s.trim()).filter(Boolean) })} className="input-field w-full" placeholder="Name 1&#10;Name 2&#10;Name 3" /></div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label htmlFor="case-phone" className="text-sm text-police-300">Phone<input id="case-phone" value={form.phone ?? ''} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="input-field mt-2 w-full" placeholder="+91-XXXXXXXXXX" /></label><label htmlFor="case-email" className="text-sm text-police-300">Email ID<input id="case-email" value={form.email ?? ''} onChange={(event) => setForm({ ...form, email: event.target.value })} className="input-field mt-2 w-full" placeholder="email@example.com" /></label></div>
                        <div><label htmlFor="case-address" className="mb-2 block text-sm text-police-300">Address</label><textarea id="case-address" rows={2} value={form.address ?? ''} onChange={(event) => setForm({ ...form, address: event.target.value })} className="input-field w-full" placeholder="Full address" /></div>
                        <div><label htmlFor="case-anyid" className="mb-2 block text-sm text-police-300">Any ID (Aadhaar, PAN, Passport, etc.)</label><input id="case-anyid" value={form.anyId ?? ''} onChange={(event) => setForm({ ...form, anyId: event.target.value })} className="input-field w-full" placeholder="ID number" /></div>
                        <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? 'Saving...' : editingCase ? 'Save Changes' : 'Create Case'}</button>
          </form>
        </div>
      )}
    </div>
  );
};

export default CasesPage;
