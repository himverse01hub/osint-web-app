import { useState, useEffect, useCallback } from 'react';

interface AlertRow {
  id: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  createdAt: string;
  acknowledgedAt?: string;
  status: string;
}

const severityColor: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
};

const emptyForm = { title: '', description: '', severity: 'medium', type: 'high_risk_activity' };

export const ActivityManager = ({ onClose }: { onClose: () => void }) => {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/alerts');
      if (!response.ok) throw new Error('Could not load alerts');
      const data = await response.json();
      setAlerts(data.alerts ?? []);
    } catch (err: any) {
      setError(err.message || 'Could not load alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const countBy = (fn: (alert: AlertRow) => boolean) => alerts.filter(fn).length;
  const criticalHigh = countBy(a => a.severity === 'critical' || a.severity === 'high');
  const acknowledged = countBy(a => Boolean(a.acknowledgedAt));
  const newToday = countBy(a => new Date(a.createdAt).toDateString() === new Date().toDateString());

  const createAlert = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not create alert');
      setShowForm(false);
      setForm(emptyForm);
      setMessage('Alert created.');
      setTimeout(() => setMessage(''), 4000);
      void load();
    } catch (err: any) {
      setError(err.message || 'Could not create alert');
    } finally {
      setSaving(false);
    }
  };

  const acknowledge = async (id: string) => {
    try {
      const response = await fetch(`/api/alerts?id=${encodeURIComponent(id)}`, { method: 'PATCH' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not acknowledge alert');
      setAlerts(prev => prev.map(a => a.id === id ? data.alert : a));
      setMessage('Alert acknowledged.');
      setTimeout(() => setMessage(''), 4000);
    } catch (err: any) {
      setError(err.message || 'Could not acknowledge alert');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="card w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Activity & Alerts</h2>
            <p className="text-police-400 text-sm">Review activity, acknowledge or create alerts</p>
          </div>
          <button onClick={onClose} className="text-police-400 hover:text-white">Close</button>
        </div>

        {message && <p className="mb-3 rounded border border-accent-cyan/40 bg-accent-cyan/10 px-3 py-2 text-sm text-accent-cyan">{message}</p>}
        {error && <p className="mb-3 rounded border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</p>}

        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-police-800 px-3 py-1 text-police-300">{alerts.length} total</span>
          <span className={`rounded-full px-3 py-1 ${criticalHigh > 0 ? 'bg-red-500/20 text-red-300' : 'bg-police-800/60 text-white/70'}`}>{criticalHigh} high/critical</span>
          <span className="rounded-full bg-police-800/60 px-3 py-1 text-white/70">{newToday} new today</span>
          <span className="rounded-full bg-police-800/60 px-3 py-1 text-white/70">{acknowledged} acknowledged</span>
        </div>

        <div className="mb-4 flex items-center gap-3">
          <button onClick={() => setShowForm(prev => !prev)} className="btn-accent px-4 py-2">
            {showForm ? 'Hide Form' : 'Create Alert'}
          </button>
          {showForm && (
            <span className="text-xs text-police-500">Creating a new alert adds it to the activity log.</span>
          )}
        </div>

        {showForm && (
          <form onSubmit={createAlert} className="mb-4 space-y-3 rounded-lg bg-police-800/50 p-4">
            <h3 className="font-semibold text-white">Create New Alert</h3>
            <div>
              <label className="text-sm text-police-300">Title
                <input className="input-field mt-1 w-full" required value={form.title}
                  onChange={event => setForm({ ...form, title: event.target.value })} placeholder="Alert title" />
              </label>
            </div>
            <div>
              <label className="text-sm text-police-300">Description
                <textarea rows={2} className="input-field mt-1 w-full" required value={form.description}
                  onChange={event => setForm({ ...form, description: event.target.value })} placeholder="What happened?" />
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm text-police-300">Severity
                <select className="input-field mt-1 w-full" value={form.severity}
                  onChange={event => setForm({ ...form, severity: event.target.value })}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
              <label className="text-sm text-police-300">Type
                <select className="input-field mt-1 w-full" value={form.type}
                  onChange={event => setForm({ ...form, type: event.target.value })}>
                  <option value="high_risk_activity">High Risk Activity</option>
                  <option value="new_connection">New Connection</option>
                  <option value="new_account">New Account</option>
                  <option value="location_change">Location Change</option>
                  <option value="darkweb_mention">Dark Web Mention</option>
                  <option value="breach_detected">Breach Detected</option>
                  <option value="watchlist_match">Watchlist Match</option>
                  <option value="report_generated">Report Generated</option>
                </select>
              </label>
            </div>
            <div className="flex items-center gap-3">
              <button type="submit" disabled={saving} className="btn-primary px-5 py-2">
                {saving ? 'Creating...' : 'Create Alert'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary px-4 py-2">Cancel</button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="py-8 text-center text-police-400">Loading alerts...</div>
        ) : alerts.length === 0 ? (
          <div className="py-8 text-center text-police-500">No alerts yet. Create one to start tracking activity.</div>
        ) : (
          <div className="space-y-2">
            {alerts.map(alert => (
              <div key={alert.id} className="flex items-start gap-3 rounded-lg bg-police-800/50 p-3">
                <div className="flex-shrink-0 pt-1">
                  <div className={`h-3 w-3 rounded-full ${severityColor[alert.severity] ?? severityColor.low}`}></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium text-white">{alert.title}</h4>
                    <span className="rounded bg-police-900/60 px-2 py-0.5 text-xs text-white/60 capitalize">{alert.severity}</span>
                    {alert.status === 'acknowledged' && (
                      <span className="rounded bg-green-500/15 px-2 py-0.5 text-xs text-green-300">Acknowledged</span>
                    )}
                  </div>
                  <p className="text-sm text-police-400">{alert.description}</p>
                  <p className="text-xs text-police-500 mt-1">
                    {new Date(alert.createdAt).toLocaleString()} • {alert.type.replace('_', ' ')}
                  </p>
                </div>
                {alert.status !== 'acknowledged' && (
                  <button onClick={() => void acknowledge(alert.id)} className="btn-secondary px-3 py-1 text-xs">
                    Acknowledge
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityManager;