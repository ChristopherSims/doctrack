import React, { useState } from 'react';
import Navigation from './components/Navigation';
import DocumentsPage from './pages/DocumentsPage';
import RequirementsPage from './pages/RequirementsPage';
import HistoryPage from './pages/HistoryPage';
import BranchesPage from './pages/BranchesPage';
import ExportPage from './pages/ExportPage';
import SettingsPage from './pages/SettingsPage';
import DiffViewPage from './pages/DiffViewPage';
import TraceabilityPage from './pages/TraceabilityPage';
import AuditLogPage from './pages/AuditLogPage';

export type Page = 'documents' | 'requirements' | 'history' | 'branches' | 'export' | 'settings' | 'diff' | 'traceability' | 'audit';

interface AppState {
  currentPage: Page;
  selectedDocumentId: string | null;
  selectedDocumentTitle: string;
  currentBranch: string;
}

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    currentPage: 'documents',
    selectedDocumentId: null,
    selectedDocumentTitle: '',
    currentBranch: 'main',
  });

  const handleNavigate = (page: Page) => {
    setState(prev => ({ ...prev, currentPage: page }));
  };

  const handleSelectDocument = (id: string, title: string) => {
    setState({
      currentPage: 'requirements',
      selectedDocumentId: id,
      selectedDocumentTitle: title,
      currentBranch: 'main',
    });
  };

  const handleBackToDocuments = () => {
    setState(prev => ({
      ...prev,
      currentPage: 'documents',
      selectedDocumentId: null,
      selectedDocumentTitle: '',
    }));
  };

  const handleBranchChange = (branchName: string) => {
    setState(prev => ({ ...prev, currentBranch: branchName }));
  };

  const renderPage = () => {
    switch (state.currentPage) {
      case 'documents':
        return <DocumentsPage onSelectDocument={handleSelectDocument} />;
      case 'requirements':
        return state.selectedDocumentId ? (
          <RequirementsPage documentId={state.selectedDocumentId} onBack={handleBackToDocuments} />
        ) : null;
      case 'history':
        return state.selectedDocumentId ? <HistoryPage documentId={state.selectedDocumentId} documentTitle={state.selectedDocumentTitle} /> : null;
      case 'branches':
        return state.selectedDocumentId ? <BranchesPage documentId={state.selectedDocumentId} documentTitle={state.selectedDocumentTitle} currentBranch={state.currentBranch} onBranchChange={handleBranchChange} /> : null;
      case 'export':
        return state.selectedDocumentId ? <ExportPage documentId={state.selectedDocumentId} documentTitle={state.selectedDocumentTitle} /> : null;
      case 'settings':
        return <SettingsPage />;
      case 'diff':
        return state.selectedDocumentId ? <DiffViewPage documentId={state.selectedDocumentId} documentTitle={state.selectedDocumentTitle} /> : null;
      case 'traceability':
        return state.selectedDocumentId ? <TraceabilityPage documentId={state.selectedDocumentId} documentTitle={state.selectedDocumentTitle} /> : null;
      case 'audit':
        return <AuditLogPage documentId={state.selectedDocumentId ?? undefined} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Navigation
        currentPage={state.currentPage}
        onNavigate={handleNavigate}
        selectedDocumentTitle={state.selectedDocumentTitle}
        currentBranch={state.currentBranch}
      />
      <main className="flex-1 overflow-auto">
        {renderPage()}
      </main>
    </div>
  );
};

export default App;
