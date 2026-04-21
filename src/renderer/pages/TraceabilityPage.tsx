import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  ChevronRight,
  ChevronDown,
  Search,
  GitBranch,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TraceabilityTree from '@/components/TraceabilityTree';
import TraceabilityGraph from '@/components/TraceabilityGraph';
import type { Requirement, TraceabilityLink, Document, RequirementFilter } from '../../types/index';
import * as API from '../../api/api';

interface TraceabilityPageProps {
  documentId: string;
  documentTitle: string;
  onNavigateToRequirement?: (documentId: string, requirementId: string) => void;
  filter?: RequirementFilter;
}

const LINK_TYPES = ['implements', 'verifies', 'traces_to', 'derives_from', 'satisfies'] as const;
type LinkType = typeof LINK_TYPES[number];

const LINK_TYPE_COLOR_CLASS: Record<string, string> = {
  implements: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
  verifies: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30',
  traces_to: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30',
  derives_from: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  satisfies: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30',
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

// --- Tree Node ---
interface TreeNode {
  req: Requirement;
  children: TreeNode[];
}

/**
 * Build a tree from requirements using their `level` field.
 * Level patterns: "1", "1.1", "1.1.1", "2", "2.1", etc.
 * Sort by level, then nest children under parents.
 */
function buildTree(requirements: Requirement[]): TreeNode[] {
  const sorted = [...requirements].sort((a, b) => {
    const aParts = (a.level || '1').split('.').map(Number);
    const bParts = (b.level || '1').split('.').map(Number);
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const av = aParts[i] || 0;
      const bv = bParts[i] || 0;
      if (av !== bv) return av - bv;
    }
    return 0;
  });

  const rootNodes: TreeNode[] = [];
  const nodeMap = new Map<string, TreeNode>();

  for (const req of sorted) {
    const node: TreeNode = { req, children: [] };
    nodeMap.set(req.id, node);
  }

  for (const req of sorted) {
    const node = nodeMap.get(req.id)!;
    const parentLevel = getParentLevel(req.level || '1');

    if (parentLevel === null) {
      // Top-level node
      rootNodes.push(node);
    } else {
      // Find parent by level
      const parent = findNodeByLevel(rootNodes, parentLevel);
      if (parent) {
        parent.children.push(node);
      } else {
        // Can't find parent, put at root
        rootNodes.push(node);
      }
    }
  }

  return rootNodes;
}

function getParentLevel(level: string): string | null {
  const parts = level.split('.');
  if (parts.length <= 1) return null;
  return parts.slice(0, -1).join('.');
}

function findNodeByLevel(nodes: TreeNode[], level: string): TreeNode | null {
  for (const node of nodes) {
    if ((node.req.level || '1') === level) return node;
    const found = findNodeByLevel(node.children, level);
    if (found) return found;
  }
  return null;
}

/** Flatten tree to get all requirement IDs (for expand-all / search) */
function flattenTreeIds(nodes: TreeNode[]): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    ids.push(node.req.id);
    ids.push(...flattenTreeIds(node.children));
  }
  return ids;
}

// --- Component ---

