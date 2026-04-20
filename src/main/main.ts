import { app, BrowserWindow, Menu, dialog, shell, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import isDev from 'electron-is-dev';
import { spawn } from 'child_process';
import axios from 'axios';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null;
let flaskProcess: any = null;

const FLASK_PORT = 5000;
const FLASK_URL = `http://localhost:${FLASK_PORT}`;
let VITE_PORT = 3000;
let VITE_URL = `http://localhost:${VITE_PORT}`;

const SETTINGS_PATH = path.join(os.homedir(), '.doctrack', 'settings.json');

function loadAppSettings(): Record<string, unknown> {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const data = fs.readFileSync(SETTINGS_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn('Failed to load settings:', err);
  }
  return {};
}

function saveAppSettings(settings: Record<string, unknown>): void {
  try {
    const dir = path.dirname(SETTINGS_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Failed to save settings:', err);
  }
}

// Window state persistence
interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized?: boolean;
}

const WINDOW_STATE_PATH = path.join(os.homedir(), '.doctrack', 'window-state.json');

function loadWindowState(): WindowState {
  try {
    if (fs.existsSync(WINDOW_STATE_PATH)) {
      const data = fs.readFileSync(WINDOW_STATE_PATH, 'utf-8');
      return JSON.parse(data) as WindowState;
    }
  } catch (err) {
    console.warn('Failed to load window state:', err);
  }
  return { width: 1400, height: 900 };
}

function saveWindowState(state: WindowState): void {
  try {
    const dir = path.dirname(WINDOW_STATE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(WINDOW_STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Failed to save window state:', err);
  }
}

// Wait for Vite dev server to be ready (tries ports 3000-3005)
async function waitForVite(maxAttempts = 60) {
  for (let port = 3000; port <= 3005; port++) {
    const url = `http://localhost:${port}`;
    for (let i = 0; i < maxAttempts; i++) {
      try {
        await axios.get(url, { timeout: 2000 });
        console.log(`Vite dev server is ready on port ${port}`);
        VITE_PORT = port;
        VITE_URL = url;
        return true;
      } catch (error) {
        // Continue to next attempt
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }
  return false;
}

// Wait for Flask to be ready
async function waitForFlask(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await axios.get(`${FLASK_URL}/api/health`);
      console.log('Flask server is ready');
      return true;
    } catch (error) {
      console.log(`Waiting for Flask... (${i + 1}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  return false;
}

// Start Flask subprocess
function startFlaskServer() {
  return new Promise<void>((resolve, reject) => {
    const flaskPath = path.join(__dirname, '../../backend');
    
    // For development
    if (isDev) {
      flaskProcess = spawn('python', ['app.py'], {
        cwd: flaskPath,
        stdio: 'inherit',
      });
    } else {
      // For production - use bundled Python
      const pythonExe = process.platform === 'win32' 
        ? path.join(flaskPath, 'python.exe')
        : path.join(flaskPath, 'python');
      
      flaskProcess = spawn(pythonExe, ['app.py'], {
        cwd: flaskPath,
        stdio: 'inherit',
      });
    }

    flaskProcess.on('error', (error: Error) => {
      console.error('Failed to start Flask:', error);
      reject(error);
    });

    flaskProcess.on('exit', (code: number) => {
      console.log(`Flask process exited with code ${code}`);
      if (mainWindow) {
        mainWindow.close();
      }
    });

    // Give Flask a moment to start, then wait for it to be ready
    setTimeout(async () => {
      const ready = await waitForFlask();
      if (ready) {
        resolve();
      } else {
        reject(new Error('Flask server failed to start'));
      }
    }, 500);
  });
}

const createWindow = (): void => {
  const windowState = loadWindowState();

  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });

  if (windowState.isMaximized) {
    mainWindow.maximize();
  }

  const startUrl = isDev
    ? VITE_URL
    : `file://${path.join(__dirname, '../renderer/index.html')}`;

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Save window state on close
  mainWindow.on('close', (): void => {
    if (mainWindow) {
      const isMaximized = mainWindow.isMaximized();
      const bounds = mainWindow.getBounds();
      saveWindowState({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        isMaximized,
      });
    }
  });

  mainWindow.on('closed', (): void => {
    mainWindow = null;
  });
};

app.on('ready', async (): Promise<void> => {
  try {
    console.log('App starting...');
    
    // Start Flask first
    console.log('Starting Flask server...');
    await startFlaskServer();
    console.log('✓ Flask ready');
    
    // In dev mode, wait for Vite dev server to be ready
    if (isDev) {
      console.log('Waiting for Vite dev server...');
      const viteReady = await waitForVite();
      if (!viteReady) {
        throw new Error('Vite dev server failed to start - not found on ports 3000-3005');
      }
      console.log(`✓ Vite ready on ${VITE_URL}`);
    }
    
    // Then create window
    console.log('Creating window...');
    createWindow();
    console.log('✓ Window created');
    
    console.log('Creating menu...');
    createMenu();
    console.log('✓ Menu created');

    // Register IPC handlers for settings
    ipcMain.handle('settings:load', () => loadAppSettings());
    ipcMain.handle('settings:save', (_event, settings: Record<string, unknown>) => saveAppSettings(settings));
  } catch (error) {
    console.error('Failed to start application:', error);
    app.quit();
  }
});

app.on('window-all-closed', (): void => {
  // Kill Flask process
  if (flaskProcess) {
    flaskProcess.kill();
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', (): void => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Create application menu
const createMenu = (): void => {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Document',
          accelerator: 'CmdOrCtrl+N',
          click: (): void => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-new-document');
            }
          },
        },
        {
          label: 'Export',
          accelerator: 'CmdOrCtrl+E',
          click: (): void => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-export');
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: (): void => app.quit(),
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Shift+Z', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'Toggle DevTools', accelerator: 'CmdOrCtrl+I', role: 'toggleDevTools' },
        { type: 'separator' },
        {
          label: 'Fullscreen',
          accelerator: 'F11',
          click: (): void => {
            if (mainWindow) {
              mainWindow.setFullScreen(!mainWindow.isFullScreen());
            }
          },
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: (): void => {
            dialog.showMessageBoxSync({
              type: 'info',
              title: 'About DocTrack',
              message: 'DocTrack Requirements Tracker',
              detail: `Version: 0.1.0\nDescription: Document Requirements Tracker with Git-like Version Control\n\nBuilt with Electron, React, and Flask.`,
            });
          },
        },
        {
          label: 'Documentation',
          click: (): void => {
            shell.openExternal('https://github.com/doctrack/doctrack');
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};
