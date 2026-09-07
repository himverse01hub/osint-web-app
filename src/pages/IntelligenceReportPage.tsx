import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { generateMockCases, generateMockData, generateMockRelationships } from '../data/mockData';
import { Person, Relationship } from '../types/osint';

export const IntelligenceReportPage = () => {
  const { authState } = useAuth();
  const { user } = authState;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [cases, setCases] = useState<Array<any>>([]);
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [reportContent, setReportContent] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    const loadCases = async () => {
      try {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Get mock data
        const mockCases = generateMockCases();
        setCases(mockCases);
        
        // Auto-select case from URL params if provided
        const caseId = searchParams.get('case');
        if (caseId) {
          const foundCase = mockCases.find(c => c.id === caseId);
          if (foundCase) {
            setSelectedCase(foundCase);
            generateReport(foundCase);
          }
        }
      } catch (error) {
        console.error('Error loading cases:', error);
      }
    };

    loadCases();
  }, [searchParams]);

  const generateReport = async (caseId: string) => {
    setGenerating(true);
    try {
      // Simulate report generation delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Get mock data for report generation
      const mockData = generateMockData();
      const mockRelationships = generateMockRelationships(mockData);
      const caseObj = cases.find((c: any) => c.id === caseId) || 
                     cases.find((c: any) => c.caseNumber === caseId);
      
      if (!caseObj) {
        throw new Error('Case not found');
      }

      // Get entities related to this case
      const caseEntityIds = caseObj.entities;
      const caseEntities = Object.values(mockData).flat().filter((entity: any) => 
        caseEntityIds.includes(entity.id)
      );
      
      const caseRelationships = mockRelationships.filter((rel: any) => 
        caseEntityIds.includes(rel.sourceId) || caseEntityIds.includes(rel.targetId)
      );

      // Generate report content
      const report = {
        id: `rep_${Date.now()}`,
        caseId: caseObj.id,
        title: `Intelligence Report: ${caseObj.title}`,
        type: 'intelligence',
        status: 'final',
        generatedBy: user.name,
        generatedAt: new Date().toISOString(),
        content: {
          subjectOverview: generateSubjectOverview(caseObj, caseEntities),
          keyFindings: generateKeyFindings(caseEntities, caseRelationships),
          associatedIdentities: caseEntities.filter((e: any) => e.type === 'person'),
          onlinePresence: caseEntities.filter((e: any) => 
            ['username', 'social_account', 'email'].includes(e.type)
          ),
          relationships: caseRelationships,
          investigativeLeads: generateInvestigativeLeads(caseEntities, caseRelationships),
          sources: generateSources(caseEntities, caseRelationships)
        },
        exports: [
          { id: 'exp_1', format: 'pdf', url: `#report-${Date.now()}`, generatedAt: new Date().toISOString() },
          { id: 'exp_2', format: 'html', url: `#report-${Date.now()}-html`, generatedAt: new Date().toISOString() },
          { id: 'exp_3', format: 'json', url: `#report-${Date.now()}-json`, generatedAt: new Date().toISOString() }
        ]
      };

      setReportContent(report);
      setGenerated(true);
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setGenerating(false);
    }
  };

  const generateSubjectOverview = (caseObj: any, entities: any[]) => {
    const persons = entities.filter((e: any) => e.type === 'person');
    return `
      This intelligence report concerns ${caseObj.title.toLowerCase()}. 
      The investigation focuses on ${persons.length} primary subject(s) involved in 
      ${caseObj.tags.join(', ')} activities. 
      
      Case Number: ${caseObj.caseNumber}
      Status: ${caseObj.status}
      Priority: ${caseObj.priority}
      Assigned Investigator: ${caseObj.assignedTo}
      
      The subjects are associated with ${caseObj.entities.length} entities including 
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
    
    return [
      `Identified ${persons.length} person(s) of interest with varying risk profiles`,
      `Discovered ${phones.length} phone numbers linked to the subjects`,
      `Found ${emails.length} email addresses, including ${emails.filter((e: any) => e.breaches && e.breaches.length > 0).length} from known data breaches`,
      `Identified ${usernames.length} social media/forum usernames across multiple platforms`,
      `Documented ${orgs.length} organizational affiliations, including registered businesses`,
      `Traced ${crypto.length} cryptocurrency wallets with total estimated value of significant funds`,
      `Mapped ${relationships.length} relationships between entities, including business partnerships and financial transactions`,
      `Detected potential money laundering patterns through cryptocurrency transactions`
    ];
  };

  const generateInvestigativeLeads = (entities: any[], relationships: any[]) => {
    return [
      {
        id: 'lead_001',
        title: 'Cryptocurrency Transaction Analysis',
        description: 'Further investigation needed into shared USDC wallet transactions to identify fund sources and destinations',
        priority: 'high',
        entityIds: ['crypto_003'],
        recommendedActions: [
          'Request transaction history from blockchain analysis',
          'Identify counterparties in USDC transactions',
          'Trace fiat on/off ramps used for wallet funding'
        ]
      },
      {
        id: 'lead_002',
        title: 'Social Media Network Mapping',
        description: 'Expand surveillance of social media accounts to identify additional associates and communication patterns',
        priority: 'medium',
        entityIds: entities.filter((e: any) => e.type === 'social_account').map((e: any) => e.id),
        recommendedActions: [
          'Monitor posts for operational security violations',
          'Identify frequent interactors and network clusters',
          'Document geotags and location check-ins'
        ]
      },
      {
        id: 'lead_003',
        title: 'Organizational Financial Records Review',
        description: 'Examine business registration and financial records of associated organizations',
        priority: 'medium',
        entityIds: orgs.map((e: any) => e.id),
        recommendedActions: [
          'Review Ministry of Corporate Affairs filings',
          'Examine bank account registrations',
          'Investigate supplier and client relationships'
        ]
      }
    ];
  };

  const generateSources = (entities: any[], relationships: any[]) => {
    const sourceCounts: Record<string, number> = {};
    
    entities.forEach((entity: any) => {
      const source = entity.sourceName || 'Unknown';
      sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    });
    
    relationships.forEach((rel: any) => {
      rel.sources.forEach((source: any) => {
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
      reliability: count > 3 ? 'high' : count > 1 ? 'medium' : 'low'
    }));
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between space-x-4">
        <div>
          <h1 className="text-2xl font-bold text-gradient">Intelligence Reports</h1>
          <p className="text-police-400">Generate and manage investigative reports</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/cases')}
            className="btn-secondary px-4 py-2"
          >
            View All Cases
          </button>
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

      {/* Case Selection */}
      {!selectedCase && cases.length > 0 && (
        <div className="card card-hover p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Select a Case</h3>
          </div>
          <div className="space-y-4">
            {cases.map((caseItem: any) => (
              <div 
                key={caseItem.id} 
                className="flex items-start gap-3 p-4 bg-police-800/50 rounded-lg hover:bg-police-800 transition-colors cursor-pointer"
                onClick={() => {
                  setSelectedCase(caseItem);
                  navigate(`/reports?case=${caseItem.id}`);
                  generateReport(caseItem.id);
                }}
              >
                <div className="flex-shrink-0">
                  <div className={`h-4 w-4 rounded-full
                    ${caseItem.priority === 'critical' ? 'bg-red-500' :
                    caseItem.priority === 'high' ? 'bg-orange-500' :
                    caseItem.priority === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'}
                  `}></div>
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-white">{caseItem.title}</h4>
                  <p className="text-police-400 text-sm">
                    Case #{caseItem.caseNumber} • {caseItem.status} • {caseItem.priority} priority
                  </p>
                  <p className="text-police-500 text-xs mt-1">
                    Assigned to: {caseItem.assignedTo} • 
                    Updated: {new Date(caseItem.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                <p className="text-white font-medium">{selectedCase.assignedTo}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Created</p>
                <p className="text-white font-medium">{new Date(selectedCase.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-police-400 text-sm">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {selectedCase.tags.map((tag: string) => (
                    <span key={tag} className="bg-police-800/50 px-2 py-0.5 rounded text-xs">
                      {tag}
                    </span>
                  ))}
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
          <p className="text-police-400">Generating intelligence report...</p>
          <p className="text-police-500 text-sm mt-2">
            Please wait while the report is being compiled from available data sources.
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
                    <div key={entity.id} className="flex items-start gap-3 p-3 bg-police-800/50 rounded-lg">
                      <div className="flex-shrink-0">
                        <div className="h-3 w-3 rounded-full bg-accent-cyan"></div>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-white">{entity.label || entity.value}</p>
                        <p className="text-police-400 text-sm">{entity.type === 'person' && (
                          <>
                            {entity.aliases.length > 0 && (
                              <span className="bg-police-900/50 px-1 py-0 rounded text-xs">
                                AKA: {entity.aliases[0]}
                              </span>
                            )}
                          </>
                        )} {entity.confidence}% Confidence</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-white mb-3">Investigative Leads</h4>
                <div className="space-y-2">
                  {reportContent.content.investigativeLeads.map((lead: any, index: number) => (
                    <div key={lead.id} className="border-l-2 border-police-600 pl-4 py-3">
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
                key={exportItem.id}
                onClick={() => {
                  // Handle export based on format
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
                // Print report
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
    // Create a temporary element for PDF generation
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
    });
  };

  const exportToHTML = () => {
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
