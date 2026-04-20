import React, { useState, useEffect } from 'react';
import {
  GitBranch as BranchIcon,
  Plus as AddIcon,
  GitMerge as MergeIcon,
  RefreshCw as RefreshIcon,
  CheckCircle2 as CheckIcon,
  X as XIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import * as API from '../../api/api';

interface BranchesPageProps {
  documentId: string;
  documentTitle: string;
  currentBranch: string;
  onBranchChange: (branchName: string) => void;
}

const BranchesPage: React.FC<BranchesPageProps> = ({ documentId, documentTitle, currentBranch, onBranchChange }) => {
  const [branches, setBranches] = useState<any[]>([]);
  const [openBranchDialog, setOpenBranchDialog] = useState(false);
  const [openMergeDialog, setOpenMergeDialog] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchDesc, setNewBranchDesc] = useState('');
  const [sourceBranch, setSourceBranch] = useState('');
  const [targetBranch, setTargetBranch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadBranches();
  }, [documentId]);

  const loadBranches = async () => {
    try {
      const result = await API.getBranches(documentId);
      if (result.success) setBranches(result.data || []);
    } catch (error) {
      console.error('Failed to load branches:', error);
    }
  };

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

  const handleMergeBranch = async () => {
    try {
      const result = await API.mergeBranch(documentId, {
        sourceBranch,
        targetBranch,
        author: 'system',
      });
      if (result.success) {
        setOpenMergeDialog(false);
        setSourceBranch('');
        setTargetBranch('');
        loadBranches();
      } else {
        setError(result.error || 'Merge failed');
      }
    } catch (error: any) {
      setError(error.message || 'Merge failed');
    }
  };

  return (
    <div className="p-6 max-w-[900px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BranchIcon className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">
            Branches
          </h2>
          <Badge variant="outline">{documentTitle}</Badge>
        </div>
        <div className="flex gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={loadBranches}>
                  <RefreshIcon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpenMergeDialog(true)}
          >
            <MergeIcon className="h-4 w-4" />
            Merge
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

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setError('')}
            >
              <XIcon className="h-3 w-3" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Branch List */}
      <div className="rounded-lg border bg-card">
        {branches.length === 0 ? (
          <div className="p-8 text-center">
            <BranchIcon className="h-12 w-12 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-muted-foreground">No branches yet</p>
          </div>
        ) : (
          <div>
            {branches.map((branch, index) => (
              <React.Fragment key={branch.id}>
                <div
                  className="flex items-center gap-3 py-3 px-4 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => handleCheckoutBranch(branch.name)}
                >
                  <div className="shrink-0 w-6 flex items-center justify-center">
                    {branch.name === currentBranch ? (
                      <CheckIcon className="h-5 w-5 text-green-500" />
                    ) : (
                      <BranchIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm ${
                          branch.name === currentBranch ? 'font-semibold' : 'font-normal'
                        }`}
                      >
                        {branch.name}
                      </span>
                      {branch.name === currentBranch && (
                        <Badge
                          variant="secondary"
                          className="h-5 text-[0.65rem] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        >
                          current
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {branch.description || 'No description'} · Created by {branch.createdBy} · {new Date(branch.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                {index < branches.length - 1 && (
                  <div className="border-t mx-4" />
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Create Branch Dialog */}
      <Dialog open={openBranchDialog} onOpenChange={setOpenBranchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Branch</DialogTitle>
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
            <Button variant="outline" onClick={() => setOpenBranchDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateBranch} disabled={!newBranchName}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Dialog */}
      <Dialog open={openMergeDialog} onOpenChange={setOpenMergeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge Branches</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="source-branch">Source Branch</Label>
              <Input
                id="source-branch"
                value={sourceBranch}
                onChange={(e) => setSourceBranch(e.target.value)}
                placeholder="Branch to merge from"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="target-branch">Target Branch</Label>
              <Input
                id="target-branch"
                value={targetBranch}
                onChange={(e) => setTargetBranch(e.target.value)}
                placeholder="Branch to merge into"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenMergeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleMergeBranch} disabled={!sourceBranch || !targetBranch}>
              Merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BranchesPage;
