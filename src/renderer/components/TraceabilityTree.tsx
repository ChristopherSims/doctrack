import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ChevronRight,
  ChevronDown,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Loader2,
} from 'lucide-react';

const LINK_TYPE_COLOR_CLASS: Record<string, string> = {
  implements: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
  verifies: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30',
  traces_to: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30',
  derives_from: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  satisfies: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30',
};

interface TreeNode {
  id: string;
  title: string;
  level: string;
  documentId: string;
  documentTitle: string;
  outgoing: Array<{
    linkId: string;
    targetId: string;
    targetTitle: string;
    targetLevel: string;
    targetDocumentId: string;
    targetDocumentTitle: string;
    linkType: string;
  }>;
  incoming: Array<{
    linkId: string;
    sourceId: string;
    sourceTitle: string;
    sourceLevel: string;
    sourceDocumentId: string;
    sourceDocumentTitle: string;
    linkType: string;
  }>;
}

interface TraceabilityTreeProps {
  nodes: TreeNode[];
  loading: boolean;
  onNavigateToRequirement?: (documentId: string, requirementId: string) => void;
  currentDocumentId: string;
}

const TraceabilityTree: React.FC<TraceabilityTreeProps> = ({
  nodes,
  loading,
  onNavigateToRequirement,
  currentDocumentId,
}) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedIds(new Set(nodes.map(n => n.id)));
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  // Filter nodes by search and link type
  const filteredNodes = useMemo(() => {
    let result = nodes;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.level.toLowerCase().includes(q) ||
        n.id.toLowerCase().includes(q) ||
        n.outgoing.some(o => o.targetTitle.toLowerCase().includes(q) || o.targetDocumentTitle.toLowerCase().includes(q)) ||
        n.incoming.some(i => i.sourceTitle.toLowerCase().includes(q) || i.sourceDocumentTitle.toLowerCase().includes(q))
      );
    }
    if (filterType !== 'all') {
      result = result.filter(n =>
        n.outgoing.some(o => o.linkType === filterType) ||
        n.incoming.some(i => i.linkType === filterType)
      );
    }
    return result;
  }, [nodes, searchQuery, filterType]);

  // Auto-expand nodes that have links when there's a search
  const effectiveExpanded = useMemo(() => {
    if (searchQuery.trim()) {
      const autoExpanded = new Set(expandedIds);
      filteredNodes.forEach(n => {
        if (n.outgoing.length > 0 || n.incoming.length > 0) {
          autoExpanded.add(n.id);
        }
      });
      return autoExpanded;
    }
    return expandedIds;
  }, [expandedIds, searchQuery, filteredNodes]);

  const nodesWithLinks = nodes.filter(n => n.outgoing.length > 0 || n.incoming.length > 0);
  const totalOutgoing = nodes.reduce((sum, n) => sum + n.outgoing.length, 0);
  const totalIncoming = nodes.reduce((sum, n) => sum + n.incoming.length, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No requirements found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search requirements..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={expandAll}>
            Expand All
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Collapse All
          </Button>
        </div>
      </div>

      {/* Summary badges */}
      <div className="flex gap-2 flex-wrap">
        <Badge variant="outline">{nodes.length} requirements</Badge>
        <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30">
          {totalOutgoing} outgoing
        </Badge>
        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
          {totalIncoming} incoming
        </Badge>
        {nodesWithLinks.length < nodes.length && (
          <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30">
            {nodes.length - nodesWithLinks.length} unlinked
          </Badge>
        )}
      </div>

      {/* Link type filter */}
      <div className="flex gap-1.5 flex-wrap">
        <Button
          variant={filterType === 'all' ? 'default' : 'outline'}
          size="sm"
          className="h-7 text-xs"
          onClick={() => setFilterType('all')}
        >
          All
        </Button>
        {['implements', 'verifies', 'traces_to', 'derives_from', 'satisfies'].map(lt => (
          <Button
            key={lt}
            variant={filterType === lt ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setFilterType(filterType === lt ? 'all' : lt)}
          >
            {lt.replace('_', ' ')}
          </Button>
        ))}
      </div>

      {/* Tree */}
      <div className="border rounded-md">
        {filteredNodes.map((node) => {
          const hasLinks = node.outgoing.length > 0 || node.incoming.length > 0;
          const isExpanded = effectiveExpanded.has(node.id);
          const isCurrentDoc = node.documentId === currentDocumentId;

          return (
            <div key={node.id} className="border-b last:border-b-0">
              {/* Node row */}
              <div
                className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => hasLinks && toggleExpand(node.id)}
              >
                {/* Expand/collapse chevron */}
                <div className="w-4 shrink-0">
                  {hasLinks && (
                    isExpanded
                      ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>

                {/* Level badge */}
                <Badge variant="outline" className="font-mono text-[0.65rem] shrink-0">
                  {node.level}
                </Badge>

                {/* Title */}
                <span className="text-sm truncate flex-1 min-w-0">
                  {node.title}
                </span>

                {/* Link counts */}
                {hasLinks && (
                  <div className="flex items-center gap-1 shrink-0">
                    {node.outgoing.length > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-blue-600 dark:text-blue-400">
                        <ArrowUpRight className="h-3 w-3" />
                        {node.outgoing.length}
                      </span>
                    )}
                    {node.incoming.length > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-amber-600 dark:text-amber-400">
                        <ArrowDownLeft className="h-3 w-3" />
                        {node.incoming.length}
                      </span>
                    )}
                  </div>
                )}

                {/* Document indicator */}
                {!isCurrentDoc && (
                  <Badge variant="secondary" className="text-[0.6rem] shrink-0">
                    {node.documentTitle}
                  </Badge>
                )}
              </div>

              {/* Expanded links */}
              {isExpanded && hasLinks && (
                <div className="pl-9 pr-3 pb-2 space-y-1">
                  {/* Outgoing links */}
                  {node.outgoing.map((link) => (
                    <div
                      key={link.linkId}
                      className="flex items-center gap-2 py-1 px-2 rounded hover:bg-accent/30 cursor-pointer text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigateToRequirement?.(link.targetDocumentId, link.targetId);
                      }}
                    >
                      <ArrowUpRight className="h-3 w-3 text-blue-500 shrink-0" />
                      <Badge variant="outline" className="font-mono text-[0.6rem]">
                        {link.targetLevel}
                      </Badge>
                      <span className="truncate flex-1 min-w-0">{link.targetTitle}</span>
                      <Badge className={`text-[0.6rem] ${LINK_TYPE_COLOR_CLASS[link.linkType] || 'bg-secondary text-secondary-foreground'}`}>
                        {link.linkType.replace('_', ' ')}
                      </Badge>
                      {link.targetDocumentId !== currentDocumentId && (
                        <Badge variant="secondary" className="text-[0.55rem] shrink-0">
                          {link.targetDocumentTitle}
                        </Badge>
                      )}
                    </div>
                  ))}

                  {/* Incoming links */}
                  {node.incoming.map((link) => (
                    <div
                      key={link.linkId}
                      className="flex items-center gap-2 py-1 px-2 rounded hover:bg-accent/30 cursor-pointer text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigateToRequirement?.(link.sourceDocumentId, link.sourceId);
                      }}
                    >
                      <ArrowDownLeft className="h-3 w-3 text-amber-500 shrink-0" />
                      <Badge variant="outline" className="font-mono text-[0.6rem]">
                        {link.sourceLevel}
                      </Badge>
                      <span className="truncate flex-1 min-w-0">{link.sourceTitle}</span>
                      <Badge className={`text-[0.6rem] ${LINK_TYPE_COLOR_CLASS[link.linkType] || 'bg-secondary text-secondary-foreground'}`}>
                        {link.linkType.replace('_', ' ')}
                      </Badge>
                      {link.sourceDocumentId !== currentDocumentId && (
                        <Badge variant="secondary" className="text-[0.55rem] shrink-0">
                          {link.sourceDocumentTitle}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {filteredNodes.length === 0 && (
          <div className="text-center py-6 text-muted-foreground text-sm">
            No requirements match the current filter
          </div>
        )}
      </div>
    </div>
  );
};

export default TraceabilityTree;
