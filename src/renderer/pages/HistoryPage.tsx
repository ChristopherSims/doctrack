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
} from '@mui/material';
import {
  History as HistoryIcon,
  Commit as CommitIcon,
  Add as AddIcon,
  Tag as TagIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import * as API from '../../api/api';

interface HistoryPageProps {
  documentId: string;
  documentTitle: string;
}

const HistoryPage: React.FC<HistoryPageProps> = ({ documentId, documentTitle }) => {
  const [commits, setCommits] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [openCommitDialog, setOpenCommitDialog] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [commitAuthor, setCommitAuthor] = useState('system');

  useEffect(() => {
    loadHistory();
  }, [documentId]);

  const loadHistory = async () => {
    try {
      const [commitResult, tagResult] = await Promise.all([
        API.getCommits(documentId),
        API.getTags(documentId),
      ]);
      if (commitResult.success) setCommits(commitResult.data || []);
      if (tagResult.success) setTags(tagResult.data || []);
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const handleCreateCommit = async () => {
    try {
      const result = await API.createCommit(documentId, {
        message: commitMessage,
        author: commitAuthor,
      });
      if (result.success) {
        setOpenCommitDialog(false);
        setCommitMessage('');
        loadHistory();
      }
    } catch (error) {
      console.error('Failed to create commit:', error);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 900 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HistoryIcon color="primary" />
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Version History
          </Typography>
          <Chip label={documentTitle} size="small" variant="outlined" />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={loadHistory} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            size="small"
            onClick={() => setOpenCommitDialog(true)}
          >
            New Commit
          </Button>
        </Box>
      </Box>

      {/* Tags Section */}
      {tags.length > 0 && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            <TagIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} /> Tags
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {tags.map((tag) => (
              <Chip
                key={tag.id}
                label={`${tag.name} (${tag.commitId?.substring(0, 8)})`}
                size="small"
                color="primary"
                variant="outlined"
              />
            ))}
          </Box>
        </Paper>
      )}

      {/* Commits List */}
      <Paper>
        {commits.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <HistoryIcon sx={{ fontSize: 48, color: '#ccc', mb: 1 }} />
            <Typography color="textSecondary">No commits yet</Typography>
            <Typography variant="body2" color="textSecondary">
              Create a commit to snapshot the current state of your requirements
            </Typography>
          </Box>
        ) : (
          <List>
            {commits.map((commit, index) => (
              <React.Fragment key={commit.id}>
                <ListItem sx={{ py: 1.5 }}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <CommitIcon sx={{ color: index === 0 ? '#1976d2' : '#999' }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: index === 0 ? 600 : 400 }}>
                          {commit.message}
                        </Typography>
                        {index === 0 && <Chip label="latest" size="small" color="primary" sx={{ height: 20 }} />}
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" color="textSecondary">
                        {commit.author} · {commit.branchName} · {new Date(commit.createdAt).toLocaleString()}
                      </Typography>
                    }
                  />
                  <Chip
                    label={commit.id?.substring(0, 8)}
                    size="small"
                    variant="outlined"
                    sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}
                  />
                </ListItem>
                {index < commits.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </Paper>

      {/* Create Commit Dialog */}
      <Dialog open={openCommitDialog} onClose={() => setOpenCommitDialog(false)} maxWidth="sm" fullWidth>
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Create Commit</Typography>
          <Stack spacing={2}>
            <TextField
              label="Commit Message"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              fullWidth
              required
              placeholder="Describe the changes in this commit"
            />
            <TextField
              label="Author"
              value={commitAuthor}
              onChange={(e) => setCommitAuthor(e.target.value)}
              fullWidth
            />
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button onClick={() => setOpenCommitDialog(false)}>Cancel</Button>
              <Button variant="contained" onClick={handleCreateCommit} disabled={!commitMessage}>
                Commit
              </Button>
            </Box>
          </Stack>
        </Box>
      </Dialog>
    </Box>
  );
};

export default HistoryPage;
