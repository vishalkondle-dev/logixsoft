"use client";

import React, { useEffect, ReactNode } from "react";
import type { AuthUser } from "@logixsoft/logix-dine/types/auth";
import { useAuthStore, type AuthState } from "./stores/auth-store";

export type AuthContextType = AuthState;

export function AuthProvider({ children }: { children: ReactNode }) {
  const refreshSession = useAuthStore((s) => s.refreshSession);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  return <>{children}</>;
}

export function useAuth(): AuthState {
  return useAuthStore();
}
