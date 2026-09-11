import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export const IntelligenceReportPage = () => {
  const { authState } = useAuth();
  const { user } = authState;
  const [searchParams] = useSearchParams();
  const [cases, setCases] = useState<Array<any>>([]);
  const [entities, setEntities] = useState<Array<any>>([]);
  const [relationships, setRelationships] = useState<Array<any>>([]);
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [reportContent, setReportContent] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [reportSearch, setReportSearch] = useState('');
  const [reportType, setReportType] = useState<'all' | 'cases' | 'entities' | 'relationships'>('all');

  useEffect(() => {
    const loadCases = async () => {
      try {
        const response = await fetch('/api/cases');
        if (!response.ok) throw new Error('Cases request failed');

        const [data, entityResponse, relationshipResponse] = await Promise.all([
          response.json(),
          fetch('/api/entities'),
          fetch('/api/relationships'),
        ]);
        if (!entityResponse.ok || !relationshipResponse.ok) throw new Error('Report inventory request failed');
        const [entityData, relationshipData] = await Promise.all([entityResponse.json(), relationshipResponse.json()]);
        const liveCases = data.cases ?? [];
        setCases(liveCases);
        setEntities(entityData.entities ?? []);
        setRelationships(relationshipData.relationships ?? []);
        setLoadError('');

        const caseId = searchParams.get('case');
        if (caseId) {
          const foundCase = liveCases.find((c: any) => c.id === caseId);
          if (foundCase) {
            setSelectedCase(foundCase);
            generateReport(foundCase.id);
          }
        }
      } catch (error) {
        console.error('Error loading cases:', error);
        setLoadError(error instanceof Error ? error.message : 'Could not load cases');
      }
    };

    void loadCases();
  }, [searchParams]);

  const reportEntries = [
    ...cases.map((caseItem: any) => ({
      id: caseItem.id,
      type: 'cases',
      title: caseItem.title,
      detail: `Case #${caseItem.caseNumber} • ${caseItem.priority} priority`,
      status: ['closed', 'archived'].includes(caseItem.status) ? 'closed' : 'pending',
      date: caseItem.updatedAt,
    })),
    ...entities.map((entity: any) => ({
      id: entity.id,
      type: 'entities',
      title: entity.label || entity.value,
      detail: `${entity.type.replace('_', ' ')} • ${entity.sourceName || 'Unknown source'}`,
      status: 'pending',
      date: entity.discoveredAt,
    })),
    ...relationships.map((relationship: any) => ({
      id: relationship.id,
      type: 'relationships',
      title: `${relationship.sourceLabel || relationship.sourceId} → ${relationship.targetLabel || relationship.targetId}`,
      detail: relationship.type.replace(/_/g, ' '),
      status: 'pending',
      date: relationship.discoveredAt,
    })),
  ];
  const filteredReportEntries = reportEntries.filter((entry) => {
    const matchesType = reportType === 'all' || entry.type === reportType;
    const search = reportSearch.trim().toLowerCase();
    const matchesSearch = !search || `${entry.title} ${entry.detail} ${entry.status}`.toLowerCase().includes(search);
    return matchesType && matchesSearch;
  });
  const reportCounts = {
    pending: filteredReportEntries.filter(entry => entry.status === 'pending').length,
    closed: filteredReportEntries.filter(entry => entry.status === 'closed').length,
    total: filteredReportEntries.length,
  };

  const generateReport = useCallback(async (caseId: string) => {
    setGenerating(true);
    try {
      const caseObj = cases.find((c: any) => c.id === caseId) ??
        cases.find((c: any) => c.caseNumber === caseId);

      if (!caseObj) throw new Error('Case not found');

      const [caseResponse, graphResponse] = await Promise.all([
        fetch(`/api/cases?id=${encodeURIComponent(caseObj.id)}`),
        fetch('/api/entities'),
      ]);
      if (!caseResponse.ok || !graphResponse.ok) throw new Error('Database request failed');

      const [caseData, graphData] = await Promise.all([caseResponse.json(), graphResponse.json()]);
      const liveCase = caseData.case ?? caseObj;
      const allEntities = graphData.entities ?? [];
      const allRelationships = graphData.relationships ?? [];

      const caseEntityIds: string[] = Array.isArray(liveCase.entities) ? liveCase.entities : [];
      const caseEntities = allEntities.filter((entity: any) => caseEntityIds.includes(entity.id));
      const caseRelationships = allRelationships.filter((rel: any) =>
        caseEntityIds.includes(rel.sourceId) || caseEntityIds.includes(rel.targetId)
      );

      setSelectedCase(liveCase);

      const report = {
        id: `rep_${Date.now()}`,
        caseId: liveCase.id,
        title: `Intelligence Report: ${liveCase.title}`,
        type: 'intelligence',
        status: 'final',
        generatedBy: user?.name ?? 'Investigator',
        generatedAt: new Date().toISOString(),
        content: {
          subjectOverview: generateSubjectOverview(liveCase, caseEntities),
          keyFindings: generateKeyFindings(caseEntities, caseRelationships),
          associatedIdentities: caseEntities.filter((e: any) => e.type === 'person'),
          onlinePresence: caseEntities.filter((e: any) =>
            ['username', 'social_account', 'email'].includes(e.type)
          ),
          relationships: caseRelationships,
          investigativeLeads: generateInvestigativeLeads(caseEntities, caseRelationships),
          sources: generateSources(caseEntities, caseRelationships),
        },
        exports: [
          { id: `exp_${Date.now()}_1`, format: 'pdf', url: `#report-${Date.now()}`, generatedAt: new Date().toISOString() },
          { id: `exp_${Date.now()}_2`, format: 'html', url: `#report-${Date.now()}-html`, generatedAt: new Date().toISOString() },
          { id: `exp_${Date.now()}_3`, format: 'json', url: `#report-${Date.now()}-json`, generatedAt: new Date().toISOString() },
        ],
      };

      setReportContent(report);
      setGenerated(true);
    } catch (error) {
      console.error('Error generating report:', error);
      setLoadError(error instanceof Error ? error.message : 'Could not generate report');
    } finally {
      setGenerating(false);
    }
  }, [cases, user?.name]);

  const generateSubjectOverview = (caseObj: any, entities: any[]) => {
    const persons = entities.filter((e: any) => e.type === 'person');
    const tags = Array.isArray(caseObj.tags) ? caseObj.tags : [];
    const entityIds = Array.isArray(caseObj.entities) ? caseObj.entities : [];
    return `
      This intelligence report concerns ${caseObj.title.toLowerCase()}.
      The investigation focuses on ${persons.length} primary subject(s) involved in
      ${tags.length > 0 ? tags.join(', ') : 'the case'} activities.

      Case Number: ${caseObj.caseNumber}
      Status: ${caseObj.status}
      Priority: ${caseObj.priority}
      Assigned Investigator: ${caseObj.assignedTo || 'Unassigned'}

      The subjects are associated with ${entityIds.length} entities including
      financial instruments, communication channels, and organizational affiliations.
    `;
  };

  const generateKeyFindings = (entities: any[], relationships: any[]) => {
    const persons = entities.filter((e: any) => e.type === 'person');
    const phones = entities.filter((e: any) => e.type === 'phone');
    const emails = entities.filter((e: any) => e.type === 'email');
    const usernames = entities.filter((e: any) => e.type === 'username');
    const orgs = entities.filter((e: any) => e.type === 'organization');
    const crypto = entities.filter((e: any) => e.type === 'crypto_wallet');
    const social = entities.filter((e: any) => e.type === 'social_account');
    const breachedEmails = emails.filter((e: any) => Array.isArray(e.breaches) && e.breaches.length > 0);

    return [
      `Identified ${persons.length} person(s) of interest in the database`,
      `Discovered ${phones.length} phone numbers linked to the case`,
      `Found ${emails.length} email addresses${breachedEmails.length > 0 ? `, including ${breachedEmails.length} from known data breaches` : ''}`,
      `Identified ${usernames.length} usernames and ${social.length} social media account(s)`,
      `Documented ${orgs.length} organizational affiliations`,
      `Traced ${crypto.length} cryptocurrency wallet(s) in the case records`,
      `Mapped ${relationships.length} relationship(s) between the case entities`,
      entities.length === 0
        ? 'Add entities via Settings > Data Management and link them to this case to enrich the report.'
        : `Total of ${entities.length} associated entity record(s) analysed`,
    ];
  };

  const generateInvestigativeLeads = (entities: any[], relationships: any[]) => {
    const orgs = entities.filter((e: any) => e.type === 'organization');
    const social = entities.filter((e: any) => e.type === 'social_account');
    return [
      {
        id: 'lead_crypto',
        title: 'Cryptocurrency Transaction Analysis',
        description: relationships.some((rel: any) => rel.type === 'crypto_shared')
          ? 'Follow up on recorded crypto wallet relationships to identify fund sources and destinations.'
          : 'No crypto connections recorded yet; request wallet monitoring from the intelligence desk.',
        priority: 'high',
        entityIds: entities.filter((e: any) => e.type === 'crypto_wallet').map((e: any) => e.id),
        recommendedActions: [
          'Request transaction history via lawful channels',
          'Identify counterparties in recorded wallet transfers',
          'Trace fiat on/off ramps used for wallet funding',
        ],
      },
      {
        id: 'lead_social',
        title: 'Social Media Network Mapping',
        description: social.length > 0
          ? 'Expand monitoring of recorded social media accounts to identify additional associates and communication patterns.'
          : 'No social media accounts recorded for this case yet; consider lawful social media OSINT.',
        priority: 'medium',
        entityIds: social.map((e: any) => e.id),
        recommendedActions: [
          'Monitor posts for operational security violations',
          'Identify frequent interactors and network clusters',
          'Document geotags and location check-ins',
        ],
      },
      {
        id: 'lead_org',
        title: 'Organizational Records Review',
        description: orgs.length > 0
          ? 'Examine business registration and financial records of associated organizations.'
          : 'No organizations linked to this case; review public corporate registries if applicable.',
        priority: 'medium',
        entityIds: orgs.map((e: any) => e.id),
        recommendedActions: [
          'Review statutory corporate filings',
          'Examine bank account registrations',
          'Investigate supplier and client relationships',
        ],
      },
    ];
  };

  const generateSources = (entities: any[], relationships: any[]) => {
    const sourceCounts: Record<string, number> = {};

    entities.forEach((entity: any) => {
      const source = entity.sourceName || 'Investigator entry';
      sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    });

    relationships.forEach((rel: any) => {
      (Array.isArray(rel.sources) ? rel.sources : []).forEach((source: string) => {
        const sourceName = source === 'social_media' ? 'Social Media Monitoring' :
          source === 'public_records' ? 'Government Databases' :
          source === 'corporate' ? 'Corporate Registries' :
          source === 'blockchain' ? 'Blockchain Explorers' :
          source === 'intelligence' ? 'Intelligence Sources' : source;
        sourceCounts[sourceName] = (sourceCounts[sourceName] || 0) + 1;
      });
    });

    return Object.entries(sourceCounts).map(([name, count]) => ({
      id: `src_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      type: 'mixed',
      count,
      reliability: count > 3 ? 'high' : count > 1 ? 'medium' : 'low',
    }));
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between space-x-4">
        <div>
          <h1 className="text-2xl font-bold text-gradient">Intelligence Reports</h1>
          <p className="text-police-400">Generate and manage investigative reports from live case data</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedCase && !generating && (
            <button
              onClick={() => generateReport(selectedCase.id)}
              className="btn-primary px-4 py-2"
            >
              Generate Report
            </button>
          )}
        </div>
      </div>

      {loadError && (
        <div className="rounded border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-300">{loadError}</div>
      )}

      <div className="card space-y-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={reportSearch}
            onChange={event => setReportSearch(event.target.value)}
            className="input-field flex-1"
            placeholder="Search cases, entities or relationship activities"
            aria-label="Search reports"
          />
          <select value={reportType} onChange={event => setReportType(event.target.value as typeof reportType)} className="input-field sm:w-56">
            <option value="all">All report entries</option>
            <option value="cases">Cases</option>
            <option value="entities">Entities</option>
            <option value="relationships">Relationship activities</option>
          </select>
          <button type="button" onClick={() => { setReportSearch(''); setReportType('all'); }} className="btn-secondary px-4 py-2">Clear</button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(['pending', 'closed', 'total'] as const).map(status => (
            <div key={status} className="rounded-lg border border-police-700 bg-police-900/50 p-3">
              <p className="text-sm capitalize text-police-400">{status}</p>
              <p className="mt-1 text-2xl font-bold text-white">{reportCounts[status]}</p>
            </div>
          ))}
        </div>
        <div className="max-h-56 space-y-2 overflow-y-auto">
          {filteredReportEntries.length ? filteredReportEntries.map(entry => (
            <div key={`${entry.type}-${entry.id}`} className="flex items-center justify-between gap-3 border-b border-police-800 py-2 text-sm">
              <div className="min-w-0"><p className="truncate font-medium text-white">{entry.title}</p><p className="truncate text-xs text-police-500">{entry.type === 'relationships' ? 'Relationship activity' : entry.type.slice(0, -1)} • {entry.detail}</p></div>
              <span className={`badge capitalize ${entry.status === 'closed' ? 'badge-primary' : 'badge-warning'}`}>{entry.status}</span>
            </div>
          )) : <p className="py-4 text-center text-sm text-police-500">No report entries match your search.</p>}
        </div>
      </div>

      {/* Case Selection removed */}

      {/* Report Generation */}
      {selectedCase && !generating && !generated && (
        <div className="card card-hover p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Generate Report for: {selectedCase.title}</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-police-400 text-sm">Case Number</p>
                <p className="text-white font-medium">{selectedCase.caseNumber}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Status</p>
                <span className={`px-3 py-1 rounded-full text-xs
                  ${selectedCase.status === 'active' ? 'bg-red-500/20 text-red-300' :
                  selectedCase.status === 'open' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-green-500/20 text-green-300'}
                `}>
                  {selectedCase.status}
                </span>
              </div>
              <div>
                <p className="text-police-400 text-sm">Priority</p>
                <span className={`px-3 py-1 rounded-full text-xs
                  ${selectedCase.priority === 'critical' ? 'bg-red-500/20 text-red-300' :
                  selectedCase.priority === 'high' ? 'bg-orange-500/20 text-orange-300' :
                  selectedCase.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-blue-500/20 text-blue-300'}
                `}>
                  {selectedCase.priority}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-4">
              <div>
                <p className="text-police-400 text-sm">Assigned To</p>
                <p className="text-white font-medium">{selectedCase.assignedTo || 'Unassigned'}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Created</p>
                <p className="text-white font-medium">{new Date(selectedCase.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {(selectedCase.tags ?? []).length > 0 ? selectedCase.tags.map((tag: string) => (
                    <span key={tag} className="bg-police-800/50 px-2 py-0.5 rounded text-xs">{tag}</span>
                  )) : <span className="text-police-500 text-sm">No tags</span>}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-police-400 text-sm">
                This report will include subject overview, key findings, associated identities,
                online presence, relationship analysis, investigative leads, and source documentation.
              </p>
              <button
                onClick={() => generateReport(selectedCase.id)}
                className="btn-primary w-full mt-4"
              >
                Generate Intelligence Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generating State */}
      {generating && (
        <div className="card card-hover p-6 text-center">
          <div className="inline-block animate-pulse">
            <svg className="h-8 w-8 text-accent-cyan mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 6v6l4 2"></path>
            </svg>
          </div>
          <p className="text-police-400">Compiling report from database...</p>
          <p className="text-police-500 text-sm mt-2">
            Pulling the latest case entities, relationships, and sources from the database.
          </p>
        </div>
      )}

      {/* Generated Report */}
      {generated && reportContent && (
        <>
          <div className="card card-hover p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Generated Report</h3>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-police-400 text-sm">Report ID</p>
                  <p className="text-white font-medium">{reportContent.id}</p>
                </div>
                <div>
                  <p className="text-police-400 text-sm">Case</p>
                  <p className="text-white font-medium">{reportContent.title}</p>
                </div>
                <div>
                  <p className="text-police-400 text-sm">Generated By</p>
                  <p className="text-white font-medium">{reportContent.generatedBy}</p>
                </div>
                <div>
                  <p className="text-police-400 text-sm">Generated At</p>
                  <p className="text-white font-medium">{new Date(reportContent.generatedAt).toLocaleString()}</p>
                </div>
              </div>

              {/* Report Content Preview */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-white mb-3">Subject Overview</h4>
                <p className="text-police-400 text-sm leading-relaxed">{reportContent.content.subjectOverview}</p>
              </div>

              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-white mb-3">Key Findings</h4>
                <ol className="list-decimal list-inside space-y-2 text-police-400 text-sm">
                  {reportContent.content.keyFindings.map((finding: string, index: number) => (
                    <li key={index}>{finding}</li>
                  ))}
                </ol>
              </div>

              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-white mb-3">Associated Identities ({reportContent.content.associatedIdentities.length})</h4>
                <div className="space-y-2">
                  {reportContent.content.associatedIdentities.map((entity: any, index: number) => (
                    <div key={entity.id ?? index} className="flex items-start gap-3 p-3 bg-police-800/50 rounded-lg">
                      <div className="flex-shrink-0">
                        <div className="h-3 w-3 rounded-full bg-accent-cyan"></div>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-white">{entity.label || entity.value}</p>
                        <p className="text-police-400 text-sm">{entity.type === 'person' && ((
                          <span className="bg-police-900/50 px-1 py-0 rounded text-xs">
                            {(entity.aliases ?? []).length > 0 ? `AKA: ${entity.aliases[0]}` : ''}
                          </span>
                        ))} {entity.confidence}% Confidence</p>
                      </div>
                    </div>
                  ))}
                  {reportContent.content.associatedIdentities.length === 0 && (
                    <p className="text-police-500 text-sm">No person entities linked to this case yet.</p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-white mb-3">Investigative Leads</h4>
                <div className="space-y-2">
                  {reportContent.content.investigativeLeads.map((lead: any, index: number) => (
                    <div key={lead.id ?? index} className="border-l-2 border-police-600 pl-4 py-3">
                      <h4 className="font-medium text-white">{lead.title}</h4>
                      <p className="text-police-400 text-sm">{lead.description}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs
                          ${lead.priority === 'critical' ? 'bg-red-500/20 text-red-300' :
                          lead.priority === 'high' ? 'bg-orange-500/20 text-orange-300' :
                          lead.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-green-500/20 text-green-300'}
                        `}>
                          {lead.priority}
                        </span>
                        <span className="text-police-400 text-sm">Priority</span>
                      </div>
                      <div className="mt-2 text-police-400 text-sm">
                        <strong>Recommended Actions:</strong>
                        <ul className="list-disc list-inside mt-1 space-y-1">
                          {lead.recommendedActions.map((action: string, actionIndex: number) => (
                            <li key={actionIndex}>{action}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Export Buttons */}
          <div className="flex items-center justify-center gap-4">
            {reportContent.exports.map((exportItem: any, index: number) => (
              <button
                key={exportItem.id ?? index}
                onClick={() => {
                  if (exportItem.format === 'pdf') {
                    exportToPDF();
                  } else if (exportItem.format === 'html') {
                    exportToHTML();
                  } else {
                    exportToJSON();
                  }
                }}
                className={`btn-${exportItem.format === 'pdf' ? 'accent' : exportItem.format === 'html' ? 'secondary' : 'outline'} px-6 py-2`}
              >
                Export {exportItem.format.toUpperCase()}
              </button>
            ))}
            <button
              onClick={() => {
                window.print();
              }}
              className="btn-secondary px-6 py-2"
            >
              Print Report
            </button>
          </div>
        </>
      )}
    </div>
  );

  const exportToPDF = () => {
    if (!reportContent) return;
    const element = document.createElement('div');
    element.innerHTML = `
      <h1>${reportContent.title}</h1>
      <p><strong>Report ID:</strong> ${reportContent.id}</p>
      <p><strong>Case:</strong> ${reportContent.content.subjectOverview}</p>
      <p><strong>Generated By:</strong> ${reportContent.generatedBy}</p>
      <p><strong>Generated At:</strong> ${new Date(reportContent.generatedAt).toLocaleString()}</p>
      <h2>Key Findings</h2>
      <ul>
        ${reportContent.content.keyFindings.map((finding: string) => `<li>${finding}</li>`).join('')}
      </ul>
    `;

    document.body.appendChild(element);

    html2canvas(element).then((canvas) => {
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF();
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Haryana_Police_Report_${reportContent.id}.pdf`);
      document.body.removeChild(element);
    }).catch(() => {
      document.body.removeChild(element);
    });
  };

  const exportToHTML = () => {
    if (!reportContent) return;
    const element = document.createElement('div');
    element.innerHTML = `
      <html>
        <head>
          <title>${reportContent.title}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            h1, h2, h3 { color: #00d4ff; }
            .metadata { background: #f0f4f8; padding: 20px; margin-bottom: 30px; border-radius: 8px; }
            .finding { background: #fff8e1; padding: 15px; margin: 10px 0; border-left: 4px solid #ffb800; }
          </style>
        </head>
        <body>
          <h1>${reportContent.title}</h1>
          <div class="metadata">
            <p><strong>Report ID:</strong> ${reportContent.id}</p>
            <p><strong>Generated By:</strong> ${reportContent.generatedBy}</p>
            <p><strong>Generated At:</strong> ${new Date(reportContent.generatedAt).toLocaleString()}</p>
          </div>
          <h2>Key Findings</h2>
          <ul>
            ${reportContent.content.keyFindings.map((finding: string) => `<li>${finding}</li>`).join('')}
          </ul>
        </body>
      </html>
    `;

    const blob = new Blob([element.innerHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Haryana_Police_Report_${reportContent.id}.html`;
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(element);
  };

  const exportToJSON = () => {
    if (!reportContent) return;
    const dataStr = JSON.stringify(reportContent, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Haryana_Police_Report_${reportContent.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
};

export default IntelligenceReportPage;