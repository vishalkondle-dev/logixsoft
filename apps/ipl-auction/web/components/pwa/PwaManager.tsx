"use client";

import { useEffect } from "react";
import { usePwaStore } from "../../stores/pwaStore";

export function PwaManager() {
  const { setDeferredPrompt, setIsInstalled } = usePwaStore();

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Detect if running in standalone mode (already installed PWA)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
    }

    // 2. Register Service Worker
    if ("serviceWorker" in navigator) {
      const registerSW = async () => {
        try {
          const registration = await navigator.serviceWorker.register("/sw.js", {
            scope: "/",
          });
          console.log("[PWA] ServiceWorker registered successfully:", registration.scope);
        } catch (err) {
          console.debug("[PWA] ServiceWorker registration error:", err);
        }
      };

      if (document.readyState === "complete") {
        registerSW();
      } else {
        window.addEventListener("load", registerSW, { once: true });
      }
    }

    // 3. Listen for browser install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      console.log("[PWA] beforeinstallprompt captured");
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      console.log("[PWA] App successfully installed");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [setDeferredPrompt, setIsInstalled]);

  return null;
}
