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
      if (res.ok) {
        window.location.href = "/pos";
      } else {
        notifications.show({ title: "Error", message: "Failed to switch store scope", color: "red" });
      }
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
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
