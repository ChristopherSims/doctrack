import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Plus,
  Loader2,
  Trash2,
  CheckCircle2,
  XCircle,
  GitPullRequestDraft,
  GitPullRequest,
  GitMerge,
  Clock,
  AlertCircle,
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
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { ChangeProposal } from '../../types/index';
import * as API from '../../api/api';

interface ChangeProposalsPageProps {
  documentId: string;
  documentTitle: string;
  onBack: () => void;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  draft: <GitPullRequestDraft className="size-4 text-muted-foreground" />,
  proposed: <GitPullRequest className="size-4 text-blue-500" />,
  approved: <CheckCircle2 className="size-4 text-green-500" />,
  rejected: <XCircle className="size-4 text-red-500" />,
  implemented: <GitMerge className="size-4 text-purple-500" />,
};

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  proposed: 'outline',
  approved: 'default',
  rejected: 'destructive',
  implemented: 'default',
};

const ChangeProposalsPage: React.FC<ChangeProposalsPageProps> = ({ documentId, documentTitle, onBack }) => {
  const [proposals, setProposals] = useState<ChangeProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ title: '', description: '', createdBy: 'system' });
  const [creating, setCreating] = useState(false);
  const [selectedCp, setSelectedCp] = useState<ChangeProposal | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [cpHistory, setCpHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; type: 'success' | 'error' }>({
    open: false,
    message: '',
    type: 'success',
  });

  useEffect(() => {
    loadProposals();
  }, [documentId]);

  useEffect(() => {
    if (!snackbar.open) return undefined;
    const t = setTimeout(() => setSnackbar((s) => ({ ...s, open: false })), 3000);
    return () => clearTimeout(t);
  }, [snackbar.open]);

  const loadProposals = async () => {
    setLoading(true);
    try {
      const res = await API.getChangeProposals(documentId);
      if (res.success) {
        setProposals(res.data || []);
      }
    } catch (e) {
      console.error('Failed to load change proposals:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!createForm.title.trim()) return;
    setCreating(true);
    try {
      const res = await API.createChangeProposal(documentId, createForm);
      if (res.success) {
        setCreateOpen(false);
        setCreateForm({ title: '', description: '', createdBy: 'system' });
        await loadProposals();
        setSnackbar({ open: true, message: 'Change proposal created', type: 'success' });
      } else {
        setSnackbar({ open: true, message: res.error || 'Failed to create', type: 'error' });
      }
    } catch (e) {
      setSnackbar({ open: true, message: 'Failed to create change proposal', type: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (cp: ChangeProposal) => {
    if (!window.confirm(`Delete change proposal "${cp.title}"?`)) return;
    try {
      const res = await API.deleteChangeProposal(cp.id);
      if (res.success) {
        await loadProposals();
        setSnackbar({ open: true, message: 'Change proposal deleted', type: 'success' });
      } else {
        setSnackbar({ open: true, message: res.error || 'Failed to delete', type: 'error' });
      }
    } catch (e) {
      setSnackbar({ open: true, message: 'Failed to delete', type: 'error' });
    }
  };

  const handleStatusChange = async (cp: ChangeProposal, status: string) => {
    const updates: any = { status };
    const now = new Date().toISOString();
    if (status === 'approved') {
      updates.approvedBy = 'system';
      updates.approvedAt = now;
    }
    if (status === 'implemented') {
      updates.implementedAt = now;
    }
    try {
      const res = await API.updateChangeProposal(cp.id, updates);
      if (res.success) {
        await loadProposals();
        if (detailOpen && selectedCp?.id === cp.id) {
          setSelectedCp({ ...cp, ...updates });
        }
        setSnackbar({ open: true, message: `Status updated to ${status}`, type: 'success' });
      } else {
        setSnackbar({ open: true, message: res.error || 'Failed to update', type: 'error' });
      }
    } catch (e) {
      setSnackbar({ open: true, message: 'Failed to update status', type: 'error' });
    }
  };

  const openDetail = async (cp: ChangeProposal) => {
    setSelectedCp(cp);
    setDetailOpen(true);
    setHistoryLoading(true);
    try {
      const res = await API.getChangeProposalHistory(cp.id);
      if (res.success) {
        setCpHistory(res.data || []);
      } else {
        setCpHistory([]);
      }
    } catch (e) {
      setCpHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h2 className="text-xl font-semibold">Change Proposals</h2>
          <p className="text-sm text-muted-foreground">{documentTitle}</p>
        </div>
        <div className="flex-1" />
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4 mr-1" />
          New Change Proposal
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        {(['draft', 'proposed', 'approved', 'rejected', 'implemented'] as const).map((status) => (
          <Card key={status}>
            <CardContent className="p-4 flex items-center gap-3">
              {STATUS_ICONS[status]}
              <div>
                <div className="text-2xl font-bold">{proposals.filter((p) => p.status === status).length}</div>
                <div className="text-xs text-muted-foreground capitalize">{status}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">All Change Proposals</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : proposals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <GitPullRequestDraft className="size-8 mb-2 opacity-50" />
              <p className="text-sm">No change proposals yet.</p>
              <Button variant="link" size="sm" onClick={() => setCreateOpen(true)}>
                Create one
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proposals.map((cp) => (
                  <TableRow key={cp.id} className="cursor-pointer" onClick={() => openDetail(cp)}>
                    <TableCell>
                      <div className="font-medium">{cp.title}</div>
                      {cp.description && (
                        <div className="text-xs text-muted-foreground line-clamp-1">{cp.description}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[cp.status] || 'secondary'} className="capitalize gap-1">
                        {STATUS_ICONS[cp.status]}
                        {cp.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3" />
                        {new Date(cp.createdAt).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{cp.createdBy}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {cp.status === 'draft' && (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            title="Propose"
                            onClick={() => handleStatusChange(cp, 'proposed')}
                          >
                            <GitPullRequest className="size-3.5 text-blue-500" />
                          </Button>
                        )}
                        {cp.status === 'proposed' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              title="Approve"
                              onClick={() => handleStatusChange(cp, 'approved')}
                            >
                              <CheckCircle2 className="size-3.5 text-green-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              title="Reject"
                              onClick={() => handleStatusChange(cp, 'rejected')}
                            >
                              <XCircle className="size-3.5 text-red-500" />
                            </Button>
                          </>
                        )}
                        {cp.status === 'approved' && (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            title="Implement"
                            onClick={() => handleStatusChange(cp, 'implemented')}
                          >
                            <GitMerge className="size-3.5 text-purple-500" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          title="Delete"
                          onClick={() => handleDelete(cp)}
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-5 text-primary" />
              New Change Proposal
            </DialogTitle>
            <DialogDescription>Create a change proposal to track edits to requirements.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-1">
            <div className="flex flex-col gap-1.5">
              <Label>Title *</Label>
              <Input
                placeholder="e.g., Update safety requirements for v2.0"
                value={createForm.title}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Description</Label>
              <Textarea
                placeholder="Brief description of the proposed changes"
                value={createForm.description}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Created By</Label>
              <Input
                value={createForm.createdBy}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, createdBy: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!createForm.title.trim() || creating}>
              {creating ? <Loader2 className="size-4 animate-spin mr-1" /> : <Plus className="size-4 mr-1" />}
              {creating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedCp && STATUS_ICONS[selectedCp.status]}
              {selectedCp?.title}
            </DialogTitle>
            <DialogDescription>
              <Badge variant={selectedCp ? STATUS_VARIANTS[selectedCp.status] : 'secondary'} className="capitalize">
                {selectedCp?.status}
              </Badge>
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="info">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="info">Info</TabsTrigger>
              <TabsTrigger value="history">Edit History</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-3 py-2">
              <div>
                <Label className="text-xs text-muted-foreground">Description</Label>
                <p className="text-sm mt-1">{selectedCp?.description || 'No description.'}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Created By</Label>
                  <p className="text-sm">{selectedCp?.createdBy}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Created At</Label>
                  <p className="text-sm">{selectedCp?.createdAt ? new Date(selectedCp.createdAt).toLocaleString() : '-'}</p>
                </div>
                {selectedCp?.approvedBy && (
                  <>
                    <div>
                      <Label className="text-xs text-muted-foreground">Approved By</Label>
                      <p className="text-sm">{selectedCp.approvedBy}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Approved At</Label>
                      <p className="text-sm">{selectedCp.approvedAt ? new Date(selectedCp.approvedAt).toLocaleString() : '-'}</p>
                    </div>
                  </>
                )}
                {selectedCp?.implementedAt && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Implemented At</Label>
                    <p className="text-sm">{new Date(selectedCp.implementedAt).toLocaleString()}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                {selectedCp?.status === 'draft' && (
                  <Button size="sm" onClick={() => selectedCp && handleStatusChange(selectedCp, 'proposed')}>
                    <GitPullRequest className="size-4 mr-1" />
                    Propose
                  </Button>
                )}
                {selectedCp?.status === 'proposed' && (
                  <>
                    <Button size="sm" variant="default" onClick={() => selectedCp && handleStatusChange(selectedCp, 'approved')}>
                      <CheckCircle2 className="size-4 mr-1" />
                      Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => selectedCp && handleStatusChange(selectedCp, 'rejected')}>
                      <XCircle className="size-4 mr-1" />
                      Reject
                    </Button>
                  </>
                )}
                {selectedCp?.status === 'approved' && (
                  <Button size="sm" onClick={() => selectedCp && handleStatusChange(selectedCp, 'implemented')}>
                    <GitMerge className="size-4 mr-1" />
                    Implement
                  </Button>
                )}
              </div>
            </TabsContent>

            <TabsContent value="history" className="py-2">
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : cpHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <AlertCircle className="size-6 mb-2 opacity-50" />
                  <p className="text-sm">No edits recorded under this change proposal yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cpHistory.map((h) => (
                    <div key={h.id} className="border rounded-md p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {h.requirementLevel} {h.requirementTitle || h.requirementId}
                        </span>
                        <span className="text-xs text-muted-foreground">{new Date(h.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Field: <span className="font-mono">{h.field}</span> · By: {h.userName}
                      </div>
                      <div className="mt-1.5 grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-destructive/5 rounded px-2 py-1">
                          <span className="text-destructive font-medium">Old:</span>{' '}
                          {h.oldValue ?? '\u2014'}
                        </div>
                        <div className="bg-green-500/5 rounded px-2 py-1">
                          <span className="text-green-600 font-medium">New:</span>{' '}
                          {h.newValue ?? '\u2014'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Snackbar */}
      {snackbar.open && (
        <div className="fixed bottom-4 right-4 z-[100]">
          <div
            className={`px-4 py-2 rounded-md shadow-lg text-sm font-medium ${
              snackbar.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
            }`}
          >
            {snackbar.message}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChangeProposalsPage;
