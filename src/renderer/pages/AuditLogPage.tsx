import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Select,
  MenuItem,
  Button,
  Chip,
  Collapse,
  IconButton,
  Stack,
  InputLabel,
  FormControl,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  FilterAlt as FilterIcon,
} from '@mui/icons-material';
import * as API from '../../api/api';
import type { AuditLogEntry } from '../../types';

interface AuditLogPageProps {
  documentId?: string;
}

const AuditLogPage: React.FC<AuditLogPageProps> = ({ documentId }) => {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchText, setSearchText] = useState<string>('');
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Expanded rows (by entry id)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const fetchAuditLog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await API.getAuditLog(documentId);
      if (response.success && response.data) {
        setEntries(response.data as AuditLogEntry[]);
      } else {
        setError(response.error || 'Failed to load audit log');
      }
    } catch (err) {
      setError('Network error loading audit log');
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    fetchAuditLog();
  }, [fetchAuditLog]);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Collect unique resource types from data for the filter dropdown
  const resourceTypes = Array.from(new Set(entries.map(e => e.resourceType))).sort();

  // Apply filters
  const filteredEntries = entries.filter(entry => {
    // Text search across action, actorName, resourceId
    if (searchText) {
      const q = searchText.toLowerCase();
      const matches =
        entry.action.toLowerCase().includes(q) ||
        entry.actorName.toLowerCase().includes(q) ||
        entry.resourceId.toLowerCase().includes(q);
      if (!matches) return false;
    }

    // Resource type filter
    if (resourceTypeFilter !== 'all' && entry.resourceType !== resourceTypeFilter) {
      return false;
    }

    // Date range filter
    if (dateFrom) {
      const entryDate = new Date(entry.timestamp);
      const from = new Date(dateFrom);
      if (entryDate < from) return false;
    }
    if (dateTo) {
      const entryDate = new Date(entry.timestamp);
      const to = new Date(dateTo);
      // Include the entire end day
      to.setHours(23, 59, 59, 999);
      if (entryDate > to) return false;
    }

    return true;
  });

  const formatTimestamp = (ts: string) => {
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  };

  const getApprovalStatusChip = (status: string) => {
    switch (status) {
      case 'approved':
        return <Chip label="Approved" color="success" size="small" />;
      case 'pending':
        return <Chip label="Pending" color="warning" size="small" />;
      case 'rejected':
        return <Chip label="Rejected" color="error" size="small" />;
      default:
        return <Chip label={status || 'N/A'} size="small" variant="outlined" />;
    }
  };

  const clearFilters = () => {
    setSearchText('');
    setResourceTypeFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5">
          {documentId ? 'Document Audit Log' : 'Audit Log'}
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchAuditLog}
          disabled={loading}
        >
          Refresh
        </Button>
      </Stack>

      {documentId && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Showing audit log entries for document: {documentId}
        </Alert>
      )}

      {/* Filter Controls */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          <FilterIcon color="action" />
          <TextField
            label="Search"
            size="small"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="Search action, actor, resource..."
            sx={{ minWidth: 220 }}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Resource Type</InputLabel>
            <Select
              value={resourceTypeFilter}
              label="Resource Type"
              onChange={e => setResourceTypeFilter(e.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
              {resourceTypes.map(rt => (
                <MenuItem key={rt} value={rt}>
                  {rt}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="From"
            type="date"
            size="small"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="To"
            type="date"
            size="small"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <Button size="small" onClick={clearFilters}>
            Clear Filters
          </Button>
        </Stack>
      </Paper>

      {/* Error State */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Table */}
      {!loading && !error && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Timestamp</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Action</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Actor</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Resource Type</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Resource ID</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Approval Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography color="textSecondary">
                      No audit log entries found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredEntries.map(entry => (
                  <React.Fragment key={entry.id}>
                    <TableRow hover>
                      <TableCell>{formatTimestamp(entry.timestamp)}</TableCell>
                      <TableCell>
                        <Chip label={entry.action} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {entry.actorName}
                          {entry.actorType && (
                            <Typography
                              component="span"
                              variant="caption"
                              color="textSecondary"
                              sx={{ ml: 0.5 }}
                            >
                              ({entry.actorType})
                            </Typography>
                          )}
                        </Typography>
                      </TableCell>
                      <TableCell>{entry.resourceType}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                          {entry.resourceId}
                        </Typography>
                      </TableCell>
                      <TableCell>{getApprovalStatusChip(entry.approvalStatus)}</TableCell>
                      <TableCell>
                        {entry.changeDetails ? (
                          <IconButton
                            size="small"
                            onClick={() => toggleRow(entry.id)}
                            aria-label="Toggle details"
                          >
                            {expandedRows.has(entry.id) ? (
                              <ExpandLessIcon />
                            ) : (
                              <ExpandMoreIcon />
                            )}
                          </IconButton>
                        ) : (
                          <Typography variant="caption" color="textSecondary">
                            None
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={7} sx={{ py: 0, border: 0 }}>
                        <Collapse
                          in={expandedRows.has(entry.id)}
                          timeout="auto"
                          unmountOnExit
                        >
                          <Paper
                            variant="outlined"
                            sx={{ m: 1, p: 2, bgcolor: '#f5f5f5', maxHeight: 300, overflow: 'auto' }}
                          >
                            <Typography variant="caption" color="textSecondary" sx={{ mb: 1, display: 'block' }}>
                              Change Details
                            </Typography>
                            <pre style={{ margin: 0, fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>
                              {JSON.stringify(entry.changeDetails, null, 2)}
                            </pre>
                            {entry.reason && (
                              <Box sx={{ mt: 1 }}>
                                <Typography variant="caption" color="textSecondary">Reason: </Typography>
                                <Typography variant="body2">{entry.reason}</Typography>
                              </Box>
                            )}
                            {entry.approvedBy && (
                              <Box sx={{ mt: 0.5 }}>
                                <Typography variant="caption" color="textSecondary">Approved By: </Typography>
                                <Typography variant="body2">{entry.approvedBy}</Typography>
                              </Box>
                            )}
                            {entry.aiAgentModel && (
                              <Box sx={{ mt: 0.5 }}>
                                <Typography variant="caption" color="textSecondary">AI Model: </Typography>
                                <Typography variant="body2">{entry.aiAgentModel}</Typography>
                              </Box>
                            )}
                          </Paper>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Result count */}
      {!loading && !error && entries.length > 0 && (
        <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
          Showing {filteredEntries.length} of {entries.length} entries
        </Typography>
      )}
    </Box>
  );
};

export default AuditLogPage;
