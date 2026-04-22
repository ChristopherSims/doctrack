import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  GitBranch as BranchIcon,
  Plus as AddIcon,
  GitMerge as MergeIcon,
  RefreshCw as RefreshIcon,
  CheckCircle2 as CheckIcon,
  X as XIcon,
  ArrowRight,
  RotateCcw,
  Loader2,
  Network,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import * as API from '../../api/api';

interface BranchesPageProps {
  documentId: string;
  documentTitle: string;
  currentBranch: string;
  onBranchChange: (branchName: string) => void;
}

const BRANCH_COLORS = [
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#10b981', // emerald
  '#8b5cf6', // violet
  '#ef4444', // red
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#f97316', // orange
];

// --- Flow Diagram Component ---

interface FlowNode {
  id: string;
  branchName: string;
  message: string;
  author: string;
  createdAt: string;
  parentCommitId: string | null;
  isMerge: boolean;
  isRevert?: boolean;
  isUncommitted?: boolean;
  mergeSourceBranch?: string | null;
}

interface FlowEdge {
  from: string;
  to: string;
  type: string;
}

interface FlowDiagramProps {
  nodes: FlowNode[];
  branches: any[];
  edges: FlowEdge[];
  currentBranch: string;
  onRevert?: (commitId: string, branchName: string) => void;
}

