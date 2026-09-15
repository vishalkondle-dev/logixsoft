import { create } from 'zustand';
import { authClient } from './better-auth-client';

export interface User {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role?: string;
}

interface AuthStore {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  googleLogin: (callbackPath?: string) => Promise<void>;
  demoLogin: (callbackPath?: string) => void;
  logout: () => Promise<void>;
  checkAuth: (force?: boolean) => Promise<void>;
  setUser: (user: User | null) => void;
}

let checkAuthPromise: Promise<void> | null = null;

export const useAuth = create<AuthStore>((set, get) => ({
  user: null,
  isLoading: false,
  isAuthenticated: false,

  setUser: (user) => {
    set({ user, isAuthenticated: !!user, isLoading: false });
  },

  googleLogin: async (callbackPath = '/dashboard') => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://payment.logixsoft.in';
    const res = await authClient.signIn.social({
      provider: 'google',
      callbackURL: `${origin}${callbackPath}`,
      errorCallbackURL: `${origin}/login?error=auth_failed`,
    });
    if (res?.error) {
      throw new Error(res.error.message || 'Google OAuth failed');
    }
    if ((res as any)?.data?.url && typeof window !== 'undefined') {
      window.location.href = (res as any).data.url;
    }
  },

  demoLogin: (callbackPath = '/dashboard') => {
    const demoUser: User = {
      id: 'default-merchant',
      name: 'Demo Merchant',
      email: 'merchant@logixsoft.in',
      role: 'MERCHANT',
    };
    set({ user: demoUser, isAuthenticated: true, isLoading: false });
    if (typeof window !== 'undefined') {
      window.location.href = callbackPath;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await authClient.signOut().catch(() => { });
      checkAuthPromise = null;
      set({ user: null, isAuthenticated: false, isLoading: false });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  checkAuth: async (force = false) => {
    const current = get();
    if (!force && current.isAuthenticated && current.user) {
      return;
    }
    if (!force && checkAuthPromise) {
      return checkAuthPromise;
    }

    checkAuthPromise = (async () => {
      try {
        const { data } = await authClient.getSession();
        if (data?.user) {
          set({ user: data.user as unknown as User, isAuthenticated: true, isLoading: false });
        } else {
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      } catch {
        set({ user: null, isAuthenticated: false, isLoading: false });
      } finally {
        checkAuthPromise = null;
      }
    })();

    return checkAuthPromise;
  },
}));
