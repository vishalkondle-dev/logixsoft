# Logix Dine Native (Android & iOS)

A production-ready Capacitor 8 native mobile wrapper for **Logix Dine**, providing Android and iOS applications with full access to native hardware APIs (Camera, MLKit Barcode Scanning, Haptics, Status Bar, App Lifecycle, and Network monitoring).

---

## Architecture Overview

```
apps/logix-dine/
├── api/       # Cloudflare Workers API backend (Hono + D1 + DO)
├── web/       # Next.js 16 Web Application (OpenNext on Cloudflare)
└── native/    # Capacitor 8 Native Mobile App (Android & iOS)
    ├── android/            # Native Android Studio Project
    ├── ios/                # Native iOS Xcode Project
    ├── src/                # Web shell & offline fallback screen
    ├── dist/               # Bundled assets (compiled via Vite)
    └── capacitor.config.ts # Capacitor configuration
```

### Modes of Operation
1. **Live Web App (Default & Production)**:
   Points to `https://dine.logixsoft.in`. Changes and features pushed to the web app are instantly available to all mobile users without requiring app store updates (OTA). Native plugins (Camera, Haptics, Status Bar, etc.) remain fully functional via Capacitor's native bridge.
2. **Local Mobile Dev**:
   Set `CAPACITOR_SERVER_URL=http://<YOUR-IP>:3000` to connect the native device/emulator directly to your local Next.js dev server with fast refresh.
3. **Bundled Offline Shell**:
   Set `USE_LOCAL_BUNDLE=true` to bundle and serve local assets from `dist/` with a diagnostic dashboard, network checker, and retry button.

---

## Installed Capacitor Plugins

| Plugin | Purpose in Logix Dine |
|---|---|
| `@capacitor-mlkit/barcode-scanning` | Fast Google MLKit QR scanning for Dine-in tables |
| `@capacitor/camera` | Camera capture & photo uploads for menu and profiles |
| `@capacitor/status-bar` | Custom dark-themed status bar (`#1A1B1E`) |
| `@capacitor/splash-screen` | Logix Dine branded launch screen with spinner |
| `@capacitor/haptics` | Native vibration feedback when ringing staff, adding items, placing orders |
| `@capacitor/keyboard` | Native soft keyboard viewport management |
| `@capacitor/network` | Real-time online/offline network change detection |
| `@capacitor/app` | App lifecycle and Android hardware back button handling |
| `@capacitor/device` | Device model, OS version, and platform detection |
| `@capacitor/preferences` | Native encrypted key-value storage |
| `@capacitor/screen-orientation` | Orientation control for POS tablet vs phone |

---

## Commands

Run these from the monorepo root:

### Synchronize Native Projects
After modifying `capacitor.config.ts` or installing new Capacitor plugins:
```bash
pnpm native:sync
```

### Android Development
Open the Android project in Android Studio:
```bash
pnpm native:open:android
```

Run directly on a connected Android phone or emulator:
```bash
pnpm native:run:android
```

Compile a debug APK via Gradle:
```bash
pnpm native:assemble:android
# Output: apps/logix-dine/native/android/app/build/outputs/apk/debug/app-debug.apk
```

### iOS Development
Open the iOS project in Xcode (macOS only):
```bash
pnpm native:open:ios
```

Run directly on a connected iPhone or simulator:
```bash
pnpm native:run:ios
```

---

## Permissions Configured

### Android (`android/app/src/main/AndroidManifest.xml`)
- `INTERNET` - Network access
- `ACCESS_NETWORK_STATE` - Connection state detection
- `CAMERA` - Table QR scanning & image upload
- `VIBRATE` - Haptic feedback
- `android:usesCleartextTraffic="true"` - Local dev HTTP support

### iOS (`ios/App/App/Info.plist`)
- `NSCameraUsageDescription` - Table QR code scanning & dine-in assistance
- `NSPhotoLibraryUsageDescription` - Photo uploads for profile and restaurant assets
