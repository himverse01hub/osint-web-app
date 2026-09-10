import { useState, useEffect } from 'react';
import type { AuditLog } from '../types/osint';

export const AuditLogsPage = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState<'all' | string>('all');
  const [filterResource, setFilterResource] = useState<'all' | string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'failure'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const loadLogs = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/audit-logs');
        if (!response.ok) throw new Error('Audit logs request failed');
        const data = await response.json();
        setLogs(data.logs ?? []);
      } catch (error) {
        console.error('Error loading audit logs:', error);
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => { void loadLogs(); }, []);

  const filteredLogs = logs.filter(log => {
    const actionMatch = filterAction === 'all' || log.action.toLowerCase().includes(filterAction.toLowerCase());
    const resourceMatch = filterResource === 'all' || log.resourceType.toLowerCase().includes(filterResource.toLowerCase());
    const statusMatch = filterStatus === 'all' || log.status === filterStatus;
    const searchMatch = 
      !searchTerm ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.resourceType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.ipAddress !== undefined && String(log.details.ipAddress).includes(searchTerm) ||
      log.userName.toLowerCase().includes(searchTerm.toLowerCase());
    return actionMatch && resourceMatch && statusMatch && searchMatch;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between space-x-4">
        <div>
          <h1 className="text-2xl font-bold text-gradient">Audit Logs</h1>
          <p className="text-police-400">Monitor system activities and user actions</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => void loadLogs()}
            className="btn-secondary px-4 py-2"
          >
            Refresh
          </button>
          <button 
            onClick={() => {
              // Export logs
            }}
            className="btn-accent px-4 py-2"
          >
            Export Logs
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-wrap items-center gap-4 bg-police-900/50 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <span className="text-police-400">Action:</span>
          <input
            type="text"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            placeholder="Filter by action"
            className="input-field w-48"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-police-400">Resource:</span>
          <input
            type="text"
            value={filterResource}
            onChange={(e) => setFilterResource(e.target.value)}
            placeholder="Filter by resource"
            className="input-field w-48"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-police-400">Status:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="input-field"
          >
            <option value="all">All Statuses</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-police-400">Search:</span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search logs..."
            className="input-field w-48"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-police-400">Showing:</span>
          <span className="text-police-300 font-medium">{filteredLogs.length} entries</span>
        </div>
      </div>

      {/* Logs Table */}
      <div className="card card-hover">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr className="bg-police-900/50">
                <th className="px-4 py-3 text-left text-police-400 font-medium text-sm">Timestamp</th>
                <th className="px-4 py-3 text-left text-police-400 font-medium text-sm">User</th>
                <th className="px-4 py-3 text-left text-police-400 font-medium text-sm">Action</th>
                <th className="px-4 py-3 text-left text-police-400 font-medium text-sm">Resource</th>
                <th className="px-4 py-3 text-left text-police-400 font-medium text-sm">IP Address</th>
                <th className="px-4 py-3 text-left text-police-400 font-medium text-sm">Status</th>
                <th className="px-4 py-3 text-left text-police-400 font-medium text-sm">Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-police-800/50 transition-colors">
                    <td className="px-4 py-3 text-police-300 text-sm">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 flex items-center gap-2 text-police-300 text-sm">
                      <div className="h-3 w-3 rounded-full bg-accent-cyan"></div>
                      <span>{log.userName}</span>
                    </td>
                    <td className="px-4 py-3 text-police-300 text-sm">{log.action}</td>
                    <td className="px-4 py-3 text-police-300 text-sm">{log.resourceType}</td>
                    <td className="px-4 py-3 text-police-300 text-sm">{String(log.details.ipAddress ?? '')}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs
                        ${log.status === 'success' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}
                      `}>
                        {log.status === 'success' ? 'Success' : 'Failure'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-police-400 text-sm">
                      {typeof log.details.userAgent === 'string' ? (
                        <span title={log.details.userAgent} className="line-clamp-1">
                          {log.details.userAgent.length > 30 ? log.details.userAgent.substring(0, 30) + '...' : log.details.userAgent}
                        </span>
                      ) : 'N/A'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-police-500">
                    {loading ? 'Loading logs...' : 'No audit logs match the current filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card card-hover p-4">
          <h3 className="text-lg font-semibold text-white mb-3">Total Entries</h3>
          <p className="text-2xl font-bold text-accent-cyan">{logs.length}</p>
          <p className="text-police-400 text-sm">All Time</p>
        </div>
        <div className="card card-hover p-4">
          <h3 className="text-lg font-semibold text-white mb-3">Success Rate</h3>
          <p className="text-2xl font-bold text-accent-cyan">
            {logs.length > 0 ? `${Math.floor((logs.filter(l => l.status === 'success').length / logs.length) * 100)}%` : '0%'}
          </p>
          <p className="text-police-400 text-sm">Reliability</p>
        </div>
        <div className="card card-hover p-4">
          <h3 className="text-lg font-semibold text-white mb-3">Today</h3>
          <p className="text-2xl font-bold text-accent-cyan">
            {/* Count logs from today */}
            {logs.filter(l => {
              const today = new Date();
              const logDate = new Date(l.timestamp);
              return logDate.toDateString() === today.toDateString();
            }).length}
          </p>
          <p className="text-police-400 text-sm">Last 24h</p>
        </div>
      </div>
    </div>
  );
};

export default AuditLogsPage;
