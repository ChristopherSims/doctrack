import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Card, CardContent } from '@/components/ui/card';
import {
  Plus,
  Trash2,
  Network,
  ArrowRight,
  ArrowLeft,
  Link as LinkIcon,
  ArrowDown,
  ArrowUp,
  Loader2,
  X,
} from 'lucide-react';
import type { Requirement, TraceabilityLink, Document } from '../../types/index';
import * as API from '../../api/api';

interface TraceabilityPageProps {
  documentId: string;
  documentTitle: string;
}

const LINK_TYPES = ['implements', 'verifies', 'traces_to', 'derives_from', 'satisfies'] as const;
type LinkType = typeof LINK_TYPES[number];

const LINK_TYPE_COLOR_CLASS: Record<string, string> = {
  implements: 'bg-blue-100 text-blue-800 border-blue-300',
  verifies: 'bg-green-100 text-green-800 border-green-300',
  traces_to: 'bg-sky-100 text-sky-800 border-sky-300',
  derives_from: 'bg-amber-100 text-amber-800 border-amber-300',
  satisfies: 'bg-purple-100 text-purple-800 border-purple-300',
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
      <div className="flex justify-center items-center min-h-[80vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="p-3 flex flex-col gap-3">
        {/* Header */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2">
            <Network className="h-7 w-7 text-primary" />
            <div className="flex-1">
              <h1 className="text-xl font-semibold">
                Traceability Matrix
              </h1>
              <p className="text-sm text-muted-foreground">
                {documentTitle} — Cross-document requirement linking and impact analysis
              </p>
            </div>
            {selectedReq && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRunImpactAnalysis}
                disabled={computingImpact}
              >
                {computingImpact ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Network className="h-4 w-4" />
                )}
                {computingImpact ? 'Analyzing...' : 'Impact Analysis'}
              </Button>
            )}
          </div>
        </div>

        <div className="flex gap-3 flex-1">
          {/* Traceability Matrix */}
          <div className="flex-[2]">
            <div className="rounded-lg border bg-card overflow-hidden">
              <div className="p-4 border-b">
                <h2 className="text-base font-semibold">
                  Requirements & Links
                </h2>
                <p className="text-xs text-muted-foreground">
                  Click a requirement to view its links. Use the + button to create a new link.
                </p>
              </div>
              <div className="max-h-[60vh] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-bold w-[80px]">Level</TableHead>
                      <TableHead className="font-bold">Requirement</TableHead>
                      <TableHead className="font-bold w-[100px]">Links</TableHead>
                      <TableHead className="font-bold w-[80px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requirements.map((req) => {
                      const isSelected = selectedReq?.id === req.id;
                      const linkCount = getLinkCount(req.id);
                      const reqLinks = linksMap[req.id] || [];
                      return (
                        <React.Fragment key={req.id}>
                          <TableRow
                            data-state={isSelected ? 'selected' : undefined}
                            onClick={() => handleSelectReq(req)}
                            className="cursor-pointer"
                          >
                            <TableCell>
                              <span className="text-sm font-semibold font-mono">
                                {req.level || '1'}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">
                                  {req.title}
                                </span>
                                <span className="text-xs text-muted-foreground font-mono">
                                  {req.id}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {linkCount > 0 ? (
                                <Badge className="font-semibold">{linkCount}</Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground">0</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenCreateDialog(req);
                                    }}
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Create link</TooltipContent>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                          {/* Expand to show link chips inline */}
                          {isSelected && reqLinks.length > 0 && (
                            <TableRow>
                              <TableCell colSpan={4} className="py-0 bg-blue-50/50">
                                <div className="px-2 py-1 flex flex-wrap gap-1">
                                  {reqLinks.map((link: TraceabilityLink) => (
                                    <Badge
                                      key={link.id}
                                      variant="outline"
                                      className={`text-xs ${LINK_TYPE_COLOR_CLASS[link.linkType] || ''}`}
                                    >
                                      <LinkIcon className="h-3 w-3" />
                                      {link.linkType} → {link.targetRequirementId}
                                    </Badge>
                                  ))}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
                    {requirements.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-4">
                          <span className="text-muted-foreground">No requirements found</span>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          {/* Right Panel: View Links + Impact Analysis */}
          <div className="flex-1 flex flex-col gap-2">
            {/* View Links Panel */}
            <div className="rounded-lg border bg-card overflow-hidden flex-1">
              <div className="p-4 border-b">
                <h2 className="text-base font-semibold flex items-center gap-1">
                  <LinkIcon className="h-4 w-4" />
                  Link Details
                </h2>
              </div>
              <div className="overflow-auto max-h-[35vh] p-2">
                {!selectedReq ? (
                  <div className="py-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      Select a requirement to view its links
                    </p>
                  </div>
                ) : loadingLinks ? (
                  <div className="flex justify-center py-3">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : selectedReqLinks.length === 0 ? (
                  <div className="py-2 text-center">
                    <p className="text-sm text-muted-foreground">
                      No links for {selectedReq.title}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-1"
                      onClick={() => handleOpenCreateDialog(selectedReq)}
                    >
                      <Plus className="h-4 w-4" />
                      Create Link
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {selectedReqLinks.map((link) => (
                      <div
                        key={link.id}
                        className={`flex items-center gap-2 px-2 py-1 rounded mb-0.5 ${
                          link.direction === 'outgoing'
                            ? 'bg-blue-50'
                            : 'bg-amber-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {link.direction === 'outgoing' ? (
                            <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0" />
                          ) : (
                            <ArrowLeft className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          )}
                          <div className="flex flex-col min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <span className="text-sm font-medium truncate">
                                {link.direction === 'outgoing'
                                  ? link.targetRequirementId
                                  : link.sourceRequirementId}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[0.65rem] h-5 ${LINK_TYPE_COLOR_CLASS[link.linkType] || ''}`}
                              >
                                {link.linkType}
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {link.direction === 'outgoing' ? 'Outgoing' : 'Incoming'} · Doc: {link.targetDocumentId} · {link.createdAt ? new Date(link.createdAt).toLocaleDateString() : ''}
                            </span>
                          </div>
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDeleteLink(link.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete link</TooltipContent>
                        </Tooltip>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Impact Analysis Panel */}
            <div className="rounded-lg border bg-card overflow-hidden flex-1">
              <div className="p-4 border-b">
                <h2 className="text-base font-semibold flex items-center gap-1">
                  <Network className="h-4 w-4" />
                  Impact Analysis
                </h2>
              </div>
              <div className="overflow-auto max-h-[35vh] p-2">
                {!selectedReq ? (
                  <div className="py-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      Select a requirement, then click "Impact Analysis"
                    </p>
                  </div>
                ) : computingImpact ? (
                  <div className="flex justify-center py-3">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !impactOpen ? (
                  <div className="py-2 text-center">
                    <p className="text-sm text-muted-foreground">
                      Click "Impact Analysis" to analyze dependencies
                    </p>
                  </div>
                ) : (
                  <div>
                    {/* Downstream Impact */}
                    <Card className="mb-2 border rounded-lg">
                      <CardContent className="py-2 px-3">
                        <h3 className="text-sm font-semibold flex items-center gap-1 mb-1">
                          <ArrowDown className="h-3.5 w-3.5 text-destructive" />
                          Downstream Impact ({downstreamImpacts.length})
                        </h3>
                        {downstreamImpacts.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            No downstream dependencies found
                          </p>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            {downstreamImpacts.map((node, idx) => (
                              <div
                                key={`down-${idx}`}
                                className={`flex items-center gap-2 px-2 py-0.5 rounded mb-0.5 ${
                                  node.isDirect ? 'bg-red-50' : 'bg-amber-50'
                                }`}
                                style={{ marginLeft: `${node.depth * 2}rem` }}
                              >
                                <ArrowDown
                                  className={`h-3.5 w-3.5 shrink-0 ${node.isDirect ? 'text-destructive' : 'text-amber-500'}`}
                                />
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center gap-1">
                                    <span
                                      className={`text-sm ${node.isDirect ? 'font-semibold' : 'font-normal'}`}
                                    >
                                      {node.requirementTitle}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className={`text-[0.6rem] h-4 ${LINK_TYPE_COLOR_CLASS[node.linkType] || ''}`}
                                    >
                                      {node.linkType}
                                    </Badge>
                                    {!node.isDirect && (
                                      <Badge
                                        variant="outline"
                                        className="text-[0.6rem] h-4 text-muted-foreground"
                                      >
                                        indirect
                                      </Badge>
                                    )}
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {node.documentTitle} (depth {node.depth})
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Upstream Dependencies */}
                    <Card className="border rounded-lg">
                      <CardContent className="py-2 px-3">
                        <h3 className="text-sm font-semibold flex items-center gap-1 mb-1">
                          <ArrowUp className="h-3.5 w-3.5 text-primary" />
                          Upstream Dependencies ({upstreamDeps.length})
                        </h3>
                        {upstreamDeps.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            No upstream dependencies found
                          </p>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            {upstreamDeps.map((node, idx) => (
                              <div
                                key={`up-${idx}`}
                                className={`flex items-center gap-2 px-2 py-0.5 rounded mb-0.5 ${
                                  node.isDirect ? 'bg-blue-50' : 'bg-purple-50'
                                }`}
                                style={{ marginLeft: `${node.depth * 2}rem` }}
                              >
                                <ArrowUp
                                  className={`h-3.5 w-3.5 shrink-0 ${node.isDirect ? 'text-primary' : 'text-secondary-foreground'}`}
                                />
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center gap-1">
                                    <span
                                      className={`text-sm ${node.isDirect ? 'font-semibold' : 'font-normal'}`}
                                    >
                                      {node.requirementTitle}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className={`text-[0.6rem] h-4 ${LINK_TYPE_COLOR_CLASS[node.linkType] || ''}`}
                                    >
                                      {node.linkType}
                                    </Badge>
                                    {!node.isDirect && (
                                      <Badge
                                        variant="outline"
                                        className="text-[0.6rem] h-4 text-muted-foreground"
                                      >
                                        indirect
                                      </Badge>
                                    )}
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {node.documentTitle} (depth {node.depth})
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Create Link Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={(open) => { if (!open) handleCloseCreateDialog(); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <LinkIcon className="h-5 w-5 text-primary" />
                Create Traceability Link
              </DialogTitle>
              <DialogDescription>
                Create a new traceability link from the source requirement to a target.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 mt-1">
              {/* Source requirement info */}
              <div className="rounded-lg border p-4 bg-blue-50/50">
                <p className="text-xs text-muted-foreground">Source Requirement</p>
                <p className="text-sm font-semibold">
                  {createLinkSource?.title}
                </p>
                <p className="text-xs font-mono text-muted-foreground">
                  {createLinkSource?.id}
                </p>
              </div>

              {/* Target Document */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Target Document</label>
                <Select
                  value={selectedTargetDoc}
                  onValueChange={handleTargetDocChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select document" />
                  </SelectTrigger>
                  <SelectContent>
                    {documents.map((doc) => (
                      <SelectItem key={doc.id} value={doc.id}>
                        {doc.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Target Requirement */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Target Requirement</label>
                <Select
                  value={selectedTargetReq}
                  onValueChange={setSelectedTargetReq}
                  disabled={!selectedTargetDoc}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select requirement" />
                  </SelectTrigger>
                  <SelectContent>
                    {targetDocReqs.map((req) => (
                      <SelectItem key={req.id} value={req.id}>
                        <div className="flex flex-col">
                          <span className="text-sm">{req.title}</span>
                          <span className="text-xs font-mono text-muted-foreground">
                            {req.id}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Link Type */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Link Type</label>
                <Select
                  value={selectedLinkType}
                  onValueChange={(v) => setSelectedLinkType(v as LinkType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select link type" />
                  </SelectTrigger>
                  <SelectContent>
                    {LINK_TYPES.map((lt) => (
                      <SelectItem key={lt} value={lt}>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`text-[0.7rem] h-5 ${LINK_TYPE_COLOR_CLASS[lt] || ''}`}
                          >
                            {lt}
                          </Badge>
                          <span className="text-sm">{lt.replace(/_/g, ' ')}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCloseCreateDialog}>Cancel</Button>
              <Button
                onClick={handleCreateLink}
                disabled={!selectedTargetDoc || !selectedTargetReq || creating}
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LinkIcon className="h-4 w-4" />
                )}
                {creating ? 'Creating...' : 'Create Link'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Snackbar / Toast */}
        {snackbar.open && (
          <div className="fixed bottom-4 right-4 z-50">
            <div
              className={`flex items-center gap-2 rounded-lg border px-4 py-3 shadow-lg ${
                snackbar.severity === 'success'
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : snackbar.severity === 'error'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-sky-50 border-sky-200 text-sky-800'
              }`}
            >
              <span className="text-sm">{snackbar.message}</span>
              <button
                onClick={() => setSnackbar((prev) => ({ ...prev, open: false }))}
                className="ml-2 rounded-sm opacity-70 hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default TraceabilityPage;
