import { apiFetch } from '../lib/api';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';

export const IntelligenceReportPage = () => {
  const { authState } = useAuth();
  const { user } = authState;
  const [searchParams] = useSearchParams();
  const [cases, setCases] = useState<Array<any>>([]);
  const [entities, setEntities] = useState<Array<any>>([]);
  const [relationships, setRelationships] = useState<Array<any>>([]);
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [reportContent, setReportContent] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [reportType, setReportType] = useState<'all' | 'cases' | 'entities' | 'relationships'>('all');
  const [reportStatus, setReportStatus] = useState<'all' | 'pending' | 'disposed'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [reportModalOpen, setReportModalOpen] = useState(false);

  useEffect(() => {
    const loadCases = async () => {
      try {
        const response = await apiFetch('/api/cases');
        if (!response.ok) throw new Error('Cases request failed');

        const [data, entityResponse, relationshipResponse] = await Promise.all([
          response.json(),
          apiFetch('/api/entities'),
          apiFetch('/api/relationships'),
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
          const foundCase = liveCases.find((caseItem: any) => caseItem.id === caseId);
          if (foundCase) {
            setSelectedCaseId(foundCase.id);
            await generateReport(foundCase.id);
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
      caseNumber: caseItem.caseNumber,
      detail: caseItem.description || 'No description',
      status: ['closed', 'archived'].includes(caseItem.status) ? 'disposed' : 'pending',
      rawStatus: caseItem.status,
      priority: caseItem.priority,
      assignedTo: caseItem.assignedTo,
      date: caseItem.updatedAt,
    })),
    ...entities.map((entity: any) => ({
      id: entity.id,
      type: 'entities',
      title: entity.label || entity.value,
      caseNumber: '-',
      detail: `${entity.type.replace(/_/g, ' ')} â€¢ ${entity.sourceName || 'Unknown source'}`,
      status: 'pending',
      rawStatus: 'pending',
      priority: '-',
      assignedTo: '-',
      date: entity.discoveredAt,
    })),
    ...relationships.map((relationship: any) => ({
      id: relationship.id,
      type: 'relationships',
      title: `${relationship.sourceLabel || relationship.sourceId} â†’ ${relationship.targetLabel || relationship.targetId}`,
      caseNumber: '-',
      detail: relationship.type.replace(/_/g, ' '),
      status: 'pending',
      rawStatus: 'pending',
      priority: '-',
      assignedTo: '-',
      date: relationship.discoveredAt,
    })),
  ];

  const filteredReportEntries = reportEntries.filter((entry) => {
    const matchesType = reportType === 'all' || entry.type === reportType;
    const matchesStatus = reportStatus === 'all' || entry.status === reportStatus;
    const entryDate = entry.date ? new Date(entry.date) : null;
    const validDate = entryDate && !Number.isNaN(entryDate.getTime());
    const normalizedDate = validDate ? entryDate.toISOString().slice(0, 10) : '';
    const matchesDateFrom = !dateFrom || (normalizedDate && normalizedDate >= dateFrom);
    const matchesDateTo = !dateTo || (normalizedDate && normalizedDate <= dateTo);
    return matchesType && matchesStatus && matchesDateFrom && matchesDateTo;
  });

  const pendingCount = filteredReportEntries.filter((entry) => entry.status === 'pending').length;
  const disposedCount = filteredReportEntries.filter((entry) => entry.status === 'disposed').length;
  const totalCount = filteredReportEntries.length;

  const generateSubjectOverview = (caseObj: any, entities: any[]) => {
    const persons = entities.filter((entity: any) => entity.type === 'person');
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
    const persons = entities.filter((entity: any) => entity.type === 'person');
    const phones = entities.filter((entity: any) => entity.type === 'phone');
    const emails = entities.filter((entity: any) => entity.type === 'email');
    const usernames = entities.filter((entity: any) => entity.type === 'username');
    const orgs = entities.filter((entity: any) => entity.type === 'organization');
    const crypto = entities.filter((entity: any) => entity.type === 'crypto_wallet');
    const social = entities.filter((entity: any) => entity.type === 'social_account');
    const breachedEmails = emails.filter((entity: any) => Array.isArray(entity.breaches) && entity.breaches.length > 0);

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
    const orgs = entities.filter((entity: any) => entity.type === 'organization');
    const social = entities.filter((entity: any) => entity.type === 'social_account');
    return [
      {
        id: 'lead_crypto',
        title: 'Cryptocurrency Transaction Analysis',
        description: relationships.some((relationship: any) => relationship.type === 'crypto_shared')
          ? 'Follow up on recorded crypto wallet relationships to identify fund sources and destinations.'
          : 'No crypto connections recorded yet; request wallet monitoring from the intelligence desk.',
        priority: 'high',
        entityIds: entities.filter((entity: any) => entity.type === 'crypto_wallet').map((entity: any) => entity.id),
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
        entityIds: social.map((entity: any) => entity.id),
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
        entityIds: orgs.map((entity: any) => entity.id),
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

    relationships.forEach((relationship: any) => {
      (Array.isArray(relationship.sources) ? relationship.sources : []).forEach((source: string) => {
        const sourceName = source === 'social_media' ? 'Social Media Monitoring' :
          source === 'public_records' ? 'Government Databases' :
          source === 'corporate' ? 'Corporate Registries' :
          source === 'blockchain' ? 'Blockchain Explorers' :
          source === 'intelligence' ? 'Intelligence Sources' : source;
        sourceCounts[sourceName] = (sourceCounts[sourceName] || 0) + 1;
      });
    });

    return Object.entries(sourceCounts).map(([name, count]) => ({
      name,
      type: 'mixed',
      count,
      reliability: count > 3 ? 'high' : count > 1 ? 'medium' : 'low',
    }));
  };

  const generateReport = useCallback(async (caseId: string) => {
    setGenerating(true);
    setLoadError('');
    try {
      const caseObj = cases.find((caseItem: any) => caseItem.id === caseId) ??
        cases.find((caseItem: any) => caseItem.caseNumber === caseId);

      if (!caseObj) throw new Error('Case not found');

      const [caseResponse, graphResponse] = await Promise.all([
        apiFetch(`/api/cases?id=${encodeURIComponent(caseObj.id)}`),
        apiFetch('/api/entities'),
      ]);
      if (!caseResponse.ok || !graphResponse.ok) throw new Error('Database request failed');

      const [caseData, graphData] = await Promise.all([caseResponse.json(), graphResponse.json()]);
      const liveCase = caseData.case ?? caseObj;
      const allEntities = graphData.entities ?? [];
      const allRelationships = graphData.relationships ?? [];
      const caseEntityIds: string[] = Array.isArray(liveCase.entities) ? liveCase.entities : [];
      const caseEntities = allEntities.filter((entity: any) => caseEntityIds.includes(entity.id));
      const caseRelationships = allRelationships.filter((relationship: any) =>
        caseEntityIds.includes(relationship.sourceId) || caseEntityIds.includes(relationship.targetId)
      );

      const report = {
        id: `rep_${Date.now()}`,
        caseId: liveCase.id,
        title: `Intelligence Report: ${liveCase.title}`,
        type: 'intelligence',
        status: 'final',
        generatedBy: user?.name ?? 'Investigator',
        generatedAt: new Date().toISOString(),
        caseNumber: liveCase.caseNumber,
        caseStatus: liveCase.status,
        priority: liveCase.priority,
        assignedTo: liveCase.assignedTo,
        createdAt: liveCase.createdAt,
        updatedAt: liveCase.updatedAt,
        tags: liveCase.tags ?? [],
        description: liveCase.description || 'No description',
        caseEntities,
        caseRelationships,
        content: {
          subjectOverview: generateSubjectOverview(liveCase, caseEntities),
          keyFindings: generateKeyFindings(caseEntities, caseRelationships),
          associatedIdentities: caseEntities.filter((entity: any) => entity.type === 'person'),
          onlinePresence: caseEntities.filter((entity: any) =>
            ['username', 'social_account', 'email'].includes(entity.type)
          ),
          relationships: caseRelationships,
          investigativeLeads: generateInvestigativeLeads(caseEntities, caseRelationships),
          sources: generateSources(caseEntities, caseRelationships),
        },
        exports: ['pdf', 'html', 'json'],
      };

      setReportContent(report);
      setReportModalOpen(true);
    } catch (error) {
      console.error('Error generating report:', error);
      setLoadError(error instanceof Error ? error.message : 'Could not generate report');
    } finally {
      setGenerating(false);
    }
  }, [cases, user?.name]);

  const handleGenerateReport = async () => {
    if (!selectedCaseId) {
      setLoadError('Select a case before generating a report.');
      return;
    }
    await generateReport(selectedCaseId);
  };

  const clearFilters = () => {
    setReportType('all');
    setReportStatus('all');
    setDateFrom('');
    setDateTo('');
  };

  const statusBadge = (status: string) => {
    if (status === 'disposed' || status === 'closed' || status === 'archived') return <span className="badge badge-info">Disposed</span>;
    if (status === 'pending' || status === 'open' || status === 'active') return <span className="badge badge-warning">Pending</span>;
    return <span className="badge badge-primary capitalize">{status}</span>;
  };

  const priorityBadge = (priority: string) => {
    if (priority === 'critical') return <span className="badge badge-danger capitalize">{priority}</span>;
    if (priority === 'high') return <span className="badge badge-warning capitalize">{priority}</span>;
    if (priority === 'medium') return <span className="badge badge-primary capitalize">{priority}</span>;
    if (priority === 'low') return <span className="badge badge-success capitalize">{priority}</span>;
    return <span className="badge badge-primary capitalize">{priority || '-'}</span>;
  };

  const exportToPDF = async (report = reportContent) => {
    if (!report) return;
    try {
      const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);
      const element = document.createElement('div');
      element.innerHTML = `
      <div style="font-family:Arial,sans-serif;color:#172033;padding:24px;">
        <h1 style="color:#126782;margin:0 0 16px;">${report.title}</h1>
        <p><strong>Report ID:</strong> ${report.id}</p>
        <p><strong>Case Number:</strong> ${report.caseNumber || '-'}</p>
        <p><strong>Generated By:</strong> ${report.generatedBy}</p>
        <p><strong>Generated At:</strong> ${new Date(report.generatedAt).toLocaleString()}</p>
        <h2 style="color:#126782;margin-top:24px;">Subject Overview</h2>
        <p>${report.content.subjectOverview}</p>
        <h2 style="color:#126782;margin-top:24px;">Key Findings</h2>
        <ul>${report.content.keyFindings.map((finding: string) => `<li>${finding}</li>`).join('')}</ul>
        <h2 style="color:#126782;margin-top:24px;">Investigative Leads</h2>
        ${report.content.investigativeLeads.map((lead: any) => `<h3>${lead.title}</h3><p>${lead.description}</p>`).join('')}
      </div>
    `;
      document.body.appendChild(element);
      try {
        const canvas = await html2canvas(element);
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Haryana_Police_Report_${report.id}.pdf`);
      } finally {
        document.body.removeChild(element);
      }
    } catch (error) {
      console.error('PDF export failed:', error);
      setLoadError(error instanceof Error ? error.message : 'PDF export failed');
    }
  };

  const exportToHTML = (report = reportContent) => {
    if (!report) return;
    const element = document.createElement('div');
    element.innerHTML = `<!doctype html><html><head><meta charset="utf-8"><title>${report.title}</title><style>body{font-family:Arial,sans-serif;margin:40px;color:#172033}h1,h2,h3{color:#126782}.metadata{background:#f0f4f8;padding:20px;margin-bottom:24px;border-radius:8px}.finding{background:#fff8e1;padding:12px;margin:10px 0;border-left:4px solid #ffb800}</style></head><body><h1>${report.title}</h1><div class="metadata"><p><strong>Report ID:</strong> ${report.id}</p><p><strong>Case Number:</strong> ${report.caseNumber || '-'}</p><p><strong>Generated By:</strong> ${report.generatedBy}</p><p><strong>Generated At:</strong> ${new Date(report.generatedAt).toLocaleString()}</p></div><h2>Subject Overview</h2><p>${report.content.subjectOverview}</p><h2>Key Findings</h2>${report.content.keyFindings.map((finding: string) => `<div class="finding">${finding}</div>`).join('')}<h2>Investigative Leads</h2>${report.content.investigativeLeads.map((lead: any) => `<h3>${lead.title}</h3><p>${lead.description}</p>`).join('')}</body></html>`;
    const blob = new Blob([element.innerHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Haryana_Police_Report_${report.id}.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportToJSON = (report = reportContent) => {
    if (!report) return;
    const data = JSON.stringify(report, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Haryana_Police_Report_${report.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const closeModal = () => setReportModalOpen(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gradient">Intelligence Reports</h1>
          <p className="text-police-400">Generate a case report and export it in the required format</p>
        </div>
        <button
          onClick={handleGenerateReport}
          disabled={!selectedCaseId || generating}
          className="btn-accent px-5 py-2.5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {generating ? 'Generating...' : 'Generate Report'}
        </button>
      </div>

      {loadError && (
        <div className="rounded border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-300">{loadError}</div>
      )}

      <div className="card p-4 space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <label htmlFor="case-selector" className="mb-1 block text-sm text-police-300">Select Case</label>
            <select
              id="case-selector"
              value={selectedCaseId}
              onChange={(event) => {
                const caseId = event.target.value;
                setSelectedCaseId(caseId);
              }}
              className="input-field"
            >
              <option value="">Choose a case</option>
              {cases.map((caseItem: any) => (
                <option key={caseItem.id} value={caseItem.id}>
                  {caseItem.caseNumber} â€” {caseItem.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="report-type" className="mb-1 block text-sm text-police-300">Type of Report</label>
            <select id="report-type" value={reportType} onChange={(event) => setReportType(event.target.value as typeof reportType)} className="input-field">
              <option value="all">All Types</option>
              <option value="cases">Cases</option>
              <option value="entities">Entities</option>
              <option value="relationships">Relationships</option>
            </select>
          </div>
          <div>
            <label htmlFor="report-status" className="mb-1 block text-sm text-police-300">Status</label>
            <select id="report-status" value={reportStatus} onChange={(event) => setReportStatus(event.target.value as typeof reportStatus)} className="input-field">
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="disposed">Disposed</option>
            </select>
          </div>
          <div className="flex items-end">
            <button type="button" onClick={clearFilters} className="btn-secondary w-full py-2.5">Clear</button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="date-from" className="mb-1 block text-sm text-police-300">Date From</label>
            <input id="date-from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="input-field" />
          </div>
          <div>
            <label htmlFor="date-to" className="mb-1 block text-sm text-police-300">Date To</label>
            <input id="date-to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="input-field" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-police-700 bg-police-900/50 p-4">
            <p className="text-sm text-police-400">Pending</p>
            <p className="mt-1 text-3xl font-bold text-accent-gold">{pendingCount}</p>
          </div>
          <div className="rounded-lg border border-police-700 bg-police-900/50 p-4">
            <p className="text-sm text-police-400">Disposed</p>
            <p className="mt-1 text-3xl font-bold text-accent-cyan">{disposedCount}</p>
          </div>
          <div className="rounded-lg border border-police-700 bg-police-900/50 p-4">
            <p className="text-sm text-police-400">Total</p>
            <p className="mt-1 text-3xl font-bold text-white">{totalCount}</p>
          </div>
        </div>
      </div>

      {generating && (
        <div className="card card-hover p-6 text-center">
          <div className="inline-block animate-pulse">
            <svg className="h-8 w-8 text-accent-cyan mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 6v6l4 2"></path>
            </svg>
          </div>
          <p className="text-police-400">Compiling report from database...</p>
          <p className="text-police-500 text-sm mt-2">Pulling the latest case entities, relationships, and sources from the database.</p>
        </div>
      )}

      {reportModalOpen && reportContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="card w-full max-w-5xl max-h-[88vh] overflow-hidden flex flex-col">
            <div className="flex items-start justify-between gap-4 border-b border-police-700 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-accent-cyan">Generated Intelligence Report</p>
                <h2 className="mt-1 text-xl font-semibold text-white">{reportContent.title}</h2>
              </div>
              <button onClick={closeModal} className="text-2xl leading-none text-police-400 hover:text-white" aria-label="Close report">&times;</button>
            </div>

            <div className="flex flex-wrap gap-3 border-b border-police-700 bg-police-900/50 p-4 text-sm">
              <div><p className="text-police-500">Report ID</p><p className="font-medium text-white">{reportContent.id}</p></div>
              <div><p className="text-police-500">Case Number</p><p className="font-medium text-white">{reportContent.caseNumber || '-'}</p></div>
              <div><p className="text-police-500">Status</p>{statusBadge(reportContent.caseStatus)}</div>
              <div><p className="text-police-500">Priority</p>{priorityBadge(reportContent.priority)}</div>
              <div><p className="text-police-500">Assigned To</p><p className="font-medium text-white">{reportContent.assignedTo || 'Unassigned'}</p></div>
              <div><p className="text-police-500">Generated At</p><p className="font-medium text-white">{new Date(reportContent.generatedAt).toLocaleString()}</p></div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              <section>
                <h3 className="mb-2 text-lg font-semibold text-white">Subject Overview</h3>
                <p className="whitespace-pre-line text-sm leading-relaxed text-police-300">{reportContent.content.subjectOverview}</p>
              </section>

              <section>
                <h3 className="mb-3 text-lg font-semibold text-white">Key Findings</h3>
                <ol className="list-decimal space-y-2 pl-5 text-sm text-police-300">
                  {reportContent.content.keyFindings.map((finding: string, index: number) => <li key={index}>{finding}</li>)}
                </ol>
              </section>

              <section className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-police-700 p-4">
                  <h3 className="mb-3 font-semibold text-white">Associated Identities</h3>
                  {reportContent.content.associatedIdentities.length ? (
                    <ul className="space-y-2 text-sm text-police-300">
                      {reportContent.content.associatedIdentities.map((entity: any, index: number) => (
                        <li key={entity.id ?? index} className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-accent-cyan"></span>
                          <span>{entity.label || entity.value}</span>
                          <span className="text-police-500">({entity.confidence ?? 0}%)</span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-police-500">No person entities linked to this case.</p>}
                </div>
                <div className="rounded-lg border border-police-700 p-4">
                  <h3 className="mb-3 font-semibold text-white">Online Presence</h3>
                  {reportContent.content.onlinePresence.length ? (
                    <ul className="space-y-2 text-sm text-police-300">
                      {reportContent.content.onlinePresence.map((entity: any, index: number) => (
                        <li key={entity.id ?? index} className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-accent-gold"></span>
                          <span>{entity.label || entity.value}</span>
                          <span className="capitalize text-police-500">({entity.type.replace(/_/g, ' ')})</span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-police-500">No online presence records linked to this case.</p>}
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-lg font-semibold text-white">Relationships</h3>
                {reportContent.caseRelationships.length ? (
                  <div className="overflow-x-auto rounded-lg border border-police-700">
                    <table className="table">
                      <thead><tr><th>Source</th><th>Relationship</th><th>Target</th><th>Confidence</th></tr></thead>
                      <tbody>
                        {reportContent.caseRelationships.map((relationship: any, index: number) => (
                          <tr key={relationship.id ?? index}>
                            <td className="text-white">{relationship.sourceLabel || relationship.sourceId}</td>
                            <td className="capitalize text-police-300">{relationship.type?.replace(/_/g, ' ') || '-'}</td>
                            <td className="text-white">{relationship.targetLabel || relationship.targetId}</td>
                            <td>{relationship.confidence ?? '-'}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="text-sm text-police-500">No relationships linked to this case.</p>}
              </section>

              <section>
                <h3 className="mb-3 text-lg font-semibold text-white">Investigative Leads</h3>
                <div className="space-y-3">
                  {reportContent.content.investigativeLeads.map((lead: any, index: number) => (
                    <div key={lead.id ?? index} className="rounded-lg border-l-4 border-accent-cyan bg-police-900/50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="font-medium text-white">{lead.title}</h4>
                        {priorityBadge(lead.priority)}
                      </div>
                      <p className="mt-2 text-sm text-police-300">{lead.description}</p>
                      <div className="mt-3 text-sm text-police-400">
                        <p className="font-medium text-police-300">Recommended Actions</p>
                        <ul className="mt-1 list-disc space-y-1 pl-5">
                          {lead.recommendedActions.map((action: string, actionIndex: number) => <li key={actionIndex}>{action}</li>)}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-lg font-semibold text-white">Sources</h3>
                {reportContent.content.sources.length ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {reportContent.content.sources.map((source: any, index: number) => (
                      <div key={source.id ?? index} className="rounded-lg border border-police-700 p-3">
                        <p className="font-medium text-white">{source.name}</p>
                        <p className="mt-1 text-xs text-police-400">Records: {source.count}</p>
                        <p className="mt-1 text-xs capitalize text-police-500">{source.reliability} reliability</p>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-police-500">No sources recorded for this report.</p>}
              </section>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-police-700 p-4">
              <button onClick={() => exportToPDF()} className="btn-accent px-4 py-2">Download PDF</button>
              <button onClick={() => exportToHTML()} className="btn-secondary px-4 py-2">Download HTML</button>
              <button onClick={() => exportToJSON()} className="btn-secondary px-4 py-2">Download JSON</button>
              <button onClick={() => window.print()} className="btn-secondary px-4 py-2">Print</button>
              <button onClick={closeModal} className="btn-primary px-4 py-2">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntelligenceReportPage;
