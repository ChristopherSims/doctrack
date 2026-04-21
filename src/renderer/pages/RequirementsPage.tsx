import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
} from '@tanstack/react-table';
import {
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  Save,
  Link2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Search,
  Download,
  Loader2,
  X,
  Tag,
  ArrowUpRight,
  ArrowDownLeft,
  Upload,
  MessageSquare,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  GitCompare,
  GitPullRequestDraft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

import type { Requirement, EditHistoryEntry, RequirementFilter, ChangeProposal } from '../../types/index';
import * as API from '../../api/api';
import RichTextEditor from '@/components/RichTextEditor';
import TagInput from '@/components/TagInput';
import CSVImportDialog from '@/components/CSVImportDialog';
import RequirementVersionDiff from '@/components/RequirementVersionDiff';
import {
  getLevelDepth,
  getParentLevels,
  filterVisibleRequirements,
  computeLevelOptions,
  levelComparator,
} from '../utils/levelTree';

interface RequirementsPageProps {
  documentId: string;
  onBack: () => void;
  highlightReqId?: string;
  onClearHighlight?: () => void;
  filter?: RequirementFilter;
}

const STATUS_OPTIONS = ['draft', 'review', 'approved', 'implemented', 'verified'] as const;
const PRIORITY_OPTIONS = ['low', 'medium', 'high'] as const;
const VERIFICATION_OPTIONS = ['manual', 'unit_test', 'integration_test', 'code_review', 'inspection', 'analysis', 'demonstration'] as const;

const priorityVariantMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  high: 'destructive',
  medium: 'outline',
  low: 'secondary',
};

const statusVariantMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  review: 'outline',
  approved: 'outline',
  implemented: 'outline',
  verified: 'outline',
};

const statusColorMap: Record<string, string> = {
  draft: 'text-muted-foreground',
  review: 'text-yellow-600 border-yellow-500/40 bg-yellow-500/10',
  approved: 'text-green-600 dark:text-green-400 border-green-500/40 bg-green-500/10',
  implemented: 'text-blue-600 dark:text-blue-400 border-blue-500/40 bg-blue-500/10',
  verified: 'text-white dark:text-white border-white/60 bg-black dark:bg-black',
};

/** CSS for rendered HTML in the description column */
const descriptionHtmlStyles = `
  .req-desc-html { max-height: 80px; overflow: hidden; font-size: 0.875rem; line-height: 1.25rem; }
  .req-desc-html table { font-size: 0.75rem; border-collapse: collapse; }
  .req-desc-html table td, .req-desc-html table th { border: 1px solid var(--border); padding: 2px 4px; }
  .req-desc-html img { max-height: 60px; }
`;

const priorityColorMap: Record<string, string> = {
  high: 'text-red-600',
  medium: 'text-yellow-600',
  low: 'text-green-600',
};

/* ─── Inline editable cell ─── */

function EditableCell({
  value,
  rowId,
  field,
  onCommit,
  type = 'text',
  options,
  displayRenderer,
  disabled = false,
}: {
  value: string;
  rowId: string;
  field: keyof Requirement;
  onCommit: (rowId: string, field: keyof Requirement, value: string) => void;
  type?: 'text' | 'select';
  options?: readonly string[];
  displayRenderer?: (value: string) => React.ReactNode;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  const commit = useCallback(() => {
    if (draft !== value) {
      onCommit(rowId, field, draft);
    }
    setEditing(false);
  }, [draft, value, rowId, field, onCommit]);

  if (!editing) {
    return (
      <div
        className={`w-full h-full px-1 py-0.5 min-h-[24px] flex items-center ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-text'}`}
        onDoubleClick={() => {
          if (!disabled) setEditing(true);
        }}
        title={disabled ? 'Editing disabled: select a Change Proposal' : 'Double-click to edit'}
      >
        {displayRenderer ? displayRenderer(value) : <span className="truncate text-sm">{value || '—'}</span>}
      </div>
    );
  }

  if (type === 'select' && options) {
    return (
      <select
        ref={inputRef as unknown as React.RefObject<HTMLSelectElement>}
        className="h-full w-full px-1 py-0 text-sm bg-background border border-primary rounded-sm outline-none"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          onCommit(rowId, field, e.target.value);
          setEditing(false);
        }}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setDraft(value);
            setEditing(false);
          }
        }}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt.replace(/_/g, ' ')}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      className="h-full w-full px-1 py-0 text-sm bg-background border border-primary rounded-sm outline-none"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit();
        }
        if (e.key === 'Escape') {
          setDraft(value);
          setEditing(false);
        }
      }}
    />
  );
}

