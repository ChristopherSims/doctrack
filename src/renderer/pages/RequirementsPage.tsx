import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  Dialog,
  TextField,
  Stack,
  Chip,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Paper,
  Menu,
  Tooltip,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRowModel,
  GridToolbarQuickFilter,
  GridToolbarContainer,
  GridToolbarFilterButton,
  GridToolbarExport,
  GridRenderCellParams,
} from '@mui/x-data-grid';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import type { Requirement } from '../../types/index';
import * as API from '../../api/api';

interface RequirementsPageProps {
  documentId: string;
  onBack: () => void;
}

const STATUS_OPTIONS = ['draft', 'review', 'approved', 'implemented', 'verified'];
const PRIORITY_OPTIONS = ['low', 'medium', 'high'];
const VERIFICATION_OPTIONS = ['manual', 'unit_test', 'integration_test', 'code_review', 'inspection', 'analysis', 'demonstration'];

const getPriorityColor = (priority: string): 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' => {
  const colors: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success'> = {
    high: 'error',
    medium: 'warning',
    low: 'success',
  };
  return colors[priority] || 'default';
};

const getStatusColor = (status: string): 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' => {
  const colors: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success'> = {
    draft: 'default',
    review: 'warning',
    approved: 'success',
    implemented: 'primary',
    verified: 'info',
  };
  return colors[status] || 'default';
};

