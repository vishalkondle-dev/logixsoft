"use client";

import React, { useState, useEffect } from "react";
import { Select, Loader } from "@mantine/core";

// In-memory client cache per restaurant to avoid redundant network roundtrips
const clientOutletCache: Record<string, any[]> = {};

export interface DependentOutletSelectProps {
  restaurantId: string;
  value: string;
  onChange: (value: string) => void;
  label?: React.ReactNode;
  placeholder?: string;
  description?: React.ReactNode;
  required?: boolean;
  clearable?: boolean;
  disabled?: boolean;
  isFilter?: boolean;
  filterAllLabel?: string;
  size?: any;
  w?: any;
  style?: React.CSSProperties;
}

export function DependentOutletSelect({
  restaurantId,
  value,
  onChange,
  label,
  placeholder,
  description,
  required = false,
  clearable = true,
  disabled = false,
  isFilter = false,
  filterAllLabel = "All Outlets",
  size = "sm",
  w,
  style,
}: DependentOutletSelectProps) {
  const [outlets, setOutlets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const isRestaurantSelected = Boolean(restaurantId && restaurantId !== "ALL");

  useEffect(() => {
    if (!isRestaurantSelected) {
      setOutlets([]);
      if (!isFilter && value) {
        onChange("");
      } else if (isFilter && value !== "ALL") {
        onChange("ALL");
      }
      return;
    }

    // Check client cache first
    if (clientOutletCache[restaurantId]) {
      const cached = clientOutletCache[restaurantId];
      setOutlets(cached);
      if (value && value !== "ALL" && !cached.some((o: any) => o.id === value)) {
        onChange(isFilter ? "ALL" : "");
      }
      return;
    }

    let active = true;
    setLoading(true);

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://dine-api.logixsoft.in";
    fetch(`${API_BASE}/admin/restaurants/${restaurantId}/outlets`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data) ? data : [];
        clientOutletCache[restaurantId] = list;
        setOutlets(list);
        if (value && value !== "ALL" && !list.some((o: any) => o.id === value)) {
          onChange(isFilter ? "ALL" : "");
        }
      })
      .catch((err) => {
        console.error("Failed to load restaurant outlets:", err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [restaurantId, isRestaurantSelected]);

  const selectData = isFilter
    ? [
        { value: "ALL", label: filterAllLabel },
        ...outlets.map((o) => ({ value: o.id, label: o.name })),
      ]
    : outlets.map((o) => ({ value: o.id, label: o.name }));

  const computedPlaceholder = !isRestaurantSelected
    ? isFilter
      ? "Select Restaurant first..."
      : "Select Restaurant first..."
    : loading
    ? "Loading outlets..."
    : placeholder || (isFilter ? "Filter by Outlet" : "Select Outlet");

  return (
    <Select
      label={label}
      description={description}
      placeholder={computedPlaceholder}
      required={required}
      clearable={clearable && isRestaurantSelected && !loading}
      disabled={disabled || !isRestaurantSelected || loading}
      rightSection={loading ? <Loader size={14} /> : undefined}
      data={selectData}
      value={isRestaurantSelected ? value : isFilter ? "ALL" : ""}
      onChange={(val) => onChange(val || (isFilter ? "ALL" : ""))}
      size={size}
      w={w}
      style={style}
    />
  );
}

// Invalidation helper for client-side cache when an outlet is created or modified
export function invalidateClientOutletCache(restaurantId?: string) {
  if (restaurantId) {
    delete clientOutletCache[restaurantId];
  } else {
    for (const key of Object.keys(clientOutletCache)) {
      delete clientOutletCache[key];
    }
  }
}
