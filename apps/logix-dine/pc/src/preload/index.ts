import { contextBridge, ipcRenderer } from 'electron';

export interface PrintReceiptOptions {
  content?: string;
  html?: string;
  silent?: boolean;
  deviceName?: string;
  copies?: number;
}

export interface AppInfo {
  name: string;
  version: string;
  platform: string;
  arch: string;
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };
}

const api = {
  isElectron: true,
  platform: process.platform,
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke('get-app-info'),
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  printReceipt: (options?: PrintReceiptOptions) => ipcRenderer.invoke('print-receipt', options),
  toggleFullscreen: (): Promise<boolean> => ipcRenderer.invoke('toggle-fullscreen'),
  toggleKiosk: (): Promise<boolean> => ipcRenderer.invoke('toggle-kiosk'),
  isKiosk: (): Promise<boolean> => ipcRenderer.invoke('is-kiosk'),
  getConfig: (key: string): Promise<any> => ipcRenderer.invoke('get-config', key),
  setConfig: (key: string, value: any): Promise<boolean> => ipcRenderer.invoke('set-config', { key, value }),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('open-external', url),
  setBadge: (count: number): Promise<void> => ipcRenderer.invoke('set-badge', count),
};

contextBridge.exposeInMainWorld('logixDinePC', api);

declare global {
  interface Window {
    logixDinePC: typeof api;
  }
}
