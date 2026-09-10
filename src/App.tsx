import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import OSINTSearchPage from './pages/OSINTSearchPage';
import SuspectProfilePage from './pages/SuspectProfilePage';
import AIAssistantPage from './pages/AIAssistantPage';
import KnowledgeGraphPage from './pages/KnowledgeGraphPage';
import DarkWebIntelligencePage from './pages/DarkWebIntelligencePage';
import IntelligenceReportPage from './pages/IntelligenceReportPage';
import AlertsPage from './pages/AlertsPage';
import AuditLogsPage from './pages/AuditLogsPage';
import SettingsPage from './pages/SettingsPage';
import CasesPage from './pages/CasesPage';
import CaseDetailPage from './pages/CaseDetailPage';
import EntityActivitiesPage from './pages/EntityActivitiesPage';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';

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
            <Routes>
              <Route path="/" element={<Navigate replace to="/dashboard" />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/cases" element={<CasesPage />} />
              <Route path="/entity-activities" element={<EntityActivitiesPage />} />
              <Route path="/case/:caseId" element={<CaseDetailPage />} />
              <Route path="/search" element={<OSINTSearchPage />} />
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
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;