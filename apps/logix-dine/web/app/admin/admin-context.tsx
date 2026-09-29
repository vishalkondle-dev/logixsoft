"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { notifications } from "@mantine/notifications";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://dine-api.logixsoft.in";

interface AdminContextType {
  restaurants: any[];
  outlets: any[];
  metrics: any;
  selectedRestFilter: string;
  setSelectedRestFilter: (id: string) => void;
  refreshing: boolean;
  fetchGlobalMetadata: () => Promise<void>;
  handleEnterStore: (restaurant: any) => Promise<void>;
}

const AdminContext = createContext<AdminContextType | null>(null);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [outlets, setOutlets] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [selectedRestFilter, setSelectedRestFilter] = useState("ALL");
  const [refreshing, setRefreshing] = useState(false);

  const fetchGlobalMetadata = useCallback(async () => {
    setRefreshing(true);
    try {
      const [restRes, outRes, metRes] = await Promise.all([
        fetch(`${API_BASE}/admin/restaurants`, { credentials: "include" }),
        fetch(`${API_BASE}/admin/outlets`, { credentials: "include" }),
        fetch(`${API_BASE}/admin/metrics`, { credentials: "include" }),
      ]);

      if (restRes.ok) {
        const d = await restRes.json();
        setRestaurants(Array.isArray(d) ? d : d.restaurants || []);
      }
      if (outRes.ok) {
        const d = await outRes.json();
        setOutlets(Array.isArray(d) ? d : d.outlets || []);
      }
      if (metRes.ok) {
        const d = await metRes.json();
        setMetrics(d.metrics || null);
      }
    } catch (err: any) {
      console.error("Failed to load admin metadata:", err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchGlobalMetadata();
  }, [fetchGlobalMetadata]);

  const handleEnterStore = async (rest: any) => {
    try {
      const res = await fetch(`${API_BASE}/admin/impersonate/${rest.id}`, {
        method: "POST",
        credentials: "include",
      });

      let outletId: string | undefined;
      if (res.ok) {
        const data = await res.json().catch(() => null);
        outletId = data?.outletId;
      }

      if (!outletId) {
        const storeOutlets = outlets.filter((o) => o.restaurantId === rest.id);
        const def = storeOutlets.find((o) => o.isDefault) || storeOutlets[0];
        outletId = def?.id;
      }

      const isSubdomain = typeof window !== "undefined" && window.location.hostname.includes("logixsoft.in");
      const domainAttr = isSubdomain ? ";domain=.logixsoft.in" : "";

      document.cookie = `dine.restaurantId=${encodeURIComponent(rest.id)};path=/${domainAttr};max-age=31536000;SameSite=Lax`;
      document.cookie = `dine.restaurantId=${encodeURIComponent(rest.id)};path=/;max-age=31536000;SameSite=Lax`;

      if (outletId) {
        document.cookie = `dine.outletId=${encodeURIComponent(outletId)};path=/${domainAttr};max-age=31536000;SameSite=Lax`;
        document.cookie = `dine.outletId=${encodeURIComponent(outletId)};path=/;max-age=31536000;SameSite=Lax`;
      }

      notifications.show({
        title: "Store Scope Activated",
        message: `Entering POS for ${rest.name}...`,
        color: "teal",
      });

      const targetUrl = outletId ? `/pos?outletId=${outletId}` : `/pos`;
      window.location.href = targetUrl;
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err.message || "Failed to switch store scope",
        color: "red",
      });
    }
  };

  return (
    <AdminContext.Provider
      value={{
        restaurants,
        outlets,
        metrics,
        selectedRestFilter,
        setSelectedRestFilter,
        refreshing,
        fetchGlobalMetadata,
        handleEnterStore,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) {
    throw new Error("useAdmin must be used within an AdminProvider");
  }
  return ctx;
}
