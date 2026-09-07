import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { generateMockData, generateMockRelationships } from '../data/mockData';
import { Relationship } from '../types/osint';

export const KnowledgeGraphPage = () => {
  const { authState } = useAuth();
  const [searchParams] = useSearchParams();
  const [nodes, setNodes] = useState<Array<any>>([]);
  const [edges, setEdges] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(true);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);

  useEffect(() => {
    const loadGraph = async () => {
      setLoading(true);
      try {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1200));
        
        // Get mock data
        const mockData = generateMockData();
        const mockRelationships = generateMockRelationships(mockData);
        
        // Convert entities to nodes
        const entityTypes = [
          { type: 'person', data: mockData.persons, color: '#00d4ff' },
          { type: 'phone', data: mockData.phones, color: '#00d47e' },
          { type: 'email', data: mockData.emails, color: '#ffb800' },
          { type: 'username', data: mockData.usernames, color: '#ff4d4d' },
          { type: 'organization', data: mockData.organizations, color: '#8b5cf6' },
          { type: 'location', data: mockData.locations, color: '#06b6d4' },
          { type: 'crypto_wallet', data: mockData.cryptoWallets, color: '#f97316' },
          { type: 'social_account', data: mockData.socialAccounts, color: '#ec4899' },
          { type: 'vehicle', data: mockData.vehicles, color: '#6366f1' },
          { type: 'document', data: mockData.documents, color: '#10b981' },
        ];

        const allNodes: any[] = [];
        entityTypes.forEach(({ type, data, color }) => {
          data.forEach((entity: any) => {
            allNodes.push({
              id: entity.id,
              label: entity.label || entity.value,
              type,
              color,
              size: 20,
              // For sizing based on connections
              connections: mockRelationships.filter((rel: any) => 
                rel.sourceId === entity.id || rel.targetId === entity.id
              ).length
            });
          });
        });

        // Adjust node sizes based on connection count
        const maxConnections = Math.max(...allNodes.map(n => n.connections), 1);
        allNodes.forEach(node => {
          // Size between 15 and 35 based on connection count
          node.size = 15 + Math.floor((node.connections / maxConnections) * 20);
        });

        setNodes(allNodes);

        // Convert relationships to edges
        const allEdges: any[] = mockRelationships.map((rel: any) => ({
          id: rel.id,
          source: rel.sourceId,
          target: rel.targetId,
          label: rel.type.replace('_', ' '),
          type: rel.type,
          strength: rel.strength,
          confidence: rel.confidence,
          color: rel.verified ? '#00d4ff' : '#ffb800',
          width: Math.max(1, rel.strength / 10),
          dashed: !rel.verified
        }));

        setEdges(allEdges);

        // Handle focus node from URL params
        const focusId = searchParams.get('focus');
        if (focusId) {
          setFocusNodeId(focusId);
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
  }, [searchParams]);

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
    setFocusNodeId(null);
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

      {/* Graph Controls */}
      <div className="flex items-center justify-between bg-police-900/50 rounded-lg p-4">
        <div className="flex items-center gap-4">
          <span className="text-police-400">Show:</span>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="show-weak"
              className="h-4 w-4 text-accent-cyan focus:ring-police-500 border-police-600 rounded"
            />
            <label htmlFor="show-weak" className="text-police-300 text-sm">
              Weak Connections
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="show-unverified"
              className="h-4 w-4 text-accent-cyan focus:ring-police-500 border-police-600 rounded"
            />
            <label htmlFor="show-unverified" className="text-police-300 text-sm">
              Unverified Links
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="show-labels"
              checked
              className="h-4 w-4 text-accent-cyan focus:ring-police-500 border-police-600 rounded"
            />
            <label htmlFor="show-labels" className="text-police-300 text-sm">
              Node Labels
            </label>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="text-sm text-police-400 hover:text-police-300">
            Layout: Force Directed
          </button>
          <button className="btn-secondary px-3 py-1">
            Fullscreen
          </button>
        </div>
      </div>

      {/* Graph Display */}
      <div className="relative">
        {/* In a real implementation, this would use a graph visualization library like vis.js or cytoscape.js */}
        <div 
          id="graph-container"
          className="w-full h-[600px] bg-police-800/50 rounded-lg border border-police-700"
          onClick={handleBackgroundClick}
        >
          {/* Placeholder for graph visualization */}
          <div className="flex items-center justify-center h-full text-police-500">
            <p>Knowledge graph visualization would appear here in the full implementation.</p>
            <p className="mt-2 text-sm">
              Showing {nodes.length} entities and {edges.length} relationships.
            </p>
          </div>
          
          {/* Mock nodes and edges for demonstration */}
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
                <span className="text-xs text-white">{node.label.length > 8 ? node.label.slice(0, 8) + '...' : node.label}</span>
              </div>
            );
          })}
          
          {/* Mock edges (simplified) */}
          {edges.slice(0, 10).map((edge, index) => {
            const leftPos = (index * 17 + 20) % 80 + 5;
            const topPos = (index * 23 + 30) % 60 + 5;
            const borderWidth = Math.max(1, Math.floor(edge.strength / 10));
            const borderColor = edge.verified ? 'border-accent-cyan' : 'border-yellow-400';
            return (
              <div 
                key={edge.id}
                style={{ 
                  left: `${leftPos}%`, 
                  top: `${topPos}%`,
                  width: `${Math.random() * 30 + 20}%`,
                  height: '1px',
                  borderTopWidth: `${borderWidth}px`,
                }}
                className={`absolute opacity-60 ${borderColor} ${edge.dashed ? 'border-dashed' : 'border-solid'}`}
              ></div>
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
                // Navigate to profile page
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
