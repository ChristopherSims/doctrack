import React from 'react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Settings,
  History,
  GitBranch,
  Download,
  GitCompareArrows,
  Network,
  ShieldCheck,
} from 'lucide-react';
import type { Page } from '../App';

interface NavigationProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  selectedDocumentTitle?: string;
  currentBranch?: string;
}

const Navigation: React.FC<NavigationProps> = ({ currentPage, onNavigate, selectedDocumentTitle, currentBranch }) => {
  const menuItems = [
    { label: 'Documents', icon: FileText, page: 'documents' as Page },
  ];

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
    <header className="h-14 border-b bg-card flex items-center px-4 gap-1 shrink-0">
      <h1 className="text-lg font-semibold tracking-tight mr-3">DocTrack</h1>
      {currentBranch && (
        <Badge variant="secondary" className="mr-2">{currentBranch}</Badge>
      )}
      <Separator orientation="vertical" className="h-6 mx-2" />
      {menuItems.map(item => (
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
  );
};

export default Navigation;
