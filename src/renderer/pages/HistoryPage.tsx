import React, { useState, useEffect } from 'react';
import {
  History as HistoryIcon,
  GitCommit as CommitIcon,
  Plus as AddIcon,
  Tag as TagIcon,
  RefreshCw as RefreshIcon,
  Package,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';
import * as API from '../../api/api';

interface HistoryPageProps {
  documentId: string;
  documentTitle: string;
}

const HistoryPage: React.FC<HistoryPageProps> = ({ documentId, documentTitle }) => {
  const [commits, setCommits] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [baselines, setBaselines] = useState<any[]>([]);
  const [openCommitDialog, setOpenCommitDialog] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [commitAuthor, setCommitAuthor] = useState('system');
  const [openBaselineDialog, setOpenBaselineDialog] = useState(false);
  const [baselineName, setBaselineName] = useState('');
  const [baselineDesc, setBaselineDesc] = useState('');
  const [baselineCommitId, setBaselineCommitId] = useState('');

  useEffect(() => {
    loadHistory();
  }, [documentId]);

  const loadHistory = async () => {
    try {
      const [commitResult, tagResult, baselineResult] = await Promise.all([
        API.getCommits(documentId),
        API.getTags(documentId),
        API.getBaselines(documentId),
      ]);
      if (commitResult.success) setCommits(commitResult.data || []);
      if (tagResult.success) setTags(tagResult.data || []);
      if (baselineResult.success) setBaselines(baselineResult.data || []);
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const handleCreateCommit = async () => {
    try {
      const result = await API.createCommit(documentId, {
        message: commitMessage,
        author: commitAuthor,
      });
      if (result.success) {
        setOpenCommitDialog(false);
        setCommitMessage('');
        loadHistory();
      }
    } catch (error) {
      console.error('Failed to create commit:', error);
    }
  };

  const handleCreateBaseline = async () => {
    if (!baselineName.trim() || !baselineCommitId) return;
    try {
      const result = await API.createBaseline(documentId, {
        name: baselineName.trim(),
        commitId: baselineCommitId,
        description: baselineDesc.trim() || undefined,
        createdBy: commitAuthor,
      });
      if (result.success) {
        setOpenBaselineDialog(false);
        setBaselineName('');
        setBaselineDesc('');
        setBaselineCommitId('');
        loadHistory();
      }
    } catch (error) {
      console.error('Failed to create baseline:', error);
    }
  };

  const handleDeleteBaseline = async (baselineId: string) => {
    if (!window.confirm('Delete this baseline?')) return;
    try {
      const result = await API.deleteBaseline(baselineId);
      if (result.success) loadHistory();
    } catch (error) {
      console.error('Failed to delete baseline:', error);
    }
  };

  return (
    <div className="p-6 max-w-[900px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <HistoryIcon className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">
            Version History
          </h2>
          <Badge variant="outline">{documentTitle}</Badge>
        </div>
        <div className="flex gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={loadHistory}>
                  <RefreshIcon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setOpenBaselineDialog(true)}
          >
            <Package className="h-4 w-4 mr-1" />
            New Baseline
          </Button>
          <Button
            size="sm"
            onClick={() => setOpenCommitDialog(true)}
          >
            <AddIcon className="h-4 w-4" />
            New Commit
          </Button>
        </div>
      </div>

      {/* Tags Section */}
      {tags.length > 0 && (
        <div className="rounded-lg border bg-card p-4 mb-4">
          <p className="text-sm font-semibold mb-2">
            <TagIcon className="inline h-4 w-4 mr-1 align-middle" /> Tags
          </p>
          <div className="flex gap-2 flex-wrap">
            {tags.map((tag) => (
              <Badge
                key={tag.id}
                variant="outline"
              >
                {`${tag.name} (${tag.commitId?.substring(0, 8)})`}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Baselines Section */}
      {baselines.length > 0 && (
        <div className="rounded-lg border bg-card p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold">
              <Package className="inline h-4 w-4 mr-1 align-middle" /> Baselines
            </p>
            <Button variant="ghost" size="sm" onClick={() => setOpenBaselineDialog(true)}>
              <AddIcon className="h-3.5 w-3.5 mr-1" /> New
            </Button>
          </div>
          <div className="space-y-2">
            {baselines.map((bl) => (
              <div key={bl.id} className="flex items-center justify-between border rounded px-3 py-2">
                <div>
                  <span className="text-sm font-medium">{bl.name}</span>
                  {bl.description && <p className="text-xs text-muted-foreground">{bl.description}</p>}
                  <p className="text-xs text-muted-foreground">
                    {bl.createdBy || 'unknown'} · {new Date(bl.createdAt).toLocaleString()} · commit {bl.commitId?.substring(0, 8)}
                  </p>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteBaseline(bl.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Commits List */}
      <div className="rounded-lg border bg-card overflow-hidden">
        {commits.length === 0 ? (
          <div className="p-8 text-center">
            <HistoryIcon className="h-12 w-12 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-muted-foreground">No commits yet</p>
            <p className="text-sm text-muted-foreground">
              Create a commit to snapshot the current state of your requirements
            </p>
          </div>
        ) : (
          <div>
            {commits.map((commit, index) => (
              <React.Fragment key={commit.id}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <CommitIcon
                    className={`h-4 w-4 shrink-0 ${index === 0 ? 'text-primary' : 'text-muted-foreground'}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${index === 0 ? 'font-semibold' : 'font-normal'}`}>
                        {commit.message}
                      </span>
                      {index === 0 && (
                        <Badge className="h-5 text-xs">latest</Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {commit.author} · {commit.branchName} · {new Date(commit.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="font-mono text-[0.7rem]"
                  >
                    {commit.id?.substring(0, 8)}
                  </Badge>
                </div>
                {index < commits.length - 1 && (
                  <div className="border-t" />
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Create Commit Dialog */}
      <Dialog open={openCommitDialog} onOpenChange={setOpenCommitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Commit</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="commit-message">Commit Message *</Label>
              <Input
                id="commit-message"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Describe the changes in this commit"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="commit-author">Author</Label>
              <Input
                id="commit-author"
                value={commitAuthor}
                onChange={(e) => setCommitAuthor(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCommitDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCommit} disabled={!commitMessage}>
              Commit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Baseline Dialog */}
      <Dialog open={openBaselineDialog} onOpenChange={setOpenBaselineDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Baseline</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="baseline-name">Name *</Label>
              <Input
                id="baseline-name"
                value={baselineName}
                onChange={(e) => setBaselineName(e.target.value)}
                placeholder="e.g. v1.0, Sprint-3, Release Candidate"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="baseline-commit">Commit *</Label>
              <Select value={baselineCommitId} onValueChange={setBaselineCommitId}>
                <SelectTrigger id="baseline-commit">
                  <SelectValue placeholder="Select a commit" />
                </SelectTrigger>
                <SelectContent>
                  {commits.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.message} ({c.id?.substring(0, 8)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="baseline-desc">Description</Label>
              <Input
                id="baseline-desc"
                value={baselineDesc}
                onChange={(e) => setBaselineDesc(e.target.value)}
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenBaselineDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateBaseline} disabled={!baselineName.trim() || !baselineCommitId}>
              Create Baseline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HistoryPage;
