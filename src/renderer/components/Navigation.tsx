import React from 'react';
import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Box,
  Typography,
  Divider,
  Chip,
} from '@mui/material';
import {
  Description as DescriptionIcon,
  Settings as SettingsIcon,
  Article as FileDocumentIcon,
  History as HistoryIcon,
  CallSplit as BranchIcon,
  FileDownload as ExportIcon,
} from '@mui/icons-material';
import type { Page } from '../App';

interface NavigationProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  selectedDocumentTitle?: string;
  currentBranch?: string;
}

const Navigation: React.FC<NavigationProps> = ({ currentPage, onNavigate, selectedDocumentTitle, currentBranch }) => {
  const drawerWidth = 240;

  const menuItems = [
    { label: 'Documents', icon: <DescriptionIcon />, page: 'documents' as Page },
  ];

  const documentMenuItems = selectedDocumentTitle ? [
    { label: 'History', icon: <HistoryIcon />, page: 'history' as Page },
    { label: 'Branches', icon: <BranchIcon />, page: 'branches' as Page },
    { label: 'Export', icon: <ExportIcon />, page: 'export' as Page },
  ] : [];

  const globalMenuItems = [
    { label: 'Settings', icon: <SettingsIcon />, page: 'settings' as Page },
  ];

  return (
    <Drawer
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          backgroundColor: '#fafafa',
          borderRight: '1px solid #e0e0e0',
        },
      }}
      variant="permanent"
      anchor="left"
    >
      <Toolbar sx={{ px: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FileDocumentIcon sx={{ color: '#1976d2', fontSize: 28 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
            DocTrack
          </Typography>
        </Box>
      </Toolbar>

      <Divider />

      <List sx={{ flex: 1, pt: 1 }}>
        {menuItems.map((item) => (
          <ListItemButton
            key={item.page}
            onClick={() => onNavigate(item.page)}
            selected={currentPage === item.page}
            sx={{
              mx: 1,
              borderRadius: 1,
              mb: 0.5,
              '&.Mui-selected': {
                backgroundColor: '#e3f2fd',
                '&:hover': { backgroundColor: '#bbdefb' },
              },
              '&:hover': { backgroundColor: '#f0f0f0' },
            }}
          >
            <ListItemIcon sx={{ color: currentPage === item.page ? '#1976d2' : '#666', minWidth: 36 }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: '0.9rem' }} />
          </ListItemButton>
        ))}

        {selectedDocumentTitle && (
          <>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ px: 2, py: 0.5 }}>
              <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {selectedDocumentTitle}
              </Typography>
              {currentBranch && (
                <Chip label={currentBranch} size="small" sx={{ ml: 1, height: 18, fontSize: '0.65rem' }} />
              )}
            </Box>
            {documentMenuItems.map((item) => (
              <ListItemButton
                key={item.page}
                onClick={() => onNavigate(item.page)}
                selected={currentPage === item.page}
                sx={{
                  mx: 1,
                  borderRadius: 1,
                  mb: 0.5,
                  '&.Mui-selected': {
                    backgroundColor: '#e3f2fd',
                    '&:hover': { backgroundColor: '#bbdefb' },
                  },
                  '&:hover': { backgroundColor: '#f0f0f0' },
                }}
              >
                <ListItemIcon sx={{ color: currentPage === item.page ? '#1976d2' : '#666', minWidth: 36 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: '0.9rem' }} />
              </ListItemButton>
            ))}
          </>
        )}

        <Divider sx={{ my: 1 }} />

        {globalMenuItems.map((item) => (
          <ListItemButton
            key={item.page}
            onClick={() => onNavigate(item.page)}
            selected={currentPage === item.page}
            sx={{
              mx: 1,
              borderRadius: 1,
              mb: 0.5,
              '&.Mui-selected': {
                backgroundColor: '#e3f2fd',
                '&:hover': { backgroundColor: '#bbdefb' },
              },
              '&:hover': { backgroundColor: '#f0f0f0' },
            }}
          >
            <ListItemIcon sx={{ color: currentPage === item.page ? '#1976d2' : '#666', minWidth: 36 }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: '0.9rem' }} />
          </ListItemButton>
        ))}
      </List>

      <Divider />
      <Box sx={{ p: 2, color: '#999' }}>
        <Typography variant="caption" display="block">v0.1.0</Typography>
        <Typography variant="caption" display="block">Requirements Tracker</Typography>
      </Box>
    </Drawer>
  );
};

export default Navigation;
