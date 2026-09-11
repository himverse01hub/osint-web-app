import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  Simulation,
} from 'd3-force';
import { zoom, zoomIdentity, ZoomBehavior, ZoomTransform, D3ZoomEvent } from 'd3-zoom';
import { select } from 'd3-selection';

const COLORS: Record<string, string> = {
  person: '#00d4ff',
  phone: '#00d47e',
  email: '#ffb800',
  username: '#ff4d4d',
  organization: '#8b5cf6',
  location: '#06b6d4',
  crypto_wallet: '#f97316',
  social_account: '#ec4899',
  vehicle: '#6366f1',
  document: '#10b981',
};

const TYPE_SHAPES: Record<string, string> = {
  person: 'circle',
  organization: 'square',
  location: 'diamond',
  phone: 'roundRect',
  email: 'triangle',
  username: 'pentagon',
  crypto_wallet: 'hexagon',
  social_account: 'star',
  vehicle: 'parallelogram',
  document: 'ellipse',
};

function getShapePath(type: string, size: number): string {
  const s = size;
  switch (type) {
    case 'square':
      return `M ${-s} ${-s} L ${s} ${-s} L ${s} ${s} L ${-s} ${s} Z`;
    case 'diamond':
      return `M 0 ${-s * 1.2} L ${s} 0 L 0 ${s * 1.2} L ${-s} 0 Z`;
    case 'triangle':
      return `M 0 ${-s} L ${s} ${s * 0.7} L ${-s} ${s * 0.7} Z`;
    case 'pentagon':
      const p = Array.from({ length: 5 }, (_, i) => {
        const a = (i * 72 - 90) * (Math.PI / 180);
        return `${Math.cos(a) * s} ${Math.sin(a) * s}`;
      }).join(' ');
      return `M ${p} Z`;
    case 'hexagon':
      const h = Array.from({ length: 6 }, (_, i) => {
        const a = (i * 60) * (Math.PI / 180);
        return `${Math.cos(a) * s} ${Math.sin(a) * s}`;
      }).join(' ');
      return `M ${h} Z`;
    case 'star': {
      const pts = Array.from({ length: 5 }, (_, i) => {
        const outer = (i * 72 - 90) * (Math.PI / 180);
        const inner = ((i * 72) + 36 - 90) * (Math.PI / 180);
        return `${Math.cos(outer) * s} ${Math.sin(outer) * s} ${Math.cos(inner) * s * 0.45} ${Math.sin(inner) * s * 0.45}`;
      }).join(' ');
      return `M ${pts.replace(/ /g, ' L ')} Z`;
    }
    case 'parallelogram':
      return `M ${-s * 0.6} ${-s} L ${s * 0.6} ${-s} L ${s} ${s} L ${-s * 0.6} ${s} Z`;
    case 'roundRect':
      return `M ${-s} ${-s * 0.8} L ${s} ${-s * 0.8} A ${s * 0.3} ${s * 0.3} 0 0 1 ${s} ${-s * 0.5} L ${s} ${s * 0.5} A ${s * 0.3} ${s * 0.3} 0 0 1 ${s * 0.7} ${s * 0.8} L ${-s * 0.7} ${s * 0.8} A ${s * 0.3} ${s * 0.3} 0 0 1 ${-s} ${s * 0.5} L ${-s} ${-s * 0.5} A ${s * 0.3} ${s * 0.3} 0 0 1 ${-s * 0.6} ${-s * 0.8} Z`;
    case 'ellipse':
      return `M ${-s} 0 A ${s} ${s * 0.6} 0 1 1 ${s} 0 A ${s} ${s * 0.6} 0 1 1 ${-s} 0 Z`;
    default:
      return `M 0 ${-s} A ${s} ${s} 0 1 1 0 ${s} A ${s} ${s} 0 1 1 0 ${-s} Z`;
  }
}

