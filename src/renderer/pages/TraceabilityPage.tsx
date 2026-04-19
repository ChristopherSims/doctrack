import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  Chip,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tooltip,
  Snackbar,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Collapse,
  Card,
  CardContent,
  Stack,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  DeviceHub as DeviceHubIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
  Link as LinkIcon,
  ArrowDownward as ArrowDownwardIcon,
  ArrowUpward as ArrowUpwardIcon,
} from '@mui/icons-material';
import type { Requirement, TraceabilityLink, Document } from '../../types/index';
import * as API from '../../api/api';

interface TraceabilityPageProps {
  documentId: string;
  documentTitle: string;
}

const LINK_TYPES = ['implements', 'verifies', 'traces_to', 'derives_from', 'satisfies'] as const;
type LinkType = typeof LINK_TYPES[number];

const LINK_TYPE_COLORS: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success'> = {
  implements: 'primary',
  verifies: 'success',
  traces_to: 'info',
  derives_from: 'warning',
  satisfies: 'secondary',
};

interface LinkWithDetails extends TraceabilityLink {
  targetReqTitle?: string;
  targetDocTitle?: string;
  sourceReqTitle?: string;
  sourceDocTitle?: string;
  direction?: 'outgoing' | 'incoming';
}

interface ImpactNode {
  requirementId: string;
  requirementTitle: string;
  documentId: string;
  documentTitle: string;
  linkType: string;
  depth: number;
  isDirect: boolean;
}

