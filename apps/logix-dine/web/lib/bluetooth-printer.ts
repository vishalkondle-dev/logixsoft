// ─── Web Bluetooth printer layer ──────────────────────────────────────────────
// Targets FF00/FF02 (most Chinese 58mm printers) with Nordic UART fallback.
// On first pair, logs all GATT UUIDs to localStorage so the real profile
// can be inspected if neither standard matches.

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
    writeValueWithoutResponse(value: BufferSource): Promise<void>;
  }
}

const FF00_SERVICE  = "0000ff00-0000-1000-8000-00805f9b34fb";
const FF02_CHAR     = "0000ff02-0000-1000-8000-00805f9b34fb";
const NORDIC_SVC    = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const NORDIC_WRITE  = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";

const KEY_ID   = "bt-printer-id";
const KEY_NAME = "bt-printer-name";
const KEY_UUIDS = "bt-printer-uuids";

const CHUNK_SIZE = 20; // safe default MTU without negotiation

export type PrinterStatus = "paired" | "unpaired" | "unsupported";

export function isSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export function getStatus(): PrinterStatus {
  if (!isSupported()) return "unsupported";
  return localStorage.getItem(KEY_ID) ? "paired" : "unpaired";
}

export function isPaired(): boolean {
  return getStatus() === "paired";
}

export function getPairedName(): string | null {
  return localStorage.getItem(KEY_NAME);
}

export function forget(): void {
  localStorage.removeItem(KEY_ID);
  localStorage.removeItem(KEY_NAME);
  localStorage.removeItem(KEY_UUIDS);
}

async function getWriteChar(
  server: BluetoothRemoteGATTServer
): Promise<BluetoothRemoteGATTCharacteristic> {
  // Diagnostics: log every service + characteristic
  try {
    const services = await server.getPrimaryServices();
    const uuids: Record<string, string[]> = {};
    for (const svc of services) {
      const chars = await svc.getCharacteristics().catch(() => []);
      uuids[svc.uuid] = chars.map((c) => c.uuid);
    }
    localStorage.setItem(KEY_UUIDS, JSON.stringify(uuids, null, 2));
  } catch (_) {}

  // Try FF00 / FF02
  try {
    const svc = await server.getPrimaryService(FF00_SERVICE);
    return await svc.getCharacteristic(FF02_CHAR);
  } catch (_) {}

  // Try Nordic UART
  try {
    const svc = await server.getPrimaryService(NORDIC_SVC);
    return await svc.getCharacteristic(NORDIC_WRITE);
  } catch (_) {}

  throw new Error(
    "No compatible write characteristic found. Check localStorage key bt-printer-uuids for the actual GATT profile."
  );
}

/** Prompt the user to pair a printer (requires user gesture). Returns device name. */
export async function pair(): Promise<string> {
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [FF00_SERVICE, NORDIC_SVC],
  });
  const server = await device.gatt!.connect();
  await getWriteChar(server); // validates + logs UUIDs
  server.disconnect();

  localStorage.setItem(KEY_ID, device.id);
  localStorage.setItem(KEY_NAME, device.name ?? "Printer");
  return device.name ?? "Printer";
}

/** Send raw ESC/POS bytes to the paired printer. */
export async function print(bytes: Uint8Array): Promise<void> {
  const savedId = localStorage.getItem(KEY_ID);
  if (!savedId) throw new Error("No printer paired");

  let device: BluetoothDevice | undefined;

  // getDevices() lets us reconnect without another requestDevice (Chrome 85+)
  try {
    const devices = await (navigator.bluetooth as any).getDevices?.() ?? [];
    device = (devices as BluetoothDevice[]).find((d) => d.id === savedId);
  } catch (_) {}

  if (!device) {
    // Fallback: prompt again (e.g. Firefox / older Chrome)
    device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [FF00_SERVICE, NORDIC_SVC],
    });
  }

  const server = await device.gatt!.connect();
  const char = await getWriteChar(server);

  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    await char.writeValueWithoutResponse(bytes.slice(offset, offset + CHUNK_SIZE));
  }

  server.disconnect();
}
