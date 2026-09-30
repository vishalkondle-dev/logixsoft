"use client";

import React, { useEffect, ReactNode } from "react";
import { useAdminStore, type AdminState } from "@/lib/stores/admin-store";

export type AdminContextType = AdminState;

export function AdminProvider({ children }: { children: ReactNode }) {
  const fetchGlobalMetadata = useAdminStore((s) => s.fetchGlobalMetadata);

  useEffect(() => {
    fetchGlobalMetadata();
  }, [fetchGlobalMetadata]);

  return <>{children}</>;
}

export function useAdmin(): AdminState {
  return useAdminStore();
}
