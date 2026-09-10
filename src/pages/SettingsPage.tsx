import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { User } from '../types/auth';
import type { EntityType, SourceType } from '../types/osint';

type EntityRow = { id: string; type: EntityType; value: string; label: string; confidence: number; source: SourceType; sourceName: string; verified: boolean; tags: string[] };
type CaseRow = { id: string; caseNumber: string; title: string; description: string; status: string; priority: string; assignedTo: string | null; tags: string[]; entities: string[] };
type RelationshipRow = { id: string; sourceId: string; targetId: string; type: string; confidence: number; description: string; sourceLabel?: string; targetLabel?: string };

const entityTypes: EntityType[] = ['person', 'phone', 'email', 'username', 'organization', 'location', 'crypto_wallet', 'social_account', 'vehicle', 'document'];
const sourceTypes: SourceType[] = ['public_records', 'government', 'social_media', 'news', 'corporate', 'blockchain', 'database', 'intelligence', 'other'];
const relationshipTypes = [
  'phone_shared', 'email_shared', 'username_shared', 'location_shared',
  'organization_shared', 'crypto_shared', 'social_connection',
  'vehicle_shared', 'document_shared', 'known_associate', 'family',
  'business_partner', 'financial_transaction', 'communication', 'co_occurrence',
];
const userRoles = ['admin', 'investigator', 'analyst', 'supervisor'];
const emptyEntity = { type: 'person' as EntityType, value: '', label: '', confidence: 50, source: 'public_records' as SourceType, sourceName: 'Investigator entry', verified: false, tags: '' };
const emptyCase = { caseNumber: '', title: '', description: '', status: 'open', priority: 'medium', assignedTo: '', tags: '', entities: [] as string[] };
const emptyRelationship = { sourceId: '', targetId: '', type: 'known_associate', confidence: 70, description: '' };
const emptyUserForm = { id: '', username: '', password: '', name: '', email: '', role: 'investigator', department: '', rank: '', phone: '' };

const readSettings = () => { try { return JSON.parse(localStorage.getItem('osint-settings') || '{}'); } catch { return {}; } };

