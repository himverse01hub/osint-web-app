import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export const DashboardPage = () => {
  const { authState } = useAuth();
  const { user } = authState;
  const [stats, setStats] = useState({
    totalPersons: 0,
    totalPhones: 0,
    totalEmails: 0,
    totalUsernames: 0,
    totalOrganizations: 0,
    totalLocations: 0,
    totalCryptoWallets: 0,
    totalSocialAccounts: 0,
    totalVehicles: 0,
    totalDocuments: 0,
    totalRelationships: 0,
    activeCases: 0,
    totalCases: 0,
    totalAlerts: 0,
    highPriorityAlerts: 0,
  });
  const [cases, setCases] = useState<Array<{id: string; caseNumber: string; title: string; status: string; priority: string; assignedTo: string; updatedAt: string}>>([]);
  const [alerts, setAlerts] = useState<Array<any>>([]);
  const [entities, setEntities] = useState<Array<any>>([]);
  const [activeDrilldown, setActiveDrilldown] = useState<'cases' | 'alerts' | 'entities' | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;

    const loadLiveDashboard = async () => {
      if (disposed) return;
      setRefreshing(true);

      try {
        const [statsResponse, casesResponse, entitiesResponse, alertsResponse] = await Promise.all([
          fetch('/api/dashboard'),
          fetch('/api/cases'),
          fetch('/api/entities'),
          fetch('/api/alerts?limit=10'),
        ]);

        if (!statsResponse.ok || !casesResponse.ok || !entitiesResponse.ok || !alertsResponse.ok) {
          throw new Error('One or more live dashboard requests failed');
        }

        const [statsData, casesData, entitiesData, alertsData] = await Promise.all([
          statsResponse.json(),
          casesResponse.json(),
          entitiesResponse.json(),
          alertsResponse.json(),
        ]);

        if (disposed) return;
        setStats(prev => ({ ...prev, ...statsData.stats }));
        setCases(casesData.cases ?? []);
        setEntities((entitiesData.entities ?? []).filter((entity: any) => entity.sourceName === 'Investigator entry'));
        setAlerts(alertsData.alerts ?? []);
        setLastSyncedAt(new Date().toISOString());
      } catch (error) {
        if (!disposed) console.error('Live dashboard refresh failed:', error);
      } finally {
        if (!disposed) setRefreshing(false);
      }
    };

    void loadLiveDashboard();
    const refreshTimer = window.setInterval(loadLiveDashboard, 15000);

    return () => {
      disposed = true;
      window.clearInterval(refreshTimer);
    };
  }, []);

  const drilldownConfig = {
    cases: { title: 'Pending cases', tablePath: '/cases?view=table' },
    alerts: { title: 'Activity alerts', tablePath: '/alerts?view=table' },
    entities: { title: 'User-added entities', tablePath: '/data-management?section=entities' },
  } as const;

  const drilldownRows = activeDrilldown === 'cases'
    ? cases.filter(caseItem => ['active', 'open'].includes(caseItem.status))
    : activeDrilldown === 'alerts'
      ? alerts
      : activeDrilldown === 'entities'
        ? entities
        : [];

  // Organize cases by priority for column display
  const casesByPriority = activeDrilldown === 'cases'
    ? {
        critical: cases.filter(c => c.status === 'active' && c.priority === 'critical'),
        high: cases.filter(c => c.status === 'active' && c.priority === 'high'),
        medium: cases.filter(c => c.status === 'active' && c.priority === 'medium'),
        low: cases.filter(c => c.status === 'active' && c.priority === 'low'),
      }
    : {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-accent-cyan">Operations overview</p>
          <h1 className="mt-1 text-3xl font-bold text-white">Good day, {user?.name}</h1>
          <p className="mt-1 text-police-400">Monitor investigations, alerts, and intelligence activity.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 text-xs text-police-500"><span className={`h-2 w-2 rounded-full ${refreshing ? 'animate-pulse bg-yellow-400' : 'bg-green-400'}`}></span>{refreshing ? 'Syncing' : lastSyncedAt ? `Synced ${new Date(lastSyncedAt).toLocaleTimeString()}` : 'Connecting'}</span>
          <button onClick={() => window.location.reload()} disabled={refreshing} className="btn-secondary px-4 py-2">{refreshing ? 'Refreshing...' : 'Refresh'}</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[
          { key: 'cases' as const, label: 'Pending cases', value: stats.activeCases, detail: `${stats.totalCases} total investigations`, icon: 'folder', color: 'text-cyan-300' },
          { key: 'alerts' as const, label: 'Activity alerts', value: stats.totalAlerts, detail: `${stats.highPriorityAlerts} high priority`, icon: 'bell', color: 'text-amber-300' },
          { key: 'entities' as const, label: 'Entities tracked', value: entities.length, detail: `${stats.totalRelationships} relationships`, icon: 'users', color: 'text-emerald-300' },
        ].map((metric) => (
          <button key={metric.label} onClick={() => setActiveDrilldown(metric.key)} className="card card-hover flex items-start justify-between p-5 text-left">
            <div><p className="text-sm text-police-400">{metric.label}</p><p className="mt-2 text-3xl font-bold text-white">{metric.value}</p><p className="mt-2 text-xs text-police-500">{metric.detail}</p></div>
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-police-800/80 ${metric.color}`}>
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                {metric.icon === 'folder' && <path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />}
                {metric.icon === 'bell' && <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>}
                {metric.icon === 'users' && <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>}
              </svg>
            </div>
          </button>
        ))}
      </div>

      {/* Priority-based cases overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {(['critical', 'high', 'medium', 'low'] as const).map((priority) => {
          const priorityCases = casesByPriority[priority];
          if (!priorityCases || !priorityCases.length) return null;
          return (
            <button
              key={priority}
              onClick={() => {
                setActiveDrilldown('cases');
                // Scroll to the priority section in the drill-down
                setTimeout(() => {
                  const element = document.getElementById(`priority-${priority}`);
                  if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
              }}
              className="card card-hover p-4 text-left transition-all hover:scale-105"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className={`text-sm font-semibold ${priority === 'critical' ? 'text-red-400' : priority === 'high' ? 'text-orange-400' : priority === 'medium' ? 'text-amber-300' : 'text-emerald-400'}`}>{priority.toUpperCase()} Priority</h3>
                <span className="text-xs text-police-400 bg-police-900 px-2 py-1 rounded-full">{priorityCases.length}</span>
              </div>
              <div className="space-y-1">
                {priorityCases.slice(0, 3).map((caseItem: any) => (
                  <div key={caseItem.id} className="text-xs">
                    <p className="text-white font-medium truncate">{caseItem.caseNumber}</p>
                    <p className="text-police-400 truncate">{caseItem.title}</p>
                  </div>
                ))}
                {priorityCases.length > 3 && (
                  <p className="text-xs text-police-500">... and {priorityCases.length - 3} more</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {activeDrilldown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setActiveDrilldown(null)}>
          <section className="card max-h-[80vh] w-full max-w-3xl overflow-hidden p-6" onClick={event => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.16em] text-accent-cyan">Dashboard drill-down</p>
                <h2 className="mt-1 text-xl font-semibold text-white">{drilldownConfig[activeDrilldown].title}</h2>
              </div>
              <button type="button" onClick={() => setActiveDrilldown(null)} className="text-police-400 hover:text-white" aria-label="Close drill-down">Close</button>
            </div>
            <div className="mt-5 max-h-[52vh] space-y-2 overflow-y-auto">
              {activeDrilldown === 'cases' && casesByPriority ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                     {(['critical', 'high', 'medium', 'low'] as const).map((priority) => {
                       const priorityCases = casesByPriority[priority] ?? [];
                       if (!priorityCases.length) return null;
                      return (
                        <div key={priority} className="rounded-lg border border-police-800 bg-police-950/40 p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className={`text-sm font-semibold ${priority === 'critical' ? 'text-red-400' : priority === 'high' ? 'text-orange-400' : priority === 'medium' ? 'text-amber-300' : 'text-emerald-400'}`}>{priority.toUpperCase()} Priority</h3>
                            <span className="text-xs text-police-400 bg-police-900 px-2 py-1 rounded-full">{priorityCases.length}</span>
                          </div>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {priorityCases.slice(0, 5).map((caseItem: any) => (
                              <div key={caseItem.id} className="p-2 rounded border border-police-800 bg-police-900/50 hover:bg-police-800/50 transition-colors">
                                <p className="text-sm font-medium text-white truncate">{caseItem.caseNumber}</p>
                                <p className="text-xs text-police-400 truncate">{caseItem.title}</p>
                                <div className="flex items-center justify-between mt-1">
                                  <span className="text-xs capitalize text-police-500">{caseItem.status}</span>
                                  <span className="text-xs text-police-500">Assigned: {caseItem.assignedTo || 'Unassigned'}</span>
                                </div>
                              </div>
                            ))}
                            {priorityCases.length > 5 && (
                              <p className="text-xs text-police-500 text-center py-1">... and {priorityCases.length - 5} more cases</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : drilldownRows.length ? drilldownRows.slice(0, 10).map((row: any) => (
                <div key={row.id} className="rounded-lg border border-police-800 bg-police-950/40 p-3">
                  {activeDrilldown === 'cases' && <><p className="font-medium text-white">{row.caseNumber} · {row.title}</p><p className="text-sm capitalize text-police-400">{row.status} · {row.priority} priority</p></>}
                  {activeDrilldown === 'alerts' && <><p className="font-medium text-white">{row.title}</p><p className="text-sm text-police-400">{row.description || 'No description'} · {row.severity} severity</p></>}
                  {activeDrilldown === 'entities' && <><p className="font-medium text-white">{row.label || row.value}</p><p className="text-sm capitalize text-police-400">{row.type?.replace('_', ' ')} · {row.value}</p></>}
                </div>
              )) : <p className="py-8 text-center text-police-500">No related data available yet.</p>}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setActiveDrilldown(null)} className="btn-secondary px-4 py-2">Close</button>
            </div>
          </section>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        <section className="card card-hover p-5">
          <div className="mb-5"><div><h2 className="text-lg font-semibold text-white">Cases by priority</h2><p className="text-sm text-police-500">Active and open investigations</p></div></div>
          <div className="space-y-4">{(['critical', 'high', 'medium', 'low'] as const).map((priority) => { const count = cases.filter((caseItem) => ['active', 'open'].includes(caseItem.status) && caseItem.priority === priority).length; const width = Math.min(100, count ? Math.max(12, (count / Math.max(stats.activeCases, 1)) * 100) : 0); return <div key={priority}><div className="mb-1 flex justify-between text-sm"><span className="capitalize text-police-300">{priority}</span><span className="font-semibold text-white">{count}</span></div><div className="h-2 rounded-full bg-police-800"><div className={`h-2 rounded-full ${priority === 'critical' ? 'bg-red-400' : priority === 'high' ? 'bg-orange-400' : priority === 'medium' ? 'bg-amber-300' : 'bg-emerald-400'}`} style={{ width: `${width}%` }}></div></div></div>; })}</div>
        </section>
      </div>

    </div>
  );
};

export default DashboardPage;