const TraceabilityPage: React.FC<TraceabilityPageProps> = ({ documentId, documentTitle }) => {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReq, setSelectedReq] = useState<Requirement | null>(null);
  const [linksMap, setLinksMap] = useState<Record<string, LinkWithDetails[]>>({});

  // Create link dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createLinkSource, setCreateLinkSource] = useState<Requirement | null>(null);
  const [selectedTargetDoc, setSelectedTargetDoc] = useState('');
  const [targetDocReqs, setTargetDocReqs] = useState<Requirement[]>([]);
  const [selectedTargetReq, setSelectedTargetReq] = useState('');
  const [selectedLinkType, setSelectedLinkType] = useState<LinkType>('traces_to');
  const [creating, setCreating] = useState(false);

  // Impact analysis
  const [impactOpen, setImpactOpen] = useState(false);
  const [downstreamImpacts, setDownstreamImpacts] = useState<ImpactNode[]>([]);
  const [upstreamDeps, setUpstreamDeps] = useState<ImpactNode[]>([]);
  const [computingImpact, setComputingImpact] = useState(false);

  // Snackbar
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({ open: false, message: '', severity: 'info' });

  useEffect(() => {
    loadData();
  }, [documentId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reqResult, docsResult] = await Promise.all([
        API.getRequirements(documentId),
        API.getDocuments(),
      ]);

      if (reqResult.success) {
        const reqs = reqResult.data || [];
        setRequirements(reqs);
        // Load traceability links for all requirements
        await loadAllLinks(reqs);
      }

      if (docsResult.success) {
        setDocuments(
          (docsResult.data || []).filter((d: Document) => d.id !== documentId)
        );
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllLinks = async (reqs: Requirement[]) => {
    const newLinksMap: Record<string, LinkWithDetails[]> = {};
    // Batch requests in chunks to avoid overwhelming the server
    const chunkSize = 10;
    for (let i = 0; i < reqs.length; i += chunkSize) {
      const chunk = reqs.slice(i, i + chunkSize);
      const results = await Promise.all(
        chunk.map(async (req) => {
          try {
            const result = await API.getTraceabilityLinks(req.id);
            return { reqId: req.id, links: result.success ? (result.data || []) : [] };
          } catch {
            return { reqId: req.id, links: [] };
          }
        })
      );
      for (const { reqId, links } of results) {
        if (links.length > 0) {
          newLinksMap[reqId] = links;
        }
      }
    }
    setLinksMap(newLinksMap);
  };

  const loadTargetDocReqs = async (docId: string) => {
    try {
      const result = await API.getRequirements(docId);
      if (result.success) {
        setTargetDocReqs(result.data || []);
      }
    } catch (error) {
      console.error('Failed to load target document requirements:', error);
      setTargetDocReqs([]);
    }
  };

  const handleOpenCreateDialog = (req: Requirement) => {
    setCreateLinkSource(req);
    setSelectedTargetDoc('');
    setSelectedTargetReq('');
    setSelectedLinkType('traces_to');
    setTargetDocReqs([]);
    setCreateDialogOpen(true);
  };

  const handleCloseCreateDialog = () => {
    setCreateDialogOpen(false);
    setCreateLinkSource(null);
  };

  const handleTargetDocChange = (docId: string) => {
    setSelectedTargetDoc(docId);
    setSelectedTargetReq('');
    loadTargetDocReqs(docId);
  };

  const handleCreateLink = async () => {
    if (!createLinkSource || !selectedTargetReq || !selectedTargetDoc) return;
    setCreating(true);
    try {
      const result = await API.createTraceabilityLink({
        sourceRequirementId: createLinkSource.id,
        targetRequirementId: selectedTargetReq,
        targetDocumentId: selectedTargetDoc,
        linkType: selectedLinkType,
      });
      if (result.success) {
        setSnackbar({ open: true, message: 'Traceability link created', severity: 'success' });
        handleCloseCreateDialog();
        await loadData();
      } else {
        setSnackbar({ open: true, message: result.error || 'Failed to create link', severity: 'error' });
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to create link', severity: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    try {
      const result = await API.deleteTraceabilityLink(linkId);
      if (result.success) {
        setSnackbar({ open: true, message: 'Link deleted', severity: 'success' });
        await loadData();
        if (selectedReq) {
          await loadLinksForReq(selectedReq.id);
        }
      } else {
        setSnackbar({ open: true, message: 'Failed to delete link', severity: 'error' });
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to delete link', severity: 'error' });
    }
  };

  // Load detailed links for a single requirement (for the View Links panel)
  const [selectedReqLinks, setSelectedReqLinks] = useState<LinkWithDetails[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);

  const loadLinksForReq = useCallback(async (reqId: string) => {
    setLoadingLinks(true);
    try {
      const result = await API.getTraceabilityLinks(reqId);
      if (result.success) {
        const links: LinkWithDetails[] = (result.data || []).map((link: TraceabilityLink) => ({
          ...link,
          direction: link.sourceRequirementId === reqId ? 'outgoing' : 'incoming',
        }));
        setSelectedReqLinks(links);
      }
    } catch (error) {
      console.error('Failed to load links:', error);
      setSelectedReqLinks([]);
    } finally {
      setLoadingLinks(false);
    }
  }, []);

  const handleSelectReq = (req: Requirement) => {
    if (selectedReq?.id === req.id) {
      setSelectedReq(null);
      setSelectedReqLinks([]);
      setImpactOpen(false);
      return;
    }
    setSelectedReq(req);
    loadLinksForReq(req.id);
    setImpactOpen(false);
  };

  // Impact Analysis - recursive traversal
  const computeDownstreamImpact = useCallback(async (reqId: string, depth: number, visited: Set<string>, results: ImpactNode[]) => {
    if (visited.has(reqId)) return;
    visited.add(reqId);

    try {
      const result = await API.getTraceabilityLinks(reqId);
      if (!result.success) return;
      const links: TraceabilityLink[] = result.data || [];

      for (const link of links) {
        // Outgoing links: source is this req -> downstream impact
        if (link.sourceRequirementId === reqId) {
          const targetId = link.targetRequirementId;
          if (!visited.has(targetId)) {
            // Get requirement details
            let reqTitle = targetId;
            let docTitle = link.targetDocumentId;
            try {
              const reqResult = await API.getRequirement(targetId);
              if (reqResult.success && reqResult.data) {
                reqTitle = reqResult.data.title || targetId;
              }
              const docResult = await API.getDocument(link.targetDocumentId);
              if (docResult.success && docResult.data) {
                docTitle = docResult.data.title || link.targetDocumentId;
              }
            } catch { /* use defaults */ }

            results.push({
              requirementId: targetId,
              requirementTitle: reqTitle,
              documentId: link.targetDocumentId,
              documentTitle: docTitle,
              linkType: link.linkType,
              depth,
              isDirect: depth === 1,
            });
            await computeDownstreamImpact(targetId, depth + 1, visited, results);
          }
        }
      }
    } catch (error) {
      console.error('Error computing downstream impact:', error);
    }
  }, []);

  const computeUpstreamDeps = useCallback(async (reqId: string, depth: number, visited: Set<string>, results: ImpactNode[]) => {
    if (visited.has(reqId)) return;
    visited.add(reqId);

    try {
      const result = await API.getTraceabilityLinks(reqId);
      if (!result.success) return;
      const links: TraceabilityLink[] = result.data || [];

      for (const link of links) {
        // Incoming links: target is this req -> upstream dependency
        if (link.targetRequirementId === reqId) {
          const sourceId = link.sourceRequirementId;
          if (!visited.has(sourceId)) {
            let reqTitle = sourceId;
            let docTitle = 'Unknown';
            try {
              const reqResult = await API.getRequirement(sourceId);
              if (reqResult.success && reqResult.data) {
                reqTitle = reqResult.data.title || sourceId;
                const docId = reqResult.data.documentId;
                const docResult = await API.getDocument(docId);
                if (docResult.success && docResult.data) {
                  docTitle = docResult.data.title || docId;
                }
              }
            } catch { /* use defaults */ }

            results.push({
              requirementId: sourceId,
              requirementTitle: reqTitle,
              documentId: '',
              documentTitle: docTitle,
              linkType: link.linkType,
              depth,
              isDirect: depth === 1,
            });
            await computeUpstreamDeps(sourceId, depth + 1, visited, results);
          }
        }
      }
    } catch (error) {
      console.error('Error computing upstream deps:', error);
    }
  }, []);

  const handleRunImpactAnalysis = async () => {
    if (!selectedReq) return;
    setComputingImpact(true);
    setImpactOpen(true);
    setDownstreamImpacts([]);
    setUpstreamDeps([]);

    try {
      const downstream: ImpactNode[] = [];
      const upstream: ImpactNode[] = [];
      await Promise.all([
        computeDownstreamImpact(selectedReq.id, 1, new Set([selectedReq.id]), downstream),
        computeUpstreamDeps(selectedReq.id, 1, new Set([selectedReq.id]), upstream),
      ]);
      setDownstreamImpacts(downstream);
      setUpstreamDeps(upstream);
    } catch (error) {
      console.error('Impact analysis failed:', error);
    } finally {
      setComputingImpact(false);
    }
  };

  const getLinkCount = (reqId: string): number => {
    return (linksMap[reqId] || []).length;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <DeviceHubIcon sx={{ fontSize: 28, color: 'primary.main' }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Traceability Matrix
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {documentTitle} — Cross-document requirement linking and impact analysis
            </Typography>
          </Box>
          {selectedReq && (
            <Button
              variant="contained"
              color="secondary"
              size="small"
              onClick={handleRunImpactAnalysis}
              disabled={computingImpact}
              startIcon={computingImpact ? <CircularProgress size={16} /> : <DeviceHubIcon />}
            >
              {computingImpact ? 'Analyzing...' : 'Impact Analysis'}
            </Button>
          )}
        </Box>
      </Paper>

      <Box sx={{ display: 'flex', gap: 3, flex: 1 }}>
        {/* Traceability Matrix */}
        <Box sx={{ flex: 2 }}>
          <Paper sx={{ overflow: 'hidden' }}>
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Requirements & Links
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Click a requirement to view its links. Use the + button to create a new link.
              </Typography>
            </Box>
            <TableContainer sx={{ maxHeight: '60vh' }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, width: 80 }}>Level</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Requirement</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 100 }}>Links</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 80 }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {requirements.map((req) => {
                    const isSelected = selectedReq?.id === req.id;
                    const linkCount = getLinkCount(req.id);
                    const reqLinks = linksMap[req.id] || [];
                    return (
                      <React.Fragment key={req.id}>
                        <TableRow
                          hover
                          selected={isSelected}
                          onClick={() => handleSelectReq(req)}
                          sx={{
                            cursor: 'pointer',
                            '&.Mui-selected': {
                              backgroundColor: '#e3f2fd',
                              '&:hover': { backgroundColor: '#bbdefb' },
                            },
                          }}
                        >
                          <TableCell>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                              {req.level || '1'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {req.title}
                              </Typography>
                              <Typography variant="caption" color="textSecondary" sx={{ fontFamily: 'monospace' }}>
                                {req.id}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            {linkCount > 0 ? (
                              <Chip
                                label={linkCount}
                                size="small"
                                color="primary"
                                variant="filled"
                                sx={{ fontWeight: 600 }}
                              />
                            ) : (
                              <Chip label="0" size="small" variant="outlined" sx={{ color: '#999' }} />
                            )}
                          </TableCell>
                          <TableCell>
                            <Tooltip title="Create link">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenCreateDialog(req);
                                }}
                              >
                                <AddIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                        {/* Expand to show link chips inline */}
                        {isSelected && reqLinks.length > 0 && (
                          <TableRow>
                            <TableCell colSpan={4} sx={{ py: 0, backgroundColor: '#f5f9ff' }}>
                              <Collapse in={isSelected}>
                                <Box sx={{ px: 2, py: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                  {reqLinks.map((link: TraceabilityLink) => (
                                    <Chip
                                      key={link.id}
                                      icon={<LinkIcon />}
                                      label={`${link.linkType} → ${link.targetRequirementId}`}
                                      size="small"
                                      color={LINK_TYPE_COLORS[link.linkType] || 'default'}
                                      variant="outlined"
                                      sx={{ fontSize: '0.7rem' }}
                                    />
                                  ))}
                                </Box>
                              </Collapse>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {requirements.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                        <Typography color="textSecondary">No requirements found</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>

        {/* Right Panel: View Links + Impact Analysis */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* View Links Panel */}
          <Paper sx={{ flex: 1, overflow: 'hidden' }}>
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                <LinkIcon sx={{ fontSize: 18, mr: 1, verticalAlign: 'middle' }} />
                Link Details
              </Typography>
            </Box>
            <Box sx={{ overflow: 'auto', maxHeight: '35vh', p: 1 }}>
              {!selectedReq ? (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography color="textSecondary" variant="body2">
                    Select a requirement to view its links
                  </Typography>
                </Box>
              ) : loadingLinks ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : selectedReqLinks.length === 0 ? (
                <Box sx={{ py: 2, textAlign: 'center' }}>
                  <Typography color="textSecondary" variant="body2">
                    No links for {selectedReq.title}
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenCreateDialog(selectedReq)}
                    sx={{ mt: 1 }}
                  >
                    Create Link
                  </Button>
                </Box>
              ) : (
                <List dense disablePadding>
                  {selectedReqLinks.map((link) => (
                    <ListItem
                      key={link.id}
                      sx={{
                        px: 1,
                        py: 0.5,
                        borderRadius: 1,
                        mb: 0.5,
                        backgroundColor: link.direction === 'outgoing' ? '#f0f7ff' : '#fff3e0',
                      }}
                      secondaryAction={
                        <Tooltip title="Delete link">
                          <IconButton
                            edge="end"
                            size="small"
                            color="error"
                            onClick={() => handleDeleteLink(link.id)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      }
                    >
                      <ListItemIcon sx={{ minWidth: 28 }}>
                        {link.direction === 'outgoing' ? (
                          <ArrowForwardIcon fontSize="small" color="primary" />
                        ) : (
                          <ArrowBackIcon fontSize="small" color="warning" />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {link.direction === 'outgoing'
                                ? link.targetRequirementId
                                : link.sourceRequirementId}
                            </Typography>
                            <Chip
                              label={link.linkType}
                              size="small"
                              color={LINK_TYPE_COLORS[link.linkType] || 'default'}
                              sx={{ height: 20, fontSize: '0.65rem' }}
                            />
                          </Box>
                        }
                        secondary={
                          <Typography variant="caption" color="textSecondary">
                            {link.direction === 'outgoing' ? 'Outgoing' : 'Incoming'} · Doc: {link.targetDocumentId} · {link.createdAt ? new Date(link.createdAt).toLocaleDateString() : ''}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          </Paper>

          {/* Impact Analysis Panel */}
          <Paper sx={{ flex: 1, overflow: 'hidden' }}>
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                <DeviceHubIcon sx={{ fontSize: 18, mr: 1, verticalAlign: 'middle' }} />
                Impact Analysis
              </Typography>
            </Box>
            <Box sx={{ overflow: 'auto', maxHeight: '35vh', p: 1 }}>
              {!selectedReq ? (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography color="textSecondary" variant="body2">
                    Select a requirement, then click "Impact Analysis"
                  </Typography>
                </Box>
              ) : computingImpact ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : !impactOpen ? (
                <Box sx={{ py: 2, textAlign: 'center' }}>
                  <Typography color="textSecondary" variant="body2">
                    Click "Impact Analysis" to analyze dependencies
                  </Typography>
                </Box>
              ) : (
                <Box>
                  {/* Downstream Impact */}
                  <Card variant="outlined" sx={{ mb: 1 }}>
                    <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                      <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                        <ArrowDownwardIcon fontSize="small" color="error" />
                        Downstream Impact ({downstreamImpacts.length})
                      </Typography>
                      {downstreamImpacts.length === 0 ? (
                        <Typography variant="caption" color="textSecondary">
                          No downstream dependencies found
                        </Typography>
                      ) : (
                        <List dense disablePadding>
                          {downstreamImpacts.map((node, idx) => (
                            <ListItem
                              key={`down-${idx}`}
                              sx={{
                                px: 1,
                                py: 0.25,
                                borderRadius: 0.5,
                                mb: 0.25,
                                backgroundColor: node.isDirect ? '#ffebee' : '#fff3e0',
                                ml: node.depth * 2,
                              }}
                            >
                              <ListItemIcon sx={{ minWidth: 24 }}>
                                <ArrowDownwardIcon
                                  fontSize="small"
                                  sx={{ fontSize: 14 }}
                                  color={node.isDirect ? 'error' : 'warning'}
                                />
                              </ListItemIcon>
                              <ListItemText
                                primary={
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Typography
                                      variant="body2"
                                      sx={{
                                        fontWeight: node.isDirect ? 600 : 400,
                                        fontSize: '0.8rem',
                                      }}
                                    >
                                      {node.requirementTitle}
                                    </Typography>
                                    <Chip
                                      label={node.linkType}
                                      size="small"
                                      color={LINK_TYPE_COLORS[node.linkType] || 'default'}
                                      sx={{ height: 16, fontSize: '0.6rem' }}
                                    />
                                    {!node.isDirect && (
                                      <Chip
                                        label="indirect"
                                        size="small"
                                        variant="outlined"
                                        sx={{ height: 16, fontSize: '0.6rem', color: '#999' }}
                                      />
                                    )}
                                  </Box>
                                }
                                secondary={
                                  <Typography variant="caption" color="textSecondary">
                                    {node.documentTitle} (depth {node.depth})
                                  </Typography>
                                }
                              />
                            </ListItem>
                          ))}
                        </List>
                      )}
                    </CardContent>
                  </Card>

                  {/* Upstream Dependencies */}
                  <Card variant="outlined">
                    <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                      <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                        <ArrowUpwardIcon fontSize="small" color="primary" />
                        Upstream Dependencies ({upstreamDeps.length})
                      </Typography>
                      {upstreamDeps.length === 0 ? (
                        <Typography variant="caption" color="textSecondary">
                          No upstream dependencies found
                        </Typography>
                      ) : (
                        <List dense disablePadding>
                          {upstreamDeps.map((node, idx) => (
                            <ListItem
                              key={`up-${idx}`}
                              sx={{
                                px: 1,
                                py: 0.25,
                                borderRadius: 0.5,
                                mb: 0.25,
                                backgroundColor: node.isDirect ? '#e3f2fd' : '#f3e5f5',
                                ml: node.depth * 2,
                              }}
                            >
                              <ListItemIcon sx={{ minWidth: 24 }}>
                                <ArrowUpwardIcon
                                  fontSize="small"
                                  sx={{ fontSize: 14 }}
                                  color={node.isDirect ? 'primary' : 'secondary'}
                                />
                              </ListItemIcon>
                              <ListItemText
                                primary={
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Typography
                                      variant="body2"
                                      sx={{
                                        fontWeight: node.isDirect ? 600 : 400,
                                        fontSize: '0.8rem',
                                      }}
                                    >
                                      {node.requirementTitle}
                                    </Typography>
                                    <Chip
                                      label={node.linkType}
                                      size="small"
                                      color={LINK_TYPE_COLORS[node.linkType] || 'default'}
                                      sx={{ height: 16, fontSize: '0.6rem' }}
                                    />
                                    {!node.isDirect && (
                                      <Chip
                                        label="indirect"
                                        size="small"
                                        variant="outlined"
                                        sx={{ height: 16, fontSize: '0.6rem', color: '#999' }}
                                      />
                                    )}
                                  </Box>
                                }
                                secondary={
                                  <Typography variant="caption" color="textSecondary">
                                    {node.documentTitle} (depth {node.depth})
                                  </Typography>
                                }
                              />
                            </ListItem>
                          ))}
                        </List>
                      )}
                    </CardContent>
                  </Card>
                </Box>
              )}
            </Box>
          </Paper>
        </Box>
      </Box>

      {/* Create Link Dialog */}
      <Dialog open={createDialogOpen} onClose={handleCloseCreateDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LinkIcon color="primary" />
            Create Traceability Link
          </Box>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {/* Source requirement info */}
            <Paper variant="outlined" sx={{ p: 2, backgroundColor: '#f5f9ff' }}>
              <Typography variant="caption" color="textSecondary">Source Requirement</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {createLinkSource?.title}
              </Typography>
              <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#666' }}>
                {createLinkSource?.id}
              </Typography>
            </Paper>

            {/* Target Document */}
            <FormControl fullWidth size="small">
              <InputLabel>Target Document</InputLabel>
              <Select
                value={selectedTargetDoc}
                label="Target Document"
                onChange={(e) => handleTargetDocChange(e.target.value)}
              >
                {documents.map((doc) => (
                  <MenuItem key={doc.id} value={doc.id}>
                    {doc.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Target Requirement */}
            <FormControl fullWidth size="small" disabled={!selectedTargetDoc}>
              <InputLabel>Target Requirement</InputLabel>
              <Select
                value={selectedTargetReq}
                label="Target Requirement"
                onChange={(e) => setSelectedTargetReq(e.target.value)}
              >
                {targetDocReqs.map((req) => (
                  <MenuItem key={req.id} value={req.id}>
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="body2">{req.title}</Typography>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#666' }}>
                        {req.id}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Link Type */}
            <FormControl fullWidth size="small">
              <InputLabel>Link Type</InputLabel>
              <Select
                value={selectedLinkType}
                label="Link Type"
                onChange={(e) => setSelectedLinkType(e.target.value as LinkType)}
              >
                {LINK_TYPES.map((lt) => (
                  <MenuItem key={lt} value={lt}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={lt}
                        size="small"
                        color={LINK_TYPE_COLORS[lt]}
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                      <Typography variant="body2">{lt.replace(/_/g, ' ')}</Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseCreateDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateLink}
            disabled={!selectedTargetDoc || !selectedTargetReq || creating}
            startIcon={creating ? <CircularProgress size={16} /> : <LinkIcon />}
          >
            {creating ? 'Creating...' : 'Create Link'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default TraceabilityPage;
