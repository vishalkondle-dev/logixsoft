import { create } from 'zustand';
import { authClient } from '../lib/better-auth-client';

export interface AuthState {
  user: any | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  setUser: (user: any | null) => void;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) =>
    set({
      user,
      isAuthenticated: !!user,
      isLoading: false,
    }),

  refreshSession: async () => {
    try {
      const res = await authClient.getSession();
      if (res?.data?.user) {
        set({
          user: res.data.user,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  signOut: async () => {
    set({ isLoading: true });
    try {
      await authClient.signOut();
      set({ user: null, isAuthenticated: false, isLoading: false });
    } catch (err) {
      console.error('Sign out error:', err);
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
