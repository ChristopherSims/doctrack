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
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

import type { Requirement, EditHistoryEntry, RequirementFilter } from '../../types/index';
import * as API from '../../api/api';
import RichTextEditor from '@/components/RichTextEditor';
import TagInput from '@/components/TagInput';
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
  approved: 'default',
  implemented: 'default',
  verified: 'default',
};

const statusColorMap: Record<string, string> = {
  draft: 'text-muted-foreground',
  review: 'text-yellow-600',
  approved: 'text-green-600',
  implemented: 'text-blue-600',
  verified: 'text-cyan-600',
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

/* ─── Related Requirements Picker (cross-document) ─── */
function RelatedRequirementsPicker({
  documentId,
  documents,
  selectedIds,
  onSelect,
  onRemove,
}: {
  documentId: string;
  documents: any[];
  selectedIds: string[];
  onSelect: (reqId: string) => void;
  onRemove: (reqId: string) => void;
}) {
  const [selectedDoc, setSelectedDoc] = useState('');
  const [docReqs, setDocReqs] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(false);

  const loadReqs = async (docId: string) => {
    setLoading(true);
    try {
      const result = await API.getRequirements(docId);
      if (result.success) {
        setDocReqs(result.data || []);
      }
    } catch {
      setDocReqs([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Select
        value={selectedDoc}
        onValueChange={(val) => {
          setSelectedDoc(val);
          loadReqs(val);
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select document to pick requirements from..." />
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
      {loading && (
        <div className="flex items-center gap-2 py-2">
          <Loader2 className="size-3.5 animate-spin" />
          <span className="text-xs text-muted-foreground">Loading...</span>
        </div>
      )}
      {!loading && docReqs.length > 0 && (
        <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
          {docReqs.map((req) => {
            const isSelected = selectedIds.includes(req.id);
            return (
              <button
                key={req.id}
                type="button"
                className={`w-full px-3 py-1.5 text-sm text-left hover:bg-accent flex items-center gap-2 ${
                  isSelected ? 'bg-accent/50' : ''
                }`}
                onClick={() => {
                  if (isSelected) {
                    onRemove(req.id);
                  } else {
                    onSelect(req.id);
                  }
                }}
              >
                <span
                  className={`w-4 h-4 border rounded-sm flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'bg-primary border-primary text-primary-foreground' : ''
                  }`}
                >
                  {isSelected && <span className="text-xs">✓</span>}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{req.level}</span>
                <span className="truncate">{req.title}</span>
              </button>
            );
          })}
        </div>
      )}
      {!loading && selectedDoc && docReqs.length === 0 && (
        <p className="text-xs text-muted-foreground py-2">No requirements in this document.</p>
      )}
    </div>
  );
}

function EditableCell({
  value,
  rowId,
  field,
  onCommit,
  type = 'text',
  options,
  displayRenderer,
}: {
  value: string;
  rowId: string;
  field: keyof Requirement;
  onCommit: (rowId: string, field: keyof Requirement, value: string) => void;
  type?: 'text' | 'select';
  options?: readonly string[];
  displayRenderer?: (value: string) => React.ReactNode;
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
        className="w-full h-full px-1 py-0.5 cursor-text min-h-[24px] flex items-center"
        onDoubleClick={() => setEditing(true)}
        title="Double-click to edit"
      >
        {displayRenderer ? displayRenderer(value) : <span className="truncate text-sm">{value || '\u2014'}</span>}
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
  const [openTraceability, setOpenTraceability] = useState(false);
  const [tracingReq, setTracingReq] = useState<Requirement | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [reqsForTrace, setReqsForTrace] = useState<Requirement[]>([]);
  const [selectedDocForTrace, setSelectedDocForTrace] = useState('');
  const [stats, setStats] = useState<{ total: number; byStatus: Record<string, number>; byPriority: Record<string, number> } | null>(null);

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

  // Edit history state
  const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null);
  const [editHistory, setEditHistory] = useState<EditHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

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

  // Load edit history when a requirement is selected
  useEffect(() => {
    if (selectedRequirement) {
      setHistoryLoading(true);
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
    const statusQ = filter.status.trim().toLowerCase();
    const priorityQ = filter.priority.trim().toLowerCase();
    const verificationQ = filter.verification.trim().toLowerCase();
    const tagsQ = filter.tags.trim().toLowerCase();
    if (!statusQ && !priorityQ && !verificationQ && !tagsQ) return visibleRequirements;

    return visibleRequirements.filter((req) => {
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
            tags: row.tags || [],
            custom_fields: row.customFields || {},
            related_requirements: row.relatedRequirements || [],
            parentRequirementId: row.parentRequirementId || '',
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
      cell: ({ row }) => (
        <EditableCell
          value={row.original.priority}
          rowId={row.original.id}
          field="priority"
          onCommit={handleCellCommit}
          type="select"
          options={PRIORITY_OPTIONS}
          displayRenderer={(v) => (
            <Badge variant={priorityVariantMap[v] || 'secondary'} className={priorityColorMap[v] || ''}>
              {v || 'medium'}
            </Badge>
          )}
        />
      ),
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
    },
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
        </div>
        <div className="flex items-center gap-2">
          {filter && (filter.status.trim() || filter.priority.trim() || filter.verification.trim() || filter.tags.trim()) && (
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
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-1.5 pr-3 font-medium">Field</th>
                        <th className="pb-1.5 pr-3 font-medium">Old Value</th>
                        <th className="pb-1.5 pr-3 font-medium">New Value</th>
                        <th className="pb-1.5 pr-3 font-medium">User</th>
                        <th className="pb-1.5 pr-3 font-medium">Branch</th>
                        <th className="pb-1.5 font-medium">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editHistory.map((entry) => (
                        <tr key={entry.id} className="border-b last:border-0">
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
                      ))}
                    </tbody>
                  </table>
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
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="relations">Relations</TabsTrigger>
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

              {/* Related Requirements (cross-document) */}
              <div>
                <Label className="mb-1.5">Related Requirements</Label>
                {/* Selected related requirements as chips */}
                {formData.relatedRequirements.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {formData.relatedRequirements.map((reqId) => {
                      // Try to find the requirement in loaded data
                      const foundReq = requirements.find((r) => r.id === reqId);
                      return (
                        <Badge key={reqId} variant="outline" className="gap-1 pr-1 text-xs">
                          {foundReq ? `${foundReq.level} - ${foundReq.title}` : reqId}
                          <button
                            type="button"
                            className="ml-0.5 rounded-full hover:bg-foreground/10 p-0.5"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                relatedRequirements: formData.relatedRequirements.filter((id) => id !== reqId),
                              });
                            }}
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}
                {/* Document picker + requirement checklist */}
                <RelatedRequirementsPicker
                  documentId={documentId}
                  documents={documents}
                  selectedIds={formData.relatedRequirements}
                  onSelect={(reqId) => {
                    if (!formData.relatedRequirements.includes(reqId)) {
                      setFormData({
                        ...formData,
                        relatedRequirements: [...formData.relatedRequirements, reqId],
                      });
                    }
                  }}
                  onRemove={(reqId) => {
                    setFormData({
                      ...formData,
                      relatedRequirements: formData.relatedRequirements.filter((id) => id !== reqId),
                    });
                  }}
                />
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
    </div>
  );
};

export default RequirementsPage;
