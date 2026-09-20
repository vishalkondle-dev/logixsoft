/**
 * Centralized React Query hooks for all server data.
 *
 * Any two components (across different pages) calling the same hook with the
 * same arguments share a single cached result — no duplicate fetches, no
 * prop drilling. Cache is invalidated after mutations via queryClient.invalidateQueries.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getBootstrap,
  listOrders,
  getKitchenOrders,
  getCategories,
  getItems,
  getTables,
  listStaff,
  getOutlets,
  getReport,
  type ReportType,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
  createItem,
  updateItem,
  deleteItem,
  toggleItem,
  createTable,
  updateTable,
  toggleTable,
  deleteTable,
  inviteStaff,
  updateStaff,
  removeStaff,
  createOutlet,
  updateOutlet,
  deleteOutlet,
  setDefaultOutlet,
} from "@/lib/api-client";

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const qk = {
  bootstrap: (restaurantId: string, outletId: string | null) =>
    ["bootstrap", restaurantId, outletId] as const,
  orders: (restaurantId: string, params?: Record<string, any>) =>
    ["orders", restaurantId, params ?? {}] as const,
  kitchenOrders: (restaurantId: string, outletId: string | null) =>
    ["kitchenOrders", restaurantId, outletId] as const,
  categories: (restaurantId: string, outletId: string | null) =>
    ["categories", restaurantId, outletId] as const,
  items: (restaurantId: string, outletId: string | null, categoryId?: string) =>
    ["items", restaurantId, outletId, categoryId ?? null] as const,
  tables: (restaurantId: string, outletId: string | null | undefined) =>
    ["tables", restaurantId, outletId ?? null] as const,
  staff: (restaurantId: string) =>
    ["staff", restaurantId] as const,
  outlets: (restaurantId: string) =>
    ["outlets", restaurantId] as const,
  report: (restaurantId: string, type: ReportType, from: string, to: string, outletId: string | null) =>
    ["report", restaurantId, type, from, to, outletId ?? null] as const,
};

// ─── Bootstrap (categories + items + outlet info) ────────────────────────────

export function useBootstrap(restaurantId: string, outletId: string | null) {
  return useQuery({
    queryKey: qk.bootstrap(restaurantId, outletId),
    queryFn: () => getBootstrap(restaurantId, outletId),
    enabled: !!restaurantId && !!outletId,
    staleTime: 60_000,
  });
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export function useOrders(
  restaurantId: string,
  params: { status?: string; orderStatus?: string; outletId?: string; limit?: number; tableOccupied?: boolean } = {},
  enabled = true,
  options?: { refetchInterval?: number | false; staleTime?: number },
) {
  return useQuery({
    queryKey: qk.orders(restaurantId, params),
    queryFn: () => listOrders(restaurantId, params),
    enabled: !!restaurantId && enabled,
    staleTime: options?.staleTime ?? (options?.refetchInterval ? 0 : 30_000),
    refetchInterval: options?.refetchInterval,
  });
}

// ─── Kitchen Orders ───────────────────────────────────────────────────────────

export function useKitchenOrders(
  restaurantId: string,
  outletId: string | null,
  options?: { refetchInterval?: number | false }
) {
  return useQuery({
    queryKey: qk.kitchenOrders(restaurantId, outletId),
    queryFn: () => getKitchenOrders(restaurantId, outletId ?? undefined),
    enabled: !!restaurantId && !!outletId,
    staleTime: 5_000,
    refetchInterval: options?.refetchInterval !== undefined ? options.refetchInterval : 30_000,
  });
}

// ─── Menu Categories ─────────────────────────────────────────────────────────

export function useCategories(restaurantId: string, outletId: string | null) {
  return useQuery({
    queryKey: qk.categories(restaurantId, outletId),
    queryFn: () => getCategories(restaurantId, outletId),
    enabled: !!restaurantId,
    staleTime: 60_000,
  });
}

// ─── Menu Items ───────────────────────────────────────────────────────────────

export function useItems(
  restaurantId: string,
  outletId: string | null,
  categoryId?: string,
) {
  return useQuery({
    queryKey: qk.items(restaurantId, outletId, categoryId),
    queryFn: () => getItems(restaurantId, categoryId, outletId),
    enabled: !!restaurantId,
    staleTime: 60_000,
  });
}

// ─── Tables ───────────────────────────────────────────────────────────────────

export function useTables(
  restaurantId: string,
  outletId: string | null | undefined,
  options?: { refetchInterval?: number | false; staleTime?: number },
) {
  return useQuery({
    queryKey: qk.tables(restaurantId, outletId),
    queryFn: () => getTables(restaurantId, outletId ?? undefined),
    enabled: !!restaurantId && !!outletId,
    staleTime: options?.staleTime ?? (options?.refetchInterval ? 0 : 60_000),
    refetchInterval: options?.refetchInterval,
  });
}

// ─── Staff ───────────────────────────────────────────────────────────────────

export function useStaff(restaurantId: string, enabled = true) {
  return useQuery({
    queryKey: qk.staff(restaurantId),
    queryFn: () => listStaff(restaurantId),
    enabled: !!restaurantId && enabled,
    staleTime: 60_000,
  });
}

// ─── Outlets ─────────────────────────────────────────────────────────────────

export function useOutlets(restaurantId: string) {
  return useQuery({
    queryKey: qk.outlets(restaurantId),
    queryFn: () => getOutlets(restaurantId),
    enabled: !!restaurantId,
    staleTime: 60_000,
  });
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export function useReport(
  restaurantId: string,
  type: ReportType,
  from: string,
  to: string,
  outletId: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: qk.report(restaurantId, type, from, to, outletId),
    queryFn: () => getReport(restaurantId, type, from, to, outletId),
    enabled: !!restaurantId && !!from && !!to && enabled,
    staleTime: 60_000,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

// Categories
export function useCreateCategory(restaurantId: string, outletId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description?: string; sortOrder?: number; outletId?: string | null }) =>
      createCategory(restaurantId, body, outletId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.categories(restaurantId, outletId) });
      qc.invalidateQueries({ queryKey: qk.bootstrap(restaurantId, outletId) });
    },
  });
}

export function useUpdateCategory(restaurantId: string, outletId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) =>
      updateCategory(restaurantId, id, body, outletId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.categories(restaurantId, outletId) });
      qc.invalidateQueries({ queryKey: qk.bootstrap(restaurantId, outletId) });
    },
  });
}

export function useDeleteCategory(restaurantId: string, outletId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCategory(restaurantId, id, outletId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.categories(restaurantId, outletId) });
      qc.invalidateQueries({ queryKey: qk.bootstrap(restaurantId, outletId) });
    },
  });
}

export function useReorderCategories(restaurantId: string, outletId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: { id: string; sortOrder: number }[]) =>
      reorderCategories(restaurantId, items, outletId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.categories(restaurantId, outletId) });
    },
  });
}

// Items
export function useCreateItem(restaurantId: string, outletId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { categoryId: string; name: string; pricePaise: number; description?: string; outletId?: string | null; variants?: any[]; addons?: any[] }) =>
      createItem(restaurantId, body, outletId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items", restaurantId] });
      qc.invalidateQueries({ queryKey: qk.bootstrap(restaurantId, outletId) });
    },
  });
}

export function useUpdateItem(restaurantId: string, outletId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) =>
      updateItem(restaurantId, id, body, outletId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items", restaurantId] });
      qc.invalidateQueries({ queryKey: qk.bootstrap(restaurantId, outletId) });
    },
  });
}

export function useDeleteItem(restaurantId: string, outletId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteItem(restaurantId, id, outletId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items", restaurantId] });
      qc.invalidateQueries({ queryKey: qk.bootstrap(restaurantId, outletId) });
    },
  });
}

export function useToggleItem(restaurantId: string, outletId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => toggleItem(restaurantId, id, outletId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items", restaurantId] });
      qc.invalidateQueries({ queryKey: qk.bootstrap(restaurantId, outletId) });
    },
  });
}

// Tables
export function useCreateTable(restaurantId: string, outletId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { outletId: string; name: string; section?: string; capacity?: number }) =>
      createTable(restaurantId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.tables(restaurantId, outletId) });
    },
  });
}

export function useUpdateTable(restaurantId: string, outletId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) =>
      updateTable(restaurantId, id, body, outletId ?? undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.tables(restaurantId, outletId) });
    },
  });
}

export function useToggleTable(restaurantId: string, outletId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => toggleTable(restaurantId, id, outletId ?? undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.tables(restaurantId, outletId) });
    },
  });
}

export function useDeleteTable(restaurantId: string, outletId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTable(restaurantId, id, outletId ?? undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.tables(restaurantId, outletId) });
    },
  });
}

// Staff
export function useInviteStaff(restaurantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { phone: string; role: string; outletIds: string[] }) =>
      inviteStaff(restaurantId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.staff(restaurantId) });
    },
  });
}

export function useUpdateStaff(restaurantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { role?: string; outletIds?: string[] } }) =>
      updateStaff(restaurantId, id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.staff(restaurantId) });
    },
  });
}

export function useRemoveStaff(restaurantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => removeStaff(restaurantId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.staff(restaurantId) });
    },
  });
}

// Outlets
export function useCreateOutlet(restaurantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; address?: string; phone?: string; upiId?: string }) =>
      createOutlet(restaurantId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.outlets(restaurantId) });
    },
  });
}

export function useUpdateOutlet(restaurantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) =>
      updateOutlet(restaurantId, id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.outlets(restaurantId) });
    },
  });
}

export function useDeleteOutlet(restaurantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteOutlet(restaurantId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.outlets(restaurantId) });
    },
  });
}

export function useSetDefaultOutlet(restaurantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => setDefaultOutlet(restaurantId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.outlets(restaurantId) });
    },
  });
}
