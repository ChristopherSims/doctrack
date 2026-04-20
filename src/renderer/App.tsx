import React, { useState, useEffect } from 'react';
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
  highlightReqId: string | null;
  navigateToDocId: string | null;
}

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    currentPage: 'documents',
    selectedDocumentId: null,
    selectedDocumentTitle: '',
    currentBranch: 'main',
    highlightReqId: null,
    navigateToDocId: null,
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
      highlightReqId: null,
      navigateToDocId: null,
    });
  };

  const handleBackToDocuments = () => {
    setState(prev => ({
      ...prev,
      currentPage: 'documents',
      selectedDocumentId: null,
      selectedDocumentTitle: '',
      highlightReqId: null,
      navigateToDocId: null,
    }));
  };

  const handleBranchChange = (branchName: string) => {
    setState(prev => ({ ...prev, currentBranch: branchName }));
  };

  const handleNavigateToDocument = (docId: string, docTitle: string) => {
    setState(prev => ({
      ...prev,
      currentPage: 'requirements',
      selectedDocumentId: docId,
      selectedDocumentTitle: docTitle,
      highlightReqId: null,
      navigateToDocId: null,
    }));
  };

  const handleNavigateToRequirement = (documentId: string, requirementId: string) => {
    // Find the document title from API or use a placeholder
    setState(prev => ({
      ...prev,
      currentPage: 'requirements',
      selectedDocumentId: documentId,
      selectedDocumentTitle: prev.selectedDocumentTitle,
      highlightReqId: requirementId,
      navigateToDocId: documentId,
    }));
  };

  // When navigateToDocId is set, fetch the document title
  useEffect(() => {
    if (state.navigateToDocId && state.navigateToDocId !== state.selectedDocumentId) {
      // Document ID changed - need to fetch title
      // The RequirementsPage will handle this via its own loadData
    }
    if (state.navigateToDocId) {
      setState(prev => ({ ...prev, navigateToDocId: null }));
    }
  }, [state.navigateToDocId]);

  // Clear highlight after it's been consumed
  const handleClearHighlight = () => {
    setState(prev => ({ ...prev, highlightReqId: null }));
  };

  const renderPage = () => {
    switch (state.currentPage) {
      case 'documents':
        return <DocumentsPage onSelectDocument={handleSelectDocument} />;
      case 'requirements':
        return state.selectedDocumentId ? (
          <RequirementsPage
            documentId={state.selectedDocumentId}
            onBack={handleBackToDocuments}
            highlightReqId={state.highlightReqId ?? undefined}
            onClearHighlight={handleClearHighlight}
          />
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
        return state.selectedDocumentId ? (
          <TraceabilityPage
            documentId={state.selectedDocumentId}
            documentTitle={state.selectedDocumentTitle}
            onNavigateToRequirement={handleNavigateToRequirement}
          />
        ) : null;
      case 'audit':
        return <AuditLogPage documentId={state.selectedDocumentId ?? undefined} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <Navigation
        currentPage={state.currentPage}
        onNavigate={handleNavigate}
        selectedDocumentTitle={state.selectedDocumentTitle}
        currentBranch={state.currentBranch}
        onNavigateToDocument={handleNavigateToDocument}
      />
      <main className="flex-1 overflow-auto">
        {renderPage()}
      </main>
    </div>
  );
};

export default App;
