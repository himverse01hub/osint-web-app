import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export const SuspectProfilePage = () => {
  const { entityId } = useParams<{ entityId: string }>();
  const navigate = useNavigate();
  const [entity, setEntity] = useState<any>(null);
  const [relationships, setRelationships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'activity'>('overview');

  useEffect(() => {
    if (!entityId) {
      navigate('/search');
      return;
    }

    const loadProfile = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/entities?id=${encodeURIComponent(entityId)}`);
        if (!response.ok) throw new Error('Entity profile request failed');
        const data = await response.json();
        setEntity(data.entity);
        setRelationships(data.relationships ?? []);
      } catch (error) {
        console.error('Error loading profile:', error);
        navigate('/search');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [entityId, navigate]);

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
          <p className="mt-4 text-police-300">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!entity) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-police-950">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gradient">Profile Not Found</h2>
          <p className="text-police-400 mt-4">The requested entity could not be found.</p>
          <button onClick={() => navigate('/search')} className="btn-primary mt-6">
            Return to Search
          </button>
        </div>
      </div>
    );
  }

  const getEntityTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      person: 'Person', phone: 'Phone Number', email: 'Email Address',
      username: 'Username/Handle', organization: 'Organization', location: 'Location',
      crypto_wallet: 'Cryptocurrency Wallet', social_account: 'Social Media Account',
      vehicle: 'Vehicle', document: 'Document',
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between space-x-4">
        <div>
          <h1 className="text-2xl font-bold text-gradient">
            {getEntityTypeLabel(entity.type)} Profile
          </h1>
          <p className="text-police-400">
            Entity ID: {entity.id} • {entity.confidence}% Confidence • Source: {entity.sourceName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/graph?focus=${entityId}`)} className="btn-secondary px-4 py-2">
            View in Graph
          </button>
          <button onClick={() => navigate(`/reports`)} className="btn-accent px-4 py-2">
            Generate Report
          </button>
        </div>
      </div>

      <div className="flex border-b border-police-700 mb-6">
        {(['overview', 'details', 'activity'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-center font-medium capitalize ${
              activeTab === tab
                ? 'bg-police-800 text-white border-b-2 border-accent-cyan'
                : 'text-police-400 hover:bg-police-800/50 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && <OverviewTab entity={entity} relationships={relationships} />}
      {activeTab === 'details' && <DetailsTab entity={entity} />}
      {activeTab === 'activity' && <ActivityTab entity={entity} relationships={relationships} />}
    </div>
  );
};

const OverviewTab = ({ entity, relationships }: { entity: any; relationships: any[] }) => {
  const relatedCount = new Set(
    relationships.flatMap((rel: any) => [rel.sourceId, rel.targetId].filter(id => id !== entity.id))
  ).size;
  const dataPoints = Object.values(entity).filter(v => v !== null && v !== undefined && v !== '').length;

  return (
    <div className="space-y-6">
      <div className="card card-hover p-6">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0">
            <div className="h-12 w-12 flex items-center justify-center bg-police-900/50 rounded-lg">
              <svg className="h-8 w-8 text-accent-cyan" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
            <h2 className="text-2xl font-bold text-white">{entity.label || entity.value}</h2>
            <div className="flex flex-wrap items-center gap-4 mt-2">
              <div className="flex items-center gap-2">
                <span className="text-police-300 text-sm">Confidence: {entity.confidence}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-police-300 text-sm">Source: {entity.sourceName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-police-300 text-sm">Discovered: {new Date(entity.discoveredAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {entity.type === 'person' && entity.riskScore !== undefined && (
        <div className="card card-hover p-4">
          <h3 className="text-lg font-semibold text-white mb-3">Risk Assessment</h3>
          <div className="flex items-center">
            <div className="w-3/4">
              <div className="bg-police-800/50 h-2.5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-500 to-yellow-500 transition-all duration-1000"
                  style={{ width: `${entity.riskScore}%` }}
                ></div>
              </div>
            </div>
            <div className="ml-4 text-right">
              <p className="text-2xl font-bold text-white">{entity.riskScore}/100</p>
              <p className="text-police-400 text-sm">
                {entity.riskScore >= 70 ? 'High Risk' : entity.riskScore >= 50 ? 'Medium Risk' : 'Low Risk'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card card-hover p-4">
          <h3 className="text-lg font-semibold text-white mb-3">Connections</h3>
          <p className="text-2xl font-bold text-accent-cyan">{relationships.length}</p>
          <p className="text-police-400 text-sm">Relationships Found</p>
        </div>
        <div className="card card-hover p-4">
          <h3 className="text-lg font-semibold text-white mb-3">Related Entities</h3>
          <p className="text-2xl font-bold text-accent-cyan">{relatedCount}</p>
          <p className="text-police-400 text-sm">Connected Entities</p>
        </div>
        <div className="card card-hover p-4">
          <h3 className="text-lg font-semibold text-white mb-3">Data Points</h3>
          <p className="text-2xl font-bold text-accent-cyan">{dataPoints}</p>
          <p className="text-police-400 text-sm">Information Points</p>
        </div>
      </div>
    </div>
  );
};

const DetailsTab = ({ entity }: { entity: any }) => {
  return (
    <div className="space-y-6">
      <div className="card card-hover p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Basic Information</h3>
        </div>
        <div className="space-y-4">
          {entity.type === 'person' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-police-400 text-sm">Full Name</p>
                <p className="text-white font-medium">{entity.value}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Aliases</p>
                <div className="flex flex-wrap gap-2">
                  {entity.aliases && entity.aliases.map((alias: string) => (
                    <span key={alias} className="bg-police-800/50 px-3 py-1 rounded text-sm">{alias}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-police-400 text-sm">Date of Birth</p>
                <p className="text-white font-medium">{entity.metadata?.dateOfBirth || 'Not available'}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Gender</p>
                <p className="text-white font-medium">{entity.metadata?.gender || 'Not available'}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Nationality</p>
                <p className="text-white font-medium">{entity.metadata?.nationality || 'Not available'}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Status</p>
                <span className={`px-3 py-1 rounded-full text-xs ${
                  entity.status === 'active' ? 'bg-red-500/20 text-red-300' :
                  entity.status === 'monitoring' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-green-500/20 text-green-300'
                }`}>
                  {entity.status?.charAt(0).toUpperCase() + entity.status?.slice(1)}
                </span>
              </div>
            </div>
          )}

          {entity.type === 'phone' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-police-400 text-sm">Phone Number</p>
                <p className="text-white font-medium">{entity.value}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Carrier</p>
                <p className="text-white font-medium">{entity.carrier || 'Not available'}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Location</p>
                <p className="text-white font-medium">{entity.location || 'Not available'}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Registered Name</p>
                <p className="text-white font-medium">{entity.registeredName || 'Not available'}</p>
              </div>
            </div>
          )}

          {entity.type === 'email' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-police-400 text-sm">Email Address</p>
                <p className="text-white font-medium">{entity.value}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Domain</p>
                <p className="text-white font-medium">{entity.domain}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Provider</p>
                <p className="text-white font-medium">{entity.provider || 'Not available'}</p>
              </div>
              {entity.breaches && entity.breaches.length > 0 && (
                <>
                  <div>
                    <p className="text-police-400 text-sm">Known Breaches</p>
                    <p className="text-white font-medium">{entity.breaches.length}</p>
                  </div>
                  <div>
                    <p className="text-police-400 text-sm">Last Breach</p>
                    <p className="text-white font-medium">{entity.breaches[0]?.date || 'Not available'}</p>
                  </div>
                </>
              )}
            </div>
          )}

          {entity.type === 'username' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-police-400 text-sm">Username</p>
                <p className="text-white font-medium">@{entity.value}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Platform</p>
                <p className="text-white font-medium">{entity.platform?.charAt(0).toUpperCase() + entity.platform?.slice(1)}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Display Name</p>
                <p className="text-white font-medium">{entity.displayName || 'Not available'}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Followers</p>
                <p className="text-white font-medium">{entity.followers?.toLocaleString() || '0'}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Following</p>
                <p className="text-white font-medium">{entity.following?.toLocaleString() || '0'}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Verified</p>
                <span className={`px-3 py-1 rounded-full text-xs ${
                  entity.verified ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                }`}>
                  {entity.verified ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          )}

          {entity.type === 'organization' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-police-400 text-sm">Organization Name</p>
                <p className="text-white font-medium">{entity.value}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Industry</p>
                <p className="text-white font-medium">{entity.industry || 'Not available'}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Registration Number</p>
                <p className="text-white font-medium">{entity.registrationNumber || 'Not available'}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Address</p>
                <p className="text-white font-medium">{entity.address || 'Not available'}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-police-400 text-sm">Key People</p>
                <div className="flex flex-wrap gap-2">
                  {entity.keyPeople?.map((person: string) => (
                    <span key={person} className="bg-police-800/50 px-3 py-1 rounded text-sm">{person}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {entity.type === 'crypto_wallet' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <p className="text-police-400 text-sm">Wallet Address</p>
                <p className="text-white font-medium break-all">{entity.value}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Currency</p>
                <p className="text-white font-medium">{entity.currency}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Balance</p>
                <p className="text-white font-medium">{entity.balance || 'Not available'}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Transactions</p>
                <p className="text-white font-medium">{entity.transactions?.toLocaleString() || '0'}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">First Seen</p>
                <p className="text-white font-medium">{entity.firstSeen || 'Not available'}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Last Activity</p>
                <p className="text-white font-medium">{entity.lastActivity || 'Not available'}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Exchanges</p>
                <div className="flex flex-wrap gap-2">
                  {entity.exchanges?.map((exchange: string) => (
                    <span key={exchange} className="bg-police-800/50 px-3 py-1 rounded text-sm">{exchange}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {entity.type === 'location' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-police-400 text-sm">Location Name</p>
                <p className="text-white font-medium">{entity.value}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Address</p>
                <p className="text-white font-medium">{entity.address || 'Not available'}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">City</p>
                <p className="text-white font-medium">{entity.city || 'Not available'}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">State</p>
                <p className="text-white font-medium">{entity.state || 'Not available'}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Country</p>
                <p className="text-white font-medium">{entity.country || 'Not available'}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Visit Count</p>
                <p className="text-white font-medium">{entity.visitCount?.toLocaleString() || '0'}</p>
              </div>
            </div>
          )}

          {entity.type === 'social_account' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-police-400 text-sm">Handle</p>
                <p className="text-white font-medium">@{entity.handle}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Platform</p>
                <p className="text-white font-medium">{entity.platform?.charAt(0).toUpperCase() + entity.platform?.slice(1)}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Display Name</p>
                <p className="text-white font-medium">{entity.displayName || 'Not available'}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Bio</p>
                <p className="text-white font-medium">{entity.bio || 'Not available'}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Followers</p>
                <p className="text-white font-medium">{entity.followers?.toLocaleString() || '0'}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Following</p>
                <p className="text-white font-medium">{entity.following?.toLocaleString() || '0'}</p>
              </div>
            </div>
          )}

          {entity.type === 'vehicle' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-police-400 text-sm">Registration Number</p>
                <p className="text-white font-medium">{entity.value}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Make/Model</p>
                <p className="text-white font-medium">{entity.make || 'N/A'} {entity.model || ''}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Year</p>
                <p className="text-white font-medium">{entity.year || 'Not available'}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Color</p>
                <p className="text-white font-medium">{entity.color || 'Not available'}</p>
              </div>
            </div>
          )}

          {entity.type === 'document' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-police-400 text-sm">Document Type</p>
                <p className="text-white font-medium">{entity.documentType}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Document Number</p>
                <p className="text-white font-medium">{entity.documentNumber}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Issuing Authority</p>
                <p className="text-white font-medium">{entity.issuingAuthority || 'Not available'}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Expiry Date</p>
                <p className="text-white font-medium">{entity.expiryDate || 'Not available'}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {entity.type === 'person' && (
        <div className="card card-hover p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Associated Entities</h3>
          <div className="space-y-4">
            {entity.phones && entity.phones.length > 0 && (
              <EntityGroup title="Phone Numbers" items={entity.phones.map((p: string) => ({ id: p, label: p }))} />
            )}
            {entity.emails && entity.emails.length > 0 && (
              <EntityGroup title="Email Addresses" items={entity.emails.map((e: string) => ({ id: e, label: e }))} />
            )}
            {entity.usernames && entity.usernames.length > 0 && (
              <EntityGroup title="Usernames" items={entity.usernames.map((u: string) => ({ id: u, label: '@' + u }))} />
            )}
            {entity.organizations && entity.organizations.length > 0 && (
              <EntityGroup title="Organizations" items={entity.organizations.map((o: any) => ({ id: o.id, label: o.value }))} />
            )}
            {entity.locations && entity.locations.length > 0 && (
              <EntityGroup title="Locations" items={entity.locations.map((l: any) => ({ id: l.id, label: l.value }))} />
            )}
            {entity.cryptoWallets && entity.cryptoWallets.length > 0 && (
              <EntityGroup title="Cryptocurrency Wallets" items={entity.cryptoWallets.map((w: any) => ({ id: w.id, label: w.value.slice(0, 20) + '...' }))} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const EntityGroup = ({ title, items }: { title: string; items: Array<{ id: string; label: string }> }) => (
  <div>
    <h4 className="text-police-300 font-medium mb-2">{title} ({items.length})</h4>
    <div className="space-y-2">
      {items.map(item => (
        <div key={item.id} className="flex items-center justify-between p-2 bg-police-800/50 rounded">
          <span className="text-police-300">{item.label}</span>
          <span className="text-sm text-accent-cyan">View</span>
        </div>
      ))}
    </div>
  </div>
);

const ActivityTab = ({ entity, relationships }: { entity: any; relationships: any[] }) => {
  return (
    <div className="space-y-6">
      <div className="card card-hover p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Relationship Network</h3>
        <div className="h-64 bg-police-800/50 rounded-lg flex items-center justify-center">
          <p className="text-police-500 text-center">
            Relationship graph visualization would appear here.<br />
            <span className="text-sm">Showing {relationships.length} relationships for this entity.</span>
          </p>
        </div>
        <div className="mt-4 space-y-3">
          {relationships.length === 0 ? (
            <div className="text-center text-police-500 py-4">No relationships found for this entity.</div>
          ) : (
            relationships.map((rel: any) => (
              <div key={rel.id} className="flex items-start gap-3 p-3 bg-police-800/50 rounded-lg">
                <div className="flex-shrink-0">
                  <div className="h-3 w-3 rounded-full bg-accent-cyan"></div>
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-white">{rel.description}</h4>
                  <p className="text-police-400 text-sm">
                    Strength: {rel.strength}% • Confidence: {rel.confidence}% • {new Date(rel.discoveredAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card card-hover p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Activity Timeline</h3>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-3 w-3 rounded-full bg-accent-cyan mt-1"></div>
            <div className="flex-1">
              <h4 className="font-medium text-white">Entity Discovered</h4>
              <p className="text-police-400 text-sm">
                {entity.sourceName} identified this entity on {new Date(entity.discoveredAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-3 w-3 rounded-full bg-green-500 mt-1"></div>
            <div className="flex-1">
              <h4 className="font-medium text-white">Relationship Established</h4>
              <p className="text-police-400 text-sm">Connection identified with related entities</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-3 w-3 rounded-full bg-yellow-500 mt-1"></div>
            <div className="flex-1">
              <h4 className="font-medium text-white">Risk Assessment Updated</h4>
              <p className="text-police-400 text-sm">Risk score reviewed and updated</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuspectProfilePage;
