import React, { useEffect, useState } from 'react';
import { X, GitCompare, ArrowRight, User, Clock, GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import * as API from '../../api/api';
import type { EditHistoryEntry } from '../../types/index';

interface RequirementVersionDiffProps {
  open: boolean;
  onClose: () => void;
  requirementId: string;
  leftEntry: EditHistoryEntry | null;
  rightEntry: EditHistoryEntry | null;
}

interface Snapshot {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  level?: string;
  changeRequestId?: string;
  changeRequestLink?: string;
  testPlan?: string;
  testPlanLink?: string;
  verificationMethod?: string;
  rationale?: string;
  tags?: string;
  custom_fields?: string;
  related_requirements?: string;
  [key: string]: any;
}

const DIFF_FIELDS = [
  { key: 'title', label: 'Title' },
  { key: 'description', label: 'Description' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'level', label: 'Level' },
  { key: 'changeRequestId', label: 'Change Request ID' },
  { key: 'changeRequestLink', label: 'Change Request Link' },
  { key: 'testPlan', label: 'Test Plan' },
  { key: 'testPlanLink', label: 'Test Plan Link' },
  { key: 'verificationMethod', label: 'Verification Method' },
  { key: 'rationale', label: 'Rationale' },
  { key: 'tags', label: 'Tags' },
  { key: 'custom_fields', label: 'Custom Fields' },
  { key: 'related_requirements', label: 'Related Requirements' },
];

function formatValue(val: any, field: string): string {
  if (val === null || val === undefined || val === '') return '—';
  if (field === 'tags' || field === 'related_requirements') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) {
        return parsed.length > 0 ? parsed.join(', ') : '—';
      }
      return String(val);
    } catch {
      return String(val);
    }
  }
  if (field === 'custom_fields') {
    try {
      const parsed = JSON.parse(val);
      const entries = Object.entries(parsed);
      if (entries.length === 0) return '—';
      return entries.map(([k, v]) => `${k}: ${v}`).join(', ');
    } catch {
      return String(val);
    }
  }
  return String(val);
}

function computeChangeType(left: any, right: any, field: string): 'unchanged' | 'modified' | 'added' | 'removed' {
  const l = formatValue(left, field);
  const r = formatValue(right, field);
  if (l === r) return 'unchanged';
  if (l === '—') return 'added';
  if (r === '—') return 'removed';
  return 'modified';
}

function ChangeBadge({ type }: { type: 'unchanged' | 'modified' | 'added' | 'removed' }) {
  if (type === 'unchanged') return null;
  const variants: Record<string, { className: string; label: string }> = {
    modified: { className: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700', label: 'Modified' },
    added: { className: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700', label: 'Added' },
    removed: { className: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700', label: 'Removed' },
  };
  const v = variants[type];
  return (
    <Badge variant="outline" className={`text-[0.65rem] h-5 ${v.className}`}>
      {v.label}
    </Badge>
  );
}

function VersionHeader({ entry, label }: { entry: EditHistoryEntry; label: string }) {
  return (
    <div className="flex-1 border rounded-lg p-3 bg-muted/40">
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="secondary" className="text-xs">{label}</Badge>
        <span className="text-xs font-mono text-muted-foreground">{entry.id.substring(0, 8)}</span>
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '—'}
        </div>
        <div className="flex items-center gap-1.5">
          <User className="h-3 w-3" />
          {entry.userName || entry.userId || '—'}
        </div>
        <div className="flex items-center gap-1.5">
          <GitBranch className="h-3 w-3" />
          {entry.branchName || '—'}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-foreground">Field:</span>
          <Badge variant="outline" className="text-[0.65rem] h-4">{entry.field}</Badge>
        </div>
      </div>
    </div>
  );
}

const RequirementVersionDiff: React.FC<RequirementVersionDiffProps> = ({
  open,
  onClose,
  requirementId,
  leftEntry,
  rightEntry,
}) => {
  const [leftSnapshot, setLeftSnapshot] = useState<Snapshot | null>(null);
  const [rightSnapshot, setRightSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !leftEntry || !rightEntry) {
      setLeftSnapshot(null);
      setRightSnapshot(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      API.getRequirementHistorySnapshot(requirementId, leftEntry.id),
      API.getRequirementHistorySnapshot(requirementId, rightEntry.id),
    ])
      .then(([leftRes, rightRes]) => {
        if (cancelled) return;
        if (!leftRes.success || !rightRes.success) {
          setError(leftRes.error || rightRes.error || 'Failed to load snapshots');
          return;
        }
        setLeftSnapshot(leftRes.data || null);
        setRightSnapshot(rightRes.data || null);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load snapshots');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [open, requirementId, leftEntry, rightEntry]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <GitCompare className="h-5 w-5 text-primary" />
            Requirement Version Diff
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-4">
          {leftEntry && rightEntry && (
            <div className="flex items-center gap-3">
              <VersionHeader entry={leftEntry} label="Older" />
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              <VersionHeader entry={rightEntry} label="Newer" />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto px-6 pb-6">
          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {!loading && !error && leftSnapshot && rightSnapshot && (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left font-medium text-muted-foreground px-3 py-2 w-[140px]">Field</th>
                    <th className="text-left font-medium text-muted-foreground px-3 py-2 w-[45%]">Older Version</th>
                    <th className="text-left font-medium text-muted-foreground px-3 py-2 w-[45%]">Newer Version</th>
                    <th className="text-left font-medium text-muted-foreground px-3 py-2 w-[100px]">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {DIFF_FIELDS.map(({ key, label }) => {
                    const leftVal = leftSnapshot[key];
                    const rightVal = rightSnapshot[key];
                    const changeType = computeChangeType(leftVal, rightVal, key);
                    const isChanged = changeType !== 'unchanged';

                    return (
                      <tr
                        key={key}
                        className={`border-b last:border-0 ${isChanged ? 'bg-amber-50/40 dark:bg-amber-900/10' : ''}`}
                      >
                        <td className="px-3 py-2.5 font-medium align-top">{label}</td>
                        <td className={`px-3 py-2.5 align-top ${isChanged ? 'text-muted-foreground line-through decoration-red-400/60' : ''}`}>
                          <div className="break-words whitespace-pre-wrap">{formatValue(leftVal, key)}</div>
                        </td>
                        <td className={`px-3 py-2.5 align-top ${isChanged ? 'text-foreground font-medium' : ''}`}>
                          <div className="break-words whitespace-pre-wrap">{formatValue(rightVal, key)}</div>
                        </td>
                        <td className="px-3 py-2.5 align-top">
                          <ChangeBadge type={changeType} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="border-t px-6 py-3 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="h-4 w-4 mr-1" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RequirementVersionDiff;
