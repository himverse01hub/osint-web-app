import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { generateMockDarkWebMentions } from '../data/mockData';
import { DarkWebMention } from '../types/osint';

export const DarkWebIntelligencePage = () => {
  const { authState } = useAuth();
  const [mentions, setMentions] = useState<DarkWebMention[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all');
  const [filterVerified, setFilterVerified] = useState<'all' | 'verified' | 'unverified'>('all');

  useEffect(() => {
    const loadMentions = async () => {
      setLoading(true);
      try {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Get mock data (clearly labeled as simulated)
        const mockMentions = generateMockDarkWebMentions();
        setMentions(mockMentions);
      } catch (error) {
        console.error('Error loading dark web intelligence:', error);
      } finally {
        setLoading(false);
      }
    };

    loadMentions();
  }, []);

  const filteredMentions = mentions.filter(mention => {
    const severityMatch = filterSeverity === 'all' || mention.severity === filterSeverity;
    const verifiedMatch = filterVerified === 'all' || 
      (filterVerified === 'verified' && mention.verified) || 
      (filterVerified === 'unverified' && !mention.verified);
    return severityMatch && verifiedMatch;
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between space-x-4">
        <div>
          <h1 className="text-2xl font-bold text-gradient">Dark Web Intelligence</h1>
          <p className="text-police-400">Monitoring simulated dark web activity and data leaks</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              // Refresh data
            }}
            className="btn-secondary px-4 py-2"
          >
            Refresh Data
          </button>
          <button 
            onClick={() => {
              // Export data
            }}
            className="btn-accent px-4 py-2"
          >
            Export Report
          </button>
        </div>
      </div>

      {/* Warning Banner for Simulated Data */}
      <div className="bg-yellow-900/50 border border-yellow-700/50 text-yellow-300 text-sm px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c.77-1.333-.262-3-1.732-3z"></path>
            </svg>
            <span>
              <strong>SIMULATED DATA:</strong> All dark web intelligence shown here is simulated for demonstration purposes only.
              No actual dark web marketplaces or stolen databases were accessed.
            </span>
          </div>
          <button className="text-yellow-400 hover:text-yellow-300 transition-colors px-3 py-1 rounded hover:bg-yellow-800/20">
            Close
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
          <span className="text-police-400">Verification:</span>
          <select
            value={filterVerified}
            onChange={(e) => setFilterVerified(e.target.value as any)}
            className="input-field"
          >
            <option value="all">All</option>
            <option value="verified">Verified Only</option>
            <option value="unverified">Unverified Only</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-police-400">Showing:</span>
          <span className="text-police-300 font-medium">{filteredMentions.length} mentions</span>
        </div>
      </div>

      {/* Mentions List */}
      <div className="space-y-4">
        {filteredMentions.length > 0 ? (
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
                      {/* Warning icon */}
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
                <div className="text-right">
                  <span className={`px-3 py-1 rounded-full text-xs
                    ${getSeverityColor(mention.severity)}
                  `}>
                    {mention.severity.charAt(0).toUpperCase() + mention.severity.slice(1)}
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-police-400">{mention.description}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {mention.dataTypes.map((type: string) => (
                    <span key={type} className="bg-police-800/50 px-2 py-0.5 rounded text-xs">
                      {type}
                    </span>
                  ))}
                </div>
                {mention.price && (
                  <div className="flex items-center gap-3 mt-2 text-police-400 text-sm">
                    <span className="text-police-300">Price:</span>
                    <span className="font-medium">{mention.price} {mention.currency || ''}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 mt-2 text-police-400 text-sm">
                  <span className="text-police-300">Seller:</span>
                  <span className="font-medium">{mention.seller || 'Unknown'}</span>
                </div>
                <div className="flex items-center gap-3 mt-2 text-police-400 text-sm">
                  <span className="text-police-300">Entity:</span>
                  <span className="font-medium">
                    {mention.entityType === 'email' && (
                      <span className="text-white">
                        Email: {mention.entityId === 'email_002' ? 'money.maker99@protonmail.com' : 'entity_' + mention.entityId.slice(0, 4)}
                      </span>
                    )}
                    {mention.entityType === 'username' && (
                      <span className="text-white">
                        Username: @{mention.entityId === 'username_002' ? 'money_maker_99' : 'entity_' + mention.entityId.slice(0, 4)}
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2 text-police-400 text-sm">
                  <span className="text-police-300">Verified:</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs
                    ${mention.verified ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}
                  `}>
                    {mention.verified ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2 text-police-400 text-sm">
                  <span className="text-police-300">Source:</span>
                  <span className="text-accent-cyan hover:text-accent-400">
                    SIMULATED: Do not access
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center text-police-500 py-8">
            <p>No dark web mentions match the current filters.</p>
            <p className="mt-2 text-sm">Try adjusting the severity or verification filters.</p>
          </div>
        )}
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card card-hover p-4">
          <h3 className="text-lg font-semibold text-white mb-3">Total Mentions</h3>
          <p className="text-2xl font-bold text-accent-cyan">{mentions.length}</p>
          <p className="text-police-400 text-sm">Simulated</p>
        </div>
        <div className="card card-hover p-4">
          <h3 className="text-lg font-semibold text-white mb-3">High Risk</h3>
          <p className="text-2xl font-bold text-accent-cyan">
            {mentions.filter(m => m.severity === 'high' || m.severity === 'critical').length}
          </p>
          <p className="text-police-400 text-sm">Severity</p>
        </div>
        <div className="card card-hover p-4">
          <h3 className="text-lg font-semibold text-white mb-3">Verified</h3>
          <p className="text-2xl font-bold text-accent-cyan">{mentions.filter(m => m.verified).length}</p>
          <p className="text-police-400 text-sm">Confirmed</p>
        </div>
        <div className="card card-hover p-4">
          <h3 className="text-lg font-semibold text-white mb-3">Data Types</h3>
          <p className="text-2xl font-bold text-accent-cyan">
            {/* Count unique data types */}
            {Array.from(new Set(mentions.flatMap(m => m.dataTypes))).length}
          </p>
          <p className="text-police-400 text-sm">Unique</p>
        </div>
      </div>
    </div>
  );
};

export default DarkWebIntelligencePage;
