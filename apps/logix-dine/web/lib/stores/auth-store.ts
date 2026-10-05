import { create } from 'zustand';
import type { AuthUser } from '@logixsoft/logix-dine/types/auth';
import { authClient } from '../auth-client';

export interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isLoginModalOpen: boolean;

  // Actions
  openLoginModal: () => void;
  closeLoginModal: () => void;
  setUser: (user: AuthUser | null) => void;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  isLoginModalOpen: false,

  openLoginModal: () => set({ isLoginModalOpen: true }),
  closeLoginModal: () => set({ isLoginModalOpen: false }),

  setUser: (user: AuthUser | null) =>
    set({
      user,
      isAuthenticated: !!user,
      isLoading: false,
    }),

  refreshSession: async () => {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://dine-api.logixsoft.in';
      const res = await fetch(`${apiBase}/auth/me`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.user) {
          set({
            user: data.user as AuthUser,
            isAuthenticated: true,
            isLoading: false,
          });
          return;
        }
      }

      const clientRes = await authClient.getSession();
      if (clientRes?.data?.user) {
        set({
          user: clientRes.data.user as unknown as AuthUser,
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
