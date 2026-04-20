import React, { useState, useEffect } from 'react';
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
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeftRight, RefreshCw, Loader2, X } from 'lucide-react';
import * as API from '../../api/api';

interface DiffViewPageProps {
  documentId: string;
  documentTitle: string;
}

interface ModifiedRequirement {
  id: string;
  field: string;
  oldValue: string;
  newValue: string;
}

interface DiffResult {
  added: any[];
  removed: any[];
  modified: ModifiedRequirement[];
}

const DiffViewPage: React.FC<DiffViewPageProps> = ({ documentId, documentTitle }) => {
  const [commits, setCommits] = useState<any[]>([]);
  const [commit1, setCommit1] = useState<string>('');
  const [commit2, setCommit2] = useState<string>('');
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadCommits();
  }, [documentId]);

  const loadCommits = async () => {
    try {
      const result = await API.getCommits(documentId);
      if (result.success) {
        setCommits(result.data || []);
      }
    } catch (err) {
      console.error('Failed to load commits:', err);
    }
  };

  const handleCompare = async () => {
    if (!commit1 || !commit2) {
      setError('Please select two commits to compare.');
      return;
    }
    if (commit1 === commit2) {
      setError('Please select two different commits.');
      return;
    }

    setLoading(true);
    setError('');
    setDiffResult(null);

    try {
      const result = await API.diffCommits(commit1, commit2);
      if (result.success) {
        setDiffResult(result.data || { added: [], removed: [], modified: [] });
      } else {
        setError(result.error || 'Failed to compute diff.');
      }
    } catch (err) {
      setError('An error occurred while comparing commits.');
      console.error('Diff error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getCommitLabel = (commit: any) => {
    const shortId = commit.id?.substring(0, 8) || 'unknown';
    const date = commit.createdAt ? new Date(commit.createdAt).toLocaleDateString() : '';
    return `${shortId} — ${commit.message || 'No message'} (${date})`;
  };

  const getShortId = (id: string) => id?.substring(0, 8) || id;

  const totalChanges = diffResult
    ? diffResult.added.length + diffResult.removed.length + diffResult.modified.length
    : 0;

  return (
    <div className="p-6 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">
            Diff View
          </h1>
          <Badge variant="outline">{documentTitle}</Badge>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={loadCommits}
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Commit Selectors */}
      <div className="rounded-lg border bg-card p-4 mb-6">
        <p className="text-sm font-semibold mb-4">
          Select Commits to Compare
        </p>
        <div className="flex items-center gap-4 flex-wrap">
          <Select value={commit1} onValueChange={setCommit1}>
            <SelectTrigger size="sm" className="w-[300px]">
              <SelectValue placeholder="Commit 1 (Base)" />
            </SelectTrigger>
            <SelectContent>
              {commits.map((commit) => (
                <SelectItem key={commit.id} value={commit.id}>
                  {getCommitLabel(commit)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />

          <Select value={commit2} onValueChange={setCommit2}>
            <SelectTrigger size="sm" className="w-[300px]">
              <SelectValue placeholder="Commit 2 (Compare)" />
            </SelectTrigger>
            <SelectContent>
              {commits.map((commit) => (
                <SelectItem key={commit.id} value={commit.id}>
                  {getCommitLabel(commit)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={handleCompare}
            disabled={!commit1 || !commit2 || loading}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {!loading && <ArrowLeftRight className="h-4 w-4" />}
            {loading ? 'Comparing...' : 'Compare'}
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => setError('')}
              className="ml-2 rounded-full p-0.5 hover:bg-destructive/20"
            >
              <X className="h-4 w-4" />
            </button>
          </AlertDescription>
        </Alert>
      )}

      {/* Diff Results */}
      {diffResult && (
        <div>
          {/* Summary */}
          <div className="flex gap-2 mb-4">
            <Badge className="bg-green-50 text-green-800 border-green-200 hover:bg-green-100">
              {diffResult.added.length} Added
            </Badge>
            <Badge className="bg-red-50 text-red-800 border-red-200 hover:bg-red-100">
              {diffResult.removed.length} Removed
            </Badge>
            <Badge className="bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100">
              {diffResult.modified.length} Modified
            </Badge>
            <Badge variant="outline">
              {totalChanges} Total Changes
            </Badge>
          </div>

          {totalChanges === 0 && (
            <Alert className="mb-4 border-blue-200 bg-blue-50 text-blue-800">
              <AlertDescription>
                No differences found between the selected commits.
              </AlertDescription>
            </Alert>
          )}

          {/* Added Requirements */}
          {diffResult.added.length > 0 && (
            <div className="rounded-lg border mb-4 overflow-hidden">
              <div className="p-4 bg-green-50 rounded-t-lg">
                <h2 className="text-base font-semibold text-green-800">
                  Added Requirements ({diffResult.added.length})
                </h2>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold">ID</TableHead>
                    <TableHead className="font-semibold">Title</TableHead>
                    <TableHead className="font-semibold">Priority</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diffResult.added.map((req) => (
                    <TableRow key={req.id} className="bg-green-50 hover:bg-green-100">
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[0.7rem]">
                          {getShortId(req.id)}
                        </Badge>
                      </TableCell>
                      <TableCell>{req.title}</TableCell>
                      <TableCell>{req.priority || '—'}</TableCell>
                      <TableCell>{req.status || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Removed Requirements */}
          {diffResult.removed.length > 0 && (
            <div className="rounded-lg border mb-4 overflow-hidden">
              <div className="p-4 bg-red-50 rounded-t-lg">
                <h2 className="text-base font-semibold text-red-800">
                  Removed Requirements ({diffResult.removed.length})
                </h2>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold">ID</TableHead>
                    <TableHead className="font-semibold">Title</TableHead>
                    <TableHead className="font-semibold">Priority</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diffResult.removed.map((req) => (
                    <TableRow key={req.id} className="bg-red-50 hover:bg-red-100">
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[0.7rem]">
                          {getShortId(req.id)}
                        </Badge>
                      </TableCell>
                      <TableCell>{req.title}</TableCell>
                      <TableCell>{req.priority || '—'}</TableCell>
                      <TableCell>{req.status || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Modified Requirements */}
          {diffResult.modified.length > 0 && (
            <div className="rounded-lg border mb-4 overflow-hidden">
              <div className="p-4 bg-amber-50 rounded-t-lg">
                <h2 className="text-base font-semibold text-amber-800">
                  Modified Requirements ({diffResult.modified.length})
                </h2>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold">Requirement ID</TableHead>
                    <TableHead className="font-semibold">Field</TableHead>
                    <TableHead className="font-semibold">Old Value</TableHead>
                    <TableHead className="font-semibold">New Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diffResult.modified.map((mod, index) => (
                    <TableRow key={`${mod.id}-${mod.field}-${index}`} className="bg-amber-50 hover:bg-amber-100">
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[0.7rem]">
                          {getShortId(mod.id)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200">
                          {mod.field}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-red-800 line-through opacity-70">
                        {mod.oldValue || '—'}
                      </TableCell>
                      <TableCell className="text-green-800 font-semibold">
                        {mod.newValue || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* No commits available */}
      {commits.length === 0 && (
        <div className="rounded-lg border bg-card p-8 text-center">
          <ArrowLeftRight className="h-12 w-12 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-muted-foreground">No commits available</p>
          <p className="text-sm text-muted-foreground">
            Create commits in the History page before comparing versions.
          </p>
        </div>
      )}
    </div>
  );
};

export default DiffViewPage;
