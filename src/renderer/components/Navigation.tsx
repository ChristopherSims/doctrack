import React from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Box,
  Typography,
  Divider,
} from '@mui/material';
import {
  Description as DescriptionIcon,
  Settings as SettingsIcon,
  Article as FileDocumentIcon,
} from '@mui/icons-material';
import type { Page } from '../App';

interface NavigationProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  selectedDocumentTitle?: string;
}

const Navigation: React.FC<NavigationProps> = ({ currentPage, onNavigate }) => {
  const drawerWidth = 280;

  const menuItems = [
    { label: 'Documents', icon: <DescriptionIcon />, page: 'documents' as Page },
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
          backgroundColor: '#f5f5f5',
        },
      }}
      variant="permanent"
      anchor="left"
    >
      <Toolbar>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FileDocumentIcon sx={{ color: '#1976d2', fontSize: 28 }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            DocTrack
          </Typography>
        </Box>
      </Toolbar>

      <Divider />

      <List sx={{ flex: 1 }}>
        {menuItems.map((item) => (
          <ListItem
            button
            key={item.page}
            onClick={() => onNavigate(item.page)}
            selected={currentPage === item.page}
            sx={{
              backgroundColor: currentPage === item.page ? '#e3f2fd' : 'transparent',
              '&:hover': {
                backgroundColor: currentPage === item.page ? '#e3f2fd' : '#f0f0f0',
              },
            }}
          >
            <ListItemIcon sx={{ color: currentPage === item.page ? '#1976d2' : 'inherit' }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItem>
        ))}
      </List>

      <Divider />

      <Box sx={{ p: 2, color: '#666', fontSize: '0.75rem' }}>
        <Typography variant="caption">v0.1.0</Typography>
        <Typography variant="caption" display="block">
          Requirements Tracker
        </Typography>
      </Box>
    </Drawer>
  );
};

export default Navigation;
