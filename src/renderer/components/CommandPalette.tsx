import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Command,
  FileText,
  LayoutDashboard,
  Settings,
  History,
  GitBranch,
  Download,
  GitCompareArrows,
  Network,
  ShieldCheck,
  Plus,
  GitCommitHorizontal,
  ArrowRight,
  Search,
} from 'lucide-react';
import type { Page } from '../App';

interface CommandItem {
  id: string;
  label: string;
  shortcut?: string;
  icon: React.ReactNode;
  action: () => void;
  keywords: string;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  currentPage: Page;
  selectedDocumentId?: string | null;
  selectedDocumentTitle?: string;
  onNavigate: (page: Page) => void;
  onCreateDocument?: () => void;
  onCreateRequirement?: () => void;
  onCommit?: () => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  currentPage,
  selectedDocumentId,
  selectedDocumentTitle,
  onNavigate,
  onCreateDocument,
  onCreateRequirement,
  onCommit,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [
      {
        id: 'nav-dashboard',
        label: 'Go to Dashboard',
        icon: <LayoutDashboard className="h-4 w-4" />,
        action: () => { onNavigate('dashboard'); onClose(); },
        keywords: 'dashboard home overview',
      },
      {
        id: 'nav-documents',
        label: 'Go to Documents',
        icon: <FileText className="h-4 w-4" />,
        action: () => { onNavigate('documents'); onClose(); },
        keywords: 'documents list docs',
      },
      {
        id: 'nav-settings',
        label: 'Go to Settings',
        icon: <Settings className="h-4 w-4" />,
        action: () => { onNavigate('settings'); onClose(); },
        keywords: 'settings preferences config',
      },
      {
        id: 'nav-audit',
        label: 'Go to Audit Log',
        icon: <ShieldCheck className="h-4 w-4" />,
        action: () => { onNavigate('audit'); onClose(); },
        keywords: 'audit log history activity',
      },
    ];

    if (selectedDocumentId) {
      items.push(
        {
          id: 'nav-requirements',
          label: `Go to Requirements — ${selectedDocumentTitle || 'Current'}`,
          icon: <FileText className="h-4 w-4" />,
          action: () => { onNavigate('requirements'); onClose(); },
          keywords: 'requirements reqs current doc',
        },
        {
          id: 'nav-history',
          label: 'Go to History',
          icon: <History className="h-4 w-4" />,
          action: () => { onNavigate('history'); onClose(); },
          keywords: 'history commits timeline',
        },
        {
          id: 'nav-branches',
          label: 'Go to Branches',
          icon: <GitBranch className="h-4 w-4" />,
          action: () => { onNavigate('branches'); onClose(); },
          keywords: 'branches version control git',
        },
        {
          id: 'nav-export',
          label: 'Go to Export',
          icon: <Download className="h-4 w-4" />,
          action: () => { onNavigate('export'); onClose(); },
          keywords: 'export download csv word pdf',
        },
        {
          id: 'nav-diff',
          label: 'Go to Diff View',
          icon: <GitCompareArrows className="h-4 w-4" />,
          action: () => { onNavigate('diff'); onClose(); },
          keywords: 'diff compare changes',
        },
        {
          id: 'nav-traceability',
          label: 'Go to Traceability',
          icon: <Network className="h-4 w-4" />,
          action: () => { onNavigate('traceability'); onClose(); },
          keywords: 'traceability links dependencies',
        },
        {
          id: 'action-create-req',
          label: 'Create Requirement',
          icon: <Plus className="h-4 w-4" />,
          action: () => { if (onCreateRequirement) onCreateRequirement(); onClose(); },
          keywords: 'new requirement create add',
        },
        {
          id: 'action-commit',
          label: 'Create Commit',
          icon: <GitCommitHorizontal className="h-4 w-4" />,
          action: () => { if (onCommit) onCommit(); onClose(); },
          keywords: 'commit snapshot save version',
        }
      );
    } else {
      items.push({
        id: 'action-create-doc',
        label: 'Create Document',
        icon: <Plus className="h-4 w-4" />,
        action: () => { if (onCreateDocument) onCreateDocument(); onClose(); },
        keywords: 'new document create add doc',
      });
    }

    return items;
  }, [selectedDocumentId, selectedDocumentTitle, onNavigate, onClose, onCreateDocument, onCreateRequirement, onCommit]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.keywords.toLowerCase().includes(q)
    );
  }, [commands, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (!open) {
          setQuery('');
        }
      }
      if (!open) return;

      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = filtered[selectedIndex];
        if (item) {
          item.action();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, filtered, selectedIndex, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const el = listRef.current.children[selectedIndex] as HTMLElement;
      if (el) {
        el.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-lg border bg-popover shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded border text-[10px] font-mono text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No commands found
            </div>
          ) : (
            filtered.map((item, idx) => (
              <button
                key={item.id}
                className={`flex items-center gap-3 w-full px-4 py-2.5 text-left text-sm transition-colors ${
                  idx === selectedIndex
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent/50'
                }`}
                onClick={() => {
                  item.action();
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <span className="text-muted-foreground">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {idx === selectedIndex && (
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 rounded border font-mono">↑</kbd>
              <kbd className="px-1 rounded border font-mono">↓</kbd>
              <span>to navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 rounded border font-mono">↵</kbd>
              <span>to select</span>
            </span>
          </div>
          <span className="hidden sm:inline">{filtered.length} commands</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