const TraceabilityPage: React.FC<TraceabilityPageProps> = ({ documentId, documentTitle, onNavigateToRequirement, filter }) => {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReq, setSelectedReq] = useState<Requirement | null>(null);
  const [linksMap, setLinksMap] = useState<Record<string, LinkWithDetails[]>>({});

  // Search & expand state
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

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

  // Cross-doc tree view data
  const [crossDocTreeData, setCrossDocTreeData] = useState<any[]>([]);
  const [crossDocTreeLoading, setCrossDocTreeLoading] = useState(false);

  // Graph view
  const [graphSelectedNodeId, setGraphSelectedNodeId] = useState<string | null>(null);

  // Apply shared RequirementFilter from App.tsx
  const filteredRequirements = useMemo(() => {
    if (!filter) return requirements;
    const titleQ = filter.title.trim().toLowerCase();
    const descriptionQ = filter.description.trim().toLowerCase();
    const statusQ = filter.status.trim().toLowerCase();
    const priorityQ = filter.priority.trim().toLowerCase();
    const verificationQ = filter.verification.trim().toLowerCase();
    const tagsQ = filter.tags.trim().toLowerCase();
    if (!titleQ && !descriptionQ && !statusQ && !priorityQ && !verificationQ && !tagsQ) return requirements;

    return requirements.filter((req) => {
      if (titleQ && !(req.title || '').toLowerCase().includes(titleQ)) return false;
      if (descriptionQ && !(req.description || '').toLowerCase().includes(descriptionQ)) return false;
      if (statusQ && !(req.status || 'draft').toLowerCase().includes(statusQ)) return false;
      if (priorityQ && !(req.priority || 'medium').toLowerCase().includes(priorityQ)) return false;
      if (verificationQ && !(req.verificationMethod || '').toLowerCase().includes(verificationQ)) return false;
      if (tagsQ) {
        const reqTags = Array.isArray(req.tags) ? req.tags : [];
        if (!reqTags.some((t: string) => t.toLowerCase().includes(tagsQ))) return false;
      }
      return true;
    });
  }, [requirements, filter]);

  // Build tree from filtered requirements
  const tree = useMemo(() => buildTree(filteredRequirements), [filteredRequirements]);

  // When search changes, auto-expand matching paths
  useEffect(() => {
    if (searchQuery.trim()) {
      const matchingIds = new Set<string>();
      const q = searchQuery.toLowerCase();

      function searchNodes(nodes: TreeNode[], ancestorIds: string[]): boolean {
        let anyMatch = false;
        for (const node of nodes) {
          const matches =
            node.req.title.toLowerCase().includes(q) ||
            node.req.id.toLowerCase().includes(q) ||
            (node.req.description || '').toLowerCase().includes(q);

          const childMatch = searchNodes(node.children, [...ancestorIds, node.req.id]);

          if (matches || childMatch) {
            anyMatch = true;
            // Expand all ancestors
            for (const aid of ancestorIds) {
              matchingIds.add(aid);
            }
            if (node.children.length > 0) {
              matchingIds.add(node.req.id);
            }
          }
        }
        return anyMatch;
      }

      searchNodes(tree, []);
      setExpandedIds(prev => {
        const next = new Set(prev);
        for (const id of matchingIds) next.add(id);
        return next;
      });
    }
  }, [searchQuery, tree]);

  // Build graph nodes/edges from loaded requirements and linksMap
  const { graphNodes, graphEdges } = useMemo(() => {
    const reqs = filteredRequirements;
    if (reqs.length === 0) return { graphNodes: [], graphEdges: [] };

    // Layout: simple grid arrangement
    const cols = Math.ceil(Math.sqrt(reqs.length));
    const spacingX = 140;
    const spacingY = 100;

    const nodes = reqs.map((req, i) => ({
      id: req.id,
      label: req.title,
      level: req.level || '1',
      status: req.status || 'draft',
      x: (i % cols) * spacingX + spacingX / 2,
      y: Math.floor(i / cols) * spacingY + spacingY / 2,
    }));

    const edges: { source: string; target: string; linkType: string }[] = [];
    const edgeSet = new Set<string>();

    for (const req of reqs) {
      const links = linksMap[req.id] || [];
      for (const link of links) {
        const otherId = link.sourceRequirementId === req.id ? link.targetRequirementId : link.sourceRequirementId;
        if (reqs.some((r) => r.id === otherId)) {
          const key = [link.sourceRequirementId, link.targetRequirementId].sort().join('-');
          if (!edgeSet.has(key)) {
            edgeSet.add(key);
            edges.push({
              source: link.sourceRequirementId,
              target: link.targetRequirementId,
              linkType: link.linkType,
            });
          }
        }
      }
    }

    return { graphNodes: nodes, graphEdges: edges };
  }, [filteredRequirements, linksMap]);

  // When tree changes, reset graph selection
  useEffect(() => {
    setGraphSelectedNodeId(null);
  }, [documentId]);

  // Auto-expand top-level on first load
  useEffect(() => {
    if (tree.length > 0 && expandedIds.size === 0) {
      setExpandedIds(new Set(tree.filter(n => n.children.length > 0).map(n => n.req.id)));
    }
  }, [tree]);

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

  // Build cross-doc tree data for TraceabilityTree component
  const loadCrossDocTreeData = useCallback(async () => {
    setCrossDocTreeLoading(true);
    try {
      const result = await API.getCrossDocTraceTree(documentId);
      if (result.success && result.data) {
        setCrossDocTreeData(result.data);
      }
    } catch (err) {
      console.error('Failed to load cross-doc tree:', err);
    } finally {
      setCrossDocTreeLoading(false);
    }
  }, [documentId]);

  const loadAllLinks = async (reqs: Requirement[]) => {
    const newLinksMap: Record<string, LinkWithDetails[]> = {};
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

  // Load detailed links for a single requirement
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

  // When graph node is clicked, select the requirement
  const handleGraphNodeClick = useCallback((nodeId: string) => {
    setGraphSelectedNodeId(nodeId);
    const req = requirements.find((r) => r.id === nodeId);
    if (req) {
      setSelectedReq(req);
      loadLinksForReq(req.id);
      setImpactOpen(false);
    }
  }, [requirements, loadLinksForReq]);

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

  const toggleExpand = (reqId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(reqId)) {
        next.delete(reqId);
      } else {
        next.add(reqId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedIds(new Set(flattenTreeIds(tree)));
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  // Impact Analysis
  const computeDownstreamImpact = useCallback(async (reqId: string, depth: number, visited: Set<string>, results: ImpactNode[]) => {
    if (visited.has(reqId)) return;
    visited.add(reqId);
    try {
      const result = await API.getTraceabilityLinks(reqId);
      if (!result.success) return;
      const links: TraceabilityLink[] = result.data || [];
      for (const link of links) {
        if (link.sourceRequirementId === reqId) {
          const targetId = link.targetRequirementId;
          if (!visited.has(targetId)) {
            let reqTitle = targetId;
            let docTitle = link.targetDocumentId;
            try {
              const reqResult = await API.getRequirement(targetId);
              if (reqResult.success && reqResult.data) reqTitle = reqResult.data.title || targetId;
              const docResult = await API.getDocument(link.targetDocumentId);
              if (docResult.success && docResult.data) docTitle = docResult.data.title || link.targetDocumentId;
            } catch { /* use defaults */ }
            results.push({ requirementId: targetId, requirementTitle: reqTitle, documentId: link.targetDocumentId, documentTitle: docTitle, linkType: link.linkType, depth, isDirect: depth === 1 });
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
                if (docResult.success && docResult.data) docTitle = docResult.data.title || docId;
              }
            } catch { /* use defaults */ }
            results.push({ requirementId: sourceId, requirementTitle: reqTitle, documentId: '', documentTitle: docTitle, linkType: link.linkType, depth, isDirect: depth === 1 });
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

  // --- Filter tree by search ---
  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return tree;
    const q = searchQuery.toLowerCase();

    function filterNodes(nodes: TreeNode[]): TreeNode[] {
      const result: TreeNode[] = [];
      for (const node of nodes) {
        const filteredChildren = filterNodes(node.children);
        const selfMatch =
          node.req.title.toLowerCase().includes(q) ||
          node.req.id.toLowerCase().includes(q) ||
          (node.req.description || '').toLowerCase().includes(q);
        if (selfMatch || filteredChildren.length > 0) {
          result.push({ req: node.req, children: filteredChildren });
        }
      }
      return result;
    }

    return filterNodes(tree);
  }, [tree, searchQuery]);

  // --- Render tree node ---
  const renderTreeNode = (node: TreeNode, depth: number) => {
    const isSelected = selectedReq?.id === node.req.id;
    const isExpanded = expandedIds.has(node.req.id);
    const hasChildren = node.children.length > 0;
    const linkCount = getLinkCount(node.req.id);

    return (
      <React.Fragment key={node.req.id}>
        <div
          className={`flex items-center gap-1 px-2 py-1.5 cursor-pointer rounded-sm mx-1 mb-0.5 transition-colors ${
            isSelected
              ? 'bg-primary/10 ring-1 ring-primary/30'
              : 'hover:bg-accent/50'
          }`}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
          onClick={() => handleSelectReq(node.req)}
        >
          {/* Expand/collapse toggle */}
          {hasChildren ? (
            <button
              className="shrink-0 p-0.5 rounded hover:bg-accent"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.req.id);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          ) : (
            <span className="w-[22px] shrink-0" />
          )}

          {/* Level badge */}
          <span className="text-xs font-mono font-semibold text-muted-foreground shrink-0 min-w-[28px]">
            {node.req.level || '1'}
          </span>

          {/* Title */}
          <span className={`text-sm truncate flex-1 ${isSelected ? 'font-semibold text-primary' : 'font-medium'}`}>
            {node.req.title}
          </span>

          {/* Link count badge */}
          {linkCount > 0 ? (
            <Badge className="text-[0.6rem] h-4 px-1.5 font-semibold shrink-0">{linkCount}</Badge>
          ) : (
            <Badge variant="outline" className="text-[0.6rem] h-4 px-1.5 text-muted-foreground shrink-0">0</Badge>
          )}

          {/* Add link button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="shrink-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
                style={{ opacity: undefined }}  // always visible for now
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenCreateDialog(node.req);
                }}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Create link</TooltipContent>
          </Tooltip>
        </div>

        {/* Expanded link chips for selected node */}
        {isSelected && (linksMap[node.req.id] || []).length > 0 && (
          <div className="px-2 py-1 mx-2 mb-1" style={{ paddingLeft: `${depth * 20 + 28}px` }}>
            <div className="flex flex-wrap gap-1">
              {(linksMap[node.req.id] || []).map((link: TraceabilityLink) => {
                const isOutgoing = link.sourceRequirementId === node.req.id;
                const docTitle = isOutgoing ? (link.targetDocTitle || 'Unknown') : (link.sourceDocTitle || 'Unknown');
                const reqLevel = isOutgoing ? (link.targetReqLevel || '') : (link.sourceReqLevel || '');
                return (
                  <Badge
                    key={link.id}
                    variant="outline"
                    className={`text-xs cursor-pointer hover:bg-accent ${LINK_TYPE_COLOR_CLASS[link.linkType] || ''}`}
                    onClick={() => {
                      const targetDocId = isOutgoing ? link.targetDocumentId : (link.sourceDocumentId || '');
                      const targetReqId = isOutgoing ? link.targetRequirementId : link.sourceRequirementId;
                      if (onNavigateToRequirement && targetDocId) {
                        onNavigateToRequirement(targetDocId, targetReqId);
                      }
                    }}
                  >
                    <LinkIcon className="h-3 w-3" />
                    {docTitle} → {reqLevel}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {/* Children */}
        {hasChildren && isExpanded && node.children.map(child => renderTreeNode(child, depth + 1))}
      </React.Fragment>
    );
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
      <div className="p-3 flex flex-col gap-3 h-full">
        {/* Header */}
        <div className="rounded-lg border bg-card p-4 shrink-0">
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
            {filter && (filter.title.trim() || filter.description.trim() || filter.status.trim() || filter.priority.trim() || filter.verification.trim() || filter.tags.trim()) && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-xs gap-1">
                Filtered: {filteredRequirements.length}/{requirements.length}
              </Badge>
            )}
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

        <Tabs defaultValue="document-tree" className="flex-1 min-h-0 flex flex-col">
          <TabsList className="shrink-0 w-fit">
            <TabsTrigger value="document-tree" className="gap-1.5">
              <Network className="size-3.5" />
              Document Tree
            </TabsTrigger>
            <TabsTrigger value="graph" className="gap-1.5">
              <Network className="size-3.5" />
              Graph
            </TabsTrigger>
            <TabsTrigger value="cross-doc" className="gap-1.5" onClick={() => { if (crossDocTreeData.length === 0) loadCrossDocTreeData(); }}>
              <GitBranch className="size-3.5" />
              Cross-Doc Links
            </TabsTrigger>
          </TabsList>

          {/* ─── Document Tree Tab (existing view) ─── */}
          <TabsContent value="document-tree" className="flex-1 min-h-0 mt-0">
        <div className="flex gap-3 flex-1 min-h-0">
          {/* Left Panel: Hierarchical Tree */}
          <div className="flex-[2] flex flex-col min-w-0">
            <div className="rounded-lg border bg-card overflow-hidden flex flex-col flex-1">
              <div className="p-3 border-b shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-base font-semibold">
                    Requirements & Links
                  </h2>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={expandAll}>
                      Expand All
                    </Button>
                    <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={collapseAll}>
                      Collapse All
                    </Button>
                  </div>
                </div>
                {/* Search bar */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search requirements..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                  {searchQuery && (
                    <button
                      className="absolute right-2 top-1.5"
                      onClick={() => setSearchQuery('')}
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </div>
              </div>
              <div className="overflow-auto flex-1 p-1">
                {filteredTree.length === 0 ? (
                  <div className="py-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      {searchQuery ? 'No requirements match your search' : 'No requirements found'}
                    </p>
                  </div>
                ) : (
                  filteredTree.map(node => renderTreeNode(node, 0))
                )}
              </div>
            </div>
          </div>

          {/* Right Panel: View Links + Impact Analysis */}
          <div className="flex-1 flex flex-col gap-2 min-w-0">
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
                    {selectedReqLinks.map((link) => {
                      const isOutgoing = link.direction === 'outgoing';
                      const docTitle = isOutgoing ? (link.targetDocTitle || 'Unknown') : (link.sourceDocTitle || 'Unknown');
                      const reqLevel = isOutgoing ? (link.targetReqLevel || '') : (link.sourceReqLevel || '');
                      const reqTitle = isOutgoing ? (link.targetReqTitle || '') : (link.sourceReqTitle || '');
                      return (
                        <div
                          key={link.id}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded mb-0.5 ${
                            isOutgoing
                              ? 'bg-blue-500/10 dark:bg-blue-500/15'
                              : 'bg-amber-500/10 dark:bg-amber-500/15'
                          }`}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {isOutgoing ? (
                              <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0" />
                            ) : (
                              <ArrowLeft className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
                            )}
                            <div className="flex flex-col min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                {onNavigateToRequirement ? (
                                  <button
                                    className="text-sm font-medium truncate text-primary hover:underline cursor-pointer text-left"
                                    onClick={() => {
                                      const targetDocId = isOutgoing ? link.targetDocumentId : (link.sourceDocumentId || '');
                                      const targetReqId = isOutgoing ? link.targetRequirementId : link.sourceRequirementId;
                                      if (targetDocId) onNavigateToRequirement(targetDocId, targetReqId);
                                    }}
                                  >
                                    {docTitle} → {reqLevel}
                                  </button>
                                ) : (
                                  <span className="text-sm font-medium truncate">
                                    {docTitle} → {reqLevel}
                                  </span>
                                )}
                                <Badge
                                  variant="outline"
                                  className={`text-[0.65rem] h-5 ${LINK_TYPE_COLOR_CLASS[link.linkType] || ''}`}
                                >
                                  {link.linkType}
                                </Badge>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {reqTitle} · {isOutgoing ? 'Outgoing' : 'Incoming'}
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
                      );
                    })}
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
                          <p className="text-xs text-muted-foreground">No downstream dependencies found</p>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            {downstreamImpacts.map((node, idx) => (
                              <div
                                key={`down-${idx}`}
                                className={`flex items-center gap-2 px-2 py-0.5 rounded mb-0.5 ${node.isDirect ? 'bg-red-500/10 dark:bg-red-500/15' : 'bg-amber-500/10 dark:bg-amber-500/15'}`}
                                style={{ marginLeft: `${node.depth * 2}rem` }}
                              >
                                <ArrowDown className={`h-3.5 w-3.5 shrink-0 ${node.isDirect ? 'text-destructive' : 'text-amber-500 dark:text-amber-400'}`} />
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center gap-1">
                                    {onNavigateToRequirement ? (
                                      <button
                                        className={`text-sm ${node.isDirect ? 'font-semibold' : 'font-normal'} text-primary hover:underline cursor-pointer text-left`}
                                        onClick={() => onNavigateToRequirement(node.documentId, node.requirementId)}
                                      >
                                        {node.documentTitle} → {node.requirementTitle}
                                      </button>
                                    ) : (
                                      <span className={`text-sm ${node.isDirect ? 'font-semibold' : 'font-normal'}`}>
                                        {node.documentTitle} → {node.requirementTitle}
                                      </span>
                                    )}
                                    <Badge variant="outline" className={`text-[0.6rem] h-4 ${LINK_TYPE_COLOR_CLASS[node.linkType] || ''}`}>
                                      {node.linkType}
                                    </Badge>
                                    {!node.isDirect && (
                                      <Badge variant="outline" className="text-[0.6rem] h-4 text-muted-foreground">indirect</Badge>
                                    )}
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    depth {node.depth}
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
                          <p className="text-xs text-muted-foreground">No upstream dependencies found</p>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            {upstreamDeps.map((node, idx) => (
                              <div
                                key={`up-${idx}`}
                                className={`flex items-center gap-2 px-2 py-0.5 rounded mb-0.5 ${node.isDirect ? 'bg-blue-500/10 dark:bg-blue-500/15' : 'bg-purple-500/10 dark:bg-purple-500/15'}`}
                                style={{ marginLeft: `${node.depth * 2}rem` }}
                              >
                                <ArrowUp className={`h-3.5 w-3.5 shrink-0 ${node.isDirect ? 'text-primary' : 'text-purple-500 dark:text-purple-400'}`} />
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center gap-1">
                                    {onNavigateToRequirement ? (
                                      <button
                                        className={`text-sm ${node.isDirect ? 'font-semibold' : 'font-normal'} text-primary hover:underline cursor-pointer text-left`}
                                        onClick={() => onNavigateToRequirement(node.documentId, node.requirementId)}
                                      >
                                        {node.documentTitle} → {node.requirementTitle}
                                      </button>
                                    ) : (
                                      <span className={`text-sm ${node.isDirect ? 'font-semibold' : 'font-normal'}`}>
                                        {node.documentTitle} → {node.requirementTitle}
                                      </span>
                                    )}
                                    <Badge variant="outline" className={`text-[0.6rem] h-4 ${LINK_TYPE_COLOR_CLASS[node.linkType] || ''}`}>
                                      {node.linkType}
                                    </Badge>
                                    {!node.isDirect && (
                                      <Badge variant="outline" className="text-[0.6rem] h-4 text-muted-foreground">indirect</Badge>
                                    )}
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    depth {node.depth}
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
          </TabsContent>

          {/* ─── Cross-Doc Links Tab ─── */}
          <TabsContent value="cross-doc" className="flex-1 min-h-0 mt-0">
            <TraceabilityTree
              nodes={crossDocTreeData}
              loading={crossDocTreeLoading}
              currentDocumentId={documentId}
              onNavigateToRequirement={onNavigateToRequirement}
            />
          </TabsContent>

          {/* ─── Graph Tab ─── */}
          <TabsContent value="graph" className="flex-1 min-h-0 mt-0">
            <TraceabilityGraph
              nodes={graphNodes}
              edges={graphEdges}
              selectedNodeId={graphSelectedNodeId}
              onNodeClick={handleGraphNodeClick}
            />
          </TabsContent>
        </Tabs>

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
              <div className="rounded-lg border p-4 bg-primary/5">
                <p className="text-xs text-muted-foreground">Source Requirement</p>
                <p className="text-sm font-semibold">{createLinkSource?.title}</p>
                <p className="text-xs text-muted-foreground">{createLinkSource?.level}</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Target Document</label>
                <Select value={selectedTargetDoc} onValueChange={handleTargetDocChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select document" />
                  </SelectTrigger>
                  <SelectContent>
                    {documents.map((doc) => (
                      <SelectItem key={doc.id} value={doc.id}>{doc.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Target Requirement</label>
                <Select value={selectedTargetReq} onValueChange={setSelectedTargetReq} disabled={!selectedTargetDoc}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select requirement" />
                  </SelectTrigger>
                  <SelectContent>
                    {targetDocReqs.map((req) => (
                      <SelectItem key={req.id} value={req.id}>
                        <div className="flex flex-col">
                          <span className="text-sm">{req.level} — {req.title}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Link Type</label>
                <Select value={selectedLinkType} onValueChange={(v) => setSelectedLinkType(v as LinkType)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select link type" />
                  </SelectTrigger>
                  <SelectContent>
                    {LINK_TYPES.map((lt) => (
                      <SelectItem key={lt} value={lt}>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-[0.7rem] h-5 ${LINK_TYPE_COLOR_CLASS[lt] || ''}`}>
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
              <Button onClick={handleCreateLink} disabled={!selectedTargetDoc || !selectedTargetReq || creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />}
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
                  ? 'bg-green-500/15 border-green-500/30 text-green-700 dark:text-green-400'
                  : snackbar.severity === 'error'
                  ? 'bg-red-500/15 border-red-500/30 text-red-700 dark:text-red-400'
                  : 'bg-sky-500/15 border-sky-500/30 text-sky-700 dark:text-sky-400'
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
