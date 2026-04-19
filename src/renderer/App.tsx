import React, { useState } from 'react';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Box,
  AppBar,
  Toolbar,
  Typography,
} from '@mui/material';
import Navigation from './components/Navigation';
import DocumentsPage from './pages/DocumentsPage';
import RequirementsPage from './pages/RequirementsPage';
import HistoryPage from './pages/HistoryPage';
import BranchesPage from './pages/BranchesPage';
import ExportPage from './pages/ExportPage';
import SettingsPage from './pages/SettingsPage';
import DiffViewPage from './pages/DiffViewPage';
import TraceabilityPage from './pages/TraceabilityPage';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#fafafa',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
  },
});

export type Page = 'documents' | 'requirements' | 'history' | 'branches' | 'export' | 'settings' | 'diff' | 'traceability';

interface AppState {
  currentPage: Page;
  selectedDocumentId: string | null;
  selectedDocumentTitle: string;
  currentBranch: string;
}

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>({
    currentPage: 'documents',
    selectedDocumentId: null,
    selectedDocumentTitle: '',
    currentBranch: 'main',
  });

  const handleNavigate = (page: Page, documentId?: string, documentTitle?: string) => {
    setAppState({
      currentPage: page,
      selectedDocumentId: documentId || appState.selectedDocumentId,
      selectedDocumentTitle: documentTitle || appState.selectedDocumentTitle,
      currentBranch: appState.currentBranch,
    });
  };

  const handleSelectDocument = (id: string, title: string) => {
    setAppState({
      currentPage: 'requirements',
      selectedDocumentId: id,
      selectedDocumentTitle: title,
      currentBranch: 'main',
    });
  };

  const handleBranchChange = (branchName: string) => {
    setAppState(prev => ({ ...prev, currentBranch: branchName }));
  };

  const renderPage = () => {
    switch (appState.currentPage) {
      case 'documents':
        return <DocumentsPage onSelectDocument={handleSelectDocument} />;
      case 'requirements':
        return appState.selectedDocumentId ? (
          <RequirementsPage
            documentId={appState.selectedDocumentId}
            onBack={() => handleNavigate('documents')}
          />
        ) : null;
      case 'history':
        return appState.selectedDocumentId ? (
          <HistoryPage
            documentId={appState.selectedDocumentId}
            documentTitle={appState.selectedDocumentTitle}
          />
        ) : null;
      case 'branches':
        return appState.selectedDocumentId ? (
          <BranchesPage
            documentId={appState.selectedDocumentId}
            documentTitle={appState.selectedDocumentTitle}
            currentBranch={appState.currentBranch}
            onBranchChange={handleBranchChange}
          />
        ) : null;
      case 'export':
        return appState.selectedDocumentId ? (
          <ExportPage
            documentId={appState.selectedDocumentId}
            documentTitle={appState.selectedDocumentTitle}
          />
        ) : null;
      case 'settings':
        return <SettingsPage />;
      case 'diff':
        return appState.selectedDocumentId ? (
          <DiffViewPage
            documentId={appState.selectedDocumentId}
            documentTitle={appState.selectedDocumentTitle}
          />
        ) : null;
      case 'traceability':
        return appState.selectedDocumentId ? (
          <TraceabilityPage
            documentId={appState.selectedDocumentId}
            documentTitle={appState.selectedDocumentTitle}
          />
        ) : null;
      default:
        return null;
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        {/* Sidebar */}
        <Navigation
          currentPage={appState.currentPage}
          onNavigate={handleNavigate}
          selectedDocumentTitle={appState.selectedDocumentTitle || undefined}
          currentBranch={appState.currentBranch}
        />

        {/* Main Content */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Top Bar */}
          <AppBar position="static" color="default" elevation={1} sx={{ bgcolor: '#fff' }}>
            <Toolbar variant="dense">
              <Typography variant="body2" color="textSecondary" sx={{ flex: 1 }}>
                {appState.selectedDocumentTitle && appState.currentPage !== 'documents'
                  ? `${appState.selectedDocumentTitle} — ${appState.currentPage.charAt(0).toUpperCase() + appState.currentPage.slice(1)}`
                  : 'DocTrack Requirements Tracker'}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Branch: {appState.currentBranch}
              </Typography>
            </Toolbar>
          </AppBar>

          {/* Page Content */}
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {renderPage()}
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default App;