export const SettingsPage = ({ mode = 'settings' }: { mode?: 'settings' | 'data' }) => {
  const { authState, reloadUser } = useAuth();
  const [searchParams] = useSearchParams();
  const user = authState.user;
  const saved = readSettings();
  const tab: 'profile' | 'data' = mode === 'data' ? 'data' : 'profile';
  const relationshipOnly = tab === 'data' && searchParams.get('section') === 'relationships';
  const entityOnly = tab === 'data' && searchParams.get('section') === 'entities';
  const [notice, setNotice] = useState('');
  const [profile, setProfile] = useState({ name: saved.name || user?.name || '', email: saved.email || user?.email || '', department: saved.department || user?.department || '', rank: saved.rank || user?.rank || '', phone: saved.phone || user?.phone || '', badgeNumber: saved.badgeNumber || user?.badgeNumber || '' });
  const [preferences, setPreferences] = useState({ theme: saved.theme || 'dark', language: saved.language || 'en', emailAlerts: saved.emailAlerts ?? true, criticalAlerts: saved.criticalAlerts ?? true });
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [relationships, setRelationships] = useState<RelationshipRow[]>([]);
  const [entity, setEntity] = useState(emptyEntity);
  const [editingEntity, setEditingEntity] = useState<string | null>(null);
  const [caseData, setCaseData] = useState(emptyCase);
  const [editingCase, setEditingCase] = useState<string | null>(null);
  const [entityDropdownOpen, setEntityDropdownOpen] = useState(false);
  const [relationship, setRelationship] = useState(emptyRelationship);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem('osint-settings', JSON.stringify({ ...profile, ...preferences }));
    document.documentElement.lang = preferences.language;
    document.documentElement.dataset.theme = preferences.theme;
  }, [profile, preferences]);

  const notify = (text: string) => { setNotice(text); window.setTimeout(() => setNotice(''), 3500); };
  const loadData = async () => {
    setLoading(true);
    try {
      const [entityResponse, caseResponse, relationshipResponse] = await Promise.all([
        fetch('/api/entities'),
        fetch('/api/cases'),
        fetch('/api/relationships'),
      ]);
      if (!entityResponse.ok || !caseResponse.ok || !relationshipResponse.ok) {
        throw new Error('Database unavailable. Set DATABASE_URL and run db/schema.sql + db/migrations/001_real_time_data.sql.');
      }
      const [entityJson, caseJson, relationshipJson] = await Promise.all([
        entityResponse.json(),
        caseResponse.json(),
        relationshipResponse.json(),
      ]);
      setEntities((entityJson.entities || []).filter((row: EntityRow) => row.sourceName === 'Investigator entry'));
      setCases(caseJson.cases || []);
      setRelationships(relationshipJson.relationships || []);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not load records.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { if (tab === 'data') void loadData(); }, [tab, entityOnly, relationshipOnly]);

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const response = await fetch('/api/auth/users', { credentials: 'same-origin' });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || 'Could not load users.');
      setUsers(json.users ?? []);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not load users.');
    } finally {
      setUsersLoading(false);
    }
  };
  useEffect(() => { void loadUsers(); }, []);

  const saveProfile = async () => {
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || 'Could not save profile.');
      localStorage.setItem('osint-settings', JSON.stringify({ ...profile, ...preferences }));
      await reloadUser();
      notify('Investigator profile saved to the database.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save profile.');
    }
  };

  const savePreferences = () => {
    localStorage.setItem('osint-settings', JSON.stringify({ ...profile, ...preferences }));
    document.documentElement.lang = preferences.language;
    document.documentElement.dataset.theme = preferences.theme;
    notify('Preferences saved.');
  };

  const saveUser = async () => {
    const isEdit = Boolean(userForm.id);
    if (!isEdit && userForm.username.trim().length < 3) return notify('User ID must be at least 3 characters.');
    if (userForm.password && userForm.password.length < 4) return notify('Password must be at least 4 characters.');
    if (!userForm.name.trim()) return notify('Full name is required.');
    const payload = {
      username: userForm.username.trim(),
      password: userForm.password,
      name: userForm.name.trim(),
      email: userForm.email.trim(),
      role: userForm.role,
      department: userForm.department.trim(),
      rank: userForm.rank.trim(),
      phone: userForm.phone.trim(),
    };
    try {
      const response = await fetch(isEdit ? `/api/auth/users?id=${userForm.id}` : '/api/auth/users', {
        method: isEdit ? 'PATCH' : 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || 'Could not save user.');
      setUserForm(emptyUserForm);
      notify(isEdit ? 'Investigator profile updated.' : 'Investigator added with user ID and password.');
      void loadUsers();
      if (isEdit && userForm.id === user?.id) void reloadUser();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save user.');
    }
  };

  const deleteUser = async (id: string) => {
    if (id === user?.id) return notify('You cannot delete your own profile.');
    if (!window.confirm('Delete this investigator profile permanently? They will be removed as a login user.')) return;
    try {
      const response = await fetch(`/api/auth/users?id=${id}`, { method: 'DELETE', credentials: 'same-origin' });
      if (response.status === 204) {
        notify('Investigator profile deleted.');
      } else {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.error || 'Could not delete profile.');
      }
      void loadUsers();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not delete profile.');
    }
  };

  const saveEntity = async (event: FormEvent) => {
    event.preventDefault();
    const payload = { ...entity, label: entity.label || entity.value, tags: entity.tags.split(',').map(tag => tag.trim()).filter(Boolean) };
    const response = await fetch(editingEntity ? `/api/entities?id=${editingEntity}` : '/api/entities', {
      method: editingEntity ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) return notify(json.error || 'Could not save entity.');
    setEntity(emptyEntity);
    setEditingEntity(null);
    notify(editingEntity ? 'Entity updated.' : 'Entity added.');
    void loadData();
  };

  const deleteEntity = async (id: string) => {
    if (!window.confirm('Delete this entity from the database?')) return;
    const response = await fetch(`/api/entities?id=${id}`, { method: 'DELETE' });
    if (!response.ok) return notify('Could not delete entity.');
    notify('Entity deleted.');
    void loadData();
  };

  const saveCase = async (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      ...caseData,
      assignedTo: caseData.assignedTo || undefined,
      tags: caseData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
    };
    const currentCaseId = editingCase;
    try {
      const response = await fetch(currentCaseId ? `/api/cases?id=${currentCaseId}` : '/api/cases', {
        method: currentCaseId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || 'Could not save case.');
      if (currentCaseId && json.case) {
        setCases(previous => previous.map(item => item.id === currentCaseId ? json.case : item));
      } else if (json.case) {
        setCases(previous => [json.case, ...previous]);
      }
      setCaseData(emptyCase);
      setEditingCase(null);
      setEntityDropdownOpen(false);
      notify(currentCaseId ? 'Case updated.' : 'Case added.');
      await loadData();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save case.');
    }
  };

  const saveRelationship = async (event: FormEvent) => {
    event.preventDefault();
    if (!relationship.sourceId || !relationship.targetId) return notify('Select both entities for the relationship.');
    const response = await fetch('/api/relationships', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(relationship),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) return notify(json.error || 'Could not save relationship.');
    setRelationship(emptyRelationship);
    notify('Relationship added.');
    void loadData();
  };

  const deleteRelationship = async (id: string) => {
    if (!window.confirm('Delete this relationship from the database?')) return;
    const response = await fetch(`/api/relationships?id=${id}`, { method: 'DELETE' });
    if (response.status !== 204 && !response.ok) return notify('Could not delete relationship.');
    notify('Relationship deleted.');
    void loadData();
  };

  const entityOptions = entities.length > 0 ? (
    entities.map(row => (
      <option key={row.id} value={row.id}>{row.label || row.value} ({row.type.replace('_', ' ')})</option>
    ))
  ) : (
    <option value="" disabled>No entities yet — add one above</option>
  );

  return <div className="space-y-6">
    <div className="flex items-center justify-between gap-4">
      <div>
        {relationshipOnly || entityOnly ? (
          <div className="flex items-center gap-3">
            <Link to={relationshipOnly ? '/entity-activities' : '/dashboard'} className="text-2xl text-police-300 hover:text-accent-cyan" aria-label="Back" title="Back">
              ←
            </Link>
            <h1 className="text-2xl font-bold text-gradient">{relationshipOnly ? 'Relationship Entry' : 'Entity Records'}</h1>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gradient">{mode === 'data' ? 'Data Management' : 'Settings'}</h1>
            <p className="text-police-400">{mode === 'data' ? 'Manage entities, relationships, and cases' : 'Manage your profile and preferences'}</p>
          </>
        )}
      </div>
      {notice && <div className="rounded border border-accent-cyan/40 bg-accent-cyan/10 px-4 py-2 text-sm text-accent-cyan">{notice}</div>}
    </div>
    {mode === 'data' && !relationshipOnly && !entityOnly && <Link to="/cases" className="btn-secondary inline-flex px-4 py-2">Back to Investigations</Link>}
    {mode === 'settings' && <div className="border-b border-police-700 py-3 font-medium text-white">Profile & Preferences</div>}

    {tab === 'profile' && (
      <div className="space-y-6">
        <section className="card p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-accent-cyan/10">
              <svg className="h-5 w-5 text-accent-cyan" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Users & Access</h2>
              <p className="text-sm text-police-400">Add many investigators with their own user IDs and passwords, edit profile details, or delete a profile.</p>
            </div>
          </div>

          <form
            className="grid grid-cols-1 gap-3 md:grid-cols-3"
            onSubmit={event => { event.preventDefault(); void saveUser(); }}
          >
            <input className="input-field" disabled={Boolean(userForm.id)} placeholder="User ID *" value={userForm.username} onChange={event => setUserForm({ ...userForm, username: event.target.value })} />
            <input className="input-field" type="password" placeholder={userForm.id ? 'New password (leave blank to keep)' : 'Password *'} value={userForm.password} onChange={event => setUserForm({ ...userForm, password: event.target.value })} />
            <input className="input-field" placeholder="Full name *" value={userForm.name} onChange={event => setUserForm({ ...userForm, name: event.target.value })} />
            <input className="input-field" type="email" placeholder="Email" value={userForm.email} onChange={event => setUserForm({ ...userForm, email: event.target.value })} />
            <select className="input-field" value={userForm.role} onChange={event => setUserForm({ ...userForm, role: event.target.value })}>
              {userRoles.map(role => <option key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</option>)}
            </select>
            <input className="input-field" placeholder="Department" value={userForm.department} onChange={event => setUserForm({ ...userForm, department: event.target.value })} />
            <input className="input-field" placeholder="Rank" value={userForm.rank} onChange={event => setUserForm({ ...userForm, rank: event.target.value })} />
            <input className="input-field" placeholder="Phone" value={userForm.phone} onChange={event => setUserForm({ ...userForm, phone: event.target.value })} />
            <div className="flex gap-2">
              <button className="btn-primary px-5 py-2">{userForm.id ? 'Update user' : 'Add user'}</button>
              {userForm.id && <button type="button" className="btn-secondary px-5 py-2" onClick={() => setUserForm(emptyUserForm)}>Cancel</button>}
            </div>
          </form>

          {usersLoading ? <p className="mt-6 text-police-400">Loading users...</p> : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-police-700 text-police-400">
                  <tr>
                    <th className="p-3">User ID</th><th className="p-3">Name</th><th className="p-3">Role</th><th className="p-3">Department</th><th className="p-3">Status</th><th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(row => (
                    <tr key={row.id} className="border-b border-police-800">
                      <td className="p-3 text-accent-cyan">{row.username || <span className="text-police-500">no login set</span>}{row.id === user?.id && <span className="ml-2 rounded bg-accent-cyan/10 px-2 py-0.5 text-xs text-accent-cyan">You</span>}</td>
                      <td className="p-3 text-white">{row.name}<div className="text-xs text-police-500">{row.rank || ''} {row.email}</div></td>
                      <td className="p-3 text-police-300">{row.role}</td>
                      <td className="p-3 text-police-300">{row.department || <span className="text-police-500">—</span>}</td>
                      <td className="p-3 text-police-300">Active</td>
                      <td className="p-3">
                        <button type="button" className="mr-3 text-accent-cyan" onClick={() => setUserForm({
                          id: row.id,
                          username: row.username ?? '',
                          password: '',
                          name: row.name,
                          email: row.email,
                          role: row.role,
                          department: row.department ?? '',
                          rank: row.rank ?? '',
                          phone: row.phone ?? '',
                        })}>Edit</button>
                        <button type="button" className="text-red-400" disabled={row.id === user?.id} onClick={() => deleteUser(row.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!users.length && <p className="p-4 text-police-500">No users yet. Add the first investigator above.</p>}
            </div>
          )}
        </section>
        <section className="card p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Preferences</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="text-sm text-police-300">Theme
              <select className="input-field mt-2 w-full" value={preferences.theme} onChange={event => setPreferences({ ...preferences, theme: event.target.value })}>
                <option value="dark">Dark</option><option value="light">Light</option>
              </select>
            </label>
            <label className="text-sm text-police-300">Language
              <select className="input-field mt-2 w-full" value={preferences.language} onChange={event => setPreferences({ ...preferences, language: event.target.value })}>
                <option value="en">English</option><option value="hi">Hindi</option>
              </select>
            </label>
            <label className="flex items-center gap-3 text-police-300">
              <input type="checkbox" checked={preferences.emailAlerts} onChange={event => setPreferences({ ...preferences, emailAlerts: event.target.checked })} /> Email alerts
            </label>
            <label className="flex items-center gap-3 text-police-300">
              <input type="checkbox" checked={preferences.criticalAlerts} onChange={event => setPreferences({ ...preferences, criticalAlerts: event.target.checked })} /> Critical alerts only
            </label>
          </div>
          <button type="button" className="btn-primary mt-6 px-6 py-2" onClick={() => void saveProfile()}>Save profile</button>
          <button type="button" className="btn-secondary ml-3 mt-6 px-6 py-2" onClick={savePreferences}>Save preferences</button>
        </section>
      </div>
    )}

    {tab === 'data' && (
      <div className="space-y-6">
        {!relationshipOnly && <section className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Entity records</h2>
              <p className="text-sm text-police-400">Add, alter, or remove operational intelligence records.</p>
            </div>
            <button type="button" className="btn-secondary px-4 py-2" onClick={loadData}>Refresh</button>
          </div>
          <form onSubmit={saveEntity} className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <select className="input-field" value={entity.type} onChange={event => setEntity({ ...entity, type: event.target.value as EntityType })}>
              {entityTypes.map(type => <option key={type}>{type}</option>)}
            </select>
            <input className="input-field" required placeholder="Value *" value={entity.value} onChange={event => setEntity({ ...entity, value: event.target.value })} />
            <input className="input-field" placeholder="Label" value={entity.label} onChange={event => setEntity({ ...entity, label: event.target.value })} />
            <input className="input-field" type="number" min="0" max="100" value={entity.confidence} onChange={event => setEntity({ ...entity, confidence: Number(event.target.value) })} />
            <select className="input-field" value={entity.source} onChange={event => setEntity({ ...entity, source: event.target.value as SourceType })}>
              {sourceTypes.map(source => <option key={source}>{source}</option>)}
            </select>
            <input className="input-field" placeholder="Source name" value={entity.sourceName} onChange={event => setEntity({ ...entity, sourceName: event.target.value })} />
            <input className="input-field md:col-span-2" placeholder="Tags, comma separated" value={entity.tags} onChange={event => setEntity({ ...entity, tags: event.target.value })} />
            <label className="flex items-center gap-2 text-sm text-police-300">
              <input type="checkbox" checked={entity.verified} onChange={event => setEntity({ ...entity, verified: event.target.checked })} /> Verified
            </label>
            <div className="flex gap-2 md:col-span-3">
              <button className="btn-primary px-5 py-2">{editingEntity ? 'Update entity' : 'Add entity'}</button>
              {editingEntity && <button type="button" className="btn-secondary px-5 py-2" onClick={() => { setEditingEntity(null); setEntity(emptyEntity); }}>Cancel</button>}
            </div>
          </form>
          {loading ? <p className="mt-6 text-police-400">Loading database records...</p> : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-police-700 text-police-400">
                  <tr>
                    <th className="p-3">Type</th><th className="p-3">Value</th><th className="p-3">Source</th><th className="p-3">Confidence</th><th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entities.map(row => (
                    <tr key={row.id} className="border-b border-police-800">
                      <td className="p-3 text-accent-cyan">{row.type}</td>
                      <td className="p-3 text-white">{row.label}<div className="text-xs text-police-500">{row.value}</div></td>
                      <td className="p-3 text-police-300">{row.sourceName}</td>
                      <td className="p-3 text-police-300">{row.confidence}%</td>
                      <td className="p-3">
                        <button className="mr-3 text-accent-cyan" onClick={() => { setEditingEntity(row.id); setEntity({ ...row, tags: row.tags.join(', ') }); }}>Edit</button>
                        <button className="text-red-400" onClick={() => deleteEntity(row.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!entities.length && <p className="p-4 text-police-500">No records yet. Add the first entity above.</p>}
            </div>
          )}
        </section>}

        {!entityOnly && <section className="card p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-white">Relationships</h2>
            <p className="text-sm text-police-400">Link two entities so they appear connected in profiles, reports, and the knowledge graph.</p>
          </div>
          <form onSubmit={saveRelationship} className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <select className="input-field" required value={relationship.sourceId} onChange={event => setRelationship({ ...relationship, sourceId: event.target.value })}>
              <option value="" disabled>Source entity *</option>
              {entityOptions}
            </select>
            <select className="input-field" required value={relationship.targetId} onChange={event => setRelationship({ ...relationship, targetId: event.target.value })}>
              <option value="" disabled>Target entity *</option>
              {entityOptions}
            </select>
            <select className="input-field" value={relationship.type} onChange={event => setRelationship({ ...relationship, type: event.target.value })}>
              {relationshipTypes.map(type => <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>)}
            </select>
            <input className="input-field" type="number" min="0" max="100" value={relationship.confidence} onChange={event => setRelationship({ ...relationship, confidence: Number(event.target.value) })} />
            <input className="input-field md:col-span-2" placeholder="Description (optional)" value={relationship.description} onChange={event => setRelationship({ ...relationship, description: event.target.value })} />
            <div className="md:col-span-3">
              <button className="btn-primary px-5 py-2">Add relationship</button>
            </div>
          </form>
          {loading ? <p className="mt-6 text-police-400">Loading relationships...</p> : (
            <div className="mt-6 space-y-2">
              {relationships.map(row => (
                <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-police-800 py-3">
                  <div className="text-sm">
                    <span className="text-white font-medium">{row.sourceLabel || row.sourceId}</span>
                    <span className="mx-2 text-police-500">—{row.type.replace(/_/g, ' ')} ({row.confidence}%)→</span>
                    <span className="text-white font-medium">{row.targetLabel || row.targetId}</span>
                  </div>
                  <div className="flex gap-3 text-sm text-police-400">
                    {row.description && <span className="hidden md:inline max-w-xs truncate">{row.description}</span>}
                    <button className="text-red-400" onClick={() => deleteRelationship(row.id)}>Delete</button>
                  </div>
                </div>
              ))}
              {!relationships.length && <p className="text-police-500">No relationships yet. Link two entities above.</p>}
            </div>
          )}
        </section>}

        {!relationshipOnly && !entityOnly && <section className="card p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Cases</h2>
          <form onSubmit={saveCase} className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <input className="input-field" required placeholder="Case number *" value={caseData.caseNumber} disabled={Boolean(editingCase)} onChange={event => setCaseData({ ...caseData, caseNumber: event.target.value })} />
            <input className="input-field md:col-span-2" required placeholder="Case title *" value={caseData.title} onChange={event => setCaseData({ ...caseData, title: event.target.value })} />
            <select className="input-field" value={caseData.priority} onChange={event => setCaseData({ ...caseData, priority: event.target.value })}>
              <option value="low">Low priority</option><option value="medium">Medium priority</option><option value="high">High priority</option><option value="critical">Critical priority</option>
            </select>
            <select className="input-field" value={caseData.status} onChange={event => setCaseData({ ...caseData, status: event.target.value })}>
              <option value="open">Open</option><option value="active">Active</option><option value="closed">Closed</option><option value="archived">Archived</option>
            </select>
            <select className="input-field md:col-span-2" value={caseData.assignedTo} onChange={event => setCaseData({ ...caseData, assignedTo: event.target.value })}>
              <option value="">Unassigned</option>
              {users.map(investigator => <option key={investigator.id} value={investigator.id}>{investigator.name} ({investigator.username || investigator.id})</option>)}
            </select>
            <input className="input-field" placeholder="Tags, comma separated" value={caseData.tags} onChange={event => setCaseData({ ...caseData, tags: event.target.value })} />
            <input className="input-field" placeholder="Description" value={caseData.description} onChange={event => setCaseData({ ...caseData, description: event.target.value })} />
            <label className="text-sm text-police-300 md:col-span-4">Linked entities
              <div className="relative mt-1">
                <button
                  type="button"
                  className="input-field flex w-full items-center justify-between text-left"
                  onClick={() => setEntityDropdownOpen(open => !open)}
                  aria-expanded={entityDropdownOpen}
                >
                  <span>{caseData.entities.length ? `${caseData.entities.length} entities selected` : 'Select entities'}</span>
                  <span aria-hidden="true">{entityDropdownOpen ? '▴' : '▾'}</span>
                </button>
                {entityDropdownOpen && <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded border border-police-700 bg-police-900 p-2 shadow-xl">
                  <div className="mb-2 flex items-center justify-between border-b border-police-800 px-2 pb-2">
                    <span className="text-xs text-police-500">Select one or more</span>
                    <button type="button" className="text-xs text-accent-cyan" onClick={() => setEntityDropdownOpen(false)}>Close</button>
                  </div>
                  {entities.length ? entities.map(row => (
                    <label key={row.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm text-police-200 hover:bg-police-800">
                      <input
                        type="checkbox"
                        checked={caseData.entities.includes(row.id)}
                        onChange={(event) => setCaseData({
                          ...caseData,
                          entities: event.target.checked
                            ? [...caseData.entities, row.id]
                            : caseData.entities.filter(id => id !== row.id),
                        })}
                      />
                      <span>{row.label || row.value} ({row.type.replace('_', ' ')})</span>
                    </label>
                  )) : <p className="p-2 text-sm text-police-500">No entities available</p>}
                </div>}
              </div>
            </label>
            <div className="flex gap-2 md:col-span-3">
              <button className="btn-primary px-5 py-2">{editingCase ? 'Update case' : 'Add case'}</button>
              {editingCase && <button type="button" className="btn-secondary px-5 py-2" onClick={() => { setEditingCase(null); setCaseData(emptyCase); }}>Cancel</button>}
            </div>
          </form>
          <div className="mt-6 space-y-2">
            {cases.map(row => (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-police-800 py-3">
                <div>
                  <span className="mr-3 text-accent-cyan">{row.caseNumber}</span>
                  <span className="text-white">{row.title}</span>
                  <span className="ml-3 text-sm text-police-500">({row.entities.length} entities)</span>
                </div>
                <div className="flex gap-3 text-sm text-police-400">
                  {row.status} / {row.priority}
                  <button type="button" className="text-accent-cyan" onClick={() => {
                    setEditingCase(row.id);
                    setEntityDropdownOpen(false);
                    setCaseData({
                      caseNumber: row.caseNumber,
                      title: row.title,
                      description: row.description ?? '',
                      status: row.status,
                      priority: row.priority,
                      assignedTo: row.assignedTo ?? '',
                      tags: Array.isArray(row.tags) ? row.tags.join(', ') : '',
                      entities: row.entities ?? [],
                    });
                  }}>Edit</button>
                </div>
              </div>
            ))}
            {!cases.length && <p className="text-police-500">No cases yet. Add the first case above.</p>}
          </div>
        </section>}
      </div>
    )}
  </div>;
};

export default SettingsPage;