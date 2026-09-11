import { useState } from 'react';

interface GhuntResult {
  action: string;
  query: string;
  output: string;
}

export const GhuntPanel = () => {
  const [action, setAction] = useState<'email' | 'geolocate' | 'image' | 'social' | 'google'>('email');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GhuntResult | null>(null);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!query.trim()) {
      setError('Please enter a query');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch('/api/osint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'ghunt', action, query: query.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'GHunt search failed');
      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'GHunt search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card card-hover p-6">
        <h3 className="text-lg font-semibold text-white mb-4">GHunt Intelligence Gathering</h3>
        <p className="text-police-400 text-sm mb-4">
          GHunt is a Google OSINT framework. It can find email accounts, geolocate coordinates, 
          search images, and find social media profiles.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-police-300 font-medium text-sm">Search Action</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {[
                { value: 'email' as const, label: 'Email Lookup' },
                { value: 'geolocate' as const, label: 'Geolocate' },
                { value: 'image' as const, label: 'Image Search' },
                { value: 'social' as const, label: 'Social Profiles' },
                { value: 'google' as const, label: 'Google Dork' },
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => { setAction(item.value); setResult(null); setError(''); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                    action === item.value
                      ? 'bg-accent-cyan text-police-900'
                      : 'bg-police-800 text-police-300 hover:bg-police-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-police-300 font-medium text-sm">Query</label>
            <input
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setError(''); }}
              placeholder={
                action === 'email' ? 'Enter email address' :
                action === 'geolocate' ? 'Enter coordinates (e.g., 28.6139,77.2090)' :
                action === 'image' ? 'Enter image URL' :
                action === 'social' ? 'Enter username' :
                'Enter Google search query'
              }
              className="input-field w-full mt-2"
            />
          </div>

          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Run GHunt Search'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {result && !error && (
        <div className="card card-hover p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            GHunt Result: {result.action.toUpperCase()}
          </h3>
          <div className="bg-police-950 rounded-lg p-4 border border-police-800 max-h-96 overflow-y-auto">
            <pre className="text-green-400 text-sm whitespace-pre-wrap font-mono">
              {result.output || 'No results returned.'}
            </pre>
          </div>
        </div>
      )}

      {!result && !error && (
        <div className="card card-hover p-6">
          <h3 className="text-lg font-semibold text-white mb-3">GHunt Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-police-800/50 rounded-lg">
              <h4 className="text-accent-cyan font-medium text-sm mb-2">Email Lookup</h4>
              <p className="text-police-400 text-xs">Find Google accounts and associated information linked to an email address.</p>
            </div>
            <div className="p-4 bg-police-800/50 rounded-lg">
              <h4 className="text-accent-cyan font-medium text-sm mb-2">Geolocate</h4>
              <p className="text-police-400 text-xs">Reverse geocode coordinates to find exact locations on Google Maps.</p>
            </div>
            <div className="p-4 bg-police-800/50 rounded-lg">
              <h4 className="text-accent-cyan font-medium text-sm mb-2">Image Search</h4>
              <p className="text-police-400 text-xs">Search Google Images for matching or related images.</p>
            </div>
            <div className="p-4 bg-police-800/50 rounded-lg">
              <h4 className="text-accent-cyan font-medium text-sm mb-2">Social Profiles</h4>
              <p className="text-police-400 text-xs">Find social media profiles associated with a username.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GhuntPanel;
