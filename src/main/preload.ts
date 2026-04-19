// Preload script - minimal CommonJS version
// The app uses HTTP REST API instead of IPC, so this is just a placeholder
// for future IPC needs or security context setup

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Placeholder - actual API communication happens via HTTP
  version: '1.0.0',
});
