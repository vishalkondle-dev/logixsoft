// ─── Web Bluetooth thermal printer layer ──────────────────────────────────────────
// Reliable Web Bluetooth ESC/POS driver for 58mm & 80mm thermal receipt printers.
// Uses proven FF00/FF02 (BillQuick-Go, POS-58, Everycom, TVS, etc.) & Nordic UART.

// Minimal ambient types for Web Bluetooth (not in TS lib by default)
declare global {
  interface Navigator {
    bluetooth: {
      requestDevice(opts: { acceptAllDevices?: boolean; optionalServices?: string[] }): Promise<BluetoothDevice>;
      getDevices?(): Promise<BluetoothDevice[]>;
    };
  }
  interface BluetoothDevice {
    id: string;
    name?: string;
    gatt?: BluetoothRemoteGATTServer;
  }
  interface BluetoothRemoteGATTServer {
    connected?: boolean;
    connect(): Promise<BluetoothRemoteGATTServer>;
    disconnect(): void;
    getPrimaryService(uuid: string): Promise<BluetoothRemoteGATTService>;
    getPrimaryServices(): Promise<BluetoothRemoteGATTService[]>;
  }
  interface BluetoothRemoteGATTService {
    uuid: string;
    getCharacteristic(uuid: string): Promise<BluetoothRemoteGATTCharacteristic>;
    getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>;
  }
  interface BluetoothRemoteGATTCharacteristic {
    uuid: string;
    properties?: {
      write?: boolean;
      writeWithoutResponse?: boolean;
      read?: boolean;
      notify?: boolean;
    };
    writeValueWithoutResponse(value: BufferSource): Promise<void>;
    writeValueWithResponse?(value: BufferSource): Promise<void>;
    writeValue?(value: BufferSource): Promise<void>;
  }
}

export const FF00_SERVICE = "0000ff00-0000-1000-8000-00805f9b34fb";
export const FF02_CHAR    = "0000ff02-0000-1000-8000-00805f9b34fb";
export const NORDIC_SVC   = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
export const NORDIC_WRITE = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";

const KEY_ID          = "bt-printer-id";
const KEY_NAME        = "bt-printer-name";
const KEY_UUIDS       = "bt-printer-uuids";
const KEY_SVC_UUID    = "bt-printer-svc-uuid";
const KEY_CHAR_UUID   = "bt-printer-char-uuid";
const KEY_CUSTOM_SVC  = "bt-printer-custom-svc";
const KEY_CUSTOM_CHAR = "bt-printer-custom-char";

const CHUNK_SIZE = 20; // safe default MTU without negotiation

export type PrinterStatus = "paired" | "unpaired" | "unsupported";

export interface PairedPrinterProfile {
  id: string | null;
  name: string | null;
  serviceUuid: string | null;
  charUuid: string | null;
  discoveredUuids: string | null;
  customServiceUuid: string | null;
  customCharUuid: string | null;
}

let cachedPairedDevice: BluetoothDevice | null = null;

// On page load, restore any previously granted device from Chrome session
if (typeof window !== "undefined" && typeof navigator !== "undefined" && "bluetooth" in navigator && (navigator.bluetooth as any).getDevices) {
  (navigator.bluetooth as any).getDevices().then((devices: BluetoothDevice[]) => {
    if (devices && devices.length > 0) {
      cachedPairedDevice = devices[0];
      if (!localStorage.getItem(KEY_ID)) {
        localStorage.setItem(KEY_ID, devices[0].id);
        if (devices[0].name) localStorage.setItem(KEY_NAME, devices[0].name);
      }
    }
  }).catch(() => {});
}

export function isSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export function getStatus(): PrinterStatus {
  if (!isSupported()) return "unsupported";
  return (localStorage.getItem(KEY_ID) || cachedPairedDevice) ? "paired" : "unpaired";
}

export function isPaired(): boolean {
  return getStatus() === "paired";
}

export function getPairedName(): string | null {
  return localStorage.getItem(KEY_NAME) || cachedPairedDevice?.name || null;
}

export function getPairedProfile(): PairedPrinterProfile {
  if (typeof window === "undefined") {
    return {
      id: null,
      name: null,
      serviceUuid: null,
      charUuid: null,
      discoveredUuids: null,
      customServiceUuid: null,
      customCharUuid: null,
    };
  }
  return {
    id: localStorage.getItem(KEY_ID),
    name: localStorage.getItem(KEY_NAME),
    serviceUuid: localStorage.getItem(KEY_SVC_UUID),
    charUuid: localStorage.getItem(KEY_CHAR_UUID),
    discoveredUuids: localStorage.getItem(KEY_UUIDS),
    customServiceUuid: localStorage.getItem(KEY_CUSTOM_SVC),
    customCharUuid: localStorage.getItem(KEY_CUSTOM_CHAR),
  };
}

export function setCustomProfile(serviceUuid: string, charUuid: string): void {
  const cleanSvc = serviceUuid.trim();
  const cleanChar = charUuid.trim();
  if (cleanSvc) {
    localStorage.setItem(KEY_CUSTOM_SVC, cleanSvc);
    localStorage.setItem(KEY_SVC_UUID, cleanSvc);
  }
  if (cleanChar) {
    localStorage.setItem(KEY_CUSTOM_CHAR, cleanChar);
    localStorage.setItem(KEY_CHAR_UUID, cleanChar);
  }
}

export function clearCustomProfile(): void {
  localStorage.removeItem(KEY_CUSTOM_SVC);
  localStorage.removeItem(KEY_CUSTOM_CHAR);
}

