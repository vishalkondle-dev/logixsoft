import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Logix Dine Capacitor Configuration
 * 
 * - In production, server.url points to 'https://dine.logixsoft.in' for instant OTA updates and full Next.js dynamic routing.
 * - Set USE_LOCAL_BUNDLE=true to load the bundled offline shell from dist/
 * - Set CAPACITOR_SERVER_URL=http://<your-ip>:3000 for local live-reload mobile development
 */
const useLocalBundle = process.env.USE_LOCAL_BUNDLE === 'true';
const customServerUrl = process.env.CAPACITOR_SERVER_URL || process.env.CAP_SERVER_URL;
const targetUrl = customServerUrl || (useLocalBundle ? undefined : 'https://dine.logixsoft.in');

const config: CapacitorConfig = {
  appId: 'in.logixsoft.dine',
  appName: 'Logix Dine',
  webDir: 'dist',
  server: targetUrl
    ? {
        url: targetUrl,
        cleartext: true,
        androidScheme: 'https',
        allowNavigation: [
          'dine.logixsoft.in',
          'dine-api.logixsoft.in',
          '*.logixsoft.in',
          'localhost',
          '10.0.2.2',
          '192.168.*.*',
        ],
      }
    : {
        androidScheme: 'https',
      },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#1A1B1E',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: true,
      androidSpinnerStyle: 'large',
      iosSpinnerStyle: 'small',
      spinnerColor: '#845EC2',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1A1B1E',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
