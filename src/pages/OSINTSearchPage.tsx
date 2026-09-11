import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { EntityType } from '../types/osint';
import { EntityManager } from '../components/EntityManager';
import { ActivityManager } from '../components/ActivityManager';
import { Pagination } from '../components/Pagination';

export const OSINTSearchPage = () => {
  const navigate = useNavigate();
  const [searchType, setSearchType] = useState<EntityType>('person');
  const [searchValue, setSearchValue] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selectedTab, setSelectedTab] = useState<'entities' | 'relationships'>('entities');
  const [panel, setPanel] = useState<'entities' | 'activity' | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [recentSearches, setRecentSearches] = useState<Array<{query: string; type: string; timestamp: string; count: number}>>([]);

  const handleSearch = async (searchPage = 1, searchLimit = limit) => {
    if (!searchValue.trim()) return;
    
    setPage(searchPage);
    setLoading(true);
    setSearchError('');
    try {
      const startedAt = performance.now();
      const response = await fetch(
        `/api/search?type=${encodeURIComponent(searchType)}&value=${encodeURIComponent(searchValue.trim())}&page=${searchPage}&limit=${searchLimit}`
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Search request failed');
      }

      const data = await response.json();
      const groupedResults = data.results.reduce((groups: Record<string, any[]>, entity: any) => {
        const groupName = entity.type === 'crypto_wallet'
          ? 'cryptoWallets'
          : `${entity.type}s`;
        groups[groupName] ??= [];
        groups[groupName].push(entity);
        return groups;
      }, {});

      setResults({
        query: data.query,
        results: groupedResults,
        totalCount: data.totalCount,
        totalPages: data.totalPages,
        page: data.page,
        limit: data.limit,
        executedAt: data.executedAt,
        executionTimeMs: performance.now() - startedAt,
        sources: data.sources ?? [],
        sourceErrors: data.sourceErrors ?? [],
      });
      setTotalPages(data.totalPages);
      setTotalCount(data.totalCount);
      setPage(data.page);
      setLimit(data.limit);
      setActiveFilters(new Set());

      const searchEntry = {
        query: searchValue.trim(),
        type: searchType,
        timestamp: new Date().toISOString(),
        count: data.totalCount,
      };

      const updated = [searchEntry, ...recentSearches.filter(s => s.query !== searchEntry.query || s.type !== searchEntry.type)].slice(0, 20);
      setRecentSearches(updated);
      localStorage.setItem('recentSearches', JSON.stringify(updated));
    } catch (error) {
      console.error('Search error:', error);
      setSearchError(error instanceof Error ? error.message : 'Search request failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleFilter = (filter: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(filter)) {
        next.delete(filter);
      } else {
        next.add(filter);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setActiveFilters(new Set());
  };

  const filteredResults = useMemo(() => {
    if (!results?.results || activeFilters.size === 0) return results?.results ?? {};
    const filtered: Record<string, any[]> = {};
    for (const [type, entities] of Object.entries(results.results)) {
      if (activeFilters.has(type)) {
        filtered[type] = entities as any[];
      }
    }
    return filtered;
  }, [results, activeFilters]);

  const allFilteredEntities = useMemo(() => {
    return Object.values(filteredResults).flat();
  }, [filteredResults]);

  const exportCSV = () => {
    if (!allFilteredEntities.length) return;
    const headers = ['Type', 'Value', 'Label', 'Confidence', 'Source', 'Discovered At'];
    const rows = allFilteredEntities.map((e: any) => [
      e.type,
      e.value,
      e.label,
      e.confidence,
      e.sourceName,
      new Date(e.discoveredAt).toLocaleDateString(),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map((c: string) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    downloadFile(csv, 'search-results.csv', 'text/csv');
  };

  const exportJSON = () => {
    if (!allFilteredEntities.length) return;
    const blob = new Blob([JSON.stringify(allFilteredEntities, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'search-results.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const uniqueTypes = useMemo(() => {
    if (!results?.results) return [];
    return Object.keys(results.results);
  }, [results]);

  if (!results) {
    return (
      <div className="space-y-6">
        {/* Search Header */}
        <div className="flex items-center justify-between space-x-4">
          <div>
            <h1 className="text-2xl font-bold text-gradient">OSINT Search</h1>
            <p className="text-police-400">Search for persons, contacts, organizations, and digital footprints</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn-secondary px-4 py-2">
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4v16h16"></path>
              </svg>
              Advanced Search
            </button>
          </div>
        </div>

        {/* Search Form */}
        <div className="card card-hover p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label htmlFor="search-type" className="text-police-300 font-medium w-20">Search For:</label>
              <select
                id="search-type"
                value={searchType}
                onChange={(e) => setSearchType(e.target.value as EntityType)}
                className="w-48 input-field"
              >
                <option value="person">Person Name</option>
                <option value="phone">Phone Number</option>
                <option value="email">Email Address</option>
                <option value="username">Username/Handle</option>
                <option value="organization">Organization</option>
                <option value="crypto_wallet">Cryptocurrency Wallet</option>
                <option value="all">All Types</option>
              </select>
            </div>
            <div>
              <input
                id="search-value"
                type="text"
                className="input-field w-full"
                placeholder="Enter name, phone, email, username, etc."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
              />
              <p className="text-police-500 text-sm mt-1">
                Examples: Rahul Sharma, +91-9876543210, rahul.sharma@example.com, TechSolutions Innovations
              </p>
              {searchError && (
                <p className="mt-2 rounded border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300">
                  {searchError}
                </p>
              )}
            </div>
            <button
              onClick={() => handleSearch(1)}
              className="btn-primary w-full"
              disabled={loading || !searchValue.trim()}
            >
              {loading ? 'Searching...' : 'Search Intelligence'}
            </button>
          </div>
        </div>

        {/* Data and Activity Manager Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button onClick={() => setPanel('entities')} className="card card-hover p-5 text-left">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-accent-cyan/10">
                <svg className="h-6 w-6 text-accent-cyan" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle>
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white">Entities</h3>
            </div>
            <p className="text-sm text-police-400">View all discovered entities. Add new ones, edit or delete existing records.</p>
            <p className="mt-3 text-sm font-medium text-accent-cyan">Open Entity Manager →</p>
          </button>
          <button onClick={() => setPanel('activity')} className="card card-hover p-5 text-left">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-accent-cyan/10">
                <svg className="h-6 w-6 text-accent-cyan" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white">Activity</h3>
            </div>
            <p className="text-sm text-police-400">Tracking of system activity. Acknowledge alerts or create new ones.</p>
            <p className="mt-3 text-sm font-medium text-accent-cyan">Open Activity Log →</p>
          </button>
        </div>

        {/* Search Tips */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card card-hover p-4">
            <h3 className="text-lg font-semibold text-white mb-3">Search Tips</h3>
            <ul className="space-y-2 text-police-400 text-sm">
              <li>• Use exact phone numbers for best results</li>
              <li>• Email searches check breaches and social media</li>
              <li>• Username searches across social platforms</li>
              <li>• Organization searches include registration data</li>
              <li>• Crypto wallet searches blockchain explorers</li>
            </ul>
          </div>
          <div className="card card-hover p-4">
            <h3 className="text-lg font-semibold text-white mb-3">Data Sources</h3>
            <ul className="space-y-2 text-police-400 text-sm">
              <li>• Social Media Platforms</li>
              <li>• Public Records & Databases</li>
              <li>• News & Publications</li>
              <li>• Dark Web Mentions (Lawful Recording)</li>
              <li>• Financial & Blockchain Data</li>
              <li>• Corporate Registries</li>
            </ul>
          </div>
        </div>

        {panel === 'entities' && <EntityManager onClose={() => setPanel(null)} />}
        {panel === 'activity' && <ActivityManager onClose={() => setPanel(null)} />}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Header */}
<div className="flex items-center justify-between space-x-4">
        <div>
          <h1 className="text-2xl font-bold text-gradient">OSINT Search Results</h1>
          <p className="text-police-400">
            Found {results.totalCount} results for "{results.query.value}" 
            ({results.executionTimeMs.toFixed(0)}ms)
          </p>
          {results.sourceErrors?.length > 0 && (
            <p className="mt-2 text-xs text-yellow-400">
              Some sources were unavailable: {results.sourceErrors.join(' | ')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              setResults(null);
              setSearchValue('');
              setPage(1);
              setTotalPages(0);
              setTotalCount(0);
              setActiveFilters(new Set());
            }}
            className="btn-secondary px-4 py-2"
          >
            New Search
          </button>
          <button onClick={exportCSV} className="btn-secondary px-4 py-2">
            Export CSV
          </button>
          <button onClick={exportJSON} className="btn-accent px-4 py-2">
            Export JSON
            </button>
        </div>
      </div>

      {/* Filter Chips */}
      {uniqueTypes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-police-400 text-sm">Filters:</span>
          {uniqueTypes.map(type => (
            <button
              key={type}
              onClick={() => toggleFilter(type)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                activeFilters.has(type)
                  ? 'bg-accent-cyan text-police-900'
                  : 'bg-police-800 text-police-300 hover:bg-police-700'
              }`}
            >
              {type.replace('_', ' ')} ({(results.results[type] as any[])?.length || 0})
            </button>
          ))}
          {activeFilters.size > 0 && (
            <button onClick={clearFilters} className="text-xs text-red-400 hover:text-red-300 ml-2">
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Results Tabs */}
      <div className="flex border-b border-police-700 mb-6">
        <button
          onClick={() => setSelectedTab('entities')}
          className={`flex-1 py-3 text-center font-medium 
            ${selectedTab === 'entities' 
              ? 'bg-police-800 text-white border-b-2 border-accent-cyan' 
              : 'text-police-400 hover:bg-police-800/50 hover:text-white'
            }`}
        >
          Entities ({Object.keys(results.results).length} types)
        </button>
        <button
          onClick={() => setSelectedTab('relationships')}
          className={`flex-1 py-3 text-center font-medium 
            ${selectedTab === 'relationships' 
              ? 'bg-police-800 text-white border-b-2 border-accent-cyan' 
              : 'text-police-400 hover:bg-police-800/50 hover:text-white'
            }`}
        >
          Relationships
        </button>
      </div>

      {selectedTab === 'entities' ? (
        <div className="space-y-6">
          {Object.entries(filteredResults).map((entry) => {
            const [type, entities] = entry as [string, any[]];
            if (entities.length === 0) return null;
            
            return (
              <div key={type} className="space-y-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gradient">
                    {type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')} 
                    ({entities.length})
                  </h3>
                  <button 
                    className="text-sm text-police-400 hover:text-police-300"
                  onClick={() => {
                      navigate('/graph');
                    }}
                  >
                    View All
                  </button>
                </div>
                <div className="space-y-3">
                  {entities.map((entity: any) => (
                    <div 
                      key={entity.id} 
                      className="flex items-start gap-4 p-4 bg-police-800/50 rounded-lg hover:bg-police-800 transition-colors cursor-pointer"
                      onClick={() => {
                          navigate(`/profile/${encodeURIComponent(entity.id)}`);
                      }}
                    >
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 flex items-center justify-center bg-police-900/50 rounded-lg">
                          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            {entity.type === 'person' && <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></>}
                            {entity.type === 'phone' && <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 2v10.7a2 2 0 0 1-.28 1.395A5.985 5.985 0 0 0 10 9a5.985 5.985 0 0 0-1.326-.168 5 5 0 1 0-8.27 9.406"></path>}
                            {entity.type === 'email' && <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><line x1="2" y1="6" x2="2" y2="6"></line><line x1="2" y1="10" x2="2" y2="10"></line><line x1="2" y1="14" x2="2" y2="14"></line></>}
                            {entity.type === 'username' && <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>}
                            {entity.type === 'organization' && <><path d="M3 3h18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"></path><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="14" x2="21" y2="14"></line></>}
                            {entity.type === 'location' && <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></>}
                            {entity.type === 'crypto_wallet' && <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>}
                            {entity.type === 'social_account' && <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>}
                            {entity.type === 'vehicle' && <path d="M5 4h2a2 2 0 0 1 2 2v1c0 2-1.5 2.5-2.5 2.5H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2 2h1.5L9 13l4-3 2 2V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1c0 2-1.5 2.5-2.5 2.5h-2C4.5 11.5 4 11 4 10V6a2 2 0 0 1 2-2h2l2 2-4 3z"></path>}
                            {entity.type === 'document' && <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></>}
                          </svg>
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-medium text-white">{entity.label || entity.value}</h4>
                          <div className="flex items-center gap-2">
                            {entity.verified && (
                              <span className="bg-green-500/20 text-green-300 text-xs px-2 py-0.5 rounded">
                                Verified
                              </span>
                            )}
                            <span className="badge badge-info text-xs">
                              {entity.confidence}% Confidence
                            </span>
                          </div>
                        </div>
                        <p className="text-police-400 text-sm">
                          Source: {entity.sourceName} • 
                          {new Date(entity.discoveredAt).toLocaleDateString()}
                        </p>
                        {entity.type === 'person' && (
                          <div className="mt-2 space-y-1 text-police-400 text-sm">
                            <div className="flex flex-wrap gap-2">
                              {(entity.aliases ?? []).slice(0, 3).map((alias: string) => (
                                <span key={alias} className="bg-police-900/50 px-2 py-0.5 rounded text-xs">
                                  {alias}
                                </span>
                              ))}
                            </div>
                            {entity.phones && entity.phones.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {entity.phones.slice(0, 2).map((phone: string) => (
                                  <span key={phone} className="text-police-300 text-xs">
                                    {phone}
                                  </span>
                                ))}
                                {entity.phones.length > 2 && (
                                  <span className="text-police-400 text-xs italic">
                                    +{entity.phones.length - 2} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        {entity.type === 'crypto_wallet' && (
                          <div className="mt-2 space-y-1 text-police-400 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-police-300">{entity.currency}</span>
                              <span className="font-medium">{entity.balance?.split(' ')[0] || '0'}</span>
                            </div>
                            <p className="text-police-500 text-xs">
                              {entity.transactions} transactions • 
                              {entity.exchanges?.length > 0 ? entity.exchanges.join(', ') : 'Multiple exchanges'}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div className="text-police-500 text-xs">
                          {entity.type === 'person' && entity.riskScore !== undefined && (
                            <span className={`px-2 py-0.5 rounded-full text-xs
                              ${entity.riskScore >= 70 ? 'bg-red-500/20 text-red-300' :
                              entity.riskScore >= 50 ? 'bg-yellow-500/20 text-yellow-300' : 'bg-green-500/20 text-green-300'}
                            `}>
                              Risk: {entity.riskScore}/100
                            </span>
                          )}
                          {entity.type === 'organization' && (
                            <span className="badge badge-success text-xs">
                              Active
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white mb-4">Relationship Network</h3>
          <p className="text-police-400 text-center py-8">
            Relationship analysis for this search is available in the Knowledge Graph section.
            <br />
            Search results are saved to the database and linked entities appear in the graph.
          </p>
        </div>
      )}

      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalCount={totalCount}
          limit={limit}
          onPageChange={(newPage) => {
            setPage(newPage);
            void handleSearch(newPage);
          }}
          onLimitChange={(newLimit) => {
            void handleSearch(1, newLimit);
          }}
          showPageSizeSelector
        />
      )}
    </div>
  );
};

export default OSINTSearchPage;