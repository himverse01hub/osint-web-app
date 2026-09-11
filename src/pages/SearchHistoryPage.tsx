import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

type SearchRow = {
  id: string;
  query: string;
  searchType?: string;
  timestamp: string;
  resultsCount: number;
  source?: string;
  isMock?: boolean;
};

const mockSearches: SearchRow[] = [
  { id: 'mock-search-1', query: 'Ravi Kumar', searchType: 'person', timestamp: '2026-09-10T08:40:00.000Z', resultsCount: 12, source: 'Sample data', isMock: true },
  { id: 'mock-search-2', query: '+91 98765 43210', searchType: 'phone', timestamp: '2026-09-09T15:20:00.000Z', resultsCount: 7, source: 'Sample data', isMock: true },
  { id: 'mock-search-3', query: 'example@domain.com', searchType: 'email', timestamp: '2026-09-08T11:05:00.000Z', resultsCount: 5, source: 'Sample data', isMock: true },
];

export const SearchHistoryPage = () => {
  const [searches, setSearches] = useState<SearchRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSearches = async () => {
      try {
        const response = await fetch('/api/search-history');
        const data = await response.json().catch(() => ({}));
        const liveSearches = Array.isArray(data.searches) ? data.searches : [];
        setSearches(liveSearches.length ? liveSearches : mockSearches);
      } catch {
        setSearches(mockSearches);
      } finally {
        setLoading(false);
      }
    };
    void loadSearches();
  }, []);

  const filteredSearches = searches.filter(search =>
    `${search.query} ${search.searchType ?? ''} ${search.source ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-accent-cyan">Investigation records</p>
          <h1 className="mt-1 text-3xl font-bold text-white">Search History</h1>
          <p className="mt-1 text-police-400">Review searches and result volumes recorded by investigators.</p>
        </div>
        <Link to="/search" className="btn-accent px-4 py-2">Open Search</Link>
      </div>

      <div className="card p-4">
        <label htmlFor="search-history-filter" className="mb-2 block text-sm text-police-300">Filter search records</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input id="search-history-filter" value={query} onChange={event => setQuery(event.target.value)} className="input-field flex-1" placeholder="Search query, type or source" />
          <button type="button" onClick={() => setQuery('')} className="btn-secondary px-4 py-2">Clear</button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table min-w-[720px]">
            <thead><tr><th>Search query</th><th>Type</th><th>Results</th><th>Source</th><th>Executed</th></tr></thead>
            <tbody>
              {filteredSearches.map(search => (
                <tr key={search.id}>
                  <td className="font-medium text-white">{search.query}</td>
                  <td className="capitalize text-police-300">{search.searchType ?? 'All types'}</td>
                  <td className="text-police-300">{search.resultsCount}</td>
                  <td>{search.isMock ? <span className="badge badge-warning">Sample data</span> : <span className="text-police-400">{search.source ?? 'Investigator search'}</span>}</td>
                  <td className="text-sm text-police-400">{new Date(search.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && !filteredSearches.length && <p className="p-8 text-center text-police-500">No search records match your filter.</p>}
        {loading && <p className="p-8 text-center text-police-400">Loading search history...</p>}
      </div>
    </div>
  );
};

export default SearchHistoryPage;
