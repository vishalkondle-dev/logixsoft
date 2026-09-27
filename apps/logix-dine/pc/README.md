# Logix Dine PC (Desktop POS for Windows, macOS & Linux)

A cross-platform Electron 34 desktop application for **Logix Dine**, designed specifically for restaurant cashier counters, kitchen display systems (KDS), and manager workstations.

---

## Workspace Structure

```
apps/logix-dine/
├── api/       # Cloudflare Workers API backend (Hono + D1 + Durable Objects)
├── web/       # Next.js 16 Web Application (OpenNext on Cloudflare)
├── native/    # Capacitor 8 Native Mobile App (Android & iOS)
└── pc/        # Electron 34 Desktop Application (Windows, macOS, Linux)
    ├── src/
    │   ├── main/       # Electron Main process (Multi-OS window, printing, kiosk, IPC)
    │   ├── preload/    # Secure contextBridge API (`window.logixDinePC`)
    │   └── renderer/   # Built-in offline POS shell & hardware diagnostics
    ├── dist/           # Compiled desktop bundles
    ├── release/        # Packaged installers (.exe, .dmg, .AppImage)
    ├── tests/          # Playwright end-to-end testing suite
    └── electron-builder.json
```

---

## Desktop POS Capabilities

| Feature | Description |
|---|---|
| **Thermal Printing** | Native silent printing to 80mm & 58mm thermal printers without browser print dialogs. Supports device selection and copies. |
| **Counter Kiosk Mode** | Fullscreen locked counter mode (toggle with `F11` or via menu) preventing accidental desktop access. |
| **POS Accelerators** | Pre-configured POS shortcuts (`F2` Orders & Tables, `F3` POS Register, `Ctrl+P`/`Cmd+P` Print Bill, `Ctrl+R` Reload). |
| **Offline POS Shell** | Automatic graceful fallback when internet drops, with printer testing, auto-reconnect, and server switcher. |
| **Multi-OS Menus** | Native macOS app menu bar, Windows top menu bar, and system tray integration. |
| **Persistent Bounds** | Remembers window dimensions, position, and maximized state across sessions. |
| **Context Isolation** | High-security IPC bridge (`window.logixDinePC`) with Node integration disabled. |

---

## Scripts & Commands

Run these from the monorepo root:

### Development & Build
```bash
# Build main, preload, and renderer bundles
pnpm pc:build

# Typecheck TypeScript files
pnpm --filter logix-dine-pc run typecheck

# Launch app in development mode
pnpm pc:dev
```

### End-to-End Testing
Runs the automated Playwright Electron test suite (launches application, tests IPC, tests printing API, tests kiosk mode, tests config persistence):
```bash
pnpm pc:test
```

### Packaging & Distribution

```bash
# Unpack directory build for current platform
pnpm pc:pack

# Windows (.exe installer & portable)
pnpm pc:dist:win

# macOS (.dmg & .zip for Apple Silicon + Intel)
pnpm pc:dist:mac

# Linux (.AppImage & .deb)
pnpm pc:dist:linux
```

---

## IPC API Reference (`window.logixDinePC`)

Web apps running inside the desktop shell have access to:

```typescript
// Detect if running inside Electron desktop shell
if (window.logixDinePC?.isElectron) {
  // Get available hardware printers
  const printers = await window.logixDinePC.getPrinters();

  // Print receipt silently to thermal printer
  await window.logixDinePC.printReceipt({
    html: receiptHtmlString,
    silent: true,
    deviceName: 'POS-80',
  });

  // Toggle counter kiosk mode
  await window.logixDinePC.toggleKiosk();

  // Get system environment
  const info = await window.logixDinePC.getAppInfo();
}
```