function getEdgePath(
  source: { x?: number; y?: number },
  target: { x?: number; y?: number },
  curvature = 0.3
): string {
  if (!source.x || !source.y || !target.x || !target.y) return '';
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const dr = Math.sqrt(dx * dx + dy * dy);
  if (dr < 0.01) return '';
  const mx = (source.x + target.x) / 2;
  const my = (source.y + target.y) / 2;
  const nx = -dy / dr;
  const ny = dx / dr;
  const cx = mx + nx * dr * curvature;
  const cy = my + ny * dr * curvature;
  return `M ${source.x} ${source.y} Q ${cx} ${cy} ${target.x} ${target.y}`;
}

const MOCK_ENTITIES = [
  { id: 'm1', label: 'Rahul Verma', type: 'person', value: 'rahul.verma', confidence: 92, verified: true, source: 'social_media', sourceName: 'Twitter' },
  { id: 'm2', label: 'Anita Singh', type: 'person', value: 'anita.singh', confidence: 88, verified: true, source: 'public_records', sourceName: 'Court Records' },
  { id: 'm3', label: 'Vikas Mehra', type: 'person', value: 'vikas.mehra', confidence: 76, verified: true, source: 'database', sourceName: 'Criminal DB' },
  { id: 'm4', label: 'Neha Rani', type: 'person', value: 'neha.rani', confidence: 64, verified: false, source: 'social_media', sourceName: 'Instagram' },
  { id: 'm5', label: 'Simran Kaur', type: 'person', value: 'simran.kaur', confidence: 81, verified: true, source: 'public_records', sourceName: 'Ration Card' },
  { id: 'm6', label: '+91-98765-43210', type: 'phone', value: '+919876543210', confidence: 95, verified: true, source: 'telecom', sourceName: 'CDR Analysis' },
  { id: 'm7', label: '+91-87654-32109', type: 'phone', value: '+918765432109', confidence: 72, verified: false, source: 'leaked_data', sourceName: 'Dark Web' },
  { id: 'm8', label: 'rahul@proton.me', type: 'email', value: 'rahul@proton.me', confidence: 89, verified: true, source: 'forum', sourceName: 'Crime Forum' },
  { id: 'm9', label: 'vikas@tutanota.com', type: 'email', value: 'vikas@tutanota.com', confidence: 67, verified: false, source: 'leaked_data', sourceName: 'Credential Dump' },
  { id: 'm10', label: '@rahul_v_official', type: 'username', value: 'rahul_v_official', confidence: 90, verified: true, source: 'social_media', sourceName: 'Twitter/X' },
  { id: 'm11', label: '@vikas_m_trades', type: 'username', value: 'vikas_m_trades', confidence: 78, verified: true, source: 'social_media', sourceName: 'Telegram' },
  { id: 'm12', label: 'Skyline Logistics', type: 'organization', value: 'Skyline Logistics', confidence: 84, verified: true, source: 'corporate', sourceName: 'MCA filings' },
  { id: 'm13', label: 'Royal Courier Services', type: 'organization', value: 'Royal Courier Services', confidence: 71, verified: false, source: 'intelligence', sourceName: 'Field Intel' },
  { id: 'm14', label: 'Sirsa, Haryana', type: 'location', value: 'Sirsa, Haryana', confidence: 93, verified: true, source: 'public_records', sourceName: 'Address Verification' },
  { id: 'm15', label: 'Hisar Bus Stand', type: 'location', value: 'Hisar Bus Stand', confidence: 68, verified: false, source: 'intelligence', sourceName: 'Surveillance' },
  { id: 'm16', label: '0x3f2a...9b1c', type: 'crypto_wallet', value: '0x3f2a...9b1c', confidence: 83, verified: true, source: 'blockchain', sourceName: 'Etherscan' },
  { id: 'm17', label: '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy', type: 'crypto_wallet', value: '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy', confidence: 59, verified: false, source: 'blockchain', sourceName: 'Blockchair' },
  { id: 'm18', label: 'DL8CAB1234', type: 'vehicle', value: 'DL8CAB1234', confidence: 86, verified: true, source: 'government', sourceName: 'RTO Records' },
  { id: 'm19', label: 'DL5XYZ5678', type: 'vehicle', value: 'DL5XYZ5678', confidence: 74, verified: false, source: 'intelligence', sourceName: 'CCTV Match' },
  { id: 'm20', label: 'Rahul_Aadhaar.pdf', type: 'document', value: 'Rahul_Aadhaar.pdf', confidence: 97, verified: true, source: 'database', sourceName: 'Secure Server' },
];

