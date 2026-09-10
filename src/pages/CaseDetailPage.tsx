import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { InvestigationCase, CaseFile } from '../types/osint';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export const CaseDetailPage = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const { authState } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [caseItem, setCaseItem] = useState<InvestigationCase | null>(null);
  const [form, setForm] = useState<InvestigationCase | null>(null);
  const [files, setFiles] = useState<CaseFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [uploadError, setUploadError] = useState('');

  const load = async () => {
    if (!caseId) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/cases?id=${encodeURIComponent(caseId)}`);
      if (!response.ok) throw new Error('Case not found');
      const data = await response.json();
      const found: InvestigationCase = data.case;
      setCaseItem(found);
      setForm({ ...found, tags: found.tags ?? [] });
      setFiles(found.files ?? []);
    } catch (err: any) {
      setError(err.message || 'Could not load case');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [caseId]);

  const saveChanges = async () => {
    if (!form || !caseId) return;
    setSaving(true);
    setNotice('');
    setError('');
    try {
      const payload = {
        title: form.title,
        status: form.status,
        priority: form.priority,
        assignedTo: form.assignedTo || undefined,
        description: form.description,
        tags: form.tags.map(tag => tag.trim()).filter(Boolean),
        coAccused: form.coAccused ?? [],
        phone: form.phone ?? '',
        email: form.email ?? '',
        address: form.address ?? '',
        anyId: form.anyId ?? '',
      };
      const response = await fetch(`/api/cases?id=${encodeURIComponent(caseId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save changes');
      const updated: InvestigationCase = { ...data.case, files };
      setCaseItem(updated);
      setForm(updated);
      setFiles(data.case.files ?? files);
      setNotice('Case changes saved.');
      setTimeout(() => setNotice(''), 4000);
    } catch (err: any) {
      setError(err.message || 'Could not save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleFileSelected = async (selected: File | null) => {
    if (!selected || !caseId) return;
    if (selected.size > MAX_UPLOAD_BYTES) {
      setUploadError('File exceeds the 8 MB upload limit.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setUploading(true);
    setUploadError('');
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result ?? '');
          const comma = result.indexOf(',');
          resolve(comma >= 0 ? result.slice(comma + 1) : result);
        };
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsDataURL(selected);
      });

      const response = await fetch(`/api/cases?upload=1&id=${encodeURIComponent(caseId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: selected.name,
          mimeType: selected.type || 'application/octet-stream',
          sizeBytes: selected.size,
          data: base64,
          uploadedBy: authState.user?.id,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Upload failed');

      const added: CaseFile = data.file;
      const next = [added, ...files];
      setFiles(next);
      setCaseItem(prev => prev ? { ...prev, files: next } : prev);
      setForm(prev => prev ? { ...prev, files: next } : prev);
      setNotice(`File "${added.fileName}" uploaded.`);
      setTimeout(() => setNotice(''), 4000);
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openFile = async (file: CaseFile) => {
    try {
      const response = await fetch(`/api/cases?file=1&fileId=${encodeURIComponent(file.id)}`);
      if (!response.ok) throw new Error('Could not fetch file');
      const data = await response.json();
      const blob = base64ToBlob(data.file.data, data.file.mimeType);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = data.file.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err: any) {
      setUploadError(err.message || 'Could not fetch file');
    }
  };

  const deleteFile = async (file: CaseFile) => {
    if (!caseId) return;
    if (!window.confirm(`Delete "${file.fileName}" from this case?`)) return;
    try {
      const response = await fetch(`/api/cases?file=1&id=${encodeURIComponent(caseId)}&fileId=${encodeURIComponent(file.id)}`, {
        method: 'DELETE',
      });
      if (response.status !== 204 && !response.ok) throw new Error('Could not delete file');
      const next = files.filter(f => f.id !== file.id);
      setFiles(next);
      setCaseItem(prev => prev ? { ...prev, files: next } : prev);
      setForm(prev => prev ? { ...prev, files: next } : prev);
      setNotice(`File "${file.fileName}" deleted.`);
      setTimeout(() => setNotice(''), 4000);
    } catch (err: any) {
      setUploadError(err.message || 'Could not delete file');
    }
  };

  if (loading) {
    return <div className="text-center text-police-400 py-10">Loading case...</div>;
  }

  if (!form || !caseItem) {
    return (
      <div className="space-y-4">
        <div className="card p-10 text-center text-police-400">
          {error || 'Case not found.'}
        </div>
        <button onClick={() => navigate('/cases')} className="btn-secondary px-4 py-2">Back to Investigations</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <button onClick={() => navigate('/cases')} className="text-sm text-police-400 hover:text-police-200 mb-1">
            ← Back to Investigations
          </button>
          <h1 className="text-2xl font-bold text-gradient">
            Case #{caseItem.caseNumber}
          </h1>
          <p className="text-police-400">Updated {new Date(caseItem.updatedAt).toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-3">
          {notice && <span className="rounded border border-accent-cyan/40 bg-accent-cyan/10 px-3 py-2 text-sm text-accent-cyan">{notice}</span>}
          <button onClick={() => void saveChanges()} disabled={saving} className="btn-accent px-5 py-2">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {error && <div className="rounded border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-300">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="card p-6 lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-white">Case Details</h2>
          <div>
            <label className="text-sm text-police-300">Title</label>
            <input
              className="input-field mt-2 w-full"
              value={form.title}
              onChange={event => setForm({ ...form, title: event.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-police-300">Status</label>
              <select
                className="input-field mt-2 w-full"
                value={form.status}
                onChange={event => setForm({ ...form, status: event.target.value as InvestigationCase['status'] })}
              >
                <option value="open">Open</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-police-300">Priority</label>
              <select
                className="input-field mt-2 w-full"
                value={form.priority}
                onChange={event => setForm({ ...form, priority: event.target.value as InvestigationCase['priority'] })}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm text-police-300">Assigned to</label>
            <input
              className="input-field mt-2 w-full"
              value={form.assignedTo || ''}
              onChange={event => setForm({ ...form, assignedTo: event.target.value })}
              placeholder="Officer name or ID"
            />
          </div>
          <div>
            <label className="text-sm text-police-300">Description</label>
            <textarea
              rows={4}
              className="input-field mt-2 w-full"
              value={form.description || ''}
              onChange={event => setForm({ ...form, description: event.target.value })}
              placeholder="Case background, findings, current status..."
            />
          </div>
          <div>
            <label className="text-sm text-police-300">Tags <span className="text-police-500">(comma separated)</span></label>
            <input
              className="input-field mt-2 w-full"
              value={form.tags.join(', ')}
              onChange={event => setForm({ ...form, tags: event.target.value.split(',').map(tag => tag.trim()) })}
              placeholder="fraud, cyber, suspect-x"
            />
          </div>
        </section>

        <section className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Evidence Files</h2>
          <div className="rounded-lg border-2 border-dashed border-police-700 p-6 text-center">
            <svg className="mx-auto h-8 w-8 text-police-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <p className="mt-3 text-sm text-police-400">Upload evidence (photos, PDF, docs)</p>
            <p className="text-xs text-police-600">Max 8 MB per file</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="btn-primary mt-4 px-4 py-2 text-sm"
            >
              {uploading ? 'Uploading...' : 'Choose File'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={event => {
                const selected = event.target.files?.[0];
                void handleFileSelected(selected ?? null);
              }}
            />
          </div>
          {uploadError && <p className="rounded border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300">{uploadError}</p>}

          <div className="space-y-2">
            {files.length === 0 && <p className="text-center text-police-500 text-sm py-3">No files uploaded yet.</p>}
            {files.map(file => (
              <div key={file.id} className="flex items-center gap-3 rounded-lg bg-police-800/50 p-3">
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-white">{file.fileName}</p>
                  <p className="text-xs text-police-500">
                    {(file.sizeBytes / 1024).toFixed(1)} KB • {new Date(file.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => void openFile(file)}
                  className="btn-secondary px-3 py-1 text-xs"
                  title="Download"
                >
                  Open
                </button>
                <button
                  onClick={() => void deleteFile(file)}
                  className="rounded border border-red-800/60 px-3 py-1 text-xs text-red-300 hover:bg-red-950/40"
                  title="Delete"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

function base64ToBlob(base64: string, mimeType: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

export default CaseDetailPage;