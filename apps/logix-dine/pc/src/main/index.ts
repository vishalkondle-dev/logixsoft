import {
  app,
  BrowserWindow,
  Menu,
  MenuItemConstructorOptions,
  Tray,
  ipcMain,
  shell,
  dialog,
} from 'electron';
import path from 'path';
import fs from 'fs';

// If running in container or as root on Linux, disable sandbox to prevent crashes
if (process.platform === 'linux' && (process.getuid?.() === 0 || process.env.LOGIX_DINE_NO_SANDBOX)) {
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
}

// ----------------------------------------------------
// Persistent Config Store (Zero-Dependency)
// ----------------------------------------------------
interface DesktopConfig {
  serverUrl: string;
  defaultPrinter: string;
  autoPrintReceipt: boolean;
  kioskMode: boolean;
  windowBounds?: {
    width: number;
    height: number;
    x?: number;
    y?: number;
    isMaximized?: boolean;
  };
}

const DEFAULT_CONFIG: DesktopConfig = {
  serverUrl: process.env.LOGIX_DINE_SERVER_URL || 'https://dine.logixsoft.in',
  defaultPrinter: '',
  autoPrintReceipt: false,
  kioskMode: false,
  windowBounds: {
    width: 1280,
    height: 850,
  },
};

class ConfigStore {
  private configPath: string;
  private data: DesktopConfig;

  constructor() {
    const userData = app.getPath('userData');
    if (!fs.existsSync(userData)) {
      fs.mkdirSync(userData, { recursive: true });
    }
    this.configPath = path.join(userData, 'desktop-config.json');
    this.data = this.load();
  }

  private load(): DesktopConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
      }
    } catch (e) {
      console.warn('Failed to load config, using defaults:', e);
    }
    return { ...DEFAULT_CONFIG };
  }

  save() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save config:', e);
    }
  }

  get<K extends keyof DesktopConfig>(key: K): DesktopConfig[K] {
    return this.data[key];
  }

  set<K extends keyof DesktopConfig>(key: K, value: DesktopConfig[K]) {
    this.data[key] = value;
    this.save();
  }

  getAll(): DesktopConfig {
    return { ...this.data };
  }
}

let store: ConfigStore;
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// ----------------------------------------------------
// Window Creation
// ----------------------------------------------------
function createWindow() {
  store = new ConfigStore();
  const bounds = store.get('windowBounds') || DEFAULT_CONFIG.windowBounds!;

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 900,
    minHeight: 600,
    title: 'Logix Dine - Restaurant POS & Management',
    backgroundColor: '#121316',
    autoHideMenuBar: false,
    show: false, // Show gracefully after ready-to-show
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  });

  if (bounds.isMaximized) {
    mainWindow.maximize();
  }

  // Save window position and size on change
  const saveBounds = () => {
    if (!mainWindow) return;
    const isMaximized = mainWindow.isMaximized();
    if (!isMaximized) {
      const currentBounds = mainWindow.getBounds();
      store.set('windowBounds', { ...currentBounds, isMaximized: false });
    } else {
      const oldBounds = store.get('windowBounds') || DEFAULT_CONFIG.windowBounds!;
      store.set('windowBounds', { ...oldBounds, isMaximized: true });
    }
  };

  mainWindow.on('resize', saveBounds);
  mainWindow.on('move', saveBounds);

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    if (store.get('kioskMode')) {
      mainWindow?.setKiosk(true);
    }
  });

  // Load target URL or local offline shell
  loadAppUrl();

  // If page fails to load (offline or server down), load local shell
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.warn(`[Logix Dine] Failed to load remote URL (${errorCode}: ${errorDescription}). Falling back to local shell.`);
    loadLocalShell();
  });

  setupMenu();
}

function loadAppUrl() {
  if (!mainWindow) return;
  const useLocal = process.env.USE_LOCAL_SHELL === 'true';
  if (useLocal) {
    loadLocalShell();
    return;
  }

  const serverUrl = store.get('serverUrl') || DEFAULT_CONFIG.serverUrl;
  console.log(`[Logix Dine] Loading server URL: ${serverUrl}`);
  mainWindow.loadURL(serverUrl).catch((err) => {
    console.warn('[Logix Dine] Error loading server URL, falling back to local shell:', err.message);
    loadLocalShell();
  });
}

function loadLocalShell() {
  if (!mainWindow) return;
  const localHtmlPath = path.join(__dirname, '../renderer/index.html');
  if (fs.existsSync(localHtmlPath)) {
    mainWindow.loadFile(localHtmlPath);
  } else {
    // Basic inline fallback if renderer build is missing
    mainWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(`
      <body style="background:#121316;color:#f8f9fa;font-family:sans-serif;padding:40px;text-align:center;">
        <h1 style="color:#845ec2;">Logix Dine Desktop</h1>
        <p>Offline Mode - Connecting to server...</p>
        <button onclick="window.location.reload()" style="background:#845ec2;color:white;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;">Retry</button>
      </body>`)}`
    );
  }
}

// ----------------------------------------------------
// Native Menu
// ----------------------------------------------------
function setupMenu() {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? ([
          {
            label: 'Logix Dine',
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ] as MenuItemConstructorOptions[])
      : []),
    {
      label: 'POS',
      submenu: [
        {
          label: 'Orders & Tables',
          accelerator: 'F2',
          click: () => {
            const baseUrl = store.get('serverUrl') || DEFAULT_CONFIG.serverUrl;
            mainWindow?.loadURL(`${baseUrl}/orders`);
          },
        },
        {
          label: 'POS Register',
          accelerator: 'F3',
          click: () => {
            const baseUrl = store.get('serverUrl') || DEFAULT_CONFIG.serverUrl;
            mainWindow?.loadURL(`${baseUrl}/pos`);
          },
        },
        {
          label: 'Print Bill',
          accelerator: 'CmdOrCtrl+P',
          click: () => {
            mainWindow?.webContents.print({ silent: false });
          },
        },
        { type: 'separator' },
        {
          label: 'Toggle Counter Kiosk Mode',
          accelerator: 'F11',
          click: () => {
            if (!mainWindow) return;
            const next = !mainWindow.isKiosk();
            mainWindow.setKiosk(next);
            store.set('kioskMode', next);
          },
        },
        { type: 'separator' },
        {
          label: isMac ? 'Close Window' : 'Exit',
          accelerator: isMac ? 'Cmd+W' : 'Alt+F4',
          role: isMac ? 'close' : 'quit',
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload', accelerator: 'CmdOrCtrl+R' },
        { role: 'forceReload', accelerator: 'CmdOrCtrl+Shift+R' },
        { role: 'toggleDevTools', accelerator: 'F12' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Desktop Tools',
      submenu: [
        {
          label: 'Switch to Live Cloud App',
          click: () => {
            store.set('serverUrl', 'https://dine.logixsoft.in');
            loadAppUrl();
          },
        },
        {
          label: 'Switch to Local Dev (localhost:3000)',
          click: () => {
            store.set('serverUrl', 'http://localhost:3000');
            loadAppUrl();
          },
        },
        {
          label: 'Open Offline POS Shell & Diagnostics',
          accelerator: 'CmdOrCtrl+Shift+D',
          click: () => {
            loadLocalShell();
          },
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Logix Dine',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'About Logix Dine',
              message: 'Logix Dine Desktop POS',
              detail: `Version: ${app.getVersion()}\nPlatform: ${process.platform} (${process.arch})\nElectron: ${process.versions.electron}\nNode: ${process.versions.node}\n\n© 2026 Logix Soft. All rights reserved.`,
            });
          },
        },
        {
          label: 'Website & Documentation',
          click: () => {
            shell.openExternal('https://dine.logixsoft.in');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ----------------------------------------------------
// IPC Handlers
// ----------------------------------------------------
ipcMain.handle('get-app-info', () => {
  return {
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    versions: {
      node: process.versions.node,
      chrome: process.versions.chrome,
      electron: process.versions.electron,
    },
  };
});

ipcMain.handle('get-printers', async () => {
  if (!mainWindow) return [];
  try {
    return await mainWindow.webContents.getPrintersAsync();
  } catch (e) {
    console.error('Failed to get printers:', e);
    return [];
  }
});

ipcMain.handle('print-receipt', async (_event, options: {
  html?: string;
  silent?: boolean;
  deviceName?: string;
  copies?: number;
} = {}) => {
  if (!mainWindow) return { success: false, error: 'No main window' };

  try {
    const defaultPrinter = store.get('defaultPrinter');
    const targetPrinter = options.deviceName || defaultPrinter || undefined;
    const isSilent = options.silent ?? store.get('autoPrintReceipt');

    if (options.html) {
      // Hidden window for formatting receipt print
      const printWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
        },
      });

      await printWindow.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(options.html)}`
      );

      return new Promise((resolve) => {
        printWindow.webContents.print(
          {
            silent: isSilent,
            deviceName: targetPrinter,
            copies: options.copies || 1,
            margins: { marginType: 'none' },
          },
          (success, failureReason) => {
            printWindow.close();
            if (success) {
              resolve({ success: true });
            } else {
              resolve({ success: false, error: failureReason });
            }
          }
        );
      });
    } else {
      // Print current contents
      return new Promise((resolve) => {
        mainWindow?.webContents.print(
          {
            silent: isSilent,
            deviceName: targetPrinter,
            copies: options.copies || 1,
          },
          (success, failureReason) => {
            if (success) {
              resolve({ success: true });
            } else {
              resolve({ success: false, error: failureReason });
            }
          }
        );
      });
    }
  } catch (err: any) {
    console.error('Print failed:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('toggle-fullscreen', () => {
  if (!mainWindow) return false;
  const next = !mainWindow.isFullScreen();
  mainWindow.setFullScreen(next);
  return next;
});

ipcMain.handle('toggle-kiosk', () => {
  if (!mainWindow) return false;
  const next = !mainWindow.isKiosk();
  mainWindow.setKiosk(next);
  store.set('kioskMode', next);
  return next;
});

ipcMain.handle('is-kiosk', () => {
  return mainWindow?.isKiosk() || false;
});

ipcMain.handle('get-config', (_event, key?: keyof DesktopConfig) => {
  if (key) return store.get(key);
  return store.getAll();
});

ipcMain.handle('set-config', (_event, { key, value }: { key: keyof DesktopConfig; value: any }) => {
  store.set(key, value);
  return true;
});

ipcMain.handle('open-external', (_event, url: string) => {
  shell.openExternal(url);
});

ipcMain.handle('set-badge', (_event, count: number) => {
  if (app.setBadgeCount) {
    app.setBadgeCount(count);
  }
});

// ----------------------------------------------------
// App Lifecycle
// ----------------------------------------------------
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