const RequirementsPage: React.FC<RequirementsPageProps> = ({ documentId, onBack }) => {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [documentTitle, setDocumentTitle] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingReq, setEditingReq] = useState<Requirement | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [dirtyRows, setDirtyRows] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number; rowId: string } | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'info',
  });
  const [openTraceability, setOpenTraceability] = useState(false);
  const [tracingReq, setTracingReq] = useState<Requirement | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [reqsForTrace, setReqsForTrace] = useState<Requirement[]>([]);
  const [selectedDocForTrace, setSelectedDocForTrace] = useState('');
  const [stats, setStats] = useState<{ total: number; byStatus: Record<string, number>; byPriority: Record<string, number> } | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium' as string,
    changeRequestId: '',
    changeRequestLink: '',
    testPlan: '',
    testPlanLink: '',
    verificationMethod: 'manual' as string,
    level: '1',
    rationale: '',
  });

  useEffect(() => {
    loadData();
  }, [documentId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const docResult = await API.getDocument(documentId);
      if (docResult.success) {
        setDocumentTitle(docResult.data?.title || '');
      }

      const reqResult = await API.getRequirements(documentId);
      if (reqResult.success) {
        setRequirements(reqResult.data || []);
      }

      const statsResult = await API.getDocumentStats(documentId);
      if (statsResult.success) {
        setStats(statsResult.data || null);
      }

      const allDocs = await API.getDocuments();
      if (allDocs.success) {
        setDocuments((allDocs.data || []).filter((d: any) => d.id !== documentId));
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRowUpdate = useCallback((newRow: GridRowModel, oldRow: GridRowModel) => {
    if (JSON.stringify(newRow) === JSON.stringify(oldRow)) {
      return oldRow;
    }
    setDirtyRows(prev => new Set(prev).add(newRow.id as string));
    setHasChanges(true);
    return newRow;
  }, []);

  const handleSaveAllChanges = async () => {
    try {
      const updates: Array<{ id: string; [key: string]: any }> = [];
      for (const reqId of dirtyRows) {
        const row = requirements.find(r => r.id === reqId);
        if (row) {
          updates.push({
            id: row.id,
            title: row.title,
            description: row.description,
            status: row.status,
            priority: row.priority,
            level: row.level,
            changeRequestId: row.changeRequestId || '',
            changeRequestLink: row.changeRequestLink || '',
            testPlan: row.testPlan || '',
            testPlanLink: row.testPlanLink || '',
            verificationMethod: row.verificationMethod || '',
            rationale: row.rationale || '',
          });
        }
      }

      if (updates.length > 0) {
        const result = await API.batchUpdateRequirements(updates);
        if (result.success) {
          setDirtyRows(new Set());
          setHasChanges(false);
          setSnackbar({ open: true, message: `${updates.length} requirement(s) saved`, severity: 'success' });
          await loadData();
        } else {
          setSnackbar({ open: true, message: 'Some updates failed', severity: 'error' });
        }
      }
    } catch (error) {
      console.error('Failed to save changes:', error);
      setSnackbar({ open: true, message: 'Failed to save changes', severity: 'error' });
    }
  };

  const handleOpenDialog = (req?: Requirement) => {
    if (req) {
      setEditingReq(req);
      setFormData({
        title: req.title,
        description: req.description,
        priority: req.priority,
        changeRequestId: req.changeRequestId || '',
        changeRequestLink: req.changeRequestLink || '',
        testPlan: req.testPlan || '',
        testPlanLink: req.testPlanLink || '',
        verificationMethod: req.verificationMethod || 'manual',
        level: req.level || '1',
        rationale: req.rationale || '',
      });
    } else {
      setEditingReq(null);
      setFormData({
        title: '',
        description: '',
        priority: 'medium',
        changeRequestId: '',
        changeRequestLink: '',
        testPlan: '',
        testPlanLink: '',
        verificationMethod: 'manual',
        level: '1',
        rationale: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingReq(null);
  };

  const handleSaveRequirement = async () => {
    try {
      if (editingReq) {
        const result = await API.updateRequirement(editingReq.id, {
          ...formData,
        });
        if (result.success) {
          setSnackbar({ open: true, message: 'Requirement updated', severity: 'success' });
          await loadData();
        }
      } else {
        const result = await API.createRequirement({
          documentId,
          ...formData,
          createdBy: 'system',
        });
        if (result.success) {
          setSnackbar({ open: true, message: 'Requirement created', severity: 'success' });
          await loadData();
        }
      }
      handleCloseDialog();
    } catch (error) {
      console.error('Failed to save requirement:', error);
      setSnackbar({ open: true, message: 'Failed to save requirement', severity: 'error' });
    }
  };

  const handleDeleteRequirement = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this requirement?')) {
      try {
        const result = await API.deleteRequirement(id);
        if (result.success) {
          setSnackbar({ open: true, message: 'Requirement deleted', severity: 'success' });
          await loadData();
        }
      } catch (error) {
        console.error('Failed to delete requirement:', error);
        setSnackbar({ open: true, message: 'Failed to delete requirement', severity: 'error' });
      }
    }
  };

  const handleContextMenu = (event: React.MouseEvent, rowId: string) => {
    event.preventDefault();
    setContextMenu({ mouseX: event.clientX, mouseY: event.clientY, rowId });
  };

  // Wrap DataGrid row context menu
  const handleGridContextMenu = (event: React.MouseEvent) => {
    const rowElement = (event.target as HTMLElement).closest('[data-id]');
    if (rowElement) {
      const rowId = rowElement.getAttribute('data-id');
      if (rowId) {
        handleContextMenu(event, rowId);
      }
    }
  };

  const handleContextClose = () => {
    setContextMenu(null);
  };

  const handleLoadReqsForTrace = async (docId: string) => {
    try {
      const result = await API.getRequirements(docId);
      if (result.success) {
        setReqsForTrace(result.data || []);
      }
    } catch (error) {
      console.error('Failed to load requirements:', error);
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'level',
      headerName: 'Level',
      width: 90,
      editable: true,
      type: 'singleSelect',
      valueOptions: ['1', '1.1', '1.1.1', '1.2', '1.2.1', '1.3', '2', '2.1', '2.1.1', '2.2', '2.2.1', '2.3', '3', '3.1', '3.2'],
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
          {params.value || '1'}
        </Typography>
      ),
    },
    {
      field: 'id',
      headerName: 'ID',
      width: 120,
      editable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#666' }}>
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'title',
      headerName: 'Title',
      width: 300,
      editable: true,
    },
    {
      field: 'description',
      headerName: 'Description',
      width: 350,
      editable: true,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {params.value || '—'}
        </Typography>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 130,
      editable: true,
      type: 'singleSelect',
      valueOptions: STATUS_OPTIONS,
      renderCell: (params: GridRenderCellParams) => (
        <Chip label={params.value || 'draft'} size="small" color={getStatusColor(params.value)} variant="outlined" />
      ),
    },
    {
      field: 'priority',
      headerName: 'Priority',
      width: 110,
      editable: true,
      type: 'singleSelect',
      valueOptions: PRIORITY_OPTIONS,
      renderCell: (params: GridRenderCellParams) => (
        <Chip label={params.value || 'medium'} size="small" color={getPriorityColor(params.value)} />
      ),
    },
    {
      field: 'changeRequestId',
      headerName: 'CR ID',
      width: 130,
      editable: true,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
          {params.value || '—'}
        </Typography>
      ),
    },
    {
      field: 'changeRequestLink',
      headerName: 'CR Link',
      width: 150,
      editable: true,
      renderCell: (params: GridRenderCellParams) => (
        params.value ? (
          <a href={params.value} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', color: '#1976d2', textDecoration: 'none' }}>
            {params.value.length > 20 ? params.value.substring(0, 20) + '...' : params.value}
          </a>
        ) : (
          <Typography variant="body2" sx={{ color: '#999' }}>—</Typography>
        )
      ),
    },
    {
      field: 'testPlan',
      headerName: 'Test Plan',
      width: 200,
      editable: true,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.8rem' }}>
          {params.value || '—'}
        </Typography>
      ),
    },
    {
      field: 'verificationMethod',
      headerName: 'Verification',
      width: 140,
      editable: true,
      type: 'singleSelect',
      valueOptions: VERIFICATION_OPTIONS,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
          {params.value ? params.value.replace(/_/g, ' ') : '—'}
        </Typography>
      ),
    },
    {
      field: 'rationale',
      headerName: 'Rationale',
      width: 200,
      editable: true,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.8rem' }}>
          {params.value || '—'}
        </Typography>
      ),
    },
    {
      field: 'actions',
      headerName: '',
      width: 100,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Edit details">
            <IconButton size="small" onClick={() => handleOpenDialog(requirements.find(r => r.id === params.id))}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" color="error" onClick={() => handleDeleteRequirement(params.id as string)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  const CustomToolbar = () => (
    <GridToolbarContainer sx={{ display: 'flex', justifyContent: 'space-between', p: 1 }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Requirement
        </Button>
        {hasChanges && (
          <Button
            variant="contained"
            color="success"
            size="small"
            startIcon={<SaveIcon />}
            onClick={handleSaveAllChanges}
          >
            Save All ({dirtyRows.size})
          </Button>
        )}
        <GridToolbarFilterButton />
        <GridToolbarExport />
      </Box>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <GridToolbarQuickFilter />
      </Box>
    </GridToolbarContainer>
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Document Top Bar */}
      <Paper sx={{ p: 2, borderRadius: 0, boxShadow: 1, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <IconButton onClick={onBack} size="small">
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="textSecondary">
              Document
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              {documentTitle}
            </Typography>
          </Box>
          {stats && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip label={`${stats.total} total`} size="small" variant="outlined" />
              {Object.entries(stats.byStatus).map(([status, count]) => (
                <Chip key={status} label={`${status}: ${count}`} size="small" color={getStatusColor(status)} variant="outlined" />
              ))}
            </Box>
          )}
        </Box>
      </Paper>

      {/* Main Data Grid */}
      <Box sx={{ flex: 1, minHeight: 0 }} onContextMenu={handleGridContextMenu}>
        <DataGrid
          rows={requirements}
          columns={columns}
          density="compact"
          editMode="row"
          processRowUpdate={handleRowUpdate}
          onProcessRowUpdateError={(error) => console.error('Row update error:', error)}
          slots={{
            toolbar: CustomToolbar,
          }}
          onRowClick={(_params) => {
            // Track selected row
          }}
          sx={{
            border: 'none',
            '& .MuiDataGrid-cell:focus': {
              outline: '2px solid #1976d2',
              outlineOffset: -2,
            },
            '& .MuiDataGrid-columnHeader': {
              backgroundColor: '#f5f5f5',
              fontWeight: 600,
            },
            '& .MuiDataGrid-row--editing': {
              backgroundColor: '#fff9c4',
            },
            '& .dirty-row': {
              backgroundColor: '#fff3e0 !important',
            },
          }}
          initialState={{
            sorting: {
              sortModel: [{ field: 'level', sort: 'asc' }],
            },
            columns: {
              columnVisibilityModel: {
                changeRequestLink: false,
                testPlanLink: false,
                rationale: false,
              },
            },
          }}
          pageSizeOptions={[25, 50, 100]}
          disableRowSelectionOnClick
        />
      </Box>

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleContextClose}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={() => {
          if (contextMenu) {
            const req = requirements.find(r => r.id === contextMenu.rowId);
            if (req) handleOpenDialog(req);
          }
          handleContextClose();
        }}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} /> Edit Details
        </MenuItem>
        <MenuItem onClick={() => {
          if (contextMenu) {
            const req = requirements.find(r => r.id === contextMenu.rowId);
            if (req) {
              setTracingReq(req);
              setOpenTraceability(true);
            }
          }
          handleContextClose();
        }}>
          <LinkIcon fontSize="small" sx={{ mr: 1 }} /> Link Traceability
        </MenuItem>
        <MenuItem onClick={() => {
          if (contextMenu) handleDeleteRequirement(contextMenu.rowId);
          handleContextClose();
        }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1, color: '#d32f2f' }} /> Delete
        </MenuItem>
      </Menu>

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 3 }}>
            {editingReq ? 'Edit Requirement' : 'New Requirement'}
          </Typography>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl sx={{ minWidth: 120 }}>
                <InputLabel>Level</InputLabel>
                <Select
                  value={formData.level}
                  label="Level"
                  onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                >
                  <MenuItem value="1">1</MenuItem>
                  <MenuItem value="1.1">1.1</MenuItem>
                  <MenuItem value="1.1.1">1.1.1</MenuItem>
                  <MenuItem value="1.2">1.2</MenuItem>
                  <MenuItem value="1.2.1">1.2.1</MenuItem>
                  <MenuItem value="1.3">1.3</MenuItem>
                  <MenuItem value="2">2</MenuItem>
                  <MenuItem value="2.1">2.1</MenuItem>
                  <MenuItem value="2.1.1">2.1.1</MenuItem>
                  <MenuItem value="2.2">2.2</MenuItem>
                  <MenuItem value="3">3</MenuItem>
                  <MenuItem value="3.1">3.1</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                fullWidth
                required
              />
            </Box>
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              multiline
              rows={4}
              required
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={formData.priority}
                  label="Priority"
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                </Select>
              </FormControl>
              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>Verification Method</InputLabel>
                <Select
                  value={formData.verificationMethod}
                  label="Verification Method"
                  onChange={(e) => setFormData({ ...formData, verificationMethod: e.target.value })}
                >
                  {VERIFICATION_OPTIONS.map(opt => (
                    <MenuItem key={opt} value={opt}>{opt.replace(/_/g, ' ')}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Change Request ID"
                value={formData.changeRequestId}
                onChange={(e) => setFormData({ ...formData, changeRequestId: e.target.value })}
                placeholder="e.g., CR-2024-001"
                sx={{ flex: 1 }}
              />
              <TextField
                label="CR Link"
                value={formData.changeRequestLink}
                onChange={(e) => setFormData({ ...formData, changeRequestLink: e.target.value })}
                placeholder="URL to CR document"
                sx={{ flex: 1 }}
              />
            </Box>
            <TextField
              label="Test Plan"
              value={formData.testPlan}
              onChange={(e) => setFormData({ ...formData, testPlan: e.target.value })}
              fullWidth
              multiline
              rows={2}
              placeholder="Describe test approach or reference test document"
            />
            <TextField
              label="Rationale"
              value={formData.rationale}
              onChange={(e) => setFormData({ ...formData, rationale: e.target.value })}
              fullWidth
              multiline
              rows={2}
              placeholder="Why this requirement exists"
            />
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button onClick={handleCloseDialog}>Cancel</Button>
              <Button variant="contained" onClick={handleSaveRequirement}>
                Save
              </Button>
            </Box>
          </Stack>
        </Box>
      </Dialog>

      {/* Traceability Dialog */}
      <Dialog open={openTraceability} onClose={() => setOpenTraceability(false)} maxWidth="sm" fullWidth>
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Link Traceability
          </Typography>
          {tracingReq && (
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              Source: {tracingReq.level} - {tracingReq.title}
            </Typography>
          )}
          <Stack spacing={2}>
            <FormControl fullWidth>
              <InputLabel>Target Document</InputLabel>
              <Select
                value={selectedDocForTrace}
                label="Target Document"
                onChange={(e) => {
                  setSelectedDocForTrace(e.target.value);
                  handleLoadReqsForTrace(e.target.value);
                }}
              >
                {documents.map(doc => (
                  <MenuItem key={doc.id} value={doc.id}>{doc.title}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {reqsForTrace.length > 0 && (
              <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                {reqsForTrace.map(req => (
                  <Box key={req.id} sx={{ p: 1, borderBottom: '1px solid #eee' }}>
                    <Typography variant="body2">
                      {req.level}: {req.title}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button onClick={() => setOpenTraceability(false)}>Close</Button>
            </Box>
          </Stack>
        </Box>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default RequirementsPage;