const MOCK_RELATIONSHIPS = [
  { id: 'mr1', sourceId: 'm1', targetId: 'm6', type: 'phone_shared', confidence: 92, verified: true, strength: 92 },
  { id: 'mr2', sourceId: 'm1', targetId: 'm8', type: 'email_owned', confidence: 89, verified: true, strength: 89 },
  { id: 'mr3', sourceId: 'm1', targetId: 'm10', type: 'username_owned', confidence: 90, verified: true, strength: 90 },
  { id: 'mr4', sourceId: 'm1', targetId: 'm12', type: 'works_at', confidence: 84, verified: true, strength: 84 },
  { id: 'mr5', sourceId: 'm1', targetId: 'm16', type: 'wallet_linked', confidence: 83, verified: true, strength: 83 },
  { id: 'mr6', sourceId: 'm1', targetId: 'm18', type: 'vehicle_owned', confidence: 86, verified: true, strength: 86 },
  { id: 'mr7', sourceId: 'm1', targetId: 'm20', type: 'document_owned', confidence: 97, verified: true, strength: 97 },
  { id: 'mr8', sourceId: 'm2', targetId: 'm1', type: 'associated_with', confidence: 88, verified: true, strength: 88 },
  { id: 'mr9', sourceId: 'm2', targetId: 'm5', type: 'associated_with', confidence: 76, verified: true, strength: 76 },
  { id: 'mr10', sourceId: 'm3', targetId: 'm7', type: 'phone_shared', confidence: 72, verified: false, strength: 72 },
  { id: 'mr11', sourceId: 'm3', targetId: 'm9', type: 'email_owned', confidence: 67, verified: false, strength: 67 },
  { id: 'mr12', sourceId: 'm3', targetId: 'm11', type: 'username_owned', confidence: 78, verified: true, strength: 78 },
  { id: 'mr13', sourceId: 'm3', targetId: 'm13', type: 'works_at', confidence: 71, verified: false, strength: 71 },
  { id: 'mr14', sourceId: 'm3', targetId: 'm19', type: 'vehicle_owned', confidence: 74, verified: false, strength: 74 },
  { id: 'mr15', sourceId: 'm3', targetId: 'm17', type: 'wallet_linked', confidence: 59, verified: false, strength: 59 },
  { id: 'mr16', sourceId: 'm4', targetId: 'm1', type: 'associated_with', confidence: 64, verified: false, strength: 64 },
  { id: 'mr17', sourceId: 'm5', targetId: 'm1', type: 'associated_with', confidence: 81, verified: true, strength: 81 },
  { id: 'mr18', sourceId: 'm5', targetId: 'm15', type: 'location_visited', confidence: 68, verified: false, strength: 68 },
  { id: 'mr19', sourceId: 'm10', targetId: 'm11', type: 'cross_platform', confidence: 79, verified: true, strength: 79 },
  { id: 'mr20', sourceId: 'm12', targetId: 'm13', type: 'partner_org', confidence: 73, verified: false, strength: 73 },
  { id: 'mr21', sourceId: 'm14', targetId: 'm15', type: 'nearby_location', confidence: 85, verified: true, strength: 85 },
];