const RequirementsPage: React.FC<RequirementsPageProps> = ({ documentId, onBack, highlightReqId, onClearHighlight, filter }) => {
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
  const [csvImportOpen, setCSVImportOpen] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [newReviewComment, setNewReviewComment] = useState('');
  const [reviewerName, setReviewerName] = useState('');
  const [openTraceability, setOpenTraceability] = useState(false);
  const [tracingReq, setTracingReq] = useState<Requirement | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [reqsForTrace, setReqsForTrace] = useState<Requirement[]>([]);
  const [selectedDocForTrace, setSelectedDocForTrace] = useState('');
  const [stats, setStats] = useState<{ total: number; byStatus: Record<string, number>; byPriority: Record<string, number> } | null>(null);

  // Traceability links for the edit dialog (incoming/outgoing)
  const [traceLinks, setTraceLinks] = useState<any[]>([]);
  const [traceLinksLoading, setTraceLinksLoading] = useState(false);
  const [traceAddDoc, setTraceAddDoc] = useState('');
  const [traceAddReqs, setTraceAddReqs] = useState<Requirement[]>([]);
  const [traceAddLoading, setTraceAddLoading] = useState(false);

  // Incoming link picker state
  const [traceInDoc, setTraceInDoc] = useState('');
  const [traceInReqs, setTraceInReqs] = useState<Requirement[]>([]);
  const [traceInLoading, setTraceInLoading] = useState(false);

  // Expand/collapse state
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set());

  // TanStack Table state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    changeRequestLink: false,
    testPlanLink: false,
    rationale: false,
    tags: false,
  });
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 50 });
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  const [lintOpen, setLintOpen] = useState(false);
  const [lintResults, setLintResults] = useState<any[]>([]);
  const [lintLoading, setLintLoading] = useState(false);

  // Change Proposal state
  const [changeProposals, setChangeProposals] = useState<ChangeProposal[]>([]);
  const [activeChangeProposal, setActiveChangeProposal] = useState<ChangeProposal | null>(null);
  const [cpGateOpen, setCpGateOpen] = useState(false);
  const [cpGateAction, setCpGateAction] = useState<'add' | 'edit' | null>(null);
  const [cpGateReq, setCpGateReq] = useState<Requirement | null>(null);
  const [newCpDialogOpen, setNewCpDialogOpen] = useState(false);
  const [newCpForm, setNewCpForm] = useState({ title: '', description: '' });
  const [creatingCp, setCreatingCp] = useState(false);

  // Edit history state
  const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null);
  const [editHistory, setEditHistory] = useState<EditHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([]);
  const [diffDialogOpen, setDiffDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'draft' as string,
    priority: 'medium' as string,
    changeRequestId: '',
    changeRequestLink: '',
    testPlan: '',
    testPlanLink: '',
    verificationMethod: 'manual' as string,
    level: '1',
    rationale: '',
    tags: [] as string[],
    customFields: {} as Record<string, string>,
    relatedRequirements: [] as string[],
    parentRequirementId: '' as string,
  });

  // Tag suggestions for autocomplete
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);

  useEffect(() => {
    loadData();
    setRowSelection({});
  }, [documentId]);

  // Apply highlight requirement filter when highlightReqId changes
  useEffect(() => {
    if (highlightReqId) {
      setGlobalFilter(highlightReqId);
    }
  }, [highlightReqId]);

  // Auto-hide snackbar
  useEffect(() => {
    if (snackbar.open) {
      const timer = setTimeout(() => setSnackbar(prev => ({ ...prev, open: false })), 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [snackbar.open]);

  // Load traceability links for a requirement (used in edit dialog)
  const loadTraceLinks = useCallback(async (reqId: string) => {
    setTraceLinksLoading(true);
    try {
      const result = await API.getTraceabilityLinks(reqId);
      if (result.success) {
        const rawLinks = result.data || [];
        // Classify direction at load time (same pattern as TraceabilityPage)
        const links = rawLinks.map((link: any) => ({
          ...link,
          direction: link.sourceRequirementId === reqId ? 'outgoing' : 'incoming' as 'outgoing' | 'incoming',
        }));
        setTraceLinks(links);
      } else {
        setTraceLinks([]);
      }
    } catch {
      setTraceLinks([]);
    } finally {
      setTraceLinksLoading(false);
    }
  }, []);

  // Load requirements for adding outgoing traceability links
  const loadReqsForTraceAdd = useCallback(async (docId: string) => {
    setTraceAddLoading(true);
    try {
      const result = await API.getRequirements(docId);
      if (result.success) {
        setTraceAddReqs(result.data || []);
      } else {
        setTraceAddReqs([]);
      }
    } catch {
      setTraceAddReqs([]);
    } finally {
      setTraceAddLoading(false);
    }
  }, []);

  // Load requirements for adding incoming traceability links
  const loadReqsForTraceIn = useCallback(async (docId: string) => {
    setTraceInLoading(true);
    try {
      const result = await API.getRequirements(docId);
      if (result.success) {
        setTraceInReqs(result.data || []);
      } else {
        setTraceInReqs([]);
      }
    } catch {
      setTraceInReqs([]);
    } finally {
      setTraceInLoading(false);
    }
  }, []);

  // Load edit history when a requirement is selected
  useEffect(() => {
    if (selectedRequirement) {
      setHistoryLoading(true);
      setSelectedHistoryIds([]);
      API.getRequirementHistory(selectedRequirement.id)
        .then((result) => {
          if (result.success) {
            setEditHistory(result.data || []);
          } else {
            setEditHistory([]);
          }
        })
        .catch(() => setEditHistory([]))
        .finally(() => setHistoryLoading(false));
    } else {
      setEditHistory([]);
      setSelectedHistoryIds([]);
    }
  }, [selectedRequirement]);

  // Compute parent levels from current requirements
  const parentLevelSet = useMemo(() => {
    const levels = requirements.map(r => r.level || '1');
    return getParentLevels(levels);
  }, [requirements]);

  // Compute visible rows based on expand/collapse state
  const visibleRequirements = useMemo(() => {
    return filterVisibleRequirements(requirements, expandedLevels);
  }, [requirements, expandedLevels]);

  // Apply shared RequirementFilter from App.tsx
  const filteredRequirements = useMemo(() => {
    if (!filter) return visibleRequirements;
    const titleQ = filter.title.trim().toLowerCase();
    const descriptionQ = filter.description.trim().toLowerCase();
    const statusQ = filter.status.trim().toLowerCase();
    const priorityQ = filter.priority.trim().toLowerCase();
    const verificationQ = filter.verification.trim().toLowerCase();
    const tagsQ = filter.tags.trim().toLowerCase();
    if (!titleQ && !descriptionQ && !statusQ && !priorityQ && !verificationQ && !tagsQ) return visibleRequirements;

    return visibleRequirements.filter((req) => {
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
  }, [visibleRequirements, filter]);

  // Compute dynamic level options for the dialog dropdown
  const levelOptions = useMemo(() => {
    const levels = requirements.map(r => r.level || '1');
    return computeLevelOptions(levels);
  }, [requirements]);

  const loadData = async () => {
    setLoading(true);
    try {
      const docResult = await API.getDocument(documentId);
      if (docResult.success) {
        setDocumentTitle(docResult.data?.title || '');
      }

      const reqResult = await API.getRequirements(documentId);
      if (reqResult.success) {
        const reqs = reqResult.data || [];
        reqs.sort((a: Requirement, b: Requirement) => levelComparator(a.level || '1', b.level || '1'));
        setRequirements(reqs);
        const levels = reqs.map((r: Requirement) => r.level || '1');
        setExpandedLevels(getParentLevels(levels));
      }

      const statsResult = await API.getDocumentStats(documentId);
      if (statsResult.success) {
        setStats(statsResult.data || null);
      }

      const allDocs = await API.getDocuments();
      if (allDocs.success) {
        setDocuments((allDocs.data || []).filter((d: any) => d.id !== documentId));
      }

      const cpResult = await API.getChangeProposals(documentId);
      if (cpResult.success) {
        setChangeProposals(cpResult.data || []);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = useCallback((level: string) => {
    setExpandedLevels(prev => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const levels = requirements.map(r => r.level || '1');
    setExpandedLevels(getParentLevels(levels));
  }, [requirements]);

  const collapseAll = useCallback(() => {
    setExpandedLevels(new Set());
  }, []);

  // Inline edit commit handler — updates the local requirements array
  const handleCellCommit = useCallback((rowId: string, field: keyof Requirement, value: string) => {
    if (!activeChangeProposal) {
      setCpGateOpen(true);
      return;
    }
    setRequirements(prev => {
      const next = prev.map(r => {
        if (r.id === rowId) {
          return { ...r, [field]: value };
        }
        return r;
      });
      return next;
    });
    setDirtyRows(prev => {
      const next = new Set(prev);
      next.add(rowId);
      return next;
    });
    setHasChanges(true);
  }, [activeChangeProposal]);

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
            tags: row.tags || [],
            custom_fields: row.customFields || {},
            related_requirements: row.relatedRequirements || [],
            parentRequirementId: row.parentRequirementId || '',
          });
        }
      }

      if (updates.length > 0) {
        const result = await API.batchUpdateRequirements(
          updates.map((u) => ({ ...u, changeProposalId: activeChangeProposal?.id }))
        );
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
    if (!activeChangeProposal) {
      setCpGateAction(req ? 'edit' : 'add');
      setCpGateReq(req || null);
      setCpGateOpen(true);
      return;
    }
    if (req) {
      setEditingReq(req);
      // Parse tags defensively
      let parsedTags: string[] = [];
      try {
        if (Array.isArray(req.tags)) {
          parsedTags = req.tags;
        } else if (typeof req.tags === 'string') {
          parsedTags = JSON.parse(req.tags);
        }
      } catch { parsedTags = []; }

      // Parse customFields defensively
      let parsedCustomFields: Record<string, string> = {};
      try {
        const cf = (req as any).customFields || (req as any).custom_fields;
        if (cf && typeof cf === 'object' && !Array.isArray(cf)) {
          parsedCustomFields = cf;
        } else if (typeof cf === 'string') {
          parsedCustomFields = JSON.parse(cf);
        }
      } catch { parsedCustomFields = {}; }

      // Parse relatedRequirements defensively
      let parsedRelated: string[] = [];
      try {
        const rr = (req as any).relatedRequirements || (req as any).related_requirements;
        if (Array.isArray(rr)) {
          parsedRelated = rr;
        } else if (typeof rr === 'string') {
          parsedRelated = JSON.parse(rr);
        }
      } catch { parsedRelated = []; }

      setFormData({
        title: req.title,
        description: req.description,
        status: req.status || 'draft',
        priority: req.priority,
        changeRequestId: req.changeRequestId || '',
        changeRequestLink: req.changeRequestLink || '',
        testPlan: req.testPlan || '',
        testPlanLink: req.testPlanLink || '',
        verificationMethod: req.verificationMethod || 'manual',
        level: req.level || '1',
        rationale: req.rationale || '',
        tags: parsedTags,
        customFields: parsedCustomFields,
        relatedRequirements: parsedRelated,
        parentRequirementId: req.parentRequirementId || '',
      });
      // Fetch traceability links for this requirement
      loadTraceLinks(req.id);
      // Fetch comments
      setCommentsLoading(true);
      API.getComments(req.id).then(res => {
        setComments(res.data || []);
        setCommentsLoading(false);
      }).catch(() => setCommentsLoading(false));
      // Fetch reviews
      setReviewsLoading(true);
      API.getReviews(req.id).then(res => {
        setReviews(res.data || []);
        setReviewsLoading(false);
      }).catch(() => setReviewsLoading(false));
    } else {
      setEditingReq(null);
      setFormData({
        title: '',
        description: '',
        status: 'draft',
        priority: 'medium',
        changeRequestId: '',
        changeRequestLink: '',
        testPlan: '',
        testPlanLink: '',
        verificationMethod: 'manual',
        level: '1',
        rationale: '',
        tags: [],
        customFields: {},
        relatedRequirements: [],
        parentRequirementId: '',
      });
      // Reset traceability state for new requirement
      setTraceLinks([]);
      setTraceAddDoc('');
      setTraceAddReqs([]);
      setTraceInDoc('');
      setTraceInReqs([]);
      // Reset comments for new requirement
      setComments([]);
      setNewCommentText('');
      // Reset reviews
      setReviews([]);
      setNewReviewComment('');
    }
    // Load tag suggestions
    API.getUniqueTags(documentId).then((result) => {
      if (result.success) {
        setTagSuggestions(result.data || []);
      }
    });
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingReq(null);
  };

  const handleSaveRequirement = async () => {
    try {
      const payload = {
        ...formData,
        tags: formData.tags,
        custom_fields: formData.customFields,
        related_requirements: formData.relatedRequirements,
        changeProposalId: activeChangeProposal?.id,
      };
      // Remove camelCase versions (backend expects snake_case for JSON fields)
      delete (payload as any).customFields;
      delete (payload as any).relatedRequirements;

      if (editingReq) {
        const result = await API.updateRequirement(editingReq.id, payload);
        if (result.success) {
          setSnackbar({ open: true, message: 'Requirement updated', severity: 'success' });
          await loadData();
        }
      } else {
        const result = await API.createRequirement({
          documentId,
          ...payload,
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

  const selectedRowIds = useMemo(() => {
    return Object.keys(rowSelection).filter((id) => rowSelection[id]);
  }, [rowSelection]);

  const handleBulkDelete = async () => {
    if (selectedRowIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedRowIds.length} selected requirements?`)) return;
    try {
      let failed = 0;
      for (const id of selectedRowIds) {
        const result = await API.deleteRequirement(id);
        if (!result.success) failed++;
      }
      setRowSelection({});
      await loadData();
      setSnackbar({
        open: true,
        message: `Deleted ${selectedRowIds.length - failed} requirements${failed > 0 ? `, ${failed} failed` : ''}`,
        severity: failed > 0 ? 'error' : 'success',
      });
    } catch (error) {
      console.error('Bulk delete failed:', error);
      setSnackbar({ open: true, message: 'Bulk delete failed', severity: 'error' });
    }
  };

  const handleBulkUpdateStatus = async (status: string) => {
    if (selectedRowIds.length === 0) return;
    const updates = selectedRowIds.map((id) => ({ id, status }));
    try {
      const result = await API.batchUpdateRequirements(updates);
      setRowSelection({});
      await loadData();
      setSnackbar({
        open: true,
        message: `Updated ${result.data?.length || selectedRowIds.length} requirements to ${status}`,
        severity: result.success ? 'success' : 'error',
      });
    } catch (error) {
      console.error('Bulk status update failed:', error);
      setSnackbar({ open: true, message: 'Bulk update failed', severity: 'error' });
    }
  };

  const handleBulkUpdatePriority = async (priority: string) => {
    if (selectedRowIds.length === 0) return;
    const updates = selectedRowIds.map((id) => ({ id, priority }));
    try {
      const result = await API.batchUpdateRequirements(updates);
      setRowSelection({});
      await loadData();
      setSnackbar({
        open: true,
        message: `Updated ${result.data?.length || selectedRowIds.length} requirements to ${priority}`,
        severity: result.success ? 'success' : 'error',
      });
    } catch (error) {
      console.error('Bulk priority update failed:', error);
      setSnackbar({ open: true, message: 'Bulk update failed', severity: 'error' });
    }
  };

  const handleBulkAddTag = async (tag: string) => {
    if (selectedRowIds.length === 0 || !tag.trim()) return;
    const trimmed = tag.trim();
    try {
      const reqs = requirements.filter((r) => selectedRowIds.includes(r.id));
      const updates = reqs.map((r) => {
        const tags = new Set(r.tags || []);
        tags.add(trimmed);
        return { id: r.id, tags: Array.from(tags) };
      });
      const result = await API.batchUpdateRequirements(updates);
      setRowSelection({});
      await loadData();
      setSnackbar({
        open: true,
        message: `Added tag "${trimmed}" to ${result.data?.length || selectedRowIds.length} requirements`,
        severity: result.success ? 'success' : 'error',
      });
    } catch (error) {
      console.error('Bulk add tag failed:', error);
      setSnackbar({ open: true, message: 'Bulk add tag failed', severity: 'error' });
    }
  };

  const handleLint = async () => {
    setLintLoading(true);
    try {
      const result = await API.lintDocument(documentId);
      if (result.success) {
        setLintResults(result.data || []);
        setLintOpen(true);
      } else {
        setSnackbar({ open: true, message: result.error || 'Lint failed', severity: 'error' });
      }
    } catch (error) {
      console.error('Lint failed:', error);
      setSnackbar({ open: true, message: 'Lint failed', severity: 'error' });
    } finally {
      setLintLoading(false);
    }
  };

  const handleContextMenu = useCallback((event: React.MouseEvent, rowId: string) => {
    event.preventDefault();
    setContextMenu({ mouseX: event.clientX, mouseY: event.clientY, rowId });
  }, []);

  const handleContextClose = useCallback(() => {
    setContextMenu(null);
  }, []);

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

  /* ─── CSV Export ─── */
  const handleExportCSV = useCallback(() => {
    const headers = ['Level', 'ID', 'Title', 'Description', 'Status', 'Priority', 'CR ID', 'CR Link', 'Test Plan', 'Test Plan Link', 'Verification', 'Rationale', 'Tags'];
    const rows = filteredRequirements.map(r => [
      r.level || '1',
      r.id,
      `"${(r.title || '').replace(/"/g, '""')}"`,
      `"${(r.description || '').replace(/"/g, '""')}"`,
      r.status,
      r.priority,
      r.changeRequestId || '',
      r.changeRequestLink || '',
      `"${(r.testPlan || '').replace(/"/g, '""')}"`,
      r.testPlanLink || '',
      r.verificationMethod || '',
      `"${(r.rationale || '').replace(/"/g, '""')}"`,
      `"${(Array.isArray(r.tags) ? r.tags.join(', ') : '').replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `requirements-${documentId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredRequirements, documentId]);

  /* ─── Column Definitions ─── */
  const columns = useMemo<ColumnDef<Requirement, string>[]>(() => [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },
    {
      accessorKey: 'level',
      header: 'Level',
      size: 180,
      cell: ({ row }) => {
        const level = row.original.level || '1';
        const depth = getLevelDepth(level);
        const isParent = parentLevelSet.has(level);
        const isExpanded = expandedLevels.has(level);

        return (
          <div
            className="flex items-center h-full w-full"
            style={{ paddingLeft: `${depth * 20}px` }}
          >
            {isParent ? (
              <button
                className="p-0.5 mr-1 rounded hover:bg-accent"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(level);
                }}
              >
                {isExpanded ? (
                  <ChevronDown className="size-4" />
                ) : (
                  <ChevronRight className="size-4" />
                )}
              </button>
            ) : (
              <span className="w-5 mr-1" />
            )}
            <EditableCell
              value={level}
              rowId={row.original.id}
              field="level"
              onCommit={handleCellCommit}
              type="select"
              options={levelOptions}
              disabled={!activeChangeProposal}
            />
          </div>
        );
      },
    },
    {
      accessorKey: 'id',
      header: 'ID',
      size: 130,
      cell: ({ getValue }) => (
        <span className="font-mono text-xs text-muted-foreground">{getValue()}</span>
      ),
      enableEditing: false,
    },
    {
      accessorKey: 'title',
      header: 'Title',
      size: 300,
      cell: ({ row }) => (
        <EditableCell
          value={row.original.title}
          rowId={row.original.id}
          field="title"
          onCommit={handleCellCommit}
          disabled={!activeChangeProposal}
        />
      ),
    },
    {
      accessorKey: 'description',
      header: 'Description',
      size: 350,
      cell: ({ row }) => {
        const desc = row.original.description || '';
        return (
          <EditableCell
            value={desc}
            rowId={row.original.id}
            field="description"
            onCommit={handleCellCommit}
            disabled={!activeChangeProposal}
            displayRenderer={(v) => {
              const val = v || '';
              const isHtml = /<[a-z][\s\S]*>/i.test(val);
              if (isHtml) {
                return (
                  <div
                    className="req-desc-html"
                    dangerouslySetInnerHTML={{ __html: val }}
                  />
                );
              }
              return <span className="truncate text-sm">{val || '\u2014'}</span>;
            }}
          />
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      size: 140,
      cell: ({ row }) => (
        <EditableCell
          value={row.original.status}
          rowId={row.original.id}
          field="status"
          onCommit={handleCellCommit}
          type="select"
          options={STATUS_OPTIONS}
          disabled={!activeChangeProposal}
          displayRenderer={(v) => (
            <Badge variant={statusVariantMap[v] || 'secondary'} className={statusColorMap[v] || ''}>
              {v || 'draft'}
            </Badge>
          )}
        />
      ),
      filterFn: 'equalsString',
    },
    {
      accessorKey: 'priority',
      header: 'Priority',
      size: 120,
      cell: ({ row }) => {
        if (row.original.status === 'verified') return null;
        return (
          <EditableCell
            value={row.original.priority}
            rowId={row.original.id}
            field="priority"
            onCommit={handleCellCommit}
            type="select"
            options={PRIORITY_OPTIONS}
            disabled={!activeChangeProposal}
            displayRenderer={(v) => (
              <Badge variant={priorityVariantMap[v] || 'secondary'} className={priorityColorMap[v] || ''}>
                {v || 'medium'}
              </Badge>
            )}
          />
        );
      },
      filterFn: 'equalsString',
    },
    {
      accessorKey: 'changeRequestId',
      header: 'CR ID',
      size: 130,
      cell: ({ row }) => (
        <EditableCell
          value={row.original.changeRequestId || ''}
          rowId={row.original.id}
          field="changeRequestId"
          onCommit={handleCellCommit}
          disabled={!activeChangeProposal}
          displayRenderer={(v) => <span className="text-xs">{v || '\u2014'}</span>}
        />
      ),
    },
    {
      accessorKey: 'changeRequestLink',
      header: 'CR Link',
      size: 160,
      cell: ({ getValue }) => {
        const val = getValue();
        return val ? (
          <a
            href={val}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline truncate block max-w-[140px]"
          >
            {val.length > 20 ? val.substring(0, 20) + '...' : val}
          </a>
        ) : (
          <span className="text-muted-foreground text-xs">{'\u2014'}</span>
        );
      },
    },
    {
      accessorKey: 'testPlan',
      header: 'Test Plan',
      size: 200,
      cell: ({ row }) => (
        <EditableCell
          value={row.original.testPlan || ''}
          rowId={row.original.id}
          field="testPlan"
          onCommit={handleCellCommit}
          disabled={!activeChangeProposal}
          displayRenderer={(v) => (
            <span className="truncate text-xs">{v || '\u2014'}</span>
          )}
        />
      ),
    },
    {
      accessorKey: 'testPlanLink',
      header: 'Test Plan Link',
      size: 160,
      cell: ({ getValue }) => {
        const val = getValue() as string;
        return val ? (
          <a
            href={val}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline truncate block max-w-[140px]"
          >
            {val.length > 20 ? val.substring(0, 20) + '...' : val}
          </a>
        ) : (
          <span className="text-muted-foreground text-xs">{'\u2014'}</span>
        );
      },
    },
    {
      accessorKey: 'verificationMethod',
      header: 'Verification',
      size: 150,
      cell: ({ row }) => (
        <EditableCell
          value={row.original.verificationMethod || ''}
          rowId={row.original.id}
          field="verificationMethod"
          onCommit={handleCellCommit}
          type="select"
          options={VERIFICATION_OPTIONS}
          disabled={!activeChangeProposal}
          displayRenderer={(v) => (
            <span className="text-xs">{v ? v.replace(/_/g, ' ') : '\u2014'}</span>
          )}
        />
      ),
    },
    {
      accessorKey: 'rationale',
      header: 'Rationale',
      size: 200,
      cell: ({ row }) => (
        <EditableCell
          value={row.original.rationale || ''}
          rowId={row.original.id}
          field="rationale"
          onCommit={handleCellCommit}
          disabled={!activeChangeProposal}
          displayRenderer={(v) => (
            <span className="truncate text-xs">{v || '\u2014'}</span>
          )}
        />
      ),
    },
    {
      accessorKey: 'tags',
      header: 'Tags',
      size: 180,
      cell: ({ row }) => {
        const tags = row.original.tags;
        const parsed = Array.isArray(tags) ? tags : [];
        if (parsed.length === 0) {
          return <span className="text-xs text-muted-foreground">{'\u2014'}</span>;
        }
        return (
          <div className="flex flex-wrap gap-0.5">
            {parsed.map((tag: string) => (
              <Badge key={tag} variant="secondary" className="text-[10px] px-1 py-0 h-4">
                {tag}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      size: 90,
      enableSorting: false,
      enableFiltering: true,
      cell: ({ row }) => (
        <div className="flex items-center gap-0.5">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => handleOpenDialog(requirements.find(r => r.id === row.original.id))}
                >
                  <Pencil className="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit details</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDeleteRequirement(row.original.id)}
                >
                  <Trash2 className="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      ),
    },
  ], [parentLevelSet, expandedLevels, toggleExpand, levelOptions, handleCellCommit, requirements]);

  const table = useReactTable({
    data: filteredRequirements,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      columnVisibility,
      pagination,
      rowSelection,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.id,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[80vh]">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Scoped styles for HTML description rendering */}
      <style dangerouslySetInnerHTML={{ __html: descriptionHtmlStyles }} />
      {/* ─── Document Top Bar ─── */}
      <div className="flex-shrink-0 border-b bg-card shadow-sm p-4">
        <div className="flex items-center gap-3 mb-1">
          <Button variant="ghost" size="icon-sm" onClick={onBack}>
            <ArrowLeft className="size-4" />
          </Button>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Document</p>
            <h1 className="text-xl font-semibold">{documentTitle}</h1>
          </div>
          {stats && (
            <div className="flex gap-1.5 flex-wrap">
              <Badge variant="outline">{stats.total} total</Badge>
              {Object.entries(stats.byStatus).map(([status, count]) => (
                <Badge key={status} variant={statusVariantMap[status] || 'secondary'} className={statusColorMap[status] || ''}>
                  {status}: {count}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Change Proposal Banner ─── */}
      <div className={`flex items-center gap-3 px-4 py-2 border-b flex-shrink-0 ${activeChangeProposal ? 'bg-blue-500/5 border-blue-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
        {activeChangeProposal ? (
          <>
            <GitPullRequestDraft className="size-4 text-blue-500" />
            <div className="flex-1 text-sm">
              <span className="text-muted-foreground">Active Change Proposal:</span>{' '}
              <span className="font-medium">{activeChangeProposal.title}</span>
              <Badge variant="outline" className="ml-2 text-xs capitalize">{activeChangeProposal.status}</Badge>
            </div>
            <Button variant="ghost" size="xs" onClick={() => setActiveChangeProposal(null)}>
              Clear
            </Button>
          </>
        ) : (
          <>
            <AlertTriangle className="size-4 text-amber-500" />
            <div className="flex-1 text-sm text-amber-700 dark:text-amber-400">
              No active Change Proposal. Editing is disabled. Select or create one to make changes.
            </div>
            <Button variant="outline" size="xs" onClick={() => setCpGateOpen(true)}>
              Select Change Proposal
            </Button>
          </>
        )}
      </div>

      {/* ─── Toolbar ─── */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/30 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <Button variant="default" size="sm" onClick={() => handleOpenDialog()}>
            <Plus className="size-3.5" />
            Add Requirement
          </Button>
          {hasChanges && (
            <Button variant="default" size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={handleSaveAllChanges}>
              <Save className="size-3.5" />
              Save All ({dirtyRows.size})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={expandAll}>
            Expand All
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Collapse All
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="size-3.5" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCSVImportOpen(true)}>
            <Upload className="size-3.5" />
            Import CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleLint} disabled={lintLoading}>
            {lintLoading ? <Loader2 className="size-3.5 animate-spin" /> : <AlertTriangle className="size-3.5" />}
            Lint
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {filter && (filter.title.trim() || filter.description.trim() || filter.status.trim() || filter.priority.trim() || filter.verification.trim() || filter.tags.trim()) && (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-xs gap-1">
              <Tag className="h-3 w-3" />
              Filtered: {filteredRequirements.length}/{visibleRequirements.length}
            </Badge>
          )}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={globalFilter ?? ''}
              onChange={(e) => {
                setGlobalFilter(e.target.value);
                if (onClearHighlight && highlightReqId) {
                  onClearHighlight();
                }
              }}
              className="h-8 w-48 pl-7 text-sm"
            />
            {globalFilter && (
              <button
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setGlobalFilter('');
                  if (onClearHighlight && highlightReqId) {
                    onClearHighlight();
                  }
                }}
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Bulk Actions Bar ─── */}
      {selectedRowIds.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-primary/5 flex-shrink-0">
          <span className="text-sm font-medium mr-1">
            {selectedRowIds.length} selected
          </span>
          <Button variant="outline" size="sm" onClick={() => handleBulkUpdateStatus('draft')}>
            Set Draft
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleBulkUpdateStatus('review')}>
            Set Review
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleBulkUpdateStatus('approved')}>
            Set Approved
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleBulkUpdatePriority('high')}>
            Set High
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleBulkUpdatePriority('medium')}>
            Set Medium
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleBulkUpdatePriority('low')}>
            Set Low
          </Button>
          <Input
            placeholder="Add tag..."
            className="h-7 w-28 text-xs"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleBulkAddTag((e.target as HTMLInputElement).value);
                (e.target as HTMLInputElement).value = '';
              }
            }}
          />
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={() => setRowSelection({})}>
            Clear
          </Button>
          <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        </div>
      )}

      {/* ─── Lint Results Panel ─── */}
      {lintOpen && (
        <div className="border-b bg-yellow-50 dark:bg-yellow-950/20 flex-shrink-0">
          <div className="flex items-center justify-between px-3 py-2 border-b border-yellow-200 dark:border-yellow-900">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              <span className="text-sm font-semibold">
                Quality Issues ({lintResults.reduce((acc, r) => acc + r.issues.length, 0)})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleLint} disabled={lintLoading}>
                <Loader2 className={`h-3.5 w-3.5 mr-1 ${lintLoading ? 'animate-spin' : ''}`} />
                Re-run
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setLintOpen(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="max-h-[200px] overflow-auto px-3 py-2">
            {lintResults.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 py-2">
                <CheckCircle2 className="h-4 w-4" />
                No issues found. Great job!
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {lintResults.map((result) => (
                  <div key={result.requirementId} className="rounded border bg-card p-2">
                    <button
                      className="text-sm font-medium hover:text-primary text-left"
                      onClick={() => {
                        setGlobalFilter(result.requirementId);
                        setLintOpen(false);
                      }}
                    >
                      {result.level} — {result.requirementTitle}
                    </button>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {result.issues.map((issue: any, idx: number) => (
                        <Badge
                          key={idx}
                          variant="outline"
                          className={`text-xs ${
                            issue.severity === 'error'
                              ? 'border-red-300 text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30'
                              : 'border-yellow-300 text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/30'
                          }`}
                        >
                          {issue.message}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Main Table ─── */}
      <div className="flex-1 min-h-0 overflow-auto" onContextMenu={(e) => {
        // Find the row from closest tr
        const rowEl = (e.target as HTMLElement).closest('tr[data-row-id]');
        if (rowEl) {
          const rowId = rowEl.getAttribute('data-row-id');
          if (rowId) {
            handleContextMenu(e, rowId);
          }
        }
      }}>
        <Table className="text-sm">
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id} className="bg-muted/50 hover:bg-muted/50">
                {headerGroup.headers.map(header => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                    className="cursor-pointer select-none"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() && (
                        <span className="text-xs">
                          {header.column.getIsSorted() === 'asc' ? ' ↑' : ' ↓'}
                        </span>
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map(row => {
                const isDirty = dirtyRows.has(row.original.id);
                const isHighlighted = highlightReqId === row.original.id;
                return (
                  <TableRow
                    key={row.id}
                    data-row-id={row.original.id}
                    className={`${isDirty ? 'bg-orange-50 dark:bg-orange-950/20' : ''} ${isHighlighted ? 'ring-2 ring-primary bg-primary/5' : ''} ${selectedRequirement?.id === row.original.id ? 'bg-accent/50' : ''} hover:bg-muted/50 cursor-pointer`}
                    onClick={() => setSelectedRequirement(row.original)}
                  >
                    {row.getVisibleCells().map(cell => (
                      <TableCell key={cell.id} className="p-0">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No requirements found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* ─── Pagination ─── */}
      <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/30 flex-shrink-0 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <span>|</span>
          <span>{filteredRequirements.length} rows</span>
          {dirtyRows.size > 0 && (
            <>
              <span>|</span>
              <span className="text-orange-600 font-medium">{dirtyRows.size} unsaved</span>
            </>
          )}
          {selectedRequirement && (
            <>
              <span>|</span>
              <span className="text-primary font-medium">Selected: {selectedRequirement.title}</span>
              <button
                className="text-muted-foreground hover:text-foreground ml-1"
                onClick={() => setSelectedRequirement(null)}
                title="Deselect"
              >
                <X className="size-3" />
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="xs"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            First
          </Button>
          <Button
            variant="outline"
            size="xs"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Prev
          </Button>
          <Button
            variant="outline"
            size="xs"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
          <Button
            variant="outline"
            size="xs"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            Last
          </Button>
          <select
            className="h-6 border rounded px-1 text-xs bg-background"
            value={table.getState().pagination.pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
          >
            {[25, 50, 100].map(size => (
              <option key={size} value={size}>{size}/page</option>
            ))}
          </select>
        </div>
      </div>

      {/* ─── Edit History Panel ─── */}
      {selectedRequirement && (
        <Card className="flex-shrink-0 mx-3 my-2">
          <CardHeader
            className="py-2 px-3 cursor-pointer flex flex-row items-center justify-between"
            onClick={() => setHistoryOpen(!historyOpen)}
          >
            <span className="text-sm font-medium">Edit History</span>
            {historyOpen ? (
              <ChevronUp className="size-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" />
            )}
          </CardHeader>
          {historyOpen && (
            <CardContent className="px-3 pb-3 pt-0">
              {historyLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading history...</span>
                </div>
              ) : editHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No edit history</p>
              ) : (
                <div className="overflow-x-auto">
                  {selectedHistoryIds.length === 2 && (
                    <div className="flex items-center gap-2 mb-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDiffDialogOpen(true)}
                      >
                        <GitCompare className="h-3.5 w-3.5 mr-1" />
                        Compare Versions
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Comparing {selectedHistoryIds.length} versions
                      </span>
                    </div>
                  )}
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-1.5 pr-2 w-8"></th>
                        <th className="pb-1.5 pr-3 font-medium">Field</th>
                        <th className="pb-1.5 pr-3 font-medium">Old Value</th>
                        <th className="pb-1.5 pr-3 font-medium">New Value</th>
                        <th className="pb-1.5 pr-3 font-medium">User</th>
                        <th className="pb-1.5 pr-3 font-medium">Branch</th>
                        <th className="pb-1.5 font-medium">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editHistory.map((entry) => {
                        const isSelected = selectedHistoryIds.includes(entry.id);
                        return (
                          <tr
                            key={entry.id}
                            className={`border-b last:border-0 ${isSelected ? 'bg-primary/5' : ''}`}
                          >
                            <td className="py-1.5 pr-2">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => {
                                  setSelectedHistoryIds((prev) => {
                                    if (prev.includes(entry.id)) {
                                      return prev.filter((id) => id !== entry.id);
                                    }
                                    if (prev.length >= 2) {
                                      return [...prev.slice(1), entry.id];
                                    }
                                    return [...prev, entry.id];
                                  });
                                }}
                                aria-label={`Select history entry ${entry.id}`}
                              />
                            </td>
                            <td className="py-1.5 pr-3 font-medium">{entry.field}</td>
                            <td className="py-1.5 pr-3 text-muted-foreground max-w-[200px] truncate">
                              {entry.oldValue ?? '\u2014'}
                            </td>
                            <td className="py-1.5 pr-3 max-w-[200px] truncate">
                              {entry.newValue ?? '\u2014'}
                            </td>
                            <td className="py-1.5 pr-3">{entry.userName || entry.userId}</td>
                            <td className="py-1.5 pr-3 font-mono text-xs">{entry.branchName || '\u2014'}</td>
                            <td className="py-1.5 text-xs text-muted-foreground whitespace-nowrap">
                              {entry.timestamp
                                ? new Date(entry.timestamp).toLocaleString(undefined, {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '\u2014'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <RequirementVersionDiff
                    open={diffDialogOpen}
                    onClose={() => setDiffDialogOpen(false)}
                    requirementId={selectedRequirement?.id || ''}
                    leftEntry={(() => {
                      const entries = editHistory.filter((e) => selectedHistoryIds.includes(e.id));
                      entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                      return entries[0] || null;
                    })()}
                    rightEntry={(() => {
                      const entries = editHistory.filter((e) => selectedHistoryIds.includes(e.id));
                      entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                      return entries[1] || null;
                    })()}
                  />
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* ─── Context Menu ─── */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-popover border rounded-md shadow-lg py-1 min-w-[160px]"
          style={{ top: contextMenu.mouseY, left: contextMenu.mouseX }}
          onClick={handleContextClose}
        >
          <button
            className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent text-left"
            onClick={() => {
              const req = requirements.find(r => r.id === contextMenu.rowId);
              if (req) handleOpenDialog(req);
            }}
          >
            <Pencil className="size-3.5" />
            Edit Details
          </button>
          <button
            className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent text-left"
            onClick={() => {
              const req = requirements.find(r => r.id === contextMenu.rowId);
              if (req) {
                setTracingReq(req);
                setOpenTraceability(true);
              }
            }}
          >
            <Link2 className="size-3.5" />
            Link Traceability
          </button>
          <button
            className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent text-destructive text-left"
            onClick={() => handleDeleteRequirement(contextMenu.rowId)}
          >
            <Trash2 className="size-3.5" />
            Delete
          </button>
        </div>
      )}
      {/* Overlay to close context menu on outside click */}
      {contextMenu && (
        <div className="fixed inset-0 z-40" onClick={handleContextClose} onContextMenu={handleContextClose} />
      )}

      {/* ─── Add/Edit Dialog ─── */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingReq ? 'Edit Requirement' : 'New Requirement'}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="relations">Relations</TabsTrigger>
              <TabsTrigger value="reviews" className="gap-1">
                <ShieldAlert className="size-3.5" />
                Reviews
                {reviews.length > 0 && (
                  <Badge variant="secondary" className="ml-0.5 h-4 min-w-4 text-[0.6rem] px-1">{reviews.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="comments" className="gap-1">
                <MessageSquare className="size-3.5" />
                Comments
                {comments.length > 0 && (
                  <Badge variant="secondary" className="ml-0.5 h-4 min-w-4 text-[0.6rem] px-1">{comments.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ─── Basic Tab ─── */}
            <TabsContent value="basic" className="grid gap-4 py-2">
              <div className="flex gap-3">
                <div className="w-40">
                  <Label className="mb-1.5">Level</Label>
                  <Select
                    value={formData.level}
                    onValueChange={(val) => setFormData({ ...formData, level: val })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Level" />
                    </SelectTrigger>
                    <SelectContent>
                      {levelOptions.map((opt) => {
                        const depth = getLevelDepth(opt);
                        return (
                          <SelectItem key={opt} value={opt}>
                            <span className="font-mono" style={{ paddingLeft: `${depth * 12}px` }}>
                              {opt}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label className="mb-1.5">Title</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    autoFocus
                  />
                </div>
              </div>
              <div>
                <Label className="mb-1.5">Description</Label>
                <RichTextEditor
                  value={formData.description}
                  onChange={(html) => setFormData({ ...formData, description: html })}
                  placeholder="Enter requirement description..."
                />
              </div>
              <div className="flex gap-3">
                <div className="w-40">
                  <Label className="mb-1.5">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(val) => setFormData({ ...formData, status: val })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(opt => (
                        <SelectItem key={opt} value={opt}>
                          <span className="capitalize">{opt}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-40">
                  <Label className="mb-1.5">Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(val) => setFormData({ ...formData, priority: val })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label className="mb-1.5">Verification Method</Label>
                  <Select
                    value={formData.verificationMethod}
                    onValueChange={(val) => setFormData({ ...formData, verificationMethod: val })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Verification Method" />
                    </SelectTrigger>
                    <SelectContent>
                      {VERIFICATION_OPTIONS.map(opt => (
                        <SelectItem key={opt} value={opt}>{opt.replace(/_/g, ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* ─── Details Tab ─── */}
            <TabsContent value="details" className="grid gap-4 py-2">
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label className="mb-1.5">Change Request ID</Label>
                  <Input
                    value={formData.changeRequestId}
                    onChange={(e) => setFormData({ ...formData, changeRequestId: e.target.value })}
                    placeholder="e.g., CR-2024-001"
                  />
                </div>
                <div className="flex-1">
                  <Label className="mb-1.5">CR Link</Label>
                  <Input
                    value={formData.changeRequestLink}
                    onChange={(e) => setFormData({ ...formData, changeRequestLink: e.target.value })}
                    placeholder="URL to CR document"
                  />
                </div>
              </div>
              <div>
                <Label className="mb-1.5">Test Plan</Label>
                <Textarea
                  value={formData.testPlan}
                  onChange={(e) => setFormData({ ...formData, testPlan: e.target.value })}
                  rows={2}
                  placeholder="Describe test approach or reference test document"
                />
              </div>
              <div>
                <Label className="mb-1.5">Test Plan Link</Label>
                <Input
                  value={formData.testPlanLink}
                  onChange={(e) => setFormData({ ...formData, testPlanLink: e.target.value })}
                  placeholder="URL to test plan document"
                  type="url"
                />
              </div>
              <div>
                <Label className="mb-1.5">Rationale</Label>
                <Textarea
                  value={formData.rationale}
                  onChange={(e) => setFormData({ ...formData, rationale: e.target.value })}
                  rows={2}
                  placeholder="Why this requirement exists"
                />
              </div>
              <div>
                <Label className="mb-1.5 flex items-center gap-1.5">
                  <Tag className="size-3.5" />
                  Tags
                </Label>
                <TagInput
                  tags={formData.tags}
                  suggestions={tagSuggestions}
                  onChange={(tags) => setFormData({ ...formData, tags })}
                  placeholder="Type and press Enter to add tags..."
                />
              </div>
              {/* Custom Fields */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label>Custom Fields</Label>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      const key = `field_${Object.keys(formData.customFields).length + 1}`;
                      setFormData({
                        ...formData,
                        customFields: { ...formData.customFields, [key]: '' },
                      });
                    }}
                  >
                    <Plus className="size-3 mr-1" />
                    Add Field
                  </Button>
                </div>
                {Object.keys(formData.customFields).length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No custom fields. Click "Add Field" to create one.</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(formData.customFields).map(([key, value]) => (
                      <div key={key} className="flex gap-2 items-center">
                        <Input
                          value={key}
                          onChange={(e) => {
                            const newFields = { ...formData.customFields };
                            delete newFields[key];
                            newFields[e.target.value] = value;
                            setFormData({ ...formData, customFields: newFields });
                          }}
                          className="w-1/3"
                          placeholder="Field name"
                        />
                        <Input
                          value={value}
                          onChange={(e) => {
                            setFormData({
                              ...formData,
                              customFields: { ...formData.customFields, [key]: e.target.value },
                            });
                          }}
                          className="flex-1"
                          placeholder="Value"
                        />
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            const newFields = { ...formData.customFields };
                            delete newFields[key];
                            setFormData({ ...formData, customFields: newFields });
                          }}
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ─── Relations Tab ─── */}
            <TabsContent value="relations" className="grid gap-4 py-2">
              {/* Parent Requirement Picker */}
              <div>
                <Label className="mb-1.5">Parent Requirement</Label>
                <Select
                  value={formData.parentRequirementId || '__none__'}
                  onValueChange={(val) => setFormData({ ...formData, parentRequirementId: val === '__none__' ? '' : val })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="None (root level)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None (root level)</SelectItem>
                    {requirements
                      .filter((r) => {
                        // Filter: valid parents only
                        // A parent's level must be a prefix of the current requirement's level
                        const currentLevel = formData.level;
                        if (!currentLevel || currentLevel === '1') return false; // root level has no parent
                        const parts = currentLevel.split('.');
                        // Valid parents: levels with one fewer dot segment (e.g., for "1.2.3", valid parents are "1" and "1.2")
                        const validParentLevels: string[] = [];
                        for (let i = 1; i < parts.length; i++) {
                          validParentLevels.push(parts.slice(0, i).join('.'));
                        }
                        return validParentLevels.includes(r.level || '1');
                      })
                      .map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.level} - {r.title}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Traceability Links (incoming/outgoing) */}
              <div className="space-y-3">
                <Label className="mb-1.5">Traceability Links</Label>
                {traceLinksLoading && (
                  <div className="flex items-center gap-2 py-2">
                    <Loader2 className="size-3.5 animate-spin" />
                    <span className="text-xs text-muted-foreground">Loading links...</span>
                  </div>
                )}
                {!traceLinksLoading && traceLinks.length === 0 && editingReq && (
                  <p className="text-xs text-muted-foreground py-1">No traceability links yet.</p>
                )}
                {!traceLinksLoading && traceLinks.length > 0 && (
                  <div className="space-y-3">
                    {/* Outgoing links */}
                    {traceLinks.filter(l => l.direction === 'outgoing').length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
                          <ArrowUpRight className="size-3.5" />
                          Outgoing ({traceLinks.filter(l => l.direction === 'outgoing').length})
                        </div>
                        <div className="space-y-1">
                          {traceLinks
                            .filter(l => l.direction === 'outgoing')
                            .map(link => (
                              <div key={link.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border bg-blue-500/5 text-sm">
                                <ArrowUpRight className="size-3.5 text-blue-500 flex-shrink-0" />
                                <span className="font-mono text-xs">{link.targetReqLevel || link.targetRequirementId}</span>
                                <span className="truncate text-muted-foreground">{link.targetReqTitle || link.targetRequirementId}</span>
                                {link.targetDocTitle && (
                                  <span className="text-xs text-muted-foreground/70 ml-auto flex-shrink-0">({link.targetDocTitle})</span>
                                )}
                                <button
                                  type="button"
                                  className="ml-1 rounded-full hover:bg-destructive/10 p-0.5 flex-shrink-0"
                                  title="Remove link"
                                  onClick={async () => {
                                    const result = await API.deleteTraceabilityLink(link.id);
                                    if (result.success && editingReq) {
                                      loadTraceLinks(editingReq.id);
                                    }
                                  }}
                                >
                                  <X className="size-3 text-destructive" />
                                </button>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                    {/* Incoming links */}
                    {traceLinks.filter(l => l.direction === 'incoming').length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
                          <ArrowDownLeft className="size-3.5" />
                          Incoming ({traceLinks.filter(l => l.direction === 'incoming').length})
                        </div>
                        <div className="space-y-1">
                          {traceLinks
                            .filter(l => l.direction === 'incoming')
                            .map(link => (
                              <div key={link.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border bg-green-500/5 text-sm">
                                <ArrowDownLeft className="size-3.5 text-green-500 flex-shrink-0" />
                                <span className="font-mono text-xs">{link.sourceReqLevel || link.sourceRequirementId}</span>
                                <span className="truncate text-muted-foreground">{link.sourceReqTitle || link.sourceRequirementId}</span>
                                {link.sourceDocTitle && (
                                  <span className="text-xs text-muted-foreground/70 ml-auto flex-shrink-0">({link.sourceDocTitle})</span>
                                )}
                                <button
                                  type="button"
                                  className="ml-1 rounded-full hover:bg-destructive/10 p-0.5 flex-shrink-0"
                                  title="Remove link"
                                  onClick={async () => {
                                    const result = await API.deleteTraceabilityLink(link.id);
                                    if (result.success && editingReq) {
                                      loadTraceLinks(editingReq.id);
                                    }
                                  }}
                                >
                                  <X className="size-3 text-destructive" />
                                </button>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Add new outgoing link */}
                {editingReq && (
                  <div className="border-t pt-3 mt-2 space-y-2">
                    <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <ArrowUpRight className="size-3.5" />
                      Add Outgoing Link
                    </div>
                    <Select
                      value={traceAddDoc}
                      onValueChange={(val) => {
                        setTraceAddDoc(val);
                        setTraceAddReqs([]);
                        loadReqsForTraceAdd(val);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select target document..." />
                      </SelectTrigger>
                      <SelectContent>
                        {documents
                          .filter((d) => d.id !== documentId)
                          .map((doc) => (
                            <SelectItem key={doc.id} value={doc.id}>
                              {doc.title}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {traceAddLoading && (
                      <div className="flex items-center gap-2 py-1">
                        <Loader2 className="size-3 animate-spin" />
                        <span className="text-xs text-muted-foreground">Loading...</span>
                      </div>
                    )}
                    {!traceAddLoading && traceAddReqs.length > 0 && (
                      <div className="max-h-40 overflow-y-auto border rounded-md divide-y">
                        {traceAddReqs.map((req) => (
                          <button
                            key={req.id}
                            type="button"
                            className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent flex items-center gap-2"
                            onClick={async () => {
                              if (!editingReq) return;
                              try {
                                const result = await API.createTraceabilityLink({
                                  sourceRequirementId: editingReq.id,
                                  targetRequirementId: req.id,
                                  targetDocumentId: traceAddDoc,
                                  linkType: 'traces',
                                });
                                if (result.success) {
                                  // Reset add-link picker
                                  setTraceAddDoc('');
                                  setTraceAddReqs([]);
                                  loadTraceLinks(editingReq.id);
                                  setSnackbar({ open: true, message: 'Link created', severity: 'success' });
                                } else {
                                  setSnackbar({ open: true, message: result.error || 'Failed to create link', severity: 'error' });
                                }
                              } catch {
                                setSnackbar({ open: true, message: 'Failed to create link', severity: 'error' });
                              }
                            }}
                          >
                            <ArrowUpRight className="size-3 text-muted-foreground flex-shrink-0" />
                            <span className="font-mono text-xs text-muted-foreground">{req.id}</span>
                            <span className="truncate">{req.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {!traceAddLoading && traceAddDoc && traceAddReqs.length === 0 && (
                      <p className="text-xs text-muted-foreground py-1">No requirements in this document.</p>
                    )}
                  </div>
                )}

                {/* Add incoming link */}
                {editingReq && (
                  <div className="border-t pt-3 mt-2 space-y-2">
                    <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <ArrowDownLeft className="size-3.5" />
                      Add Incoming Link
                    </div>
                    <Select
                      value={traceInDoc}
                      onValueChange={(val) => {
                        setTraceInDoc(val);
                        setTraceInReqs([]);
                        loadReqsForTraceIn(val);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select source document..." />
                      </SelectTrigger>
                      <SelectContent>
                        {documents
                          .filter((d) => d.id !== documentId)
                          .map((doc) => (
                            <SelectItem key={doc.id} value={doc.id}>
                              {doc.title}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {traceInLoading && (
                      <div className="flex items-center gap-2 py-1">
                        <Loader2 className="size-3 animate-spin" />
                        <span className="text-xs text-muted-foreground">Loading...</span>
                      </div>
                    )}
                    {!traceInLoading && traceInReqs.length > 0 && (
                      <div className="max-h-40 overflow-y-auto border rounded-md divide-y">
                        {traceInReqs.map((req) => (
                          <button
                            key={req.id}
                            type="button"
                            className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent flex items-center gap-2"
                            onClick={async () => {
                              if (!editingReq) return;
                              try {
                                // Incoming: picked req is SOURCE, current req is TARGET
                                const result = await API.createTraceabilityLink({
                                  sourceRequirementId: req.id,
                                  targetRequirementId: editingReq.id,
                                  targetDocumentId: documentId,
                                  linkType: 'traces',
                                });
                                if (result.success) {
                                  setTraceInDoc('');
                                  setTraceInReqs([]);
                                  loadTraceLinks(editingReq.id);
                                  setSnackbar({ open: true, message: 'Link created', severity: 'success' });
                                } else {
                                  setSnackbar({ open: true, message: result.error || 'Failed to create link', severity: 'error' });
                                }
                              } catch {
                                setSnackbar({ open: true, message: 'Failed to create link', severity: 'error' });
                              }
                            }}
                          >
                            <ArrowDownLeft className="size-3 text-muted-foreground flex-shrink-0" />
                            <span className="font-mono text-xs text-muted-foreground">{req.id}</span>
                            <span className="truncate">{req.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {!traceInLoading && traceInDoc && traceInReqs.length === 0 && (
                      <p className="text-xs text-muted-foreground py-1">No requirements in this document.</p>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ─── Reviews Tab ─── */}
            <TabsContent value="reviews" className="grid gap-4 py-2">
              <div className="space-y-3">
                {reviewsLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground py-4">
                    <Loader2 className="size-4 animate-spin" />
                    Loading reviews...
                  </div>
                ) : reviews.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No reviews yet.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {reviews.map((review) => (
                      <div key={review.id} className="border rounded-md p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{review.reviewerName}</span>
                            <Badge
                              className={
                                review.status === 'approved'
                                  ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200'
                                  : review.status === 'rejected'
                                  ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200'
                                  : 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200'
                              }
                            >
                              {review.status}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(review.createdAt).toLocaleString()}
                          </span>
                        </div>
                        {review.comment && (
                          <p className="text-sm text-muted-foreground">{review.comment}</p>
                        )}
                        {review.status === 'pending' && (
                          <div className="flex items-center gap-2 pt-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 border-green-300 hover:bg-green-50"
                              onClick={() => {
                                API.updateReview(review.id, { status: 'approved', comment: review.comment }).then(res => {
                                  if (res.success) {
                                    setReviews(prev => prev.map(r => r.id === review.id ? res.data : r));
                                    // Also update requirement status to approved
                                    if (editingReq) {
                                      API.updateRequirement(editingReq.id, { status: 'approved' }).then(() => loadData());
                                    }
                                  }
                                });
                              }}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-300 hover:bg-red-50"
                              onClick={() => {
                                const reason = window.prompt('Rejection reason / comment:');
                                if (reason === null) return;
                                API.updateReview(review.id, { status: 'rejected', comment: reason }).then(res => {
                                  if (res.success) {
                                    setReviews(prev => prev.map(r => r.id === review.id ? res.data : r));
                                    if (editingReq) {
                                      API.updateRequirement(editingReq.id, { status: 'draft' }).then(() => loadData());
                                    }
                                  }
                                });
                              }}
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {editingReq && (
                  <div className="border-t pt-3 space-y-2">
                    <p className="text-sm font-medium">Submit for Review</p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Reviewer name"
                        value={reviewerName}
                        onChange={(e) => setReviewerName(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        size="sm"
                        disabled={!reviewerName.trim()}
                        onClick={() => {
                          API.createReview(editingReq.id, {
                            reviewerName: reviewerName.trim(),
                            comment: newReviewComment.trim() || undefined,
                          }).then(res => {
                            if (res.success) {
                              setReviews(prev => [res.data, ...prev]);
                              setReviewerName('');
                              setNewReviewComment('');
                              // Update requirement status to review
                              API.updateRequirement(editingReq.id, { status: 'review' }).then(() => loadData());
                            }
                          });
                        }}
                      >
                        Submit
                      </Button>
                    </div>
                    <Input
                      placeholder="Optional comment / note"
                      value={newReviewComment}
                      onChange={(e) => setNewReviewComment(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ─── Comments Tab ─── */}
            <TabsContent value="comments" className="py-2">
              <div className="space-y-3">
                {commentsLoading && (
                  <div className="flex items-center gap-2 py-4 justify-center">
                    <Loader2 className="size-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Loading comments...</span>
                  </div>
                )}
                {!commentsLoading && comments.length === 0 && (
                  <div className="text-center py-6">
                    <MessageSquare className="size-8 mx-auto text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground mt-2">No comments yet</p>
                  </div>
                )}
                {!commentsLoading && comments.length > 0 && (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {comments.map((c: any) => (
                      <div key={c.id} className="rounded-md border px-3 py-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium">{c.author || 'User'}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[0.65rem] text-muted-foreground">
                              {new Date(c.createdAt).toLocaleString()}
                            </span>
                            <button
                              type="button"
                              className="rounded-full hover:bg-destructive/10 p-0.5"
                              title="Delete comment"
                              onClick={async () => {
                                if (!editingReq) return;
                                const res = await API.deleteComment(c.id);
                                if (res.success) {
                                  setComments(prev => prev.filter((x: any) => x.id !== c.id));
                                }
                              }}
                            >
                              <X className="size-3 text-muted-foreground hover:text-destructive" />
                            </button>
                          </div>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{c.text}</p>
                      </div>
                    ))}
                  </div>
                )}
                {/* Add comment */}
                {editingReq && (
                  <div className="flex gap-2 pt-2 border-t">
                    <textarea
                      className="flex-1 min-h-[60px] rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                      placeholder="Add a comment..."
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          // Submit comment
                          if (!editingReq || !newCommentText.trim()) return;
                          API.createComment({
                            requirementId: editingReq.id,
                            content: newCommentText.trim(),
                            authorType: 'user',
                          }).then(res => {
                            if (res.data) {
                              setComments(prev => [...prev, res.data]);
                              setNewCommentText('');
                            }
                          });
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      className="self-end"
                      disabled={!newCommentText.trim()}
                      onClick={() => {
                        if (!editingReq || !newCommentText.trim()) return;
                        API.createComment({
                          requirementId: editingReq.id,
                          content: newCommentText.trim(),
                          authorType: 'user',
                        }).then(res => {
                          if (res.data) {
                            setComments(prev => [...prev, res.data]);
                            setNewCommentText('');
                          }
                        });
                      }}
                    >
                      Post
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
            <Button onClick={handleSaveRequirement}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Traceability Dialog ─── */}
      <Dialog open={openTraceability} onOpenChange={setOpenTraceability}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link Traceability</DialogTitle>
          </DialogHeader>
          {tracingReq && (
            <p className="text-sm text-muted-foreground">
              Source: {tracingReq.level} - {tracingReq.title}
            </p>
          )}
          <div className="grid gap-3">
            <div>
              <Label className="mb-1.5">Target Document</Label>
              <Select
                value={selectedDocForTrace}
                onValueChange={(val) => {
                  setSelectedDocForTrace(val);
                  handleLoadReqsForTrace(val);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select document" />
                </SelectTrigger>
                <SelectContent>
                  {documents.map(doc => (
                    <SelectItem key={doc.id} value={doc.id}>{doc.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {reqsForTrace.length > 0 && (
              <div className="max-h-48 overflow-y-auto border rounded divide-y">
                {reqsForTrace.map(req => (
                  <div key={req.id} className="px-3 py-1.5 text-sm">
                    {req.level}: {req.title}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenTraceability(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── CSV Import Dialog ─── */}
      <CSVImportDialog
        open={csvImportOpen}
        onOpenChange={setCSVImportOpen}
        documentId={documentId}
        onImportComplete={() => {
          setCSVImportOpen(false);
          loadData();
          setSnackbar({ open: true, message: 'Requirements imported successfully', severity: 'success' });
        }}
      />

      {/* ─── Snackbar / Toast ─── */}
      {snackbar.open && (
        <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-4">
          <div
            className={`flex items-center gap-2 rounded-md px-4 py-2.5 text-sm shadow-lg border ${
              snackbar.severity === 'success'
                ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:text-green-200 dark:border-green-800'
                : snackbar.severity === 'error'
                ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:text-red-200 dark:border-red-800'
                : 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800'
            }`}
          >
            <span>{snackbar.message}</span>
            <button
              className="ml-2 opacity-70 hover:opacity-100"
              onClick={() => setSnackbar(prev => ({ ...prev, open: false }))}
            >
              <X className="size-3" />
            </button>
          </div>
        </div>
      )}

      {/* ─── Change Proposal Gate Dialog ─── */}
      <Dialog open={cpGateOpen} onOpenChange={setCpGateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitPullRequestDraft className="size-5 text-primary" />
              Select Change Proposal
            </DialogTitle>
            <DialogDescription>
              {cpGateAction === 'add'
                ? 'You must select an active Change Proposal before adding a new requirement.'
                : 'You must select an active Change Proposal before editing requirements.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-1">
            {changeProposals.filter((cp) => cp.status === 'draft' || cp.status === 'proposed' || cp.status === 'approved').length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                No active change proposals found. Create one to start editing.
              </div>
            ) : (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {changeProposals
                  .filter((cp) => cp.status === 'draft' || cp.status === 'proposed' || cp.status === 'approved')
                  .map((cp) => (
                    <button
                      key={cp.id}
                      className="w-full text-left px-3 py-2 rounded-md border hover:bg-accent text-sm flex items-center gap-2"
                      onClick={() => {
                        setActiveChangeProposal(cp);
                        setCpGateOpen(false);
                        if (cpGateAction === 'add') {
                          handleOpenDialog();
                        } else if (cpGateAction === 'edit' && cpGateReq) {
                          handleOpenDialog(cpGateReq);
                        }
                        setCpGateAction(null);
                        setCpGateReq(null);
                      }}
                    >
                      <GitPullRequestDraft className="size-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{cp.title}</div>
                        <div className="text-xs text-muted-foreground">{cp.status} · {cp.createdBy}</div>
                      </div>
                    </button>
                  ))}
              </div>
            )}
            <Button variant="outline" size="sm" className="w-full" onClick={() => setNewCpDialogOpen(true)}>
              <Plus className="size-4 mr-1" />
              Create New Change Proposal
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCpGateOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── New Change Proposal Dialog ─── */}
      <Dialog open={newCpDialogOpen} onOpenChange={setNewCpDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-5 text-primary" />
              New Change Proposal
            </DialogTitle>
            <DialogDescription>Create a change proposal to track your edits.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-1">
            <div className="flex flex-col gap-1.5">
              <Label>Title *</Label>
              <Input
                placeholder="e.g., Update safety requirements"
                value={newCpForm.title}
                onChange={(e) => setNewCpForm((prev) => ({ ...prev, title: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Description</Label>
              <Textarea
                placeholder="Brief description of changes"
                value={newCpForm.description}
                onChange={(e) => setNewCpForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewCpDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!newCpForm.title.trim()) return;
                setCreatingCp(true);
                try {
                  const res = await API.createChangeProposal(documentId, {
                    title: newCpForm.title,
                    description: newCpForm.description,
                  });
                  if (res.success && res.data) {
                    setChangeProposals((prev) => [res.data, ...prev]);
                    setActiveChangeProposal(res.data);
                    setNewCpDialogOpen(false);
                    setNewCpForm({ title: '', description: '' });
                    setCpGateOpen(false);
                    if (cpGateAction === 'add') {
                      handleOpenDialog();
                    } else if (cpGateAction === 'edit' && cpGateReq) {
                      handleOpenDialog(cpGateReq);
                    }
                    setCpGateAction(null);
                    setCpGateReq(null);
                    setSnackbar({ open: true, message: 'Change proposal created and activated', severity: 'success' });
                  } else {
                    setSnackbar({ open: true, message: res.error || 'Failed to create', severity: 'error' });
                  }
                } catch (e) {
                  setSnackbar({ open: true, message: 'Failed to create change proposal', severity: 'error' });
                } finally {
                  setCreatingCp(false);
                }
              }}
              disabled={!newCpForm.title.trim() || creatingCp}
            >
              {creatingCp ? <Loader2 className="size-4 animate-spin mr-1" /> : <Plus className="size-4 mr-1" />}
              {creatingCp ? 'Creating...' : 'Create & Activate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RequirementsPage;
