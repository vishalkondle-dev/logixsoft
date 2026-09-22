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
  getItem,
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
  uploadItemImage,
  deleteItemImage,
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
  getCustomerProfile,
  updateCustomerNotes,
  sendCustomerWhatsApp,
  getCustomerPortal,
  updateCustomerProfile,
  getCustomerOutletMenu,
  addCustomerOrderItems,
  callWaiterAssistance,
  getWaiterRequests,
  getWaiterStats,
  createWaiterRequest,
  updateWaiterRequestStatus,
  getDeliveryRiders,
  createDeliveryRider,
  updateDeliveryStatus,
  updateDeliveryRiderStatus,
  getCustomerAddresses,
  type CustomerPortalData,
  type CustomerMenuResponse,
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
  item: (restaurantId: string, id: string) =>
    ["item", restaurantId, id] as const,
  tables: (restaurantId: string, outletId: string | null | undefined, includeInactive?: boolean) =>
    ["tables", restaurantId, outletId ?? null, includeInactive ? "all" : "active"] as const,
  staff: (restaurantId: string) =>
    ["staff", restaurantId] as const,
  outlets: (restaurantId: string) =>
    ["outlets", restaurantId] as const,
  report: (restaurantId: string, type: ReportType, from: string, to: string, outletId: string | null) =>
    ["report", restaurantId, type, from, to, outletId ?? null] as const,
  customer: (restaurantId: string, phone: string, outletId?: string | null) =>
    ["customer", restaurantId, phone, outletId ?? "all"] as const,
  customerPortal: () => ["customerPortal"] as const,
  customerMenu: (outletId: string) => ["customerMenu", outletId] as const,
  waiterRequests: (restaurantId: string, outletId: string | null, params?: Record<string, any>) =>
    ["waiterRequests", restaurantId, outletId, params ?? {}] as const,
  waiterStats: (restaurantId: string, outletId: string | null) =>
    ["waiterStats", restaurantId, outletId] as const,
  deliveryRiders: (restaurantId: string, outletId: string | null) =>
    ["deliveryRiders", restaurantId, outletId] as const,
  customerAddresses: (restaurantId: string, phone: string) =>
    ["customerAddresses", restaurantId, phone] as const,
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

export function useItem(
  restaurantId: string,
  id: string,
  outletId?: string | null,
) {
  return useQuery({
    queryKey: qk.item(restaurantId, id),
    queryFn: () => getItem(restaurantId, id, outletId),
    enabled: !!restaurantId && !!id,
    staleTime: 30_000,
  });
}

// ─── Tables ───────────────────────────────────────────────────────────────────

export function useTables(
  restaurantId: string,
  outletId: string | null | undefined,
  options?: { refetchInterval?: number | false; staleTime?: number; includeInactive?: boolean },
) {
  return useQuery({
    queryKey: qk.tables(restaurantId, outletId, options?.includeInactive),
    queryFn: () => getTables(restaurantId, outletId ?? undefined, options?.includeInactive),
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
    mutationFn: (body: { categoryId: string; name: string; pricePaise: number; description?: string; imageUrl?: string | null; outletId?: string | null; variants?: any[]; addons?: any[] }) =>
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
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["items", restaurantId] });
      qc.invalidateQueries({ queryKey: qk.item(restaurantId, variables.id) });
      qc.invalidateQueries({ queryKey: qk.bootstrap(restaurantId, outletId) });
    },
  });
}

export function useDeleteItem(restaurantId: string, outletId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteItem(restaurantId, id, outletId),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["items", restaurantId] });
      qc.invalidateQueries({ queryKey: qk.item(restaurantId, id) });
      qc.invalidateQueries({ queryKey: qk.bootstrap(restaurantId, outletId) });
    },
  });
}

export function useToggleItem(restaurantId: string, outletId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => toggleItem(restaurantId, id, outletId),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["items", restaurantId] });
      qc.invalidateQueries({ queryKey: qk.item(restaurantId, id) });
      qc.invalidateQueries({ queryKey: qk.bootstrap(restaurantId, outletId) });
    },
  });
}

