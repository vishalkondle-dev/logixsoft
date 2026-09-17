"use client";

import React, {
  createContext, useContext, useState, useEffect, useCallback, ReactNode,
} from "react";
import type { JsonRestaurantRow, JsonRestaurantOutletRow } from "@logixsoft/logix-dine/types/pos-schema";
import { useAuth } from "@/lib/auth-context";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://dine-api.logixsoft.in";
const RESTAURANT_COOKIE = "dine.restaurantId";
const OUTLET_COOKIE = "dine.outletId";

interface RestaurantContextType {
  restaurant: JsonRestaurantRow | null;
  outlets: JsonRestaurantOutletRow[];
  activeOutlet: JsonRestaurantOutletRow | null;
  myRestaurants: JsonRestaurantRow[];
  isLoading: boolean;
  setActiveRestaurant: (restaurantId: string) => void;
  setActiveOutlet: (outletId: string) => void;
  refresh: () => Promise<void>;
}

const RestaurantContext = createContext<RestaurantContextType | undefined>(undefined);

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, days = 365) {
  const expires = new Date(Date.now() + days * 86400000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`;
}

export function RestaurantProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [restaurant, setRestaurant] = useState<JsonRestaurantRow | null>(null);
  const [outlets, setOutlets] = useState<JsonRestaurantOutletRow[]>([]);
  const [activeOutlet, setActiveOutletState] = useState<JsonRestaurantOutletRow | null>(null);
  const [myRestaurants, setMyRestaurants] = useState<JsonRestaurantRow[]>([]);
  const [isLoading, setIsLoading] = useState(true); // start true until first fetch resolves
  const [activeRestaurantId, setActiveRestaurantId] = useState<string | null>(null);

  const fetchData = useCallback(async (restaurantId: string) => {
    setIsLoading(true);
    try {
      const [restRes, outletsRes] = await Promise.all([
        fetch(`${API_BASE}/restaurants/me`, {
          credentials: "include",
          headers: { "X-Restaurant-Id": restaurantId },
        }),
        fetch(`${API_BASE}/outlets`, {
          credentials: "include",
          headers: { "X-Restaurant-Id": restaurantId },
        }),
      ]);

      if (restRes.ok) {
        const r = await restRes.json();
        setRestaurant(r);
      }
      if (outletsRes.ok) {
        const o = await outletsRes.json();
        setOutlets(o);
        // Set active outlet from cookie or default
        const savedOutletId = getCookie(OUTLET_COOKIE);
        const saved = o.find((out: JsonRestaurantOutletRow) => out.id === savedOutletId);
        const defaultOutlet = o.find((out: JsonRestaurantOutletRow) => out.isDefault) ?? o[0] ?? null;
        setActiveOutletState(saved ?? defaultOutlet);
      }
    } catch {
      // silently fail — auth-context handles login state
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (activeRestaurantId) await fetchData(activeRestaurantId);
  }, [activeRestaurantId, fetchData]);

  useEffect(() => {
    // Don't do anything while auth is still loading
    if (authLoading) return;

    if (!isAuthenticated || !user) {
      setRestaurant(null);
      setOutlets([]);
      setMyRestaurants([]);
      setIsLoading(false); // auth settled, no session — done
      return;
    }
    // Fetch the list of restaurants the user owns
    fetch(`${API_BASE}/restaurants`, {
      credentials: "include",
    })
      .then((r) => r.ok ? r.json() : [])
      .then((rests: JsonRestaurantRow[]) => {
        setMyRestaurants(rests);
        if (!rests.length) {
          setIsLoading(false); // no restaurants — done
          return;
        }
        // Pick active from cookie or first
        const savedId = getCookie(RESTAURANT_COOKIE);
        const toLoad = rests.find((r) => r.id === savedId) ?? rests[0];
        setActiveRestaurantId(toLoad.id);
        fetchData(toLoad.id);
      })
      .catch(() => {});
  }, [isAuthenticated, user, authLoading, fetchData]);

  const setActiveRestaurant = useCallback((restaurantId: string) => {
    setCookie(RESTAURANT_COOKIE, restaurantId);
    setActiveRestaurantId(restaurantId);
    fetchData(restaurantId);
  }, [fetchData]);

  const setActiveOutlet = useCallback((outletId: string) => {
    setCookie(OUTLET_COOKIE, outletId);
    const outlet = outlets.find((o) => o.id === outletId) ?? null;
    setActiveOutletState(outlet);
  }, [outlets]);

  return (
    <RestaurantContext.Provider value={{
      restaurant,
      outlets,
      activeOutlet,
      myRestaurants,
      isLoading,
      setActiveRestaurant,
      setActiveOutlet,
      refresh,
    }}>
      {children}
    </RestaurantContext.Provider>
  );
}

export function useRestaurant() {
  const ctx = useContext(RestaurantContext);
  if (!ctx) throw new Error("useRestaurant must be used within RestaurantProvider");
  return ctx;
}

export function useRestaurantRole(): string | null {
  // In v1 every member is OWNER — expands in v2 via restaurantMember lookup
  const { restaurant } = useRestaurant();
  const { user } = useAuth();
  if (!restaurant || !user) return null;
  return (user as any).role === "ADMIN" ? "ADMIN" : "OWNER";
}
