import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { generateMockAlerts } from '../data/mockData';
import { Alert } from '../types/osint';

export const AlertsPage = () => {
  const { authState } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all');
  const [filterType, setFilterType] = useState<'all' | Alert['type']>('all');
  const [acknowledgedFilter, setAcknowledgedFilter] = useState<'all' | 'acknowledged' | 'unacknowledged'>('all');

  useEffect(() => {
    const loadAlerts = async () => {
      setLoading(true);
      try {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Get mock data
        const mockAlerts = generateMockAlerts();
        setAlerts(mockAlerts);
      } catch (error) {
        console.error('Error loading alerts:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAlerts();
  }, []);

  const filteredAlerts = alerts.filter(alert => {
    const severityMatch = filterSeverity === 'all' || alert.severity === filterSeverity;
    const typeMatch = filterType === 'all' || alert.type === filterType;
    const acknowledgedMatch = 
      acknowledgedFilter === 'all' ||
      (acknowledgedFilter === 'acknowledged' && alert.acknowledgedAt !== undefined) ||
      (acknowledgedFilter === 'unacknowledged' && alert.acknowledgedAt === undefined);
    return severityMatch && typeMatch && acknowledgedMatch;
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

  const getTypeLabel = (type: Alert['type']) => {
    const labels: Record<Alert['type'], string> = {
      'new_connection': 'New Connection',
      'new_account': 'New Account',
      'location_change': 'Location Change',
      'darkweb_mention': 'Dark Web Mention',
      'breach_detected': 'Breach Detected',
      'high_risk_activity': 'High Risk Activity',
      'watchlist_match': 'Watchlist Match',
      'report_generated': 'Report Generated',
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between space-x-4">
        <div>
          <h1 className="text-2xl font-bold text-gradient">Alerts</h1>
          <p className="text-police-400">Monitor and manage investigative alerts</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              // Refresh alerts
            }}
            className="btn-secondary px-4 py-2"
          >
            Refresh
          </button>
          <button 
            onClick={() => {
              // Acknowledge selected
            }}
            className="btn-accent px-4 py-2"
          >
            Acknowledge Selected
          </button>
        </div>
      </div>

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
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-police-400">Type:</span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="input-field"
          >
            <option value="all">All Types</option>
            <option value="new_connection">New Connection</option>
            <option value="new_account">New Account</option>
            <option value="location_change">Location Change</option>
            <option value="darkweb_mention">Dark Web Mention</option>
            <option value="breach_detected">Breach Detected</option>
            <option value="high_risk_activity">High Risk Activity</option>
            <option value="watchlist_match">Watchlist Match</option>
            <option value="report_generated">Report Generated</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-police-400">Status:</span>
          <select
            value={acknowledgedFilter}
            onChange={(e) => setAcknowledgedFilter(e.target.value as any)}
            className="input-field"
          >
            <option value="all">All</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="unacknowledged">Unacknowledged</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-police-400">Showing:</span>
          <span className="text-police-300 font-medium">{filteredAlerts.length} alerts</span>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-4">
        {filteredAlerts.length > 0 ? (
          filteredAlerts.map((alert) => (
            <div key={alert.id} className="card card-hover p-4">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className={`h-4 w-4 rounded-full
                    ${alert.severity === 'critical' ? 'bg-red-500' :
                    alert.severity === 'high' ? 'bg-orange-500' :
                    alert.severity === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}
                  `}></div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-white">{alert.title}</h4>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs
                        ${getSeverityColor(alert.severity)}
                      `}>
                        {alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
                      </span>
                      <span className="text-police-400 text-xs">{getTypeLabel(alert.type)}</span>
                    </div>
                  </div>
                  <p className="text-police-400 text-sm">{alert.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-police-400 text-sm">
                    <span>
                      <strong>Entity:</strong> 
                      {alert.entityType && alert.entityId ? (
                        <>
                          {alert.entityType.charAt(0).toUpperCase() + alert.entityType.slice(1)}: 
                          {alert.entityId}
                        </>
                      ) : 'N/A'}
                    </span>
                    <span>
                      <strong>Time:</strong> 
                      {new Date(alert.createdAt).toLocaleString()}
                    </span>
                    <span>
                      <strong>Status:</strong> 
                      {alert.acknowledgedAt ? (
                        <>
                          <span className="text-green-400">Acknowledged</span>
                          <span className="text-police-400 ml-1">
                            {new Date(alert.acknowledgedAt).toLocaleString()}
                          </span>
                        </>
                      ) : (
                        <span className="text-yellow-400">Unacknowledged</span>
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {alert.acknowledgedAt && (
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 13l4 4L19 7"></path>
                      </svg>
                    </div>
                  )}
                  {!alert.acknowledgedAt && (
                    <button 
                      onClick={() => {
                        // Acknowledge alert
                      }}
                      className="btn-secondary px-3 py-1 text-xs"
                    >
                      Acknowledge
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center text-police-500 py-8">
            <p>No alerts match the current filters.</p>
            <p className="mt-2 text-sm">Try adjusting the filters to view more alerts.</p>
          </div>
        )}
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card card-hover p-4">
          <h3 className="text-lg font-semibold text-white mb-3">Total Alerts</h3>
          <p className="text-2xl font-bold text-accent-cyan">{alerts.length}</p>
          <p className="text-police-400 text-sm">All Time</p>
        </div>
        <div className="card card-hover p-4">
          <h3 className="text-lg font-semibold text-white mb-3">Unacknowledged</h3>
          <p className="text-2xl font-bold text-accent-cyan">
            {alerts.filter(a => a.acknowledgedAt === undefined).length}
          </p>
          <p className="text-police-400 text-sm">Pending</p>
        </div>
        <div className="card card-hover p-4">
          <h3 className="text-lg font-semibold text-white mb-3">High Priority</h3>
          <p className="text-2xl font-bold text-accent-cyan">
            {alerts.filter(a => a.severity === 'high' || a.severity === 'critical').length}
          </p>
          <p className="text-police-400 text-sm">Severity</p>
        </div>
        <div className="card card-hover p-4">
          <h3 className="text-lg font-semibold text-white mb-3">Today</h3>
          <p className="text-2xl font-bold text-accent-cyan">
            {/* Count alerts from today */}
            {alerts.filter(a => {
              const today = new Date();
              const alertDate = new Date(a.createdAt);
              return alertDate.toDateString() === today.toDateString();
            }).length}
          </p>
          <p className="text-police-400 text-sm">Last 24h</p>
        </div>
      </div>
    </div>
  );
};

export default AlertsPage;