export function useUploadItemImage(restaurantId: string, outletId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      uploadItemImage(restaurantId, id, file, outletId),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["items", restaurantId] });
      qc.invalidateQueries({ queryKey: qk.item(restaurantId, variables.id) });
      qc.invalidateQueries({ queryKey: qk.bootstrap(restaurantId, outletId) });
    },
  });
}

export function useDeleteItemImage(restaurantId: string, outletId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      deleteItemImage(restaurantId, id, outletId),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["items", restaurantId] });
      qc.invalidateQueries({ queryKey: qk.item(restaurantId, id) });
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
      qc.invalidateQueries({ queryKey: ["tables", restaurantId] });
    },
  });
}

export function useUpdateTable(restaurantId: string, outletId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) =>
      updateTable(restaurantId, id, body, outletId ?? undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tables", restaurantId] });
    },
  });
}

export function useToggleTable(restaurantId: string, outletId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => toggleTable(restaurantId, id, outletId ?? undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tables", restaurantId] });
    },
  });
}

export function useDeleteTable(restaurantId: string, outletId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTable(restaurantId, id, outletId ?? undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tables", restaurantId] });
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

// ─── Customer Profile Hooks ──────────────────────────────────────────────────

export function useCustomerProfile(
  restaurantId: string,
  phone: string,
  outletId?: string | null
) {
  return useQuery({
    queryKey: qk.customer(restaurantId, phone, outletId),
    queryFn: () => getCustomerProfile(restaurantId, phone, outletId),
    enabled: Boolean(restaurantId && phone),
    staleTime: 30_000,
  });
}

export function useUpdateCustomerNotes(restaurantId: string, phone: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ body, outletId }: { body: { notes?: string; tags?: string[] }; outletId?: string | null }) =>
      updateCustomerNotes(restaurantId, phone, body, outletId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer", restaurantId, phone] });
    },
  });
}

export function useSendCustomerWhatsApp(restaurantId: string, phone: string) {
  return useMutation({
    mutationFn: ({ message, outletId }: { message: string; outletId?: string | null }) =>
      sendCustomerWhatsApp(restaurantId, phone, { message }, outletId),
  });
}

// ─── Customer Portal Hooks ───────────────────────────────────────────────────

export function useCustomerPortal(options?: {
  refetchInterval?: number | false | ((query: any) => number | false | undefined);
}) {
  return useQuery({
    queryKey: qk.customerPortal(),
    queryFn: () => getCustomerPortal(),
    staleTime: 5_000,
    refetchInterval: options?.refetchInterval,
  });
}

export function useUpdateCustomerProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string; email?: string }) => updateCustomerProfile(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.customerPortal() });
    },
  });
}

export function useCustomerOutletMenu(outletId: string | null | undefined) {
  return useQuery({
    queryKey: outletId ? qk.customerMenu(outletId) : ["customerMenu", "none"],
    queryFn: () => getCustomerOutletMenu(outletId!),
    enabled: Boolean(outletId),
    staleTime: 60_000,
  });
}

export function useAddCustomerOrderItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      body,
    }: {
      orderId: string;
      body: {
        items: Array<{
          itemId: string;
          qty: number;
          variantId?: string;
          addonIds?: string[];
          note?: string;
        }>;
        roundNote?: string;
      };
    }) => addCustomerOrderItems(orderId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.customerPortal() });
    },
  });
}

export function useCallWaiter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      body,
    }: {
      orderId: string;
      body: {
        serviceType: "WATER" | "CUTLERY" | "BILL" | "CLEAN_TABLE" | "OTHER";
        note?: string;
      };
    }) => callWaiterAssistance(orderId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["waiterRequests"] });
      qc.invalidateQueries({ queryKey: ["waiterStats"] });
    },
  });
}

// ─── Waiter Requests Hooks ──────────────────────────────────────────────────

