import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const OSINTSearchPage = lazy(() => import('./pages/OSINTSearchPage'));
const SuspectProfilePage = lazy(() => import('./pages/SuspectProfilePage'));
const AIAssistantPage = lazy(() => import('./pages/AIAssistantPage'));
const KnowledgeGraphPage = lazy(() => import('./pages/KnowledgeGraphPage'));
const DarkWebIntelligencePage = lazy(() => import('./pages/DarkWebIntelligencePage'));
const IntelligenceReportPage = lazy(() => import('./pages/IntelligenceReportPage'));
const AlertsPage = lazy(() => import('./pages/AlertsPage'));
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const CasesPage = lazy(() => import('./pages/CasesPage'));
const CaseDetailPage = lazy(() => import('./pages/CaseDetailPage'));
const EntityActivitiesPage = lazy(() => import('./pages/EntityActivitiesPage'));
const OSTINToolsPage = lazy(() => import('./pages/OSTINToolsPage'));

function RouteFallback() {
  return (
    <div className="flex items-center justify-center py-16" role="status" aria-label="Loading page">
      <div className="text-center">
        <div className="inline-block animate-pulse">
          <svg className="h-8 w-8 text-accent-cyan" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 6v6l4 2"></path>
          </svg>
        </div>
        <p className="mt-4 text-police-300">Loading page...</p>
      </div>
    </div>
  );
}
function App() {
  const { authState } = useAuth();
  const { isAuthenticated, isLoading, user } = authState;
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-police-950">
        <div className="text-center">
          <div className="inline-block animate-pulse">
            <svg className="h-8 w-8 text-accent-cyan" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 6v6l4 2"></path>
            </svg>
          </div>
          <p className="mt-4 text-police-300">Loading Haryana Police OSINT Platform...</p>
        </div>
      </div>
    );
  }
  if (!isAuthenticated) {
    return <LoginPage />;
  }
  return (
    <div className="min-h-screen flex flex-col bg-police-950">
      <Header user={user} />
      <div className="flex-1 flex">
        <Sidebar />
        <div className="flex-1 overflow-hidden">
          <main className="flex-1 overflow-y-auto p-6">
            <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Navigate replace to="/dashboard" />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/cases" element={<CasesPage />} />
              <Route path="/entity-activities" element={<EntityActivitiesPage />} />
              <Route path="/case/:caseId" element={<CaseDetailPage />} />
              <Route path="/search" element={<OSINTSearchPage />} />
              <Route path="/osint-tools" element={<OSTINToolsPage />} />
              <Route path="/profile" element={<OSINTSearchPage />} />
              <Route path="/profile/:entityId" element={<SuspectProfilePage />} />
              <Route path="/assistant" element={<AIAssistantPage />} />
              <Route path="/graph" element={<KnowledgeGraphPage />} />
              <Route path="/darkweb" element={<DarkWebIntelligencePage />} />
              <Route path="/reports" element={<IntelligenceReportPage />} />
              <Route path="/alerts" element={<AlertsPage />} />
              <Route path="/audit" element={<AuditLogsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/data-management" element={<SettingsPage mode="data" />} />
              <Route path="*" element={<Navigate replace to="/dashboard" />} />
            </Routes>
            </Suspense>
          </main>
        </div>
      </div>
    </div>
  );
}
export default App;