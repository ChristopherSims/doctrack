import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Switch,
  FormControlLabel,
  Stack,
  Button,
  Alert,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Save as SaveIcon,
} from '@mui/icons-material';

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
    <Box sx={{ p: 3, maxWidth: 800 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <SettingsIcon color="primary" />
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Settings
        </Typography>
      </Box>

      {saved && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Settings saved
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          Connection
        </Typography>
        <TextField
          label="API Base URL"
          value={settings.apiBaseUrl}
          onChange={(e) => setSettings({ ...settings, apiBaseUrl: e.target.value })}
          fullWidth
          size="small"
          helperText="Backend Flask server URL"
        />
      </Paper>

      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          Editor
        </Typography>
        <Stack spacing={1}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.autoSave}
                onChange={(e) => setSettings({ ...settings, autoSave: e.target.checked })}
              />
            }
            label="Auto-save changes"
          />
          {settings.autoSave && (
            <TextField
              label="Auto-save interval (seconds)"
              type="number"
              value={settings.autoSaveInterval}
              onChange={(e) => setSettings({ ...settings, autoSaveInterval: parseInt(e.target.value) || 30 })}
              size="small"
              sx={{ maxWidth: 250 }}
            />
          )}
          <FormControlLabel
            control={
              <Switch
                checked={settings.confirmBeforeDelete}
                onChange={(e) => setSettings({ ...settings, confirmBeforeDelete: e.target.checked })}
              />
            }
            label="Confirm before deleting"
          />
          <TextField
            label="Max undo levels"
            type="number"
            value={settings.maxUndoLevels}
            onChange={(e) => setSettings({ ...settings, maxUndoLevels: parseInt(e.target.value) || 50 })}
            size="small"
            sx={{ maxWidth: 250 }}
          />
        </Stack>
      </Paper>

      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          Appearance
        </Typography>
        <Stack spacing={1}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.darkMode}
                onChange={(e) => setSettings({ ...settings, darkMode: e.target.checked })}
              />
            }
            label="Dark mode"
          />
          <FormControlLabel
            control={
              <Switch
                checked={settings.showStatusBar}
                onChange={(e) => setSettings({ ...settings, showStatusBar: e.target.checked })}
              />
            }
            label="Show status bar"
          />
        </Stack>
      </Paper>

      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          Defaults
        </Typography>
        <Stack direction="row" spacing={2}>
          <TextField
            label="Default priority"
            value={settings.defaultPriority}
            onChange={(e) => setSettings({ ...settings, defaultPriority: e.target.value })}
            select
            size="small"
            sx={{ minWidth: 150 }}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </TextField>
          <TextField
            label="Default status"
            value={settings.defaultStatus}
            onChange={(e) => setSettings({ ...settings, defaultStatus: e.target.value })}
            select
            size="small"
            sx={{ minWidth: 150 }}
          >
            <option value="draft">Draft</option>
            <option value="review">Review</option>
            <option value="approved">Approved</option>
          </TextField>
        </Stack>
      </Paper>

      <Button
        variant="contained"
        startIcon={<SaveIcon />}
        onClick={handleSave}
        size="large"
      >
        Save Settings
      </Button>
    </Box>
  );
};

export default SettingsPage;
