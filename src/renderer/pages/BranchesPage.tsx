import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Button,
  TextField,
  Dialog,
  Stack,
  IconButton,
  Tooltip,
  Divider,
  Alert,
} from '@mui/material';
import {
  CallSplit as BranchIcon,
  Add as AddIcon,
  Merge as MergeIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import * as API from '../../api/api';

interface BranchesPageProps {
  documentId: string;
  documentTitle: string;
  currentBranch: string;
  onBranchChange: (branchName: string) => void;
}

const BranchesPage: React.FC<BranchesPageProps> = ({ documentId, documentTitle, currentBranch, onBranchChange }) => {
  const [branches, setBranches] = useState<any[]>([]);
  const [openBranchDialog, setOpenBranchDialog] = useState(false);
  const [openMergeDialog, setOpenMergeDialog] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchDesc, setNewBranchDesc] = useState('');
  const [sourceBranch, setSourceBranch] = useState('');
  const [targetBranch, setTargetBranch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadBranches();
  }, [documentId]);

  const loadBranches = async () => {
    try {
      const result = await API.getBranches(documentId);
      if (result.success) setBranches(result.data || []);
    } catch (error) {
      console.error('Failed to load branches:', error);
    }
  };

  const handleCreateBranch = async () => {
    try {
      const result = await API.createBranch(documentId, {
        name: newBranchName,
        description: newBranchDesc,
        createdBy: 'system',
      });
      if (result.success) {
        setOpenBranchDialog(false);
        setNewBranchName('');
        setNewBranchDesc('');
        loadBranches();
      } else {
        setError(result.error || 'Failed to create branch');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to create branch');
    }
  };

  const handleCheckoutBranch = async (branchName: string) => {
    try {
      const result = await API.checkoutBranch(documentId, branchName);
      if (result.success) {
        onBranchChange(branchName);
        loadBranches();
      }
    } catch (error) {
      console.error('Failed to checkout branch:', error);
    }
  };

  const handleMergeBranch = async () => {
    try {
      const result = await API.mergeBranch(documentId, {
        sourceBranch,
        targetBranch,
        author: 'system',
      });
      if (result.success) {
        setOpenMergeDialog(false);
        setSourceBranch('');
        setTargetBranch('');
        loadBranches();
      } else {
        setError(result.error || 'Merge failed');
      }
    } catch (error: any) {
      setError(error.message || 'Merge failed');
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 900 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BranchIcon color="primary" />
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Branches
          </Typography>
          <Chip label={documentTitle} size="small" variant="outlined" />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={loadBranches} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="outlined"
            startIcon={<MergeIcon />}
            size="small"
            onClick={() => setOpenMergeDialog(true)}
          >
            Merge
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            size="small"
            onClick={() => setOpenBranchDialog(true)}
          >
            New Branch
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Paper>
        {branches.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <BranchIcon sx={{ fontSize: 48, color: '#ccc', mb: 1 }} />
            <Typography color="textSecondary">No branches yet</Typography>
          </Box>
        ) : (
          <List>
            {branches.map((branch, index) => (
              <React.Fragment key={branch.id}>
                <ListItem
                  sx={{ py: 1.5, cursor: 'pointer' }}
                  onClick={() => handleCheckoutBranch(branch.name)}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {branch.name === currentBranch ? (
                      <CheckIcon sx={{ color: '#4caf50' }} />
                    ) : (
                      <BranchIcon sx={{ color: '#999' }} />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: branch.name === currentBranch ? 600 : 400 }}>
                          {branch.name}
                        </Typography>
                        {branch.name === currentBranch && (
                          <Chip label="current" size="small" color="success" sx={{ height: 18, fontSize: '0.65rem' }} />
                        )}
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" color="textSecondary">
                        {branch.description || 'No description'} · Created by {branch.createdBy} · {new Date(branch.createdAt).toLocaleDateString()}
                      </Typography>
                    }
                  />
                </ListItem>
                {index < branches.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </Paper>

      {/* Create Branch Dialog */}
      <Dialog open={openBranchDialog} onClose={() => setOpenBranchDialog(false)} maxWidth="sm" fullWidth>
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Create Branch</Typography>
          <Stack spacing={2}>
            <TextField
              label="Branch Name"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              fullWidth
              required
              placeholder="e.g., feature/new-requirements"
            />
            <TextField
              label="Description"
              value={newBranchDesc}
              onChange={(e) => setNewBranchDesc(e.target.value)}
              fullWidth
              multiline
              rows={2}
            />
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button onClick={() => setOpenBranchDialog(false)}>Cancel</Button>
              <Button variant="contained" onClick={handleCreateBranch} disabled={!newBranchName}>
                Create
              </Button>
            </Box>
          </Stack>
        </Box>
      </Dialog>

      {/* Merge Dialog */}
      <Dialog open={openMergeDialog} onClose={() => setOpenMergeDialog(false)} maxWidth="sm" fullWidth>
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Merge Branches</Typography>
          <Stack spacing={2}>
            <TextField
              label="Source Branch"
              value={sourceBranch}
              onChange={(e) => setSourceBranch(e.target.value)}
              fullWidth
              required
              placeholder="Branch to merge from"
            />
            <TextField
              label="Target Branch"
              value={targetBranch}
              onChange={(e) => setTargetBranch(e.target.value)}
              fullWidth
              required
              placeholder="Branch to merge into"
            />
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button onClick={() => setOpenMergeDialog(false)}>Cancel</Button>
              <Button variant="contained" onClick={handleMergeBranch} disabled={!sourceBranch || !targetBranch}>
                Merge
              </Button>
            </Box>
          </Stack>
        </Box>
      </Dialog>
    </Box>
  );
};

export default BranchesPage;
