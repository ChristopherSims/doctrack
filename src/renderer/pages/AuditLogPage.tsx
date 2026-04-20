import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Filter,
  Loader2,
  Info,
  AlertCircle,
} from 'lucide-react';
import * as API from '../../api/api';
import type { AuditLogEntry } from '../../types';

interface AuditLogPageProps {
  documentId?: string;
}

const AuditLogPage: React.FC<AuditLogPageProps> = ({ documentId }) => {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchText, setSearchText] = useState<string>('');
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Expanded rows (by entry id)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const fetchAuditLog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await API.getAuditLog(documentId);
      if (response.success && response.data) {
        setEntries(response.data as AuditLogEntry[]);
      } else {
        setError(response.error || 'Failed to load audit log');
      }
    } catch (err) {
      setError('Network error loading audit log');
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    fetchAuditLog();
  }, [fetchAuditLog]);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Collect unique resource types from data for the filter dropdown
  const resourceTypes = Array.from(new Set(entries.map(e => e.resourceType))).sort();

  // Apply filters
  const filteredEntries = entries.filter(entry => {
    // Text search across action, actorName, resourceId
    if (searchText) {
      const q = searchText.toLowerCase();
      const matches =
        entry.action.toLowerCase().includes(q) ||
        entry.actorName.toLowerCase().includes(q) ||
        entry.resourceId.toLowerCase().includes(q);
      if (!matches) return false;
    }

    // Resource type filter
    if (resourceTypeFilter !== 'all' && entry.resourceType !== resourceTypeFilter) {
      return false;
    }

    // Date range filter
    if (dateFrom) {
      const entryDate = new Date(entry.timestamp);
      const from = new Date(dateFrom);
      if (entryDate < from) return false;
    }
    if (dateTo) {
      const entryDate = new Date(entry.timestamp);
      const to = new Date(dateTo);
      // Include the entire end day
      to.setHours(23, 59, 59, 999);
      if (entryDate > to) return false;
    }

    return true;
  });

  const formatTimestamp = (ts: string) => {
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  };

  const getApprovalStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">Approved</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800">Pending</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status || 'N/A'}</Badge>;
    }
  };

  const clearFilters = () => {
    setSearchText('');
    setResourceTypeFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">
          {documentId ? 'Document Audit Log' : 'Audit Log'}
        </h1>
        <Button
          variant="outline"
          onClick={fetchAuditLog}
          disabled={loading}
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {documentId && (
        <Alert className="mb-4">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Showing audit log entries for document: {documentId}
          </AlertDescription>
        </Alert>
      )}

      {/* Filter Controls */}
      <div className="rounded-lg border bg-card p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <div className="min-w-[220px]">
            <Input
              placeholder="Search action, actor, resource..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
            />
          </div>
          <div className="min-w-[160px]">
            <Select
              value={resourceTypeFilter}
              onValueChange={value => setResourceTypeFilter(value)}
            >
              <SelectTrigger size="sm">
                <SelectValue placeholder="Resource Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {resourceTypes.map(rt => (
                  <SelectItem key={rt} value={rt}>
                    {rt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="date-from" className="text-sm whitespace-nowrap">From</Label>
            <Input
              id="date-from"
              type="date"
              className="w-auto"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="date-to" className="text-sm whitespace-nowrap">To</Label>
            <Input
              id="date-to"
              type="date"
              className="w-auto"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
            />
          </div>
          <Button size="sm" variant="ghost" onClick={clearFilters}>
            Clear Filters
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-semibold">Timestamp</TableHead>
                <TableHead className="font-semibold">Action</TableHead>
                <TableHead className="font-semibold">Actor</TableHead>
                <TableHead className="font-semibold">Resource Type</TableHead>
                <TableHead className="font-semibold">Resource ID</TableHead>
                <TableHead className="font-semibold">Approval Status</TableHead>
                <TableHead className="font-semibold">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <span className="text-muted-foreground">
                      No audit log entries found
                    </span>
                  </TableCell>
                </TableRow>
              ) : (
                filteredEntries.map(entry => (
                  <React.Fragment key={entry.id}>
                    <TableRow>
                      <TableCell>{formatTimestamp(entry.timestamp)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{entry.action}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {entry.actorName}
                          {entry.actorType && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              ({entry.actorType})
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>{entry.resourceType}</TableCell>
                      <TableCell>
                        <span className="font-mono text-xs">
                          {entry.resourceId}
                        </span>
                      </TableCell>
                      <TableCell>{getApprovalStatusBadge(entry.approvalStatus)}</TableCell>
                      <TableCell>
                        {entry.changeDetails ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => toggleRow(entry.id)}
                            aria-label="Toggle details"
                          >
                            {expandedRows.has(entry.id) ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">None</span>
                        )}
                      </TableCell>
                    </TableRow>
                    {expandedRows.has(entry.id) && (
                      <TableRow>
                        <TableCell colSpan={7} className="py-0 border-0">
                          <div className="m-2 p-4 rounded-lg border bg-muted/50 max-h-[300px] overflow-auto">
                            <span className="text-xs text-muted-foreground block mb-1">
                              Change Details
                            </span>
                            <pre className="m-0 text-xs whitespace-pre-wrap">
                              {JSON.stringify(entry.changeDetails, null, 2)}
                            </pre>
                            {entry.reason && (
                              <div className="mt-2">
                                <span className="text-xs text-muted-foreground">Reason: </span>
                                <span className="text-sm">{entry.reason}</span>
                              </div>
                            )}
                            {entry.approvedBy && (
                              <div className="mt-1">
                                <span className="text-xs text-muted-foreground">Approved By: </span>
                                <span className="text-sm">{entry.approvedBy}</span>
                              </div>
                            )}
                            {entry.aiAgentModel && (
                              <div className="mt-1">
                                <span className="text-xs text-muted-foreground">AI Model: </span>
                                <span className="text-sm">{entry.aiAgentModel}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Result count */}
      {!loading && !error && entries.length > 0 && (
        <span className="text-xs text-muted-foreground block mt-2">
          Showing {filteredEntries.length} of {entries.length} entries
        </span>
      )}
    </div>
  );
};

export default AuditLogPage;
