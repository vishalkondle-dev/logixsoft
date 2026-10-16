"use client";

import { create } from "zustand";
import {
  AuthUser,
  fetchCurrentUser,
  fetchProvidersStatus,
  demoLogin,
  logoutUser,
  loginWithGoogle as clientLoginWithGoogle,
  getStoredAuthToken,
} from "../lib/auth-client";

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  googleEnabled: boolean;
  isAuthModalOpen: boolean;

  // Computed helpers
  isAuthenticated: boolean;
  isAdmin: boolean;

  // Actions
  initialize: () => Promise<void>;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  loginAsDemo: (role: "admin" | "user", name?: string) => Promise<void>;
  loginWithGoogle: (email?: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  googleEnabled: false,
  isAuthModalOpen: false,

  isAuthenticated: false,
  isAdmin: false,

  initialize: async () => {
    try {
      const [user, providers] = await Promise.all([
        fetchCurrentUser(),
        fetchProvidersStatus(),
      ]);

      const token = getStoredAuthToken();

      set({
        user,
        token,
        googleEnabled: providers.google.enabled,
        isAuthenticated: Boolean(user && !user.isGuest),
        isAdmin: user?.role === "admin",
        isLoading: false,
      });
    } catch {
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isAdmin: false,
        isLoading: false,
      });
    }
  },

  openAuthModal: () => set({ isAuthModalOpen: true }),
  closeAuthModal: () => set({ isAuthModalOpen: false }),

  loginAsDemo: async (role: "admin" | "user", name?: string) => {
    set({ isLoading: true });
    try {
      const data = await demoLogin(role, name);
      set({
        user: data.user,
        token: data.token,
        isAuthenticated: true,
        isAdmin: data.user.role === "admin",
        isLoading: false,
        isAuthModalOpen: false,
      });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  loginWithGoogle: async (email?: string, name?: string) => {
    set({ isLoading: true });
    try {
      const data = await clientLoginWithGoogle(email, name);
      set({
        user: data.user,
        token: data.token,
        isAuthenticated: true,
        isAdmin: data.user.role === "admin",
        isLoading: false,
        isAuthModalOpen: false,
      });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    await logoutUser();
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isAdmin: false,
      isLoading: false,
    });
  },
}));