const FlowDiagram: React.FC<FlowDiagramProps> = ({ nodes, branches, edges, currentBranch, onRevert }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 500 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      setSize({ width: cr.width, height: cr.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Assign column (x position) to each branch
  const branchColumnMap = useMemo(() => {
    const map: Record<string, number> = {};
    const sorted = [...branches].sort((a, b) => {
      if (a.name === 'main') return -1;
      if (b.name === 'main') return 1;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    sorted.forEach((b, i) => {
      map[b.name] = i;
    });
    return map;
  }, [branches]);

  // Node lookup by id
  const nodeMap = useMemo(() => {
    const map: Record<string, FlowNode> = {};
    nodes.forEach(n => { map[n.id] = n; });
    return map;
  }, [nodes]);

  // Layout: assign each node an (x, y) position.
  const layout = useMemo(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    const branchRowCounts: Record<string, number> = {};
    let globalRow = 0;
    const sorted = [...nodes].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    for (const node of sorted) {
      const col = branchColumnMap[node.branchName] ?? 0;
      const branchRow = branchRowCounts[node.branchName] ?? 0;
      const row = Math.max(globalRow, branchRow);
      positions[node.id] = { x: col, y: row };
      branchRowCounts[node.branchName] = row + 1;
      globalRow = row + 1;
    }
    return positions;
  }, [nodes, branchColumnMap]);

  const branchColor = (name: string) => {
    const col = branchColumnMap[name] ?? 0;
    return BRANCH_COLORS[col % BRANCH_COLORS.length];
  };

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <div className="text-center">
          <Network className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No commits yet. Create a branch and make a commit to see the flow diagram.</p>
        </div>
      </div>
    );
  }

  const COL_WIDTH = 140;
  const ROW_HEIGHT = 56;
  const PADDING_X = 70;
  const PADDING_Y = 40;
  const NODE_R = 8;

  const maxCol = Math.max(...Object.values(branchColumnMap), 0);
  const maxY = Math.max(...Object.values(layout).map(p => p.y), 0);
  const contentWidth = (maxCol + 1) * COL_WIDTH + PADDING_X * 2;
  const contentHeight = (maxY + 1) * ROW_HEIGHT + PADDING_Y * 2;

  const nodeX = (id: string) => (layout[id]?.x ?? 0) * COL_WIDTH + PADDING_X;
  const nodeY = (id: string) => (layout[id]?.y ?? 0) * ROW_HEIGHT + PADDING_Y;

  // Pan via viewBox instead of <g transform> so SVG fills container without clipping
  const [view, setView] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isRubberBanding, setIsRubberBanding] = useState(false);
  const [rubberBand, setRubberBand] = useState<{x1:number;y1:number;x2:number;y2:number} | null>(null);
  const dragStart = useRef({ x: 0, y: 0, viewX: 0, viewY: 0 });

  // Clamp view with generous soft bounds (never let min > max)
  const clampView = (vx: number, vy: number) => {
    const pad = 300;
    const minX = -contentWidth - pad;
    const maxX = size.width + pad;
    const minY = -contentHeight - pad;
    const maxY = size.height + pad;
    return {
      x: Math.max(minX, Math.min(maxX, vx)),
      y: Math.max(minY, Math.min(maxY, vy)),
    };
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.shiftKey) {
      setIsRubberBanding(true);
      const svgX = view.x + e.nativeEvent.offsetX;
      const svgY = view.y + e.nativeEvent.offsetY;
      setRubberBand({ x1: svgX, y1: svgY, x2: svgX, y2: svgY });
    } else {
      setIsPanning(true);
      dragStart.current = { x: e.clientX, y: e.clientY, viewX: view.x, viewY: view.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setView(clampView(dragStart.current.viewX + dx, dragStart.current.viewY + dy));
    } else if (isRubberBanding && rubberBand) {
      const svgX = view.x + e.nativeEvent.offsetX;
      const svgY = view.y + e.nativeEvent.offsetY;
      setRubberBand({ ...rubberBand, x2: svgX, y2: svgY });
    }
  };

  const handleMouseUp = () => {
    if (isRubberBanding) {
      setIsRubberBanding(false);
      setRubberBand(null);
    }
    setIsPanning(false);
  };

  return (
    <div ref={containerRef} className="border rounded-md bg-card relative" style={{ height: '60vh', minHeight: 360 }}>
      {/* Legend */}
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-muted/30 flex-wrap">
        {branches.map((b) => (
          <div key={b.id} className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: branchColor(b.name) }} />
            <span className={b.name === currentBranch ? 'font-semibold' : ''}>{b.name}</span>
            {b.name === currentBranch && (
              <Badge variant="secondary" className="text-[0.55rem] h-3.5 px-1">current</Badge>
            )}
          </div>
        ))}
      </div>

      <svg
        width="100%"
        height="100%"
        viewBox={`${view.x} ${view.y} ${size.width} ${size.height}`}
        preserveAspectRatio="xMidYMid meet"
        className="select-none block"
        style={{ cursor: isPanning ? 'grabbing' : isRubberBanding ? 'crosshair' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <filter id="soft-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="soft-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.25" />
          </filter>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.08" />
          </pattern>
        </defs>

        {/* Subtle background grid */}
        <rect x={view.x} y={view.y} width={size.width} height={size.height} fill="url(#grid)" />

        {/* Branch vertical lane lines (background) */}
        {branches.map((b) => {
          const col = branchColumnMap[b.name] ?? 0;
          const x = col * COL_WIDTH + PADDING_X;
          const branchNodes = nodes.filter(n => n.branchName === b.name);
          if (branchNodes.length === 0) return null;
          const ys = branchNodes.map(n => layout[n.id]?.y ?? 0);
          const minY = Math.min(...ys) * ROW_HEIGHT + PADDING_Y;
          const maxY = Math.max(...ys) * ROW_HEIGHT + PADDING_Y;
          return (
            <line
              key={`bl-${b.id}`}
              x1={x}
              y1={minY - 15}
              x2={x}
              y2={maxY + 25}
              stroke={branchColor(b.name)}
              strokeWidth={4}
              opacity={0.08}
              strokeLinecap="round"
            />
          );
        })}

        {/* Edges */}
        {edges.map((edge, i) => {
          const fromNode = nodeMap[edge.from];
          const toNode = nodeMap[edge.to];
          if (!fromNode || !toNode || !layout[edge.from] || !layout[edge.to]) return null;

          const fx = nodeX(edge.from);
          const fy = nodeY(edge.from);
          const tx = nodeX(edge.to);
          const ty = nodeY(edge.to);

          const isCrossBranch = fromNode.branchName !== toNode.branchName;

          if (!isCrossBranch) {
            return (
              <line
                key={`e${i}`}
                x1={fx}
                y1={fy + NODE_R}
                x2={tx}
                y2={ty - NODE_R}
                stroke={branchColor(toNode.branchName)}
                strokeWidth={2.5}
                opacity={0.45}
              />
            );
          }

          const midY = fy + (ty - fy) * 0.5;
          const sourceColor = branchColor(fromNode.branchName);

          return (
            <path
              key={`e${i}`}
              d={`M ${fx} ${fy + NODE_R} C ${fx} ${midY}, ${tx} ${midY}, ${tx} ${ty - NODE_R}`}
              fill="none"
              stroke={sourceColor}
              strokeWidth={2}
              opacity={0.6}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          if (!layout[node.id]) return null;
          const x = nodeX(node.id);
          const y = nodeY(node.id);
          const color = branchColor(node.branchName);
          const isUncommitted = node.isUncommitted;
          const isCurrentBranchHead = branches.some(
            b => b.name === currentBranch && b.headCommitId === node.id
          );

          return (
            <g key={node.id}>
              {isCurrentBranchHead && (
                <circle cx={x} cy={y} r={NODE_R + 4} fill="none" stroke={color} strokeWidth={1.5} opacity={0.15} filter="url(#soft-glow)">
                  <animate attributeName="r" values={`${NODE_R + 4};${NODE_R + 10};${NODE_R + 4}`} dur="3s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.15;0.4;0.15" dur="3s" repeatCount="indefinite" />
                </circle>
              )}
              <circle
                cx={x}
                cy={y}
                r={NODE_R}
                fill={isUncommitted ? 'none' : color}
                stroke={color}
                strokeWidth={2}
                filter="url(#soft-shadow)"
                className="cursor-pointer"
              />
              <text
                x={x + NODE_R + 10}
                y={y + 4}
                className="fill-foreground"
                fontSize={11}
              >
                {node.message.length > 40 ? node.message.slice(0, 40) + '...' : node.message}
              </text>
              {!isUncommitted && (
                <text
                  x={x + NODE_R + 10}
                  y={y + 16}
                  className="fill-muted-foreground"
                  fontSize={9}
                >
                  {node.author} · {new Date(node.createdAt).toLocaleDateString()}
                </text>
              )}
              {onRevert && !isUncommitted && (
                <g
                  className="opacity-0 hover:opacity-100 cursor-pointer"
                  onClick={() => onRevert(node.id, node.branchName)}
                >
                  <rect
                    x={x - NODE_R - 20}
                    y={y - 9}
                    width={18}
                    height={18}
                    rx={3}
                    fill="hsl(var(--destructive))"
                    opacity={0.85}
                  />
                  <text x={x - NODE_R - 11} y={y + 4} textAnchor="middle" fontSize={10} fill="#fff">R</text>
                </g>
              )}
            </g>
          );
        })}

        {/* Branch name labels at the top */}
        {branches.map((b) => {
          const col = branchColumnMap[b.name] ?? 0;
          const x = col * COL_WIDTH + PADDING_X;
          const branchNodes = nodes.filter(n => n.branchName === b.name);
          if (branchNodes.length === 0) return null;
          return (
            <g key={`label-${b.id}`}>
              <rect
                x={x - 30}
                y={6}
                width={60}
                height={18}
                rx={4}
                fill={branchColor(b.name)}
                opacity={0.15}
              />
              <text
                x={x}
                y={19}
                textAnchor="middle"
                className="font-semibold"
                fill={branchColor(b.name)}
                fontSize={11}
              >
                {b.name}
              </text>
            </g>
          );
        })}

        {/* Rubber-band selection rectangle */}
        {isRubberBanding && rubberBand && (
          <rect
            x={Math.min(rubberBand.x1, rubberBand.x2)}
            y={Math.min(rubberBand.y1, rubberBand.y2)}
            width={Math.abs(rubberBand.x2 - rubberBand.x1)}
            height={Math.abs(rubberBand.y2 - rubberBand.y1)}
            fill="rgba(59, 130, 246, 0.08)"
            stroke="#3b82f6"
            strokeWidth={1}
            strokeDasharray="4,4"
            rx={4}
          >
            <animate attributeName="stroke-dashoffset" from="0" to="8" dur="0.5s" repeatCount="indefinite" />
          </rect>
        )}
      </svg>
    </div>
  );
};

// --- Main Branches Page ---

const BranchesPage: React.FC<BranchesPageProps> = ({ documentId, documentTitle, currentBranch, onBranchChange }) => {
  const [branches, setBranches] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Create branch dialog
  const [openBranchDialog, setOpenBranchDialog] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchDesc, setNewBranchDesc] = useState('');

  // Merge dropdown state (per branch)
  const [mergeTargetBranch, setMergeTargetBranch] = useState('');
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeSourceBranch, setMergeSourceBranch] = useState('');
  const [merging, setMerging] = useState(false);

  // Revert dialog
  const [revertDialogOpen, setRevertDialogOpen] = useState(false);
  const [revertCommitId, setRevertCommitId] = useState('');
  const [revertBranchName, setRevertBranchName] = useState('');
  const [reverting, setReverting] = useState(false);

  // Commit graph
  const [graphData, setGraphData] = useState<{ nodes: any[]; branches: any[]; edges: any[] } | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);

  useEffect(() => {
    loadBranches();
  }, [documentId]);

  const loadBranches = useCallback(async () => {
    setLoading(true);
    try {
      const result = await API.getBranches(documentId);
      if (result.success) setBranches(result.data || []);
    } catch (error) {
      console.error('Failed to load branches:', error);
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  const loadGraph = useCallback(async () => {
    setGraphLoading(true);
    try {
      const result = await API.getCommitGraph(documentId);
      if (result.success && result.data) {
        setGraphData(result.data);
      }
    } catch (err) {
      console.error('Failed to load commit graph:', err);
    } finally {
      setGraphLoading(false);
    }
  }, [documentId]);

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

  const openMergeDialog = (sourceBranch: string) => {
    setMergeSourceBranch(sourceBranch);
    setMergeTargetBranch('');
    setMergeDialogOpen(true);
  };

  const handleMergeBranch = async () => {
    if (!mergeSourceBranch || !mergeTargetBranch) return;
    setMerging(true);
    try {
      const result = await API.mergeBranch(documentId, {
        sourceBranch: mergeSourceBranch,
        targetBranch: mergeTargetBranch,
        author: 'system',
      });
      if (result.success) {
        setMergeDialogOpen(false);
        setMergeSourceBranch('');
        setMergeTargetBranch('');
        loadBranches();
        if (graphData) loadGraph();
      } else {
        setError(result.error || 'Merge failed');
      }
    } catch (error: any) {
      setError(error.message || 'Merge failed');
    } finally {
      setMerging(false);
    }
  };

  const openRevertDialog = (commitId: string, branchName: string) => {
    setRevertCommitId(commitId);
    setRevertBranchName(branchName);
    setRevertDialogOpen(true);
  };

  const handleRevert = async () => {
    if (!revertCommitId || !revertBranchName) return;
    setReverting(true);
    try {
      const result = await API.revertBranch(documentId, {
        branchName: revertBranchName,
        commitId: revertCommitId,
        author: 'system',
      });
      if (result.success) {
        setRevertDialogOpen(false);
        setRevertCommitId('');
        setRevertBranchName('');
        loadBranches();
        if (graphData) loadGraph();
      } else {
        setError(result.error || 'Revert failed');
      }
    } catch (error: any) {
      setError(error.message || 'Revert failed');
    } finally {
      setReverting(false);
    }
  };

  // Branch row component with GitHub-style merge dropdown
  const BranchRow: React.FC<{ branch: any; isLast: boolean }> = ({ branch, isLast }) => {
    const isCurrent = branch.name === currentBranch;
    const [showMergeSelect, setShowMergeSelect] = useState(false);

    return (
      <>
        <div
          className={`flex items-center gap-3 py-3 px-4 transition-colors ${isCurrent ? 'bg-primary/5' : 'hover:bg-accent/50'}`}
        >
          {/* Icon */}
          <div className="shrink-0 w-6 flex items-center justify-center">
            {isCurrent ? (
              <CheckIcon className="h-5 w-5 text-green-500" />
            ) : (
              <BranchIcon className="h-4 w-4 text-muted-foreground" />
            )}
          </div>

          {/* Branch info */}
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleCheckoutBranch(branch.name)}>
            <div className="flex items-center gap-2">
              <span className={`text-sm ${isCurrent ? 'font-semibold' : 'font-normal'}`}>
                {branch.name}
              </span>
              {isCurrent && (
                <Badge variant="secondary" className="h-5 text-[0.65rem] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  current
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {branch.description || 'No description'} · Created by {branch.createdBy} · {new Date(branch.createdAt).toLocaleDateString()}
            </span>
          </div>

          {/* Actions */}
          {!isCurrent && (
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMergeSelect(!showMergeSelect);
                }}
              >
                <MergeIcon className="h-3.5 w-3.5" />
                Merge to...
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCheckoutBranch(branch.name);
                }}
              >
                Switch
              </Button>
            </div>
          )}

          {isCurrent && (
            <div className="flex items-center gap-1.5 shrink-0">
              {branches.filter(b => b.name !== currentBranch).length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    openMergeDialog(currentBranch);
                  }}
                >
                  <MergeIcon className="h-3.5 w-3.5" />
                  Merge to...
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Inline merge target picker */}
        {showMergeSelect && !isCurrent && (
          <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 border-t">
            <span className="text-xs text-muted-foreground">Merge</span>
            <span className="text-xs font-medium">{branch.name}</span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            <Select
              value={mergeTargetBranch}
              onValueChange={(val) => {
                setMergeTargetBranch(val);
              }}
            >
              <SelectTrigger className="h-7 w-40 text-xs">
                <SelectValue placeholder="Select target..." />
              </SelectTrigger>
              <SelectContent>
                {branches
                  .filter(b => b.name !== branch.name)
                  .map(b => (
                    <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={!mergeTargetBranch}
              onClick={() => {
                setMergeSourceBranch(branch.name);
                setMergeDialogOpen(true);
                setShowMergeSelect(false);
              }}
            >
              Merge
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setShowMergeSelect(false)}
            >
              Cancel
            </Button>
          </div>
        )}

        {!isLast && <div className="border-t mx-4" />}
      </>
    );
  };

  return (
    <div className="p-3 flex flex-col gap-3 h-full">
      {/* Header */}
      <div className="rounded-lg border bg-card p-4 shrink-0">
        <div className="flex items-center gap-2">
          <BranchIcon className="h-7 w-7 text-primary" />
          <div className="flex-1">
            <h1 className="text-xl font-semibold">Branches</h1>
            <p className="text-sm text-muted-foreground">
              {documentTitle} — Manage branches, merges, and version history
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { loadBranches(); loadGraph(); }}
            >
              <RefreshIcon className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => setOpenBranchDialog(true)}
            >
              <AddIcon className="h-4 w-4" />
              New Branch
            </Button>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button variant="ghost" size="icon-xs" onClick={() => setError('')}>
              <XIcon className="h-3 w-3" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs: Branch List / Flow Diagram */}
      <Tabs defaultValue="branches" className="flex-1 min-h-0 flex flex-col">
        <TabsList className="shrink-0 w-fit">
          <TabsTrigger value="branches" className="gap-1.5">
            <BranchIcon className="size-3.5" />
            Branches
          </TabsTrigger>
          <TabsTrigger value="flow" className="gap-1.5" onClick={() => { if (!graphData) loadGraph(); }}>
            <Network className="size-3.5" />
            Flow Diagram
          </TabsTrigger>
        </TabsList>

        {/* Branches Tab */}
        <TabsContent value="branches" className="flex-1 min-h-0 mt-0">
          <div className="rounded-lg border bg-card">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : branches.length === 0 ? (
              <div className="p-8 text-center">
                <BranchIcon className="h-12 w-12 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-muted-foreground">No branches yet</p>
              </div>
            ) : (
              <div>
                {branches.map((branch, index) => (
                  <BranchRow key={branch.id} branch={branch} isLast={index === branches.length - 1} />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Flow Diagram Tab */}
        <TabsContent value="flow" className="flex-1 min-h-0 mt-0 overflow-auto">
          {graphLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : graphData ? (
            <FlowDiagram
              nodes={graphData.nodes}
              branches={graphData.branches}
              edges={graphData.edges}
              currentBranch={currentBranch}
              onRevert={openRevertDialog}
            />
          ) : (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <div className="text-center">
                <Network className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Click the Flow Diagram tab to load the commit graph</p>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Branch Dialog */}
      <Dialog open={openBranchDialog} onOpenChange={setOpenBranchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Branch</DialogTitle>
            <DialogDescription>Create a new branch from the current state of the document.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="branch-name">Branch Name</Label>
              <Input
                id="branch-name"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="e.g., feature/new-requirements"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="branch-desc">Description</Label>
              <Textarea
                id="branch-desc"
                value={newBranchDesc}
                onChange={(e) => setNewBranchDesc(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenBranchDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateBranch} disabled={!newBranchName}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Confirmation Dialog */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MergeIcon className="h-5 w-5 text-primary" />
              Confirm Merge
            </DialogTitle>
            <DialogDescription>
              This will merge all changes from the source branch into the target branch using a source-wins strategy.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 p-3 rounded-md border bg-muted/30">
              <div className="flex-1 text-center">
                <p className="text-xs text-muted-foreground mb-1">Source</p>
                <Badge variant="outline" className="font-mono">{mergeSourceBranch}</Badge>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 text-center">
                <p className="text-xs text-muted-foreground mb-1">Target</p>
                <Badge className="font-mono">{mergeTargetBranch}</Badge>
              </div>
            </div>
            {!mergeTargetBranch && (
              <div>
                <Label className="mb-1.5">Merge into</Label>
                <Select value={mergeTargetBranch} onValueChange={setMergeTargetBranch}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select target branch..." />
                  </SelectTrigger>
                  <SelectContent>
                    {branches
                      .filter(b => b.name !== mergeSourceBranch)
                      .map(b => (
                        <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleMergeBranch} disabled={!mergeSourceBranch || !mergeTargetBranch || merging}>
              {merging ? <Loader2 className="h-4 w-4 animate-spin" /> : <MergeIcon className="h-4 w-4" />}
              {merging ? 'Merging...' : 'Merge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revert Confirmation Dialog */}
      <Dialog open={revertDialogOpen} onOpenChange={setRevertDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-destructive" />
              Revert Branch
            </DialogTitle>
            <DialogDescription>
              This will revert branch <span className="font-mono font-semibold">{revertBranchName}</span> to the state at commit <span className="font-mono text-xs">{revertCommitId.slice(0, 8)}</span>. A new revert commit will be created.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border p-3 bg-destructive/5 text-sm text-muted-foreground">
            <p>This action creates a new commit that restores the branch to a previous state. The current state is not deleted — you can always revert again.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevertDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRevert} disabled={reverting}>
              {reverting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              {reverting ? 'Reverting...' : 'Revert'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BranchesPage;
