import { create } from "zustand";

interface PwaState {
  isInstallable: boolean;
  isInstalled: boolean;
  deferredPrompt: any | null;
  setDeferredPrompt: (prompt: any) => void;
  setIsInstalled: (installed: boolean) => void;
  promptInstall: () => Promise<boolean>;
}

export const usePwaStore = create<PwaState>((set, get) => ({
  isInstallable: false,
  isInstalled: false,
  deferredPrompt: null,

  setDeferredPrompt: (prompt) => {
    set({
      deferredPrompt: prompt,
      isInstallable: !!prompt,
    });
  },

  setIsInstalled: (installed) => {
    set({
      isInstalled: installed,
      isInstallable: false,
    });
  },

  promptInstall: async () => {
    const { deferredPrompt } = get();
    if (!deferredPrompt) return false;

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        set({ isInstalled: true, isInstallable: false, deferredPrompt: null });
        return true;
      }
    } catch (err) {
      console.debug("[PWA] Install prompt caught error:", err);
    }
    return false;
  },
}));