export function useWaiterRequests(
  restaurantId: string,
  outletId: string | null,
  params: { status?: string; tableNo?: string; limit?: number } = {},
  options?: { refetchInterval?: number | false; staleTime?: number }
) {
  return useQuery({
    queryKey: qk.waiterRequests(restaurantId, outletId, params),
    queryFn: () => getWaiterRequests(restaurantId, outletId, params),
    enabled: !!restaurantId && !!outletId,
    staleTime: options?.staleTime ?? (options?.refetchInterval ? 0 : 30_000),
    refetchInterval: options?.refetchInterval,
  });
}

export function useWaiterStats(
  restaurantId: string,
  outletId: string | null,
  options?: { refetchInterval?: number | false; staleTime?: number }
) {
  return useQuery({
    queryKey: qk.waiterStats(restaurantId, outletId),
    queryFn: () => getWaiterStats(restaurantId, outletId),
    enabled: !!restaurantId && !!outletId,
    staleTime: options?.staleTime ?? (options?.refetchInterval ? 0 : 30_000),
    refetchInterval: options?.refetchInterval,
  });
}

export function useCreateWaiterRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      restaurantId,
      outletId,
      body,
    }: {
      restaurantId: string;
      outletId: string;
      body: {
        tableNo: string;
        serviceType: "WATER" | "CUTLERY" | "BILL" | "CLEAN_TABLE" | "OTHER";
        serviceLabel?: string;
        note?: string;
        orderId?: string;
        customerPhone?: string;
      };
    }) => createWaiterRequest(restaurantId, body, outletId),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["waiterRequests", vars.restaurantId] });
      queryClient.invalidateQueries({ queryKey: ["waiterStats", vars.restaurantId] });
    },
  });
}

export function useUpdateWaiterRequestStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      restaurantId,
      outletId,
      requestId,
      status,
    }: {
      restaurantId: string;
      outletId: string;
      requestId: string;
      status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
    }) => updateWaiterRequestStatus(restaurantId, requestId, status, outletId),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["waiterRequests", vars.restaurantId] });
      queryClient.invalidateQueries({ queryKey: ["waiterStats", vars.restaurantId] });
    },
  });
}

// ─── Delivery Module Hooks ────────────────────────────────────────────────────

export function useDeliveryRiders(restaurantId: string, outletId: string | null, enabled = true) {
  return useQuery({
    queryKey: qk.deliveryRiders(restaurantId, outletId),
    queryFn: () => getDeliveryRiders(restaurantId, outletId),
    enabled: !!restaurantId && enabled,
    staleTime: 30_000,
  });
}

export function useCustomerAddresses(restaurantId: string, phone: string, enabled = true) {
  return useQuery({
    queryKey: qk.customerAddresses(restaurantId, phone),
    queryFn: () => getCustomerAddresses(restaurantId, phone),
    enabled: !!restaurantId && phone.replace(/\D/g, "").length >= 10 && enabled,
    staleTime: 30_000,
  });
}

export function useCreateDeliveryRider(restaurantId: string, outletId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => createDeliveryRider(restaurantId, body, outletId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.deliveryRiders(restaurantId, outletId) });
    },
  });
}

export function useUpdateDeliveryStatus(restaurantId: string, outletId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      body,
    }: {
      orderId: string;
      body: {
        status: "ASSIGNED" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";
        riderId?: string;
        deliveryOtp?: string;
        failedReason?: string;
      };
    }) => updateDeliveryStatus(restaurantId, orderId, body, outletId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.orders(restaurantId) });
      queryClient.invalidateQueries({ queryKey: qk.kitchenOrders(restaurantId, outletId) });
      queryClient.invalidateQueries({ queryKey: qk.deliveryRiders(restaurantId, outletId) });
    },
  });
}

export function useUpdateDeliveryRiderStatus(restaurantId: string, outletId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      riderId,
      status,
    }: {
      riderId: string;
      status: "AVAILABLE" | "ON_DELIVERY" | "OFFLINE";
    }) => updateDeliveryRiderStatus(restaurantId, riderId, status, outletId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.deliveryRiders(restaurantId, outletId) });
    },
  });
}



