import React, { useState, useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  FileText,
  Settings,
  History,
  GitBranch,
  Download,
  GitCompareArrows,
  Network,
  ShieldCheck,
  ChevronDown,
  Plus,
  Loader2,
} from 'lucide-react';
import type { Page } from '../App';
import * as API from '../../api/api';

interface NavigationProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  selectedDocumentTitle?: string;
  currentBranch?: string;
  onNavigateToDocument?: (docId: string, docTitle: string) => void;
}

const Navigation: React.FC<NavigationProps> = ({
  currentPage,
  onNavigate,
  selectedDocumentTitle,
  currentBranch,
  onNavigateToDocument,
}) => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // New document dialog
  const [newDocDialogOpen, setNewDocDialogOpen] = useState(false);
  const [newDocForm, setNewDocForm] = useState({ title: '', description: '', owner: '' });
  const [creating, setCreating] = useState(false);

  // Load documents on mount
  useEffect(() => {
    loadDocuments();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [dropdownOpen]);

  const loadDocuments = async () => {
    setLoadingDocs(true);
    try {
      const result = await API.getDocuments();
      if (result.success) {
        setDocuments(result.data || []);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleSelectDocument = (doc: any) => {
    if (onNavigateToDocument) {
      onNavigateToDocument(doc.id, doc.title);
    } else {
      onNavigate('requirements');
    }
    setDropdownOpen(false);
  };

  const handleOpenNewDocDialog = () => {
    setNewDocForm({ title: '', description: '', owner: '' });
    setDropdownOpen(false);
    setNewDocDialogOpen(true);
  };

  const handleCreateDocument = async () => {
    if (!newDocForm.title.trim()) return;
    setCreating(true);
    try {
      const result = await API.createDocument({
        title: newDocForm.title,
        description: newDocForm.description,
        owner: newDocForm.owner,
      });
      if (result.success && result.data) {
        if (onNavigateToDocument) {
          onNavigateToDocument(result.data.id, result.data.title);
        }
        setNewDocDialogOpen(false);
        await loadDocuments();
      }
    } catch (error) {
      console.error('Failed to create document:', error);
    } finally {
      setCreating(false);
    }
  };

  const documentMenuItems = selectedDocumentTitle ? [
    { label: 'History', icon: History, page: 'history' as Page },
    { label: 'Branches', icon: GitBranch, page: 'branches' as Page },
    { label: 'Export', icon: Download, page: 'export' as Page },
    { label: 'Diff View', icon: GitCompareArrows, page: 'diff' as Page },
    { label: 'Traceability', icon: Network, page: 'traceability' as Page },
  ] : [];

  const globalMenuItems = [
    { label: 'Audit Log', icon: ShieldCheck, page: 'audit' as Page },
    { label: 'Settings', icon: Settings, page: 'settings' as Page },
  ];

  return (
    <>
      <header className="h-14 border-b bg-card flex items-center px-4 gap-1 shrink-0 relative z-50">
        <h1 className="text-lg font-semibold tracking-tight mr-3">DocTrack</h1>
        {currentBranch && (
          <Badge variant="secondary" className="mr-2">{currentBranch}</Badge>
        )}
        <Separator orientation="vertical" className="h-6 mx-2" />

        {/* Documents Dropdown - custom implementation */}
        <div className="relative" ref={dropdownRef}>
          <Button
            variant={currentPage === 'documents' ? 'secondary' : 'ghost'}
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setDropdownOpen(prev => !prev);
              if (!dropdownOpen) loadDocuments();
            }}
          >
            <FileText className="h-4 w-4" />
            Documents
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </Button>

          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-64 rounded-md border bg-popover p-1 text-popover-foreground shadow-md z-[100]">
              {loadingDocs ? (
                <div className="flex items-center justify-center py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
                </div>
              ) : documents.length === 0 ? (
                <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                  No documents found
                </div>
              ) : (
                documents.map((doc) => (
                  <button
                    key={doc.id}
                    className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer w-full text-left"
                    onClick={() => handleSelectDocument(doc)}
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{doc.title}</span>
                  </button>
                ))
              )}
              <div className="border-t my-1" />
              <button
                className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-primary hover:bg-accent hover:text-accent-foreground cursor-pointer w-full text-left font-medium"
                onClick={handleOpenNewDocDialog}
              >
                <Plus className="h-4 w-4 shrink-0" />
                New Document
              </button>
            </div>
          )}
        </div>

        {selectedDocumentTitle && (
          <>
            <Separator orientation="vertical" className="h-6 mx-2" />
            <span className="text-xs text-muted-foreground max-w-[120px] truncate">{selectedDocumentTitle}</span>
            <Separator orientation="vertical" className="h-6 mx-2" />
            {documentMenuItems.map(item => (
              <Button
                key={item.page}
                variant={currentPage === item.page ? 'secondary' : 'ghost'}
                size="sm"
                className="gap-1.5"
                onClick={() => onNavigate(item.page)}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Button>
            ))}
          </>
        )}
        <div className="flex-1" />
        {globalMenuItems.map(item => (
          <Button
            key={item.page}
            variant={currentPage === item.page ? 'secondary' : 'ghost'}
            size="sm"
            className="gap-1.5"
            onClick={() => onNavigate(item.page)}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Button>
        ))}
      </header>

      {/* New Document Dialog */}
      <Dialog open={newDocDialogOpen} onOpenChange={setNewDocDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              New Document
            </DialogTitle>
            <DialogDescription>
              Create a new document to manage requirements.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-1">
            <div className="flex flex-col gap-1.5">
              <Label>Title</Label>
              <Input
                placeholder="Document title"
                value={newDocForm.title}
                onChange={(e) => setNewDocForm(prev => ({ ...prev, title: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Description</Label>
              <Textarea
                placeholder="Brief description of the document"
                value={newDocForm.description}
                onChange={(e) => setNewDocForm(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Owner</Label>
              <Input
                placeholder="Document owner"
                value={newDocForm.owner}
                onChange={(e) => setNewDocForm(prev => ({ ...prev, owner: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDocDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreateDocument}
              disabled={!newDocForm.title.trim() || creating}
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {creating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Navigation;
