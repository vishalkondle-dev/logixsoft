"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import type { AuthUser } from "@logixsoft/logix-dine/types/auth";
import { authClient } from "./auth-client";

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isLoginModalOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  setUser: (user: AuthUser | null) => void;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  const openLoginModal = useCallback(() => {
    setIsLoginModalOpen(true);
  }, []);

  const closeLoginModal = useCallback(() => {
    setIsLoginModalOpen(false);
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const apiBase =
        process.env.NEXT_PUBLIC_API_URL || "https://dine-api.logixsoft.in";
      const res = await fetch(`${apiBase}/auth/me`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.user) {
          setUser(data.user as AuthUser);
          return;
        }
      }

      const clientRes = await authClient.getSession();
      if (clientRes?.data?.user) {
        setUser(clientRes.data.user as unknown as AuthUser);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      await authClient.signOut();
      setUser(null);
    } catch (err) {
      console.error("Sign out error:", err);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    isLoginModalOpen,
    openLoginModal,
    closeLoginModal,
    setUser,
    signOut,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
