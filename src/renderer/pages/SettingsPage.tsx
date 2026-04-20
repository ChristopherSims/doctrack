import React, { useState } from 'react';
import { Settings as SettingsIcon, Save as SaveIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState({
    apiBaseUrl: 'http://localhost:5000/api',
    autoSave: true,
    autoSaveInterval: 30,
    showStatusBar: true,
    darkMode: false,
    confirmBeforeDelete: true,
    defaultPriority: 'medium',
    defaultStatus: 'draft',
    maxUndoLevels: 50,
  });

  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    // TODO: Persist settings via Electron store or backend
    localStorage.setItem('doctrack-settings', JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="p-3 max-w-[800px]">
      <div className="flex items-center gap-1 mb-3">
        <SettingsIcon className="size-5 text-primary" />
        <h1 className="text-xl font-semibold">
          Settings
        </h1>
      </div>

      {saved && (
        <Alert className="mb-2 border-green-500 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200">
          <AlertDescription>
            Settings saved
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-lg border bg-card p-3 mb-2">
        <h2 className="text-sm font-semibold mb-2">
          Connection
        </h2>
        <div className="space-y-1.5">
          <Label htmlFor="apiBaseUrl">API Base URL</Label>
          <Input
            id="apiBaseUrl"
            value={settings.apiBaseUrl}
            onChange={(e) => setSettings({ ...settings, apiBaseUrl: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">Backend Flask server URL</p>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-3 mb-2">
        <h2 className="text-sm font-semibold mb-2">
          Editor
        </h2>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Switch
              id="autoSave"
              checked={settings.autoSave}
              onCheckedChange={(checked) => setSettings({ ...settings, autoSave: checked })}
            />
            <Label htmlFor="autoSave">Auto-save changes</Label>
          </div>
          {settings.autoSave && (
            <div className="max-w-[250px] space-y-1.5">
              <Label htmlFor="autoSaveInterval">Auto-save interval (seconds)</Label>
              <Input
                id="autoSaveInterval"
                type="number"
                value={settings.autoSaveInterval}
                onChange={(e) => setSettings({ ...settings, autoSaveInterval: parseInt(e.target.value) || 30 })}
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <Switch
              id="confirmBeforeDelete"
              checked={settings.confirmBeforeDelete}
              onCheckedChange={(checked) => setSettings({ ...settings, confirmBeforeDelete: checked })}
            />
            <Label htmlFor="confirmBeforeDelete">Confirm before deleting</Label>
          </div>
          <div className="max-w-[250px] space-y-1.5">
            <Label htmlFor="maxUndoLevels">Max undo levels</Label>
            <Input
              id="maxUndoLevels"
              type="number"
              value={settings.maxUndoLevels}
              onChange={(e) => setSettings({ ...settings, maxUndoLevels: parseInt(e.target.value) || 50 })}
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-3 mb-2">
        <h2 className="text-sm font-semibold mb-2">
          Appearance
        </h2>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Switch
              id="darkMode"
              checked={settings.darkMode}
              onCheckedChange={(checked) => setSettings({ ...settings, darkMode: checked })}
            />
            <Label htmlFor="darkMode">Dark mode</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="showStatusBar"
              checked={settings.showStatusBar}
              onCheckedChange={(checked) => setSettings({ ...settings, showStatusBar: checked })}
            />
            <Label htmlFor="showStatusBar">Show status bar</Label>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-3 mb-2">
        <h2 className="text-sm font-semibold mb-2">
          Defaults
        </h2>
        <div className="flex gap-4">
          <div className="space-y-1.5 min-w-[150px]">
            <Label>Default priority</Label>
            <Select
              value={settings.defaultPriority}
              onValueChange={(value) => setSettings({ ...settings, defaultPriority: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 min-w-[150px]">
            <Label>Default status</Label>
            <Select
              value={settings.defaultStatus}
              onValueChange={(value) => setSettings({ ...settings, defaultStatus: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="review">Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Button
        size="lg"
        onClick={handleSave}
      >
        <SaveIcon className="size-4" />
        Save Settings
      </Button>
    </div>
  );
};

export default SettingsPage;
