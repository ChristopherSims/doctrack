import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Select,
  MenuItem,
  Button,
  Chip,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Alert,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  CompareArrows as CompareArrowsIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import * as API from '../../api/api';

interface DiffViewPageProps {
  documentId: string;
  documentTitle: string;
}

interface ModifiedRequirement {
  id: string;
  field: string;
  oldValue: string;
  newValue: string;
}

interface DiffResult {
  added: any[];
  removed: any[];
  modified: ModifiedRequirement[];
}

const DiffViewPage: React.FC<DiffViewPageProps> = ({ documentId, documentTitle }) => {
  const [commits, setCommits] = useState<any[]>([]);
  const [commit1, setCommit1] = useState<string>('');
  const [commit2, setCommit2] = useState<string>('');
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadCommits();
  }, [documentId]);

  const loadCommits = async () => {
    try {
      const result = await API.getCommits(documentId);
      if (result.success) {
        setCommits(result.data || []);
      }
    } catch (err) {
      console.error('Failed to load commits:', err);
    }
  };

  const handleCompare = async () => {
    if (!commit1 || !commit2) {
      setError('Please select two commits to compare.');
      return;
    }
    if (commit1 === commit2) {
      setError('Please select two different commits.');
      return;
    }

    setLoading(true);
    setError('');
    setDiffResult(null);

    try {
      const result = await API.diffCommits(commit1, commit2);
      if (result.success) {
        setDiffResult(result.data || { added: [], removed: [], modified: [] });
      } else {
        setError(result.error || 'Failed to compute diff.');
      }
    } catch (err) {
      setError('An error occurred while comparing commits.');
      console.error('Diff error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getCommitLabel = (commit: any) => {
    const shortId = commit.id?.substring(0, 8) || 'unknown';
    const date = commit.createdAt ? new Date(commit.createdAt).toLocaleDateString() : '';
    return `${shortId} — ${commit.message || 'No message'} (${date})`;
  };

  const getShortId = (id: string) => id?.substring(0, 8) || id;

  const totalChanges = diffResult
    ? diffResult.added.length + diffResult.removed.length + diffResult.modified.length
    : 0;

  return (
    <Box sx={{ p: 3, maxWidth: 1200 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CompareArrowsIcon color="primary" />
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Diff View
          </Typography>
          <Chip label={documentTitle} size="small" variant="outlined" />
        </Box>
        <Button
          size="small"
          startIcon={<RefreshIcon />}
          onClick={loadCommits}
        >
          Refresh
        </Button>
      </Box>

      {/* Commit Selectors */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
          Select Commits to Compare
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <FormControl sx={{ minWidth: 300 }} size="small">
            <InputLabel>Commit 1 (Base)</InputLabel>
            <Select
              value={commit1}
              label="Commit 1 (Base)"
              onChange={(e) => setCommit1(e.target.value)}
            >
              {commits.map((commit) => (
                <MenuItem key={commit.id} value={commit.id}>
                  {getCommitLabel(commit)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <CompareArrowsIcon sx={{ color: '#999' }} />

          <FormControl sx={{ minWidth: 300 }} size="small">
            <InputLabel>Commit 2 (Compare)</InputLabel>
            <Select
              value={commit2}
              label="Commit 2 (Compare)"
              onChange={(e) => setCommit2(e.target.value)}
            >
              {commits.map((commit) => (
                <MenuItem key={commit.id} value={commit.id}>
                  {getCommitLabel(commit)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="contained"
            startIcon={<CompareArrowsIcon />}
            onClick={handleCompare}
            disabled={!commit1 || !commit2 || loading}
          >
            {loading ? 'Comparing...' : 'Compare'}
          </Button>
        </Box>
      </Paper>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Diff Results */}
      {diffResult && (
        <Box>
          {/* Summary */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Chip label={`${diffResult.added.length} Added`} color="success" size="small" />
            <Chip label={`${diffResult.removed.length} Removed`} color="error" size="small" />
            <Chip label={`${diffResult.modified.length} Modified`} color="warning" size="small" />
            <Chip label={`${totalChanges} Total Changes`} variant="outlined" size="small" />
          </Box>

          {totalChanges === 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              No differences found between the selected commits.
            </Alert>
          )}

          {/* Added Requirements */}
          {diffResult.added.length > 0 && (
            <Paper sx={{ mb: 2 }}>
              <Box sx={{ p: 2, bgcolor: '#e8f5e9', borderRadius: '4px 4px 0 0' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#2e7d32' }}>
                  Added Requirements ({diffResult.added.length})
                </Typography>
              </Box>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>ID</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Title</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Priority</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {diffResult.added.map((req) => (
                    <TableRow key={req.id} sx={{ bgcolor: '#e8f5e9' }}>
                      <TableCell>
                        <Chip label={getShortId(req.id)} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }} />
                      </TableCell>
                      <TableCell>{req.title}</TableCell>
                      <TableCell>{req.priority || '—'}</TableCell>
                      <TableCell>{req.status || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}

          {/* Removed Requirements */}
          {diffResult.removed.length > 0 && (
            <Paper sx={{ mb: 2 }}>
              <Box sx={{ p: 2, bgcolor: '#ffebee', borderRadius: '4px 4px 0 0' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#c62828' }}>
                  Removed Requirements ({diffResult.removed.length})
                </Typography>
              </Box>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>ID</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Title</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Priority</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {diffResult.removed.map((req) => (
                    <TableRow key={req.id} sx={{ bgcolor: '#ffebee' }}>
                      <TableCell>
                        <Chip label={getShortId(req.id)} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }} />
                      </TableCell>
                      <TableCell>{req.title}</TableCell>
                      <TableCell>{req.priority || '—'}</TableCell>
                      <TableCell>{req.status || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}

          {/* Modified Requirements */}
          {diffResult.modified.length > 0 && (
            <Paper sx={{ mb: 2 }}>
              <Box sx={{ p: 2, bgcolor: '#fff8e1', borderRadius: '4px 4px 0 0' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#f57f17' }}>
                  Modified Requirements ({diffResult.modified.length})
                </Typography>
              </Box>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Requirement ID</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Field</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Old Value</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>New Value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {diffResult.modified.map((mod, index) => (
                    <TableRow key={`${mod.id}-${mod.field}-${index}`} sx={{ bgcolor: '#fff8e1' }}>
                      <TableCell>
                        <Chip label={getShortId(mod.id)} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }} />
                      </TableCell>
                      <TableCell>
                        <Chip label={mod.field} size="small" color="warning" variant="outlined" />
                      </TableCell>
                      <TableCell sx={{ color: '#c62828', textDecoration: 'line-through', opacity: 0.7 }}>
                        {mod.oldValue || '—'}
                      </TableCell>
                      <TableCell sx={{ color: '#2e7d32', fontWeight: 600 }}>
                        {mod.newValue || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}
        </Box>
      )}

      {/* No commits available */}
      {commits.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <CompareArrowsIcon sx={{ fontSize: 48, color: '#ccc', mb: 1 }} />
          <Typography color="textSecondary">No commits available</Typography>
          <Typography variant="body2" color="textSecondary">
            Create commits in the History page before comparing versions.
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default DiffViewPage;
