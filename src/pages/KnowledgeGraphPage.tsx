import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export const KnowledgeGraphPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchValue, setSearchValue] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [nodes, setNodes] = useState<Array<any>>([]);
  const [edges, setEdges] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [showWeak, setShowWeak] = useState(true);
  const [showUnverified, setShowUnverified] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [expandNeighbors, setExpandNeighbors] = useState(true);
  const [entityType, setEntityType] = useState('all');
  const [relationshipType, setRelationshipType] = useState('all');
  const [minimumConfidence, setMinimumConfidence] = useState(0);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [availableRelationshipTypes, setAvailableRelationshipTypes] = useState<string[]>([]);

  useEffect(() => {
    const loadGraph = async () => {
      setLoading(true);
      if (!submittedSearch.trim()) {
        setNodes([]);
        setEdges([]);
        setSelectedNode(null);
        setLoading(false);
        return;
      }
      try {
        const response = await fetch('/api/entities');
        if (!response.ok) throw new Error('Knowledge graph request failed');
        const graphData = await response.json();
        const allEntities = graphData.entities ?? [];
        const relationships = graphData.relationships ?? [];
        setAvailableTypes(Array.from(new Set(allEntities.map((entity: any) => entity.type))).sort() as string[]);
        setAvailableRelationshipTypes(Array.from(new Set(relationships.map((rel: any) => rel.type))).sort() as string[]);
        const normalizedSearch = submittedSearch.toLowerCase();
        const matchingEntities = allEntities.filter((entity: any) =>
          (entityType === 'all' || entity.type === entityType) &&
          [entity.label, entity.value, entity.type].some((value) =>
            String(value ?? '').toLowerCase().includes(normalizedSearch)
          )
        );
        const matchingIds = new Set(matchingEntities.map((entity: any) => entity.id));
        const filteredRelationships = relationships.filter((rel: any) =>
          (relationshipType === 'all' || rel.type === relationshipType) &&
          Number(rel.confidence ?? 0) >= minimumConfidence &&
          (showWeak || Number(rel.confidence ?? 0) >= 50) &&
          (showUnverified || Boolean(rel.verified))
        );
        const graphIds = new Set(matchingIds);
        if (expandNeighbors) {
          filteredRelationships.forEach((rel: any) => {
            if (matchingIds.has(rel.sourceId)) graphIds.add(rel.targetId);
            if (matchingIds.has(rel.targetId)) graphIds.add(rel.sourceId);
          });
        }
        const entities = allEntities.filter((entity: any) => graphIds.has(entity.id));
        const entityIds = new Set(entities.map((entity: any) => entity.id));
        const visibleRelationships = filteredRelationships.filter((rel: any) => entityIds.has(rel.sourceId) && entityIds.has(rel.targetId));
        const colors: Record<string, string> = {
          person: '#00d4ff', phone: '#00d47e', email: '#ffb800', username: '#ff4d4d',
          organization: '#8b5cf6', location: '#06b6d4', crypto_wallet: '#f97316',
          social_account: '#ec4899', vehicle: '#6366f1', document: '#10b981',
        };

        const allNodes: any[] = [];
        entities.forEach((entity: any) => {
            allNodes.push({
              id: entity.id,
              label: entity.label || entity.value,
              type: entity.type,
              color: colors[entity.type] || '#94a3b8',
              size: 20,
              connections: visibleRelationships.filter((rel: any) => 
                rel.sourceId === entity.id || rel.targetId === entity.id
              ).length
            });
        });

        const maxConnections = Math.max(...allNodes.map(n => n.connections), 1);
        allNodes.forEach(node => {
          // Size between 15 and 35 based on connection count
          node.size = 15 + Math.floor((node.connections / maxConnections) * 20);
        });

        setNodes(allNodes);

        const allEdges: any[] = visibleRelationships.map((rel: any) => ({
          id: rel.id,
          source: rel.sourceId,
          target: rel.targetId,
          label: rel.type.replace('_', ' '),
          type: rel.type,
          strength: rel.strength ?? rel.confidence ?? 50,
          confidence: rel.confidence,
          color: rel.verified ? '#00d4ff' : '#ffb800',
          width: Math.max(1, (rel.strength ?? rel.confidence ?? 50) / 10),
          dashed: !rel.verified
        }));

        setEdges(allEdges);

        const focusId = searchParams.get('focus');
        if (focusId) {
          const focusedNode = allNodes.find(n => n.id === focusId);
          if (focusedNode) {
            setSelectedNode(focusedNode);
          }
        }
      } catch (error) {
        console.error('Error loading knowledge graph:', error);
      } finally {
        setLoading(false);
      }
    };

    loadGraph();
  }, [searchParams, submittedSearch, entityType, relationshipType, minimumConfidence, showWeak, showUnverified, expandNeighbors]);

  const handleNodeClick = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      setSelectedNode(node);
      // Update URL without reloading
      window.history.pushState({}, '', `?focus=${nodeId}`);
    }
  };

  const handleBackgroundClick = () => {
    setSelectedNode(null);
    window.history.pushState({}, '', '?');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-police-950">
        <div className="text-center">
          <div className="inline-block animate-pulse">
            <svg className="h-8 w-8 text-accent-cyan" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 6v6l4 2"></path>
            </svg>
          </div>
          <p className="mt-4 text-police-300">Loading knowledge graph...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between space-x-4">
        <div>
          <h1 className="text-2xl font-bold text-gradient">Knowledge Graph</h1>
          <p className="text-police-400">Visualize relationships between entities</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleBackgroundClick}
            className="btn-secondary px-4 py-2"
          >
            Clear Selection
          </button>
          <button 
            onClick={() => {
              // Export graph
            }}
            className="btn-accent px-4 py-2"
          >
            Export Graph
          </button>
        </div>
      </div>

      <form
        className="card flex flex-col gap-3 p-4 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          setSelectedNode(null);
          setSubmittedSearch(searchValue.trim());
        }}
      >
        <input
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          className="input-field flex-1"
          placeholder="Search entity, suspect, organization or type"
          aria-label="Search knowledge graph"
        />
        <button type="submit" className="btn-primary px-5 py-2">Search Graph</button>
        {submittedSearch && (
          <button
            type="button"
            className="btn-secondary px-5 py-2"
            onClick={() => { setSearchValue(''); setSubmittedSearch(''); }}
          >
            Clear
          </button>
        )}
      </form>

      <div className="card space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-police-300">Entity type
            <select value={entityType} onChange={event => setEntityType(event.target.value)} className="input-field ml-2 py-1.5">
              <option value="all">All types</option>
              {availableTypes.map(type => <option key={type} value={type}>{type.replace('_', ' ')}</option>)}
            </select>
          </label>
          <label className="text-sm text-police-300">Relationship
            <select value={relationshipType} onChange={event => setRelationshipType(event.target.value)} className="input-field ml-2 py-1.5">
              <option value="all">All relationships</option>
              {availableRelationshipTypes.map(type => <option key={type} value={type}>{type.replace('_', ' ')}</option>)}
            </select>
          </label>
          <label className="text-sm text-police-300">Min confidence
            <input type="number" min="0" max="100" value={minimumConfidence} onChange={event => setMinimumConfidence(Number(event.target.value))} className="input-field ml-2 w-20 py-1.5" />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm text-police-400">Investigation view:</span>
          <label className="flex items-center gap-2 text-sm text-police-300">
            <input
              type="checkbox"
              id="show-weak"
              checked={showWeak}
              onChange={event => setShowWeak(event.target.checked)}
              className="h-4 w-4 rounded border-police-600 text-accent-cyan"
            />
            Weak links
          </label>
          <label className="flex items-center gap-2 text-sm text-police-300">
            <input type="checkbox" checked={showUnverified} onChange={event => setShowUnverified(event.target.checked)} className="h-4 w-4 rounded border-police-600 text-accent-cyan" />
            Unverified links
          </label>
          <label className="flex items-center gap-2 text-sm text-police-300">
            <input type="checkbox" checked={expandNeighbors} onChange={event => setExpandNeighbors(event.target.checked)} className="h-4 w-4 rounded border-police-600 text-accent-cyan" />
            Expand one-hop neighbors
          </label>
          <label className="flex items-center gap-2 text-sm text-police-300">
            <input type="checkbox" checked={showLabels} onChange={event => setShowLabels(event.target.checked)} className="h-4 w-4 rounded border-police-600 text-accent-cyan" />
            Node labels
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { setEntityType('person'); setRelationshipType('all'); setMinimumConfidence(70); setShowWeak(false); setShowUnverified(false); }} className="btn-secondary px-3 py-1.5 text-sm">High-confidence people</button>
          <button type="button" onClick={() => { setEntityType('all'); setRelationshipType('phone_shared'); setMinimumConfidence(0); setShowWeak(true); setShowUnverified(true); }} className="btn-secondary px-3 py-1.5 text-sm">Phone network</button>
          <button type="button" onClick={() => { setEntityType('all'); setRelationshipType('all'); setMinimumConfidence(0); setShowWeak(true); setShowUnverified(true); }} className="btn-secondary px-3 py-1.5 text-sm">Reset view</button>
        </div>
      </div>

      {/* Graph Controls */}
      <div className="flex items-center justify-end bg-police-900/50 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-police-500">Node size reflects connection count</span>
          <button type="button" onClick={() => document.getElementById('graph-container')?.requestFullscreen()} className="btn-secondary px-3 py-1.5 text-sm">
            Fullscreen
          </button>
        </div>
      </div>

      {/* Graph Display */}
      <div className="relative">
        <div 
          id="graph-container"
          className="w-full h-[600px] bg-police-800/50 rounded-lg border border-police-700"
          onClick={handleBackgroundClick}
        >
          <div className="flex items-center justify-center h-full text-police-500">
            <p>{nodes.length ? `Showing matches for "${submittedSearch}": ${nodes.length} entities and ${edges.length} relationships.` : `No saved entities match "${submittedSearch}".`}</p>
          </div>

          {nodes.map((node, idx) => {
            const leftPos = (idx * 13 + 10) % 80 + 5;
            const topPos = (idx * 19 + 15) % 75 + 5;
            return (
              <div 
                key={node.id}
                style={{ left: `${leftPos}%`, top: `${topPos}%` }}
                className={`absolute flex items-center gap-2 p-2 px-3 rounded-lg 
                  bg-police-900/50 border border-police-700/50 
                  ${node.id === selectedNode?.id ? 'border-2 border-accent-cyan' : ''}
                  transition-all duration-200 cursor-pointer hover:bg-police-800/50
                `}
                onClick={(e) => {
                  e.stopPropagation();
                  handleNodeClick(node.id);
                }}
              >
                <div className="h-4 w-4 rounded-full" style={{ backgroundColor: node.color }}></div>
                {showLabels && <span className="text-xs text-white">{node.label.length > 18 ? node.label.slice(0, 18) + '...' : node.label}</span>}
              </div>
            );
          })}
          
        </div>
      </div>

      {/* Node Details Panel */}
      {selectedNode && (
        <div className="card card-hover p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-white">
              {selectedNode.label}
            </h3>
            <button 
              onClick={() => {
                navigate(`/profile/${encodeURIComponent(selectedNode.id)}`);
              }}
              className="text-sm text-police-400 hover:text-police-300"
            >
              View Profile
            </button>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: selectedNode.color }}></div>
              <div>
                <p className="text-police-400 text-sm">Type</p>
                <p className="text-white font-medium">
                  {selectedNode.type.charAt(0).toUpperCase() + selectedNode.type.slice(1).replace('_', ' ')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-accent-cyan"></div>
              <div>
                <p className="text-police-400 text-sm">Connections</p>
                <p className="text-white font-medium">{selectedNode.connections}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-police-600/50"></div>
              <div>
                <p className="text-police-400 text-sm">Size Score</p>
                <p className="text-white font-medium">{selectedNode.size}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeGraphPage;
