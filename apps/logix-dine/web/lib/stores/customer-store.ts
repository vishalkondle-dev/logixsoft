import { create } from 'zustand';

export interface CustomerState {
  activeTab: 'home' | 'menu' | 'orders' | 'rewards' | 'profile';
  orderMoreDrawerOpen: boolean;
  rateOrderModalOpen: boolean;
  callWaiterModalOpen: boolean;
  billBreakdownModalOpen: boolean;
  reservationModalOpen: boolean;

  // Actions
  setActiveTab: (tab: 'home' | 'menu' | 'orders' | 'rewards' | 'profile') => void;
  setOrderMoreDrawerOpen: (open: boolean) => void;
  setRateOrderModalOpen: (open: boolean) => void;
  setCallWaiterModalOpen: (open: boolean) => void;
  setBillBreakdownModalOpen: (open: boolean) => void;
  setReservationModalOpen: (open: boolean) => void;
}

export const useCustomerStore = create<CustomerState>((set) => ({
  activeTab: 'home',
  orderMoreDrawerOpen: false,
  rateOrderModalOpen: false,
  callWaiterModalOpen: false,
  billBreakdownModalOpen: false,
  reservationModalOpen: false,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setOrderMoreDrawerOpen: (open) => set({ orderMoreDrawerOpen: open }),
  setRateOrderModalOpen: (open) => set({ rateOrderModalOpen: open }),
  setCallWaiterModalOpen: (open) => set({ callWaiterModalOpen: open }),
  setBillBreakdownModalOpen: (open) => set({ billBreakdownModalOpen: open }),
  setReservationModalOpen: (open) => set({ reservationModalOpen: open }),
}));
