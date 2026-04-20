import React, { useState, useEffect } from 'react';
import Navigation from './components/Navigation';
import TitleBar from './components/TitleBar';
import DocumentsPage from './pages/DocumentsPage';
import RequirementsPage from './pages/RequirementsPage';
import HistoryPage from './pages/HistoryPage';
import BranchesPage from './pages/BranchesPage';
import ExportPage from './pages/ExportPage';
import SettingsPage from './pages/SettingsPage';
import DiffViewPage from './pages/DiffViewPage';
import TraceabilityPage from './pages/TraceabilityPage';
import AuditLogPage from './pages/AuditLogPage';
import DashboardPage from './pages/DashboardPage';
import type { RequirementFilter } from '../types/index';

export type Page = 'dashboard' | 'documents' | 'requirements' | 'history' | 'branches' | 'export' | 'settings' | 'diff' | 'traceability' | 'audit';

const EMPTY_FILTER: RequirementFilter = {
  title: '',
  description: '',
  status: '',
  priority: '',
  verification: '',
  tags: '',
};

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
    currentPage: 'dashboard',
    selectedDocumentId: null,
    selectedDocumentTitle: '',
    currentBranch: 'main',
    highlightReqId: null,
    navigateToDocId: null,
  });

  // Shared filter state — persists while viewing a document
  const [requirementFilter, setRequirementFilter] = useState<RequirementFilter>(EMPTY_FILTER);

  const isFilterActive =
    requirementFilter.title.trim().length > 0 ||
    requirementFilter.description.trim().length > 0 ||
    requirementFilter.status.trim().length > 0 ||
    requirementFilter.priority.trim().length > 0 ||
    requirementFilter.verification.trim().length > 0 ||
    requirementFilter.tags.trim().length > 0;

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
    // Clear filter when switching documents
    setRequirementFilter(EMPTY_FILTER);
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
    setRequirementFilter(EMPTY_FILTER);
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
    setRequirementFilter(EMPTY_FILTER);
  };

  const handleNavigateToRequirement = (documentId: string, requirementId: string) => {
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
      case 'dashboard':
        return (
          <DashboardPage
            onSelectDocument={handleSelectDocument}
            onNavigate={(page) => handleNavigate(page as Page)}
          />
        );
      case 'documents':
        return <DocumentsPage onSelectDocument={handleSelectDocument} />;
      case 'requirements':
        return state.selectedDocumentId ? (
          <RequirementsPage
            documentId={state.selectedDocumentId}
            onBack={handleBackToDocuments}
            highlightReqId={state.highlightReqId ?? undefined}
            onClearHighlight={handleClearHighlight}
            filter={requirementFilter}
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
            filter={requirementFilter}
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
      <TitleBar title="DocTrack" />
      <Navigation
        currentPage={state.currentPage}
        onNavigate={handleNavigate}
        selectedDocumentTitle={state.selectedDocumentTitle}
        selectedDocumentId={state.selectedDocumentId}
        currentBranch={state.currentBranch}
        onNavigateToDocument={handleNavigateToDocument}
        requirementFilter={requirementFilter}
        onFilterChange={setRequirementFilter}
        isFilterActive={isFilterActive}
      />
      <main className="flex-1 overflow-auto">
        {renderPage()}
      </main>
    </div>
  );
};

export default App;