export const KnowledgeGraphPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const simulationRef = useRef<Simulation<any, any> | null>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [nodes, setNodes] = useState<Array<any>>([]);
  const [edges, setEdges] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const [showWeak, setShowWeak] = useState(true);
  const [showUnverified, setShowUnverified] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [expandNeighbors, setExpandNeighbors] = useState(true);
  const [entityType, setEntityType] = useState('all');
  const [relationshipType, setRelationshipType] = useState('all');
  const [minimumConfidence, setMinimumConfidence] = useState(0);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [availableRelationshipTypes, setAvailableRelationshipTypes] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node?: any; edge?: any } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const loadDemoGraph = useCallback(() => {
    setLoading(true);
    setSelectedNode(null);
    setContextMenu(null);
    setAvailableTypes(Array.from(new Set(MOCK_ENTITIES.map((e) => e.type))).sort());
    setAvailableRelationshipTypes(Array.from(new Set(MOCK_RELATIONSHIPS.map((r) => r.type))).sort());
    const nodeMap = new Map(MOCK_ENTITIES.map((entity) => [entity.id, {
      id: entity.id,
      label: entity.label,
      type: entity.type,
      color: COLORS[entity.type] || '#94a3b8',
      size: 20,
      connections: 0,
      x: Math.random() * dimensions.width,
      y: Math.random() * dimensions.height,
      fx: undefined,
      fy: undefined,
    }]));
    const demoNodes = Array.from(nodeMap.values());
    const connectionCounts = new Map<string, number>();
    MOCK_RELATIONSHIPS.forEach((rel) => {
      connectionCounts.set(rel.sourceId, (connectionCounts.get(rel.sourceId) || 0) + 1);
      connectionCounts.set(rel.targetId, (connectionCounts.get(rel.targetId) || 0) + 1);
    });
    const maxConnections = Math.max(...Array.from(connectionCounts.values()), 1);
    demoNodes.forEach((node) => {
      const count = connectionCounts.get(node.id) || 0;
      node.connections = count;
      node.size = 15 + Math.floor((count / maxConnections) * 20);
    });
    const demoEdges = MOCK_RELATIONSHIPS.map((rel) => ({
      id: rel.id,
      source: nodeMap.get(rel.sourceId) || rel.sourceId,
      target: nodeMap.get(rel.targetId) || rel.targetId,
      label: rel.type.replace('_', ' '),
      type: rel.type,
      confidence: rel.confidence,
      verified: rel.verified,
      strength: rel.strength ?? rel.confidence ?? 50,
    }));
    setNodes(demoNodes);
    setEdges(demoEdges);
    setLoading(false);
  }, [dimensions.width, dimensions.height]);

  useEffect(() => {
    const updateDimensions = () => {
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width || 800, height: rect.height || 600 });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    const loadGraph = async () => {
      setLoading(true);
      setSelectedNode(null);
      setContextMenu(null);
      if (!submittedSearch.trim()) {
        setNodes([]);
        setEdges([]);
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

        const maxConnections = Math.max(...entities.map((e: any) => visibleRelationships.filter((r: any) => r.sourceId === e.id || r.targetId === e.id).length), 1);

        const initialNodes = entities.map((entity: any) => {
          const connections = visibleRelationships.filter((rel: any) => rel.sourceId === entity.id || rel.targetId === entity.id).length;
          const baseSize = 15 + Math.floor((connections / maxConnections) * 20);
          return {
            id: entity.id,
            label: entity.label || entity.value,
            type: entity.type,
            color: COLORS[entity.type] || '#94a3b8',
            size: baseSize,
            connections,
            x: Math.random() * dimensions.width,
            y: Math.random() * dimensions.height,
            fx: undefined,
            fy: undefined,
          };
        });

        const nodeMap = new Map(initialNodes.map((n: { id: string }) => [n.id, n]));
        const initialEdges = visibleRelationships.map((rel: any) => ({
          id: rel.id,
          source: nodeMap.get(rel.sourceId) || rel.sourceId,
          target: nodeMap.get(rel.targetId) || rel.targetId,
          label: rel.type.replace('_', ' '),
          type: rel.type,
          confidence: rel.confidence,
          verified: rel.verified,
          strength: rel.strength ?? rel.confidence ?? 50,
        }));

        setNodes(initialNodes);
        setEdges(initialEdges);

        const focusId = searchParams.get('focus');
        if (focusId) {
          const focusedNode = initialNodes.find((n: { id: string }) => n.id === focusId);
          if (focusedNode) {
            setTimeout(() => setSelectedNode(focusedNode), 100);
          }
        }
      } catch (error) {
        console.error('Error loading knowledge graph:', error);
      } finally {
        setLoading(false);
      }
    };

    loadGraph();
  }, [searchParams, submittedSearch, entityType, relationshipType, minimumConfidence, showWeak, showUnverified, expandNeighbors, dimensions.width, dimensions.height]);

  useEffect(() => {
    if (nodes.length === 0 || edges.length === 0) return;

    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    const sim = forceSimulation(nodes as any)
      .force(
        'link',
        forceLink(edges as any).id((d: any) => d.id).distance(180).strength((d: any) => Math.max(0.1, (d.strength ?? 50) / 100))
      )
      .force('charge', forceManyBody().strength(-600))
      .force('center', forceCenter(dimensions.width / 2, dimensions.height / 2))
      .force('collision', forceCollide().radius((d: any) => d.size + 12).strength(0.8))
      .alphaDecay(0.02)
      .velocityDecay(0.4);

    sim.on('tick', () => {
      setNodes([...nodes]);
    });

    simulationRef.current = sim;

    return () => {
      sim.stop();
      simulationRef.current = null;
    };
  }, [nodes.length, edges.length, dimensions.width, dimensions.height]);

  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;

    const svg = select(svgRef.current);
    const g = select(gRef.current);

    if (zoomRef.current) {
      svg.on('zoom.kg', null);
    }

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr('transform', event.transform.toString());
        setTransform(event.transform);
      });

    svg.call(zoomBehavior);
    svg.on('dblclick.zoom', null);

    zoomRef.current = zoomBehavior;

    return () => {
      svg.on('zoom.kg', null);
      zoomRef.current = null;
    };
  }, [dimensions.width, dimensions.height]);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n: { id: string }) => n.id === nodeId);
      if (node) {
        setSelectedNode(node);
        setContextMenu(null);
      }
    },
    [nodes]
  );

  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
    setContextMenu(null);
  }, []);

  const handleContextMenu = useCallback(
    (event: React.MouseEvent, node?: any, edge?: any) => {
      event.preventDefault();
      event.stopPropagation();
      setContextMenu({ x: event.clientX, y: event.clientY, node, edge });
    },
    []
  );

  const handleExpandNode = useCallback(
    (nodeId: string) => {
      setContextMenu(null);
      setSubmittedSearch(nodeId);
      setSearchValue('');
    },
    []
  );

  const handleViewProfile = useCallback(
    (nodeId: string) => {
      setContextMenu(null);
      navigate(`/profile/${encodeURIComponent(nodeId)}`);
    },
    [navigate]
  );

  const handleZoomIn = useCallback(() => {
    if (svgRef.current && zoomRef.current) {
      select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.4);
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (svgRef.current && zoomRef.current) {
      select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 0.7);
    }
  }, []);

  const handleZoomReset = useCallback(() => {
    if (svgRef.current && zoomRef.current) {
      select(svgRef.current).transition().duration(500).call(zoomRef.current.transform, zoomIdentity);
    }
  }, []);

  const handleFullscreen = useCallback(() => {
    const container = document.getElementById('graph-container');
    if (container) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        container.requestFullscreen();
      }
    }
  }, []);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

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
          <p className="mt-4 text-police-300">Loading investigation graph...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between space-x-4">
        <div>
          <h1 className="text-2xl font-bold text-gradient">Investigation Graph</h1>
          <p className="text-police-400">
            {nodes.length > 0
              ? `Visualizing ${nodes.length} entities and ${edges.length} relationships`
              : 'Search to visualize entity relationships'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleBackgroundClick} className="btn-secondary px-4 py-2">Clear Selection</button>
          <button onClick={loadDemoGraph} className="btn-secondary px-4 py-2">Load Demo Graph</button>
          <button onClick={handleFullscreen} className="btn-accent px-4 py-2">Fullscreen</button>
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

      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-police-300">
            Entity type
            <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className="input-field ml-2 py-1.5">
              <option value="all">All types</option>
              {availableTypes.map((type) => <option key={type} value={type}>{type.replace('_', ' ')}</option>)}
            </select>
          </label>
          <label className="text-sm text-police-300">
            Relationship
            <select value={relationshipType} onChange={(e) => setRelationshipType(e.target.value)} className="input-field ml-2 py-1.5">
              <option value="all">All relationships</option>
              {availableRelationshipTypes.map((type) => <option key={type} value={type}>{type.replace('_', ' ')}</option>)}
            </select>
          </label>
          <label className="text-sm text-police-300">
            Min confidence
            <input
              type="number"
              min="0"
              max="100"
              value={minimumConfidence}
              onChange={(e) => setMinimumConfidence(Number(e.target.value))}
              className="input-field ml-2 w-20 py-1.5"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm text-police-400">Investigation view:</span>
          {[
            { label: 'Weak links', checked: showWeak, onChange: setShowWeak },
            { label: 'Unverified links', checked: showUnverified, onChange: setShowUnverified },
            { label: 'Expand neighbors', checked: expandNeighbors, onChange: setExpandNeighbors },
            { label: 'Node labels', checked: showLabels, onChange: setShowLabels },
          ].map((item) => (
            <label key={item.label} className="flex items-center gap-2 text-sm text-police-300">
              <input
                type="checkbox"
                checked={item.checked}
                onChange={(e) => item.onChange(e.target.checked)}
                className="h-4 w-4 rounded border-police-600 text-accent-cyan"
              />
              {item.label}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => { setEntityType('person'); setRelationshipType('all'); setMinimumConfidence(70); setShowWeak(false); setShowUnverified(false); }}
            className="btn-secondary px-3 py-1.5 text-sm"
          >
            High-confidence people
          </button>
          <button
            type="button"
            onClick={() => { setEntityType('all'); setRelationshipType('phone_shared'); setMinimumConfidence(0); setShowWeak(true); setShowUnverified(true); }}
            className="btn-secondary px-3 py-1.5 text-sm"
          >
            Phone network
          </button>
          <button
            type="button"
            onClick={() => { setEntityType('all'); setRelationshipType('all'); setMinimumConfidence(0); setShowWeak(true); setShowUnverified(true); }}
            className="btn-secondary px-3 py-1.5 text-sm"
          >
            Reset view
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between bg-police-900/50 rounded-lg p-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-police-500">Node size reflects connection count</span>
          <span className="text-sm text-police-500">|</span>
          <span className="text-sm text-police-500">Zoom: {(transform.k * 100).toFixed(0)}%</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleZoomIn} className="btn-secondary px-3 py-1.5 text-sm">Zoom In</button>
          <button type="button" onClick={handleZoomOut} className="btn-secondary px-3 py-1.5 text-sm">Zoom Out</button>
          <button type="button" onClick={handleZoomReset} className="btn-secondary px-3 py-1.5 text-sm">Reset</button>
        </div>
      </div>

      <div className="relative">
        <div
          id="graph-container"
          className="w-full h-[600px] bg-police-900 rounded-lg border border-police-700 overflow-hidden"
        >
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            className="cursor-grab active:cursor-grabbing"
            onClick={handleBackgroundClick}
            onContextMenu={(e) => e.preventDefault()}
          >
            <defs>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <marker
                id="arrowhead"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#00d4ff" />
              </marker>
              <marker
                id="arrowhead-unverified"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#ffb800" />
              </marker>
            </defs>
            <g ref={gRef}>
              <g className="edges">
                {edges.map((edge) => {
                  const sourceNode = typeof edge.source === 'object' ? edge.source : nodes.find((n) => n.id === edge.source);
                  const targetNode = typeof edge.target === 'object' ? edge.target : nodes.find((n) => n.id === edge.target);
                  if (!sourceNode?.x || !targetNode?.x) return null;
                  const path = getEdgePath(sourceNode, targetNode, 0.25);
                  if (!path) return null;
                  const mx = (sourceNode.x + targetNode.x) / 2;
                  const my = (sourceNode.y + targetNode.y) / 2;
                  return (
                    <g key={edge.id}>
                      <path
                        d={path}
                        fill="none"
                        stroke={edge.verified ? '#00d4ff' : '#ffb800'}
                        strokeWidth={Math.max(1, (edge.strength ?? 50) / 15)}
                        strokeDasharray={edge.verified ? 'none' : '6 4'}
                        opacity="0.6"
                        markerEnd={edge.verified ? 'url(#arrowhead)' : 'url(#arrowhead-unverified)'}
                        onContextMenu={(e) => handleContextMenu(e, undefined, edge)}
                        className="cursor-pointer hover:opacity-100 transition-opacity"
                      />
                      {edge.label && (
                        <g transform={`translate(${mx}, ${my})`}>
                          <rect
                            x={-edge.label.length * 3.5}
                            y={-8}
                            width={edge.label.length * 7}
                            height={16}
                            rx="4"
                            fill="#0d1e33"
                            stroke={edge.verified ? '#00d4ff' : '#ffb800'}
                            strokeWidth="0.5"
                            opacity="0.9"
                          />
                          <text
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill={edge.verified ? '#00d4ff' : '#ffb800'}
                            fontSize="9"
                            fontFamily="Inter, system-ui, sans-serif"
                            fontWeight="500"
                          >
                            {edge.label}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>
              <g className="nodes">
                {nodes.map((node) => {
                  if (!node.x || !node.y) return null;
                  const isSelected = selectedNode?.id === node.id;
                  const shape = TYPE_SHAPES[node.type] || 'circle';
                  const path = getShapePath(shape, node.size);
                  const labelY = node.size + 14;
                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      onContextMenu={(e) => handleContextMenu(e, node)}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNodeClick(node.id);
                      }}
                      className="cursor-pointer"
                    >
                      <path
                        d={path}
                        fill={node.color}
                        fillOpacity="0.15"
                        stroke={node.color}
                        strokeWidth={isSelected ? 3 : 1.5}
                        filter={isSelected ? 'url(#glow)' : undefined}
                      />
                      {isSelected && (
                        <path
                          d={path}
                          fill="none"
                          stroke={node.color}
                          strokeWidth="1"
                          opacity="0.4"
                          transform={`scale(${1 + 8 / node.size})`}
                        />
                      )}
                      <circle r="3" fill={node.color} opacity="0.8" />
                      {showLabels && (
                        <text
                          y={labelY}
                          textAnchor="middle"
                          fill="#e2e8f0"
                          fontSize="10"
                          fontFamily="Inter, system-ui, sans-serif"
                          fontWeight="500"
                        >
                          {node.label.length > 20 ? node.label.slice(0, 18) + '…' : node.label}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            </g>
          </svg>

          {nodes.length === 0 && !loading && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-police-500">
                {submittedSearch ? `No saved entities match "${submittedSearch}".` : 'Search to visualize entity relationships'}
              </p>
            </div>
          )}

          <div className="absolute bottom-4 right-4 bg-police-950/90 border border-police-700 rounded-lg p-2 backdrop-blur-sm">
            <div className="text-xs text-police-400 mb-1 font-medium">Mini-map</div>
            <svg width="160" height="100" className="bg-police-900/50 rounded">
              <g transform={`translate(${transform.x * 0.08}, ${transform.y * 0.08}) scale(${transform.k * 0.08})`}>
                {nodes.map((node) => {
                  if (!node.x) return null;
                  return (
                    <circle
                      key={`mini-${node.id}`}
                      cx={node.x}
                      cy={node.y}
                      r={Math.max(2, node.size * 0.3)}
                      fill={node.color}
                      opacity="0.6"
                    />
                  );
                })}
              </g>
              <rect
                x={-transform.x / transform.k * 0.08}
                y={-transform.y / transform.k * 0.08}
                width={dimensions.width / transform.k * 0.08}
                height={dimensions.height / transform.k * 0.08}
                fill="none"
                stroke="#00d4ff"
                strokeWidth="1"
                opacity="0.5"
              />
            </svg>
          </div>

          <div className="absolute bottom-4 left-4 bg-police-950/90 border border-police-700 rounded-lg p-3 backdrop-blur-sm">
            <div className="text-xs text-police-400 mb-2 font-medium">Entity Types</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {Object.entries(COLORS).map(([type, color]) => (
                <div key={type} className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="-7 -7 14 14">
                    <path d={getShapePath(TYPE_SHAPES[type] || 'circle', 5)} fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1" />
                  </svg>
                  <span className="text-xs text-police-300 capitalize">{type.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {selectedNode && (
        <div className="card card-hover p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <svg width="24" height="24" viewBox="-7 -7 14 14">
                <path
                  d={getShapePath(TYPE_SHAPES[selectedNode.type] || 'circle', 6)}
                  fill={selectedNode.color}
                  fillOpacity="0.2"
                  stroke={selectedNode.color}
                  strokeWidth="1.5"
                />
              </svg>
              <h3 className="text-lg font-semibold text-white">{selectedNode.label}</h3>
            </div>
            <button
              onClick={() => navigate(`/profile/${encodeURIComponent(selectedNode.id)}`)}
              className="text-sm text-police-400 hover:text-police-300"
            >
              View Profile
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: selectedNode.color }}></div>
              <div>
                <p className="text-police-400 text-xs">Type</p>
                <p className="text-white font-medium capitalize">{selectedNode.type.replace('_', ' ')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-accent-cyan"></div>
              <div>
                <p className="text-police-400 text-xs">Connections</p>
                <p className="text-white font-medium">{selectedNode.connections}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-police-600/50"></div>
              <div>
                <p className="text-police-400 text-xs">Size Score</p>
                <p className="text-white font-medium">{selectedNode.size}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-accent-gold"></div>
              <div>
                <p className="text-police-400 text-xs">Zoom Level</p>
                <p className="text-white font-medium">{(transform.k * 100).toFixed(0)}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {contextMenu && (
        <div
          className="fixed z-50 bg-police-900 border border-police-700 rounded-lg shadow-xl py-1 min-w-[180px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.node && (
            <>
              <button
                className="w-full text-left px-4 py-2 text-sm text-white hover:bg-police-800 transition-colors"
                onClick={() => handleExpandNode(contextMenu.node!.id)}
              >
                Expand Node
              </button>
              <button
                className="w-full text-left px-4 py-2 text-sm text-white hover:bg-police-800 transition-colors"
                onClick={() => handleViewProfile(contextMenu.node!.id)}
              >
                View Profile
              </button>
              <button
                className="w-full text-left px-4 py-2 text-sm text-white hover:bg-police-800 transition-colors"
                onClick={() => {
                  setContextMenu(null);
                  setSelectedNode(contextMenu.node);
                }}
              >
                Focus Node
              </button>
            </>
          )}
          {contextMenu.edge && (
            <>
              <div className="px-4 py-2 text-sm text-police-300 border-b border-police-700">
                Relationship: {contextMenu.edge.label}
              </div>
              <div className="px-4 py-2 text-sm text-police-300">
                Confidence: {contextMenu.edge.confidence ?? 'N/A'}%
              </div>
              <div className="px-4 py-2 text-sm text-police-300">
                Verified: {contextMenu.edge.verified ? 'Yes' : 'No'}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default KnowledgeGraphPage;
