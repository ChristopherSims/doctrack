import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search, ExternalLink, Bug, Hammer, GitCommit, GitPullRequest } from 'lucide-react';
import * as API from '../../api/api';

interface OneDevPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (url: string) => void;
}

const TAB_CONFIG = [
  { value: 'issues', label: 'Issues', icon: Bug },
  { value: 'builds', label: 'Builds', icon: Hammer },
  { value: 'commits', label: 'Commits', icon: GitCommit },
  { value: 'pull-requests', label: 'Pull Requests', icon: GitPullRequest },
] as const;

type TabValue = typeof TAB_CONFIG[number]['value'];

const OneDevPickerDialog: React.FC<OneDevPickerDialogProps> = ({ open, onOpenChange, onSelect }) => {
  const [activeTab, setActiveTab] = useState<TabValue>('issues');
  const [projectId, setProjectId] = useState<number | null>(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [configLoaded, setConfigLoaded] = useState(false);

  const loadConfig = useCallback(async () => {
    const res = await API.getOneDevConfig();
    if (res.success && res.data) {
      setBaseUrl(res.data.url || '');
      if (res.data.project) {
        setProjectId(parseInt(res.data.project, 10) || null);
      }
    }
    setConfigLoaded(true);
  }, []);

  useEffect(() => {
    if (open) {
      loadConfig();
      setQuery('');
      setError('');
      setItems([]);
    }
  }, [open, loadConfig]);

  const fetchItems = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      let res;
      switch (activeTab) {
        case 'issues':
          res = await API.getOneDevIssues(projectId, query || undefined);
          break;
        case 'builds':
          res = await API.getOneDevBuilds(projectId, query || undefined);
          break;
        case 'commits':
          res = await API.getOneDevCommits(projectId, query || undefined);
          break;
        case 'pull-requests':
          res = await API.getOneDevPullRequests(projectId, query || undefined);
          break;
      }
      if (res && res.success && res.data) {
        setItems(Array.isArray(res.data) ? res.data : []);
      } else {
        setItems([]);
        setError(res?.error || 'Failed to load items');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load items');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, projectId, query]);

  useEffect(() => {
    if (open && projectId) {
      fetchItems();
    }
  }, [open, activeTab, projectId, fetchItems]);

  const handleSearch = () => {
    fetchItems();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const buildUrl = (item: any): string => {
    if (!baseUrl) return '';
    switch (activeTab) {
      case 'issues':
        return `${baseUrl}/issues/${item.id}`;
      case 'builds':
        return `${baseUrl}/builds/${item.id}`;
      case 'commits':
        return `${baseUrl}/commits/${item.hash || item.id}`;
      case 'pull-requests':
        return `${baseUrl}/pull-requests/${item.id}`;
      default:
        return '';
    }
  };

  const renderItem = (item: any) => {
    switch (activeTab) {
      case 'issues':
        return (
          <div className="flex items-center justify-between w-full">
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-sm font-medium truncate">{item.title || 'Untitled'}</span>
              <span className="text-xs text-muted-foreground">#{item.number || item.id} · {item.state || 'open'}</span>
            </div>
            <Badge variant="outline" className="shrink-0 ml-2">{item.state || 'open'}</Badge>
          </div>
        );
      case 'builds':
        return (
          <div className="flex items-center justify-between w-full">
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-sm font-medium truncate">{item.jobName || 'Build'}</span>
              <span className="text-xs text-muted-foreground">#{item.number || item.id} · {item.status || 'unknown'}</span>
            </div>
            <Badge variant="outline" className="shrink-0 ml-2">{item.status || 'unknown'}</Badge>
          </div>
        );
      case 'commits':
        return (
          <div className="flex items-center justify-between w-full">
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-sm font-medium truncate">{item.subject || item.message || 'Commit'}</span>
              <span className="text-xs text-muted-foreground font-mono truncate">{item.hash ? item.hash.substring(0, 12) : item.id}</span>
            </div>
          </div>
        );
      case 'pull-requests':
        return (
          <div className="flex items-center justify-between w-full">
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-sm font-medium truncate">{item.title || 'PR'}</span>
              <span className="text-xs text-muted-foreground">#{item.number || item.id} · {item.targetBranch || ''}</span>
            </div>
            <Badge variant="outline" className="shrink-0 ml-2">{item.status || 'open'}</Badge>
          </div>
        );
      default:
        return null;
    }
  };

  if (!configLoaded) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!projectId) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>OneDev Browser</DialogTitle>
            <DialogDescription>
              No OneDev project configured. Go to Settings → OneDev Integration to set up a project.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5 text-primary" />
            OneDev Browser
          </DialogTitle>
          <DialogDescription>
            Browse your OneDev project and click an item to use its link.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="flex flex-col flex-1 min-h-0">
          <TabsList className="grid grid-cols-4">
            {TAB_CONFIG.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="flex items-center gap-1 text-xs">
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex gap-2 mt-3">
            <Input
              placeholder="Search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1"
            />
            <Button variant="outline" size="icon" onClick={handleSearch} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {error && (
            <div className="text-sm text-destructive mt-2">{error}</div>
          )}

          {TAB_CONFIG.map((t) => (
            <TabsContent key={t.value} value={t.value} className="flex-1 min-h-0 mt-2">
              <ScrollArea className="h-[320px] rounded-md border">
                <div className="divide-y">
                  {items.length === 0 && !loading && (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No {t.label.toLowerCase()} found
                    </div>
                  )}
                  {items.map((item) => (
                    <button
                      key={item.id}
                      className="w-full text-left px-4 py-2.5 hover:bg-accent transition-colors flex items-center gap-2"
                      onClick={() => {
                        onSelect(buildUrl(item));
                        onOpenChange(false);
                      }}
                    >
                      {renderItem(item)}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default OneDevPickerDialog;
