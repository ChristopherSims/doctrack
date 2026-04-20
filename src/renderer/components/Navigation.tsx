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
    <aside className="w-60 border-r bg-card flex flex-col h-full">
      <div className="p-4">
        <h1 className="text-lg font-semibold tracking-tight">DocTrack</h1>
        {currentBranch && (
          <Badge variant="secondary" className="mt-1">{currentBranch}</Badge>
        )}
      </div>
      <Separator />
      <nav className="flex-1 p-2 space-y-1">
        {menuItems.map(item => (
          <Button
            key={item.page}
            variant={currentPage === item.page ? 'secondary' : 'ghost'}
            className="w-full justify-start"
            onClick={() => onNavigate(item.page)}
          >
            <item.icon className="mr-2 h-4 w-4" />
            {item.label}
          </Button>
        ))}
        {selectedDocumentTitle && (
          <>
            <Separator className="my-2" />
            <p className="px-3 py-1 text-xs text-muted-foreground truncate">{selectedDocumentTitle}</p>
            {documentMenuItems.map(item => (
              <Button
                key={item.page}
                variant={currentPage === item.page ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                onClick={() => onNavigate(item.page)}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {item.label}
              </Button>
            ))}
          </>
        )}
      </nav>
      <Separator />
      <nav className="p-2 space-y-1">
        {globalMenuItems.map(item => (
          <Button
            key={item.page}
            variant={currentPage === item.page ? 'secondary' : 'ghost'}
            className="w-full justify-start"
            onClick={() => onNavigate(item.page)}
          >
            <item.icon className="mr-2 h-4 w-4" />
            {item.label}
          </Button>
        ))}
      </nav>
    </aside>
  );
};

export default Navigation;
