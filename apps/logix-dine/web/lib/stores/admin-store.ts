import { create } from 'zustand';
import { notifications } from '@mantine/notifications';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://dine-api.logixsoft.in';

export interface AdminState {
  restaurants: any[];
  outlets: any[];
  metrics: any;
  selectedRestFilter: string;
  refreshing: boolean;

  // Actions
  setSelectedRestFilter: (id: string) => void;
  fetchGlobalMetadata: () => Promise<void>;
  handleEnterStore: (restaurant: any) => Promise<void>;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  restaurants: [],
  outlets: [],
  metrics: null,
  selectedRestFilter: 'ALL',
  refreshing: false,

  setSelectedRestFilter: (id: string) => set({ selectedRestFilter: id }),

  fetchGlobalMetadata: async () => {
    set({ refreshing: true });
    try {
      const [restRes, outRes, metRes] = await Promise.all([
        fetch(`${API_BASE}/admin/restaurants`, { credentials: 'include' }),
        fetch(`${API_BASE}/admin/outlets`, { credentials: 'include' }),
        fetch(`${API_BASE}/admin/metrics`, { credentials: 'include' }),
      ]);

      let restaurants: any[] = [];
      let outlets: any[] = [];
      let metrics: any = null;

      if (restRes.ok) {
        const d = await restRes.json();
        restaurants = Array.isArray(d) ? d : d.restaurants || [];
      }
      if (outRes.ok) {
        const d = await outRes.json();
        outlets = Array.isArray(d) ? d : d.outlets || [];
      }
      if (metRes.ok) {
        const d = await metRes.json();
        metrics = d.metrics || null;
      }

      set({
        restaurants,
        outlets,
        metrics,
        refreshing: false,
      });
    } catch (err: any) {
      console.error('Failed to load admin metadata:', err);
      set({ refreshing: false });
    }
  },

  handleEnterStore: async (rest: any) => {
    try {
      if (!rest?.id) {
        notifications.show({
          title: 'Select Store',
          message: 'Please select a specific restaurant store to enter POS.',
          color: 'orange',
        });
        return;
      }

      const res = await fetch(`${API_BASE}/admin/impersonate/${rest.id}`, {
        method: 'POST',
        credentials: 'include',
      });

      let outletId: string | undefined;
      if (res.ok) {
        const data = await res.json().catch(() => null);
        outletId = data?.outletId;
      } else {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || 'Failed to switch store scope');
      }

      if (!outletId) {
        const storeOutlets = get().outlets.filter((o) => o.restaurantId === rest.id);
        const def = storeOutlets.find((o) => o.isDefault) || storeOutlets[0];
        outletId = def?.id;
      }

      const isSubdomain = typeof window !== 'undefined' && window.location.hostname.includes('logixsoft.in');
      const domainAttr = isSubdomain ? ';domain=.logixsoft.in' : '';

      document.cookie = `dine.restaurantId=${encodeURIComponent(rest.id)};path=/${domainAttr};max-age=31536000;SameSite=Lax`;
      document.cookie = `dine.restaurantId=${encodeURIComponent(rest.id)};path=/;max-age=31536000;SameSite=Lax`;

      if (outletId) {
        document.cookie = `dine.outletId=${encodeURIComponent(outletId)};path=/${domainAttr};max-age=31536000;SameSite=Lax`;
        document.cookie = `dine.outletId=${encodeURIComponent(outletId)};path=/;max-age=31536000;SameSite=Lax`;
      }

      notifications.show({
        title: 'Entering Store Environment',
        message: `Active context switched to ${rest.name || 'Store'}. Loading POS terminal...`,
        color: 'teal',
        autoClose: 2000,
      });

      setTimeout(() => {
        window.location.href = outletId ? `/pos?outletId=${outletId}` : '/pos';
      }, 300);
    } catch (err: any) {
      notifications.show({
        title: 'Impersonation Failed',
        message: err.message || 'Could not switch to selected store.',
        color: 'red',
      });
    }
  },
}));
