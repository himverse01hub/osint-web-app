import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { generateMockData, generateMockRelationships, generateMockAlerts, generateMockCases } from '../data/mockData';
import { Person, Phone, Email, Username, Organization, Location, CryptoWallet, SocialAccount, Vehicle, Document, Relationship, Alert } from '../types/osint';

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
    totalAlerts: 0,
    highPriorityAlerts: 0,
  });
  const [recentSearches, setRecentSearches] = useState<Array<{id: string; query: string; timestamp: string; resultsCount: number}>>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [cases, setCases] = useState<Array<{id: string; caseNumber: string; title: string; status: string; priority: string; assignedTo: string; updatedAt: string}>>([]);

  useEffect(() => {
    // Generate mock data
    const mockData = generateMockData();
    const relationships = generateMockRelationships(mockData);
    const mockAlerts = generateMockAlerts();
    const mockCases = generateMockCases();

    // Flatten entities for counting
    const entities = {
      persons: mockData.persons,
      phones: mockData.phones,
      emails: mockData.emails,
      usernames: mockData.usernames,
      organizations: mockData.organizations,
      locations: mockData.locations,
      cryptoWallets: mockData.cryptoWallets,
      socialAccounts: mockData.socialAccounts,
      vehicles: mockData.vehicles,
      documents: mockData.documents,
    };

    const totalEntities = {
      totalPersons: entities.persons.length,
      totalPhones: entities.phones.length,
      totalEmails: entities.emails.length,
      totalUsernames: entities.usernames.length,
      totalOrganizations: entities.organizations.length,
      totalLocations: entities.locations.length,
      totalCryptoWallets: entities.cryptoWallets.length,
      totalSocialAccounts: entities.socialAccounts.length,
      totalVehicles: entities.vehicles.length,
      totalDocuments: entities.documents.length,
      totalRelationships: relationships.length,
    };

    // Mock case stats
    const activeCases = mockCases.filter(c => c.status === 'active' || c.status === 'open').length;
    const totalAlerts = mockAlerts.length;
    const highPriorityAlerts = mockAlerts.filter(a => a.severity === 'high' || a.severity === 'critical').length;

    setStats(prev => ({ ...prev, ...totalEntities, activeCases, totalAlerts, highPriorityAlerts }));

    // Mock recent searches
    setRecentSearches([
      { id: 'search_001', query: 'Rahul Sharma', timestamp: '2024-01-16T10:30:00Z', resultsCount: 12 },
      { id: 'search_002', query: '+91-9876543210', timestamp: '2024-01-16T09:15:00Z', resultsCount: 8 },
      { id: 'search_003', query: 'rahul.sharma@example.com', timestamp: '2024-01-16T08:45:00Z', resultsCount: 5 },
      { id: 'search_004', query: 'TechSolutions Innovations', timestamp: '2024-01-15T16:20:00Z', resultsCount: 3 },
      { id: 'search_005', query: '0x742d35Cc6634C0532925a3b8D4C0532950532950', timestamp: '2024-01-15T14:10:00Z', resultsCount: 7 },
    ]);

    setAlerts(mockAlerts);
    setCases(mockCases);
  }, []);

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between space-x-4">
        <div>
          <h1 className="text-2xl font-bold text-gradient">Dashboard</h1>
          <p className="text-police-400">Welcome back, {user?.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-secondary px-4 py-2">
            Refresh Data
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Investigation Stats */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Investigations</h3>
              <p className="text-police-400 text-sm">Active Cases</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-accent-cyan">{stats.activeCases}</p>
              <p className="text-police-400 text-sm">of {stats.activeCases + 2} total</p>
            </div>
          </div>
          <div className="h-0.5 bg-police-800 my-4"></div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-police-400">Persons</span>
              <span className="text-police-300">{stats.totalPersons}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-police-400">Organizations</span>
              <span className="text-police-300">{stats.totalOrganizations}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-police-400">Relationships</span>
              <span className="text-police-300">{stats.totalRelationships}</span>
            </div>
          </div>
        </div>

        {/* Entity Stats */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Entities</h3>
              <p className="text-police-400 text-sm">Discovered Today</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-accent-cyan">
                {stats.totalPhones + stats.totalEmails + stats.totalUsernames}
              </p>
              <p className="text-police-400 text-sm">Contacts</p>
            </div>
          </div>
          <div className="h-0.5 bg-police-800 my-4"></div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-police-400">Phone Numbers</span>
              <span className="text-police-300">{stats.totalPhones}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-police-400">Email Addresses</span>
              <span className="text-police-300">{stats.totalEmails}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-police-400">Usernames</span>
              <span className="text-police-300">{stats.totalUsernames}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-police-400">Crypto Wallets</span>
              <span className="text-police-300">{stats.totalCryptoWallets}</span>
            </div>
          </div>
        </div>

        {/* Alerts & Activity */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Activity</h3>
              <p className="text-police-400 text-sm">Alerts & Updates</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-accent-cyan">{stats.totalAlerts}</p>
              <p className="text-police-400 text-sm">Total Alerts</p>
            </div>
          </div>
          <div className="h-0.5 bg-police-800 my-4"></div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-police-400">High Priority</span>
              <span className={`
                text-sm px-2 py-0.5 rounded-full
                ${stats.highPriorityAlerts > 0 ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'}
              `}>
                {stats.highPriorityAlerts}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-police-400">New Today</span>
              <span className="text-police-300">3</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-police-400">Acknowledged</span>
              <span className="text-police-300">1</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Searches and Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Searches */}
        <div className="card card-hover">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Recent Searches</h3>
            <button className="text-sm text-police-400 hover:text-police-300">
              View All
            </button>
          </div>
          <div className="space-y-3">
            {recentSearches.map((search) => (
              <div key={search.id} className="flex items-center justify-between p-3 bg-police-800/50 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-white">{search.query}</p>
                  <p className="text-police-400 text-sm">
                    {new Date(search.timestamp).toLocaleString()} • {search.resultsCount} results
                  </p>
                </div>
                <div className="text-police-300 text-sm">
                  {search.resultsCount} results
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Active Alerts */}
        <div className="card card-hover">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Active Alerts</h3>
            <button className="text-sm text-police-400 hover:text-police-300">
              View All
            </button>
          </div>
          <div className="space-y-2">
            {alerts.slice(0, 3).map((alert) => (
              <div key={alert.id} className="flex items-start gap-3 p-3 bg-police-800/50 rounded-lg">
                <div className="flex-shrink-0">
                  <div className={`h-3 w-3 rounded-full
                    ${alert.severity === 'critical' ? 'bg-red-500' :
                    alert.severity === 'high' ? 'bg-orange-500' :
                    alert.severity === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}
                  `}></div>
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-white">{alert.title}</h4>
                  <p className="text-police-400 text-sm">{alert.description}</p>
                  <p className="text-police-500 text-xs mt-1">
                    {new Date(alert.createdAt).toLocaleString()} • 
                    {alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
                  </p>
                </div>
              </div>
            ))}
            {alerts.length === 0 && (
              <div className="text-center text-police-500 py-4">
                No active alerts
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cases Overview */}
      <div className="card card-hover">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Active Cases</h3>
          <button className="text-sm text-police-400 hover:text-police-300">
            View All Cases
          </button>
        </div>
        <div className="space-y-3">
          {cases.map((caseItem) => (
            <div key={caseItem.id} className="flex items-start gap-3 p-3 bg-police-800/50 rounded-lg">
              <div className="flex-shrink-0">
                <div className={`h-3 w-3 rounded-full
                  ${caseItem.priority === 'critical' ? 'bg-red-500' :
                  caseItem.priority === 'high' ? 'bg-orange-500' :
                  caseItem.priority === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'}
                `}></div>
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-white">{caseItem.title}</h4>
                <p className="text-police-400 text-sm">
                  Case #{caseItem.caseNumber} • {caseItem.status} • Assigned to {caseItem.assignedTo}
                </p>
                <p className="text-police-500 text-xs mt-1">
                  Updated: {new Date(caseItem.updatedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
          {cases.length === 0 && (
            <div className="text-center text-police-500 py-4">
              No active cases
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