export function forget(): void {
  cachedPairedDevice = null;
  localStorage.removeItem(KEY_ID);
  localStorage.removeItem(KEY_NAME);
  localStorage.removeItem(KEY_UUIDS);
  localStorage.removeItem(KEY_SVC_UUID);
  localStorage.removeItem(KEY_CHAR_UUID);
  localStorage.removeItem(KEY_CUSTOM_SVC);
  localStorage.removeItem(KEY_CUSTOM_CHAR);
}

/** Returns the exact services supported by 58mm/80mm receipt printers without GATT conflicts */
export function getActiveServicesList(): string[] {
  const list = [FF00_SERVICE, NORDIC_SVC];
  if (typeof window !== "undefined") {
    const customSvc = localStorage.getItem(KEY_CUSTOM_SVC)?.trim();
    if (customSvc && !list.includes(customSvc)) {
      list.push(customSvc);
    }
  }
  return list;
}

async function getWriteChar(
  server: BluetoothRemoteGATTServer
): Promise<BluetoothRemoteGATTCharacteristic> {
  // 1. Check custom user override if set
  const customSvc = localStorage.getItem(KEY_CUSTOM_SVC)?.trim();
  const customChar = localStorage.getItem(KEY_CUSTOM_CHAR)?.trim();
  if (customSvc && customChar) {
    try {
      const svc = await server.getPrimaryService(customSvc);
      return await svc.getCharacteristic(customChar);
    } catch (_) {}
  }

  // 2. Try FF00 / FF02 (Standard for BillQuick-Go and 58mm Chinese printers)
  try {
    const svc = await server.getPrimaryService(FF00_SERVICE);
    return await svc.getCharacteristic(FF02_CHAR);
  } catch (_) {}

  // 3. Try Nordic UART NUS (6e400001 / 6e400002)
  try {
    const svc = await server.getPrimaryService(NORDIC_SVC);
    return await svc.getCharacteristic(NORDIC_WRITE);
  } catch (_) {}

  // 4. Try any write characteristic on primary services
  try {
    const services = await server.getPrimaryServices();
    for (const svc of services) {
      const chars = await svc.getCharacteristics().catch(() => []);
      for (const c of chars) {
        if (c.properties?.writeWithoutResponse || c.properties?.write) {
          return c;
        }
      }
    }
  } catch (_) {}

  throw new Error("No compatible write characteristic found on thermal printer.");
}

/** Prompt the user to pair a printer (requires user gesture). Returns device name. */
export async function pair(): Promise<string> {
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: getActiveServicesList(),
  });

  cachedPairedDevice = device;
  localStorage.setItem(KEY_ID, device.id);
  localStorage.setItem(KEY_NAME, device.name ?? "Thermal Printer");

  try {
    const server = await device.gatt!.connect();
    try {
      await getWriteChar(server);
    } finally {
      try {
        server.disconnect();
      } catch (_) {}
    }
  } catch (err: any) {
    console.warn(`[BLE Printer] Paired "${device.name}", initial probe warning:`, err);
  }

  return device.name ?? "Thermal Printer";
}

let printQueue: Promise<any> = Promise.resolve();

async function sendBytes(bytes: Uint8Array): Promise<void> {
  const savedId = localStorage.getItem(KEY_ID);

  let device: BluetoothDevice | undefined;

  // 1. In-memory cached device from current session
  if (cachedPairedDevice) {
    device = cachedPairedDevice;
  }

  // 2. getDevices() if available in browser
  if (!device && typeof navigator !== "undefined" && "bluetooth" in navigator && (navigator.bluetooth as any).getDevices) {
    try {
      const devices = (await (navigator.bluetooth as any).getDevices?.()) ?? [];
      if (devices.length > 0) {
        device = devices.find((d: any) => d.id === savedId) || devices[0];
        if (device) cachedPairedDevice = device;
      }
    } catch (_) {}
  }

  // 3. Fallback: prompt user to select/reconnect printer
  if (!device) {
    try {
      device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: getActiveServicesList(),
      });
      cachedPairedDevice = device;
      localStorage.setItem(KEY_ID, device.id);
      if (device.name) localStorage.setItem(KEY_NAME, device.name);
    } catch (err: any) {
      if (err.name === "NotFoundError" || err.message?.includes("cancelled") || err.message?.includes("User cancelled")) {
        throw new Error("Print cancelled: No printer selected.");
      }
      throw new Error(
        "Thermal printer not connected. Please click 'Connect Thermal Printer' in the POS toolbar to pair."
      );
    }
  }

  if (!device.gatt) throw new Error("Bluetooth GATT not available on this device.");

  // Connect to GATT server
  let server = device.gatt;
  if (!server.connected) {
    server = await server.connect();
  }

  try {
    const char = await getWriteChar(server);

    for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
      const chunk = bytes.slice(offset, offset + CHUNK_SIZE);

      if (char.properties?.writeWithoutResponse && typeof char.writeValueWithoutResponse === "function") {
        await char.writeValueWithoutResponse(chunk);
      } else if (typeof (char as any).writeValueWithResponse === "function") {
        await (char as any).writeValueWithResponse(chunk);
      } else if (typeof (char as any).writeValue === "function") {
        await (char as any).writeValue(chunk);
      } else {
        await char.writeValueWithoutResponse(chunk);
      }

      if (offset + CHUNK_SIZE < bytes.length) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }

    // Pacing to allow printer to complete buffer flush
    await new Promise((resolve) => setTimeout(resolve, 200));
  } finally {
    try {
      server.disconnect();
    } catch (_) {}
  }
}

/** Send raw ESC/POS bytes to the paired printer with chunking and pacing. Serialized via queue. */
export async function print(bytes: Uint8Array): Promise<void> {
  const result = printQueue.then(() => sendBytes(bytes));
  printQueue = result.catch(() => {});
  return result;
}
