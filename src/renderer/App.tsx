import React, { useState } from 'react';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Box,
  Container,
  AppBar,
  Toolbar,
  Typography,
  Button,
  Menu,
  MenuItem,
} from '@mui/material';
import DocumentsPage from './pages/DocumentsPage';
import RequirementsPage from './pages/RequirementsPage';

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

export type Page = 'documents' | 'requirements' | 'settings';

interface AppState {
  currentPage: Page;
  selectedDocumentId: string | null;
}

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>({
    currentPage: 'documents',
    selectedDocumentId: null,
  });
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const handleNavigate = (page: Page, documentId?: string) => {
    setAppState({
      currentPage: page,
      selectedDocumentId: documentId || null,
    });
  };

  const renderPage = () => {
    switch (appState.currentPage) {
      case 'documents':
        return <DocumentsPage onSelectDocument={(id: string) => handleNavigate('requirements', id)} />;
      case 'requirements':
        return appState.selectedDocumentId ? (
          <RequirementsPage 
            documentId={appState.selectedDocumentId}
            onBack={() => handleNavigate('documents')}
          />
        ) : null;
      case 'settings':
        return <Container>Settings Page - Coming Soon</Container>;
      default:
        return null;
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* Top Application Menu Bar */}
        <AppBar position="static" sx={{ bgcolor: '#1976d2' }}>
          <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              DocTrack
            </Typography>
            <Box>
              <Button
                color="inherit"
                onClick={(e) => setMenuAnchor(e.currentTarget)}
                sx={{ textTransform: 'none', fontSize: '1rem' }}
              >
                ☰ Menu
              </Button>
              <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={() => setMenuAnchor(null)}
              >
                <MenuItem onClick={() => setMenuAnchor(null)}>
                  Documents
                </MenuItem>
                <MenuItem onClick={() => setMenuAnchor(null)}>
                  Settings
                </MenuItem>
              </Menu>
            </Box>
          </Toolbar>
        </AppBar>

        {/* Page Content */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {renderPage()}
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default App;
