// Preload script - exposes Electron IPC to renderer via contextBridge

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  version: '1.0.0',

  // Settings persistence via AppData
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings: Record<string, unknown>) => ipcRenderer.invoke('settings:save', settings),

  // Window controls for borderless title bar
  window: {
    minimize: () => ipcRenderer.invoke('window-minimize'),
    maximize: () => ipcRenderer.invoke('window-maximize'),
    close: () => ipcRenderer.invoke('window-close'),
  },
});
