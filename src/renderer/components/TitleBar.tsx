import React, { useState, useCallback } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Minus, Square, X } from 'lucide-react';

interface TitleBarProps {
  title?: string;
}

const TitleBar: React.FC<TitleBarProps> = ({ title = 'DocTrack' }) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const handleMinimize = useCallback(async () => {
    try {
      await window.electronAPI.window.minimize();
    } catch (err) {
      console.error('Failed to minimize window:', err);
    }
  }, []);

  const handleMaximize = useCallback(async () => {
    try {
      await window.electronAPI.window.maximize();
    } catch (err) {
      console.error('Failed to maximize window:', err);
    }
  }, []);

  const handleClose = useCallback(async () => {
    try {
      await window.electronAPI.window.close();
    } catch (err) {
      console.error('Failed to close window:', err);
    }
  }, []);

  const handleMenuHover = (menu: string) => {
    if (activeMenu && activeMenu !== menu) {
      setActiveMenu(menu);
    }
  };

  // Menu items that mirror the native Electron menu from main.ts
  const fileItems = [
    { label: 'New Document', shortcut: 'Ctrl+N', action: () => {} },
    { label: 'Export', shortcut: 'Ctrl+E', action: () => {} },
    { type: 'separator' as const },
    { label: 'Exit', shortcut: 'Ctrl+Q', action: () => window.electronAPI.window.close() },
  ];

  const editItems = [
    { label: 'Undo', shortcut: 'Ctrl+Z', action: () => document.execCommand('undo') },
    { label: 'Redo', shortcut: 'Ctrl+Shift+Z', action: () => document.execCommand('redo') },
    { type: 'separator' as const },
    { label: 'Cut', shortcut: 'Ctrl+X', action: () => document.execCommand('cut') },
    { label: 'Copy', shortcut: 'Ctrl+C', action: () => document.execCommand('copy') },
    { label: 'Paste', shortcut: 'Ctrl+V', action: () => document.execCommand('paste') },
  ];

  const viewItems = [
    { label: 'Reload', shortcut: 'Ctrl+R', action: () => window.location.reload() },
    { label: 'Toggle DevTools', shortcut: 'Ctrl+I', action: () => {} },
    { type: 'separator' as const },
    { label: 'Fullscreen', shortcut: 'F11', action: () => {} },
  ];

  const helpItems = [
    { label: 'About DocTrack', action: () => {} },
    { label: 'Documentation', action: () => window.open('https://github.com/doctrack/doctrack', '_blank') },
  ];

  interface MenuItemDef {
    label?: string;
    shortcut?: string;
    action?: () => void;
    type?: 'separator';
  }

  const renderMenuItems = (items: MenuItemDef[]) =>
    items.map((item, i) => {
      if (item.type === 'separator') {
        return <DropdownMenuSeparator key={`sep-${i}`} />;
      }
      return (
        <DropdownMenuItem
          key={item.label}
          onClick={item.action}
          className="flex items-center justify-between gap-6 cursor-pointer"
        >
          <span>{item.label}</span>
          {item.shortcut && (
            <span className="text-xs text-muted-foreground ml-auto pl-4">{item.shortcut}</span>
          )}
        </DropdownMenuItem>
      );
    });

  const menus = [
    { key: 'file', label: 'File', items: fileItems },
    { key: 'edit', label: 'Edit', items: editItems },
    { key: 'view', label: 'View', items: viewItems },
    { key: 'help', label: 'Help', items: helpItems },
  ];

  return (
    <div
      className="flex items-center h-8 px-3 bg-card border-b shrink-0 select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Menu Items */}
      <div className="flex items-center gap-0" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {menus.map((menu) => (
          <DropdownMenu
            key={menu.key}
            open={activeMenu === menu.key}
            onOpenChange={(open) => setActiveMenu(open ? menu.key : null)}
          >
            <DropdownMenuTrigger asChild>
              <button
                className="px-2 py-0.5 text-[13px] text-muted-foreground rounded hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                onMouseEnter={() => handleMenuHover(menu.key)}
              >
                {menu.label}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="min-w-[180px]"
              onMouseEnter={() => setActiveMenu(menu.key)}
            >
              {renderMenuItems(menu.items)}
            </DropdownMenuContent>
          </DropdownMenu>
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1 px-1" />

      {/* Window Title */}
      <span className="text-xs font-semibold text-muted-foreground text-center">
        {title}
      </span>

      {/* Spacer */}
      <div className="flex-1 px-1" />

      {/* Window Controls */}
      <div
        className="flex items-center"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={handleMinimize}
          className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          onClick={handleMaximize}
          className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <Square className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleClose}
          className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:bg-red-500 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default TitleBar;
