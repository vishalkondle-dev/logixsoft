import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UiState {
  soundEnabled: boolean;
  autoPrintKOT: boolean;
  autoPrintReceipt: boolean;
  kdsStatusFilter: string;
  ordersStatusFilter: string;
  waiterServiceFilter: string;
  sidebarCollapsed: boolean;

  // Actions
  toggleSound: () => void;
  setSoundEnabled: (enabled: boolean | ((prev: boolean) => boolean)) => void;
  setAutoPrintKOT: (enabled: boolean) => void;
  setAutoPrintReceipt: (enabled: boolean) => void;
  setKdsStatusFilter: (filter: string) => void;
  setOrdersStatusFilter: (filter: string) => void;
  setWaiterServiceFilter: (filter: string) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      soundEnabled: true,
      autoPrintKOT: false,
      autoPrintReceipt: false,
      kdsStatusFilter: 'ALL',
      ordersStatusFilter: 'ALL',
      waiterServiceFilter: 'ALL',
      sidebarCollapsed: false,

      toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
      setSoundEnabled: (enabled) =>
        set((state) => ({
          soundEnabled:
            typeof enabled === 'function' ? enabled(state.soundEnabled) : enabled,
        })),
      setAutoPrintKOT: (enabled) => set({ autoPrintKOT: enabled }),
      setAutoPrintReceipt: (enabled) => set({ autoPrintReceipt: enabled }),
      setKdsStatusFilter: (filter) => set({ kdsStatusFilter: filter }),
      setOrdersStatusFilter: (filter) => set({ ordersStatusFilter: filter }),
      setWaiterServiceFilter: (filter) => set({ waiterServiceFilter: filter }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
    }),
    {
      name: 'logix-dine-ui-settings',
    }
  )
);
