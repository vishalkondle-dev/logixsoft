import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Device } from '@capacitor/device';
import { Network } from '@capacitor/network';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

async function initNativeApp() {
  console.log('[Logix Dine] Initializing Native Shell...');

  // Configure Status Bar on Native platforms
  if (Capacitor.isNativePlatform()) {
    try {
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#1A1B1E' });
    } catch (e) {
      console.warn('StatusBar configuration not available:', e);
    }

    try {
      await SplashScreen.hide();
    } catch (e) {
      console.warn('SplashScreen hide skipped:', e);
    }

    // Android Hardware Back Button handling
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        // Confirm or exit app
        App.exitApp();
      }
    });
  }

  // Load device info
  try {
    const info = await Device.getInfo();
    const platformEl = document.getElementById('device-platform');
    const modelEl = document.getElementById('device-model');
    const osEl = document.getElementById('device-os');

    if (platformEl) platformEl.textContent = info.platform.toUpperCase();
    if (modelEl) modelEl.textContent = info.model || info.manufacturer || 'Browser';
    if (osEl) osEl.textContent = `${info.operatingSystem} ${info.osVersion}`;
  } catch (e) {
    console.error('Failed to get device info:', e);
  }

  // Monitor Network
  const updateNetworkStatus = async () => {
    try {
      const status = await Network.getStatus();
      const statusEl = document.getElementById('connection-status');
      const networkTypeEl = document.getElementById('network-type');

      if (networkTypeEl) {
        networkTypeEl.textContent = status.connectionType.toUpperCase();
      }

      if (statusEl) {
        if (status.connected) {
          statusEl.className = 'status-pill';
          statusEl.innerHTML = '<span class="status-indicator"></span> Online';
        } else {
          statusEl.className = 'status-pill offline';
          statusEl.innerHTML = '<span class="status-indicator"></span> Offline';
        }
      }
    } catch (e) {
      console.error('Failed to get network status:', e);
    }
  };

  await updateNetworkStatus();
  Network.addListener('networkStatusChange', updateNetworkStatus);

  // Wire URL launcher
  const launchBtn = document.getElementById('btn-launch');
  const urlInput = document.getElementById('server-url-input') as HTMLInputElement;
  const saveUrlBtn = document.getElementById('btn-save-url');

  const openAppUrl = (url: string) => {
    if (Capacitor.isNativePlatform()) {
      Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
    }
    window.location.href = url;
  };

  launchBtn?.addEventListener('click', () => {
    openAppUrl(urlInput?.value || 'https://dine.logixsoft.in');
  });

  saveUrlBtn?.addEventListener('click', () => {
    if (urlInput?.value) {
      openAppUrl(urlInput.value);
    }
  });

  // Wire Haptic Buttons
  const setupHaptic = (id: string, action: () => Promise<void>) => {
    document.getElementById(id)?.addEventListener('click', async () => {
      try {
        await action();
      } catch (err) {
        console.warn(`Haptic ${id} failed:`, err);
      }
    });
  };

  setupHaptic('haptic-light', () => Haptics.impact({ style: ImpactStyle.Light }));
  setupHaptic('haptic-medium', () => Haptics.impact({ style: ImpactStyle.Medium }));
  setupHaptic('haptic-heavy', () => Haptics.impact({ style: ImpactStyle.Heavy }));
  setupHaptic('haptic-success', () => Haptics.notification({ type: NotificationType.Success }));
  setupHaptic('haptic-warning', () => Haptics.notification({ type: NotificationType.Warning }));
  setupHaptic('haptic-error', () => Haptics.notification({ type: NotificationType.Error }));
}

// Start application
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNativeApp);
} else {
  initNativeApp();
}
