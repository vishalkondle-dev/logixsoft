import { create } from 'zustand';

export interface CheckoutState {
  order: any | null;
  mandate: any | null;
  loading: boolean;
  simulating: boolean;
  timeLeftSeconds: number;
  paymentSuccess: any | null;
  activeSuccess: any | null;
  selectedVpa: string;
  selectedApp: string;

  // Actions
  setOrder: (order: any) => void;
  setMandate: (mandate: any) => void;
  setLoading: (loading: boolean) => void;
  setSimulating: (simulating: boolean) => void;
  setTimeLeftSeconds: (seconds: number | ((prev: number) => number)) => void;
  decrementTimeLeft: () => void;
  setPaymentSuccess: (success: any) => void;
  setActiveSuccess: (success: any) => void;
  setSelectedVpa: (vpa: string) => void;
  setSelectedApp: (app: string) => void;
  resetCheckout: () => void;
}

export const useCheckoutStore = create<CheckoutState>((set) => ({
  order: null,
  mandate: null,
  loading: true,
  simulating: false,
  timeLeftSeconds: 600,
  paymentSuccess: null,
  activeSuccess: null,
  selectedVpa: '',
  selectedApp: 'generic',

  setOrder: (order) => set({ order }),
  setMandate: (mandate) => set({ mandate }),
  setLoading: (loading) => set({ loading }),
  setSimulating: (simulating) => set({ simulating }),
  setTimeLeftSeconds: (seconds) =>
    set((state) => ({
      timeLeftSeconds:
        typeof seconds === 'function' ? seconds(state.timeLeftSeconds) : seconds,
    })),
  decrementTimeLeft: () =>
    set((state) => ({ timeLeftSeconds: Math.max(0, state.timeLeftSeconds - 1) })),
  setPaymentSuccess: (paymentSuccess) => set({ paymentSuccess }),
  setActiveSuccess: (activeSuccess) => set({ activeSuccess }),
  setSelectedVpa: (selectedVpa) => set({ selectedVpa }),
  setSelectedApp: (selectedApp) => set({ selectedApp }),
  resetCheckout: () =>
    set({
      order: null,
      mandate: null,
      loading: true,
      simulating: false,
      timeLeftSeconds: 600,
      paymentSuccess: null,
      activeSuccess: null,
      selectedVpa: '',
      selectedApp: 'generic',
    }),
}));
