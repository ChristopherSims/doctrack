import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Apply saved dark mode preference before React renders
// Uses Electron IPC for AppData; falls back to localStorage in browser dev
(async () => {
  try {
    if (window.electronAPI) {
      const settings = await window.electronAPI.loadSettings();
      if (settings.darkMode) document.documentElement.classList.add('dark');
    }
  } catch {
    // Fallback for browser dev mode
    try {
      const saved = localStorage.getItem('doctrack-settings');
      if (saved) {
        const settings = JSON.parse(saved);
        if (settings.darkMode) document.documentElement.classList.add('dark');
      }
    } catch {}
  }
})();

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
