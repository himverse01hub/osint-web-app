import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const DashboardPage = () => {
  const navigate = useNavigate();
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
  const [recentSearches, setRecentSearches] = useState<Array<{id: string; query: string; timestamp: string; resultsCount: number}>>([]);
  const [cases, setCases] = useState<Array<{id: string; caseNumber: string; title: string; status: string; priority: string; assignedTo: string; updatedAt: string}>>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;

    const loadLiveDashboard = async () => {
      if (disposed) return;
      setRefreshing(true);

      try {
        const [statsResponse, searchesResponse, casesResponse, entitiesResponse] = await Promise.all([
          fetch('/api/dashboard'),
          fetch('/api/search-history'),
          fetch('/api/cases'),
          fetch('/api/entities'),
        ]);

        if (!statsResponse.ok || !searchesResponse.ok || !casesResponse.ok || !entitiesResponse.ok) {
          throw new Error('One or more live dashboard requests failed');
        }

        const [statsData, searchesData, casesData, entitiesData] = await Promise.all([
          statsResponse.json(),
          searchesResponse.json(),
          casesResponse.json(),
          entitiesResponse.json(),
        ]);

        if (disposed) return;
        setStats(prev => ({ ...prev, ...statsData.stats }));
        setRecentSearches((searchesData.searches ?? []).slice(0, 3));
        setCases(casesData.cases ?? []);
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Pending cases', value: stats.activeCases, detail: `${stats.totalCases} total investigations`, icon: 'folder', color: 'text-cyan-300', path: '/cases' },
          { label: 'Activity alerts', value: stats.totalAlerts, detail: `${stats.highPriorityAlerts} high priority`, icon: 'bell', color: 'text-amber-300', path: '/alerts' },
          { label: 'Entities tracked', value: stats.totalPersons + stats.totalOrganizations + stats.totalLocations + stats.totalPhones + stats.totalEmails, detail: `${stats.totalRelationships} relationships`, icon: 'users', color: 'text-emerald-300', path: '/data-management?section=entities' },
          { label: 'Recent searches', value: recentSearches.length, detail: `${recentSearches.reduce((total, search) => total + search.resultsCount, 0)} results returned`, icon: 'search', color: 'text-violet-300', path: '/search' },
        ].map((metric) => (
          <button key={metric.label} onClick={() => navigate(metric.path)} className="card card-hover flex items-start justify-between p-5 text-left">
            <div><p className="text-sm text-police-400">{metric.label}</p><p className="mt-2 text-3xl font-bold text-white">{metric.value}</p><p className="mt-2 text-xs text-police-500">{metric.detail}</p></div>
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-police-800/80 ${metric.color}`}>
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                {metric.icon === 'folder' && <path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />}
                {metric.icon === 'bell' && <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>}
                {metric.icon === 'users' && <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>}
                {metric.icon === 'search' && <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>}
              </svg>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_0.9fr]">
        <section className="card card-hover p-5">
          <div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-semibold text-white">Recent searches</h2><p className="text-sm text-police-500">Latest intelligence queries and result volume</p></div><button onClick={() => navigate('/search')} className="text-sm font-medium text-accent-cyan hover:text-cyan-200">Open search</button></div>
          <div className="space-y-3">
            {recentSearches.length ? recentSearches.map((search) => <div key={search.id} className="flex items-center gap-4 rounded-lg border border-police-800 bg-police-950/40 p-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-400/10 text-violet-300"><span className="text-sm font-bold">Q</span></div><div className="min-w-0 flex-1"><p className="truncate font-medium text-white">{search.query}</p><p className="text-xs text-police-500">{new Date(search.timestamp).toLocaleString()}</p></div><span className="whitespace-nowrap text-sm text-police-300">{search.resultsCount} results</span></div>) : <p className="py-8 text-center text-sm text-police-500">No recent searches recorded.</p>}
          </div>
        </section>

        <section className="card card-hover p-5">
          <div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-semibold text-white">Cases by priority</h2><p className="text-sm text-police-500">Active and open investigations</p></div><button onClick={() => navigate('/cases')} className="text-sm font-medium text-accent-cyan hover:text-cyan-200">View cases</button></div>
          <div className="space-y-4">{(['critical', 'high', 'medium', 'low'] as const).map((priority) => { const count = cases.filter((caseItem) => ['active', 'open'].includes(caseItem.status) && caseItem.priority === priority).length; const width = Math.min(100, count ? Math.max(12, (count / Math.max(stats.activeCases, 1)) * 100) : 0); return <div key={priority}><div className="mb-1 flex justify-between text-sm"><span className="capitalize text-police-300">{priority}</span><span className="font-semibold text-white">{count}</span></div><div className="h-2 rounded-full bg-police-800"><div className={`h-2 rounded-full ${priority === 'critical' ? 'bg-red-400' : priority === 'high' ? 'bg-orange-400' : priority === 'medium' ? 'bg-amber-300' : 'bg-emerald-400'}`} style={{ width: `${width}%` }}></div></div></div>; })}</div>
        </section>
      </div>

    </div>
  );
};

export default DashboardPage;
