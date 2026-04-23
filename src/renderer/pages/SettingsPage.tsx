import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save as SaveIcon, Users, Plus, Loader2, Server, TestTube, Trash2, CheckCircle, XCircle } from 'lucide-react';
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
import { useAuth } from '../contexts/AuthContext';
import * as API from '../../api/api';

const defaultSettings = {
  apiBaseUrl: 'http://localhost:5000/api',
  autoSave: true,
  autoSaveInterval: 30,
  showStatusBar: true,
  darkMode: false,
  confirmBeforeDelete: true,
  defaultPriority: 'medium',
  defaultStatus: 'draft',
  maxUndoLevels: 50,
};

const applyDarkMode = (dark: boolean) => {
  document.documentElement.classList.toggle('dark', dark);
};

const SettingsPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const [settings, setSettings] = useState(defaultSettings);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  void loading;

  // Admin user management state
  const [users, setUsers] = useState<any[]>([]);
  const [showUserPanel, setShowUserPanel] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ username: '', password: '', role: 'user' });
  const [creatingUser, setCreatingUser] = useState(false);
  const [userMessage, setUserMessage] = useState('');

  // OneDev integration state
  const [oneDevUrl, setOneDevUrl] = useState('');
  const [oneDevToken, setOneDevToken] = useState('');
  const [oneDevProject, setOneDevProject] = useState('');
  const [oneDevProjects, setOneDevProjects] = useState<any[]>([]);
  const [loadingOneDev, setLoadingOneDev] = useState(false);
  const [testingOneDev, setTestingOneDev] = useState(false);
  const [oneDevTestResult, setOneDevTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showOneDevPanel, setShowOneDevPanel] = useState(false);

  // Load settings from AppData on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await window.electronAPI.loadSettings();
        const loaded = { ...defaultSettings, ...data };
        setSettings(loaded);
        applyDarkMode(loaded.darkMode);
      } catch {
        // Fallback: use defaults
      }
      setLoading(false);
    })();
  }, []);

  const loadUsers = async () => {
    const res = await API.getUsers();
    if (res.success && res.data) {
      setUsers(res.data);
    }
  };

  const handleCreateUser = async () => {
    if (!newUserForm.username.trim() || !newUserForm.password.trim()) return;
    setCreatingUser(true);
    setUserMessage('');
    const res = await API.createUser({
      username: newUserForm.username,
      password: newUserForm.password,
      role: newUserForm.role,
    });
    setCreatingUser(false);
    if (res.success) {
      setUserMessage(`User ${newUserForm.username} created successfully`);
      setNewUserForm({ username: '', password: '', role: 'user' });
      await loadUsers();
    } else {
      setUserMessage(res.error || 'Failed to create user');
    }
  };

  useEffect(() => {
    if (showUserPanel && isAdmin) {
      loadUsers();
    }
  }, [showUserPanel, isAdmin]);

  // OneDev handlers
  const loadOneDevConfig = async () => {
    setLoadingOneDev(true);
    const res = await API.getOneDevConfig();
    if (res.success && res.data) {
      setOneDevUrl(res.data.url || '');
      setOneDevToken(res.data.token || '');
      setOneDevProject(res.data.project || '');
    }
    setLoadingOneDev(false);
  };

  const fetchOneDevProjects = async () => {
    const res = await API.getOneDevProjects();
    if (res.success && res.data) {
      setOneDevProjects(res.data);
    } else {
      setOneDevProjects([]);
    }
  };

  const handleTestOneDev = async () => {
    setTestingOneDev(true);
    setOneDevTestResult(null);
    const res = await API.testOneDevConnection();
    setTestingOneDev(false);
    if (res.success) {
      setOneDevTestResult({ success: true, message: 'Connected successfully' });
    } else {
      setOneDevTestResult({ success: false, message: res.error || 'Connection failed' });
    }
  };

  const handleSaveOneDev = async () => {
    setOneDevTestResult(null);
    const res = await API.updateOneDevConfig({
      url: oneDevUrl,
      token: oneDevToken,
      project: oneDevProject,
    });
    if (res.success) {
      setOneDevTestResult({ success: true, message: 'OneDev config saved' });
      await fetchOneDevProjects();
    } else {
      setOneDevTestResult({ success: false, message: res.error || 'Failed to save' });
    }
  };

  const handleClearOneDev = async () => {
    setOneDevTestResult(null);
    await API.deleteOneDevConfig();
    setOneDevUrl('');
    setOneDevToken('');
    setOneDevProject('');
    setOneDevProjects([]);
    setOneDevTestResult({ success: true, message: 'OneDev config cleared' });
  };

  useEffect(() => {
    if (showOneDevPanel) {
      loadOneDevConfig().then(() => fetchOneDevProjects());
    }
  }, [showOneDevPanel]);

  const updateSettings = (patch: Partial<typeof settings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      if ('darkMode' in patch) applyDarkMode(patch.darkMode!);
      return next;
    });
  };

  const handleSave = async () => {
    try {
      await window.electronAPI.saveSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
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
            onChange={(e) => updateSettings({ apiBaseUrl: e.target.value })}
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
              onCheckedChange={(checked) => updateSettings({ autoSave: checked })}
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
                onChange={(e) => updateSettings({ autoSaveInterval: parseInt(e.target.value) || 30 })}
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <Switch
              id="confirmBeforeDelete"
              checked={settings.confirmBeforeDelete}
              onCheckedChange={(checked) => updateSettings({ confirmBeforeDelete: checked })}
            />
            <Label htmlFor="confirmBeforeDelete">Confirm before deleting</Label>
          </div>
          <div className="max-w-[250px] space-y-1.5">
            <Label htmlFor="maxUndoLevels">Max undo levels</Label>
            <Input
              id="maxUndoLevels"
              type="number"
              value={settings.maxUndoLevels}
              onChange={(e) => updateSettings({ maxUndoLevels: parseInt(e.target.value) || 50 })}
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
              onCheckedChange={(checked) => updateSettings({ darkMode: checked })}
            />
            <Label htmlFor="darkMode">Dark mode</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="showStatusBar"
              checked={settings.showStatusBar}
              onCheckedChange={(checked) => updateSettings({ showStatusBar: checked })}
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
              onValueChange={(value) => updateSettings({ defaultPriority: value })}
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
              onValueChange={(value) => updateSettings({ defaultStatus: value })}
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

      <div className="rounded-lg border bg-card p-3 mb-2">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Server className="h-4 w-4" />
            OneDev Integration
          </h2>
          <Button variant="outline" size="sm" onClick={() => setShowOneDevPanel(p => !p)}>
            {showOneDevPanel ? 'Hide' : 'Configure'}
          </Button>
        </div>
        {showOneDevPanel && (
          <div className="space-y-3">
            {oneDevTestResult && (
              <Alert className={oneDevTestResult.success ? 'border-green-500 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200' : 'border-destructive'}>
                <AlertDescription className="flex items-center gap-2">
                  {oneDevTestResult.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  {oneDevTestResult.message}
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label htmlFor="onedev-url">OneDev Server URL</Label>
                <Input
                  id="onedev-url"
                  placeholder="http://localhost:6610"
                  value={oneDevUrl}
                  onChange={(e) => setOneDevUrl(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="onedev-token">Access Token</Label>
                <Input
                  id="onedev-token"
                  type="password"
                  placeholder="Bearer token"
                  value={oneDevToken}
                  onChange={(e) => setOneDevToken(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="onedev-project">Default Project</Label>
                <Select
                  value={oneDevProject}
                  onValueChange={(value) => setOneDevProject(value)}
                >
                  <SelectTrigger id="onedev-project">
                    <SelectValue placeholder={loadingOneDev ? 'Loading...' : 'Select a project'} />
                  </SelectTrigger>
                  <SelectContent>
                    {oneDevProjects.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                    {oneDevProjects.length === 0 && !loadingOneDev && (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">No projects found</div>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Save config with URL + token, then pick a project</p>
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={handleTestOneDev} disabled={testingOneDev || !oneDevUrl || !oneDevToken}>
                  {testingOneDev ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
                  Test
                </Button>
                <Button size="sm" onClick={handleSaveOneDev} disabled={!oneDevUrl || !oneDevToken}>
                  <SaveIcon className="h-4 w-4" />
                  Save
                </Button>
                <Button variant="ghost" size="sm" onClick={handleClearOneDev} disabled={!oneDevUrl && !oneDevToken}>
                  <Trash2 className="h-4 w-4" />
                  Clear
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="rounded-lg border bg-card p-3 mb-2">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" />
              User Management
            </h2>
            <Button variant="outline" size="sm" onClick={() => setShowUserPanel(p => !p)}>
              {showUserPanel ? 'Hide' : 'Manage'}
            </Button>
          </div>
          {showUserPanel && (
            <div className="space-y-3">
              {userMessage && (
                <Alert className={userMessage.includes('success') ? 'border-green-500 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200' : 'border-destructive'}>
                  <AlertDescription>{userMessage}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-muted-foreground uppercase">Existing Users</h3>
                <div className="rounded border divide-y">
                  {users.map((u) => (
                    <div key={u.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{u.username}</span>
                        <span className="text-xs text-muted-foreground">ID: {u.id}</span>
                      </div>
                      <span className="text-xs capitalize bg-secondary px-2 py-0.5 rounded">{u.role}</span>
                    </div>
                  ))}
                  {users.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No users found</div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-muted-foreground uppercase">Create New User</h3>
                <div className="flex gap-2">
                  <Input
                    placeholder="Username"
                    value={newUserForm.username}
                    onChange={(e) => setNewUserForm(prev => ({ ...prev, username: e.target.value }))}
                  />
                  <Input
                    placeholder="Password"
                    type="password"
                    value={newUserForm.password}
                    onChange={(e) => setNewUserForm(prev => ({ ...prev, password: e.target.value }))}
                  />
                  <Select
                    value={newUserForm.role}
                    onValueChange={(value) => setNewUserForm(prev => ({ ...prev, role: value }))}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleCreateUser}
                    disabled={creatingUser || !newUserForm.username.trim() || !newUserForm.password.trim()}
                  >
                    {creatingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Create
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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
