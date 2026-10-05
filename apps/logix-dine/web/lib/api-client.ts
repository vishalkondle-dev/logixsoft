const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://dine-api.logixsoft.in";

async function apiFetch<T>(
  path: string,
  restaurantId: string,
  opts: RequestInit = {},
  outletId?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    "X-Restaurant-Id": restaurantId,
    ...(outletId ? { "X-Outlet-Id": outletId } : {}),
    ...((opts.headers as Record<string, string>) ?? {}),
  };
  if (!(opts.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers,
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Billing ──────────────────────────────────────────────────────────────────

export interface DeliveryDetailsInput {
  customerName?: string;
  customerPhone?: string;
  alternatePhone?: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city?: string;
  pincode?: string;
  deliveryNotes?: string;
  deliveryMode?: "IN_HOUSE" | "THIRD_PARTY";
  riderId?: string;
}

export interface DeliveryDetails {
  id: string;
  orderId: string;
  customerName: string;
  customerPhone: string;
  alternatePhone?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  landmark?: string | null;
  city: string;
  pincode: string;
  deliveryNotes?: string | null;
  deliveryMode: string;
  riderId?: string | null;
  riderName?: string | null;
  riderPhone?: string | null;
  riderVehicleNo?: string | null;
  deliveryOtp: string;
  status: "PENDING_ASSIGNMENT" | "ASSIGNED" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";
  estimatedMinutes?: number | null;
  assignedAt?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  failedReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerAddress {
  id: string;
  customerPhone: string;
  label: string;
  receiverName?: string | null;
  receiverPhone?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  landmark?: string | null;
  city: string;
  pincode: string;
  isDefault?: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryRider {
  id: string;
  restaurantId: string;
  outletId: string;
  name: string;
  phone: string;
  vehicleType: string;
  vehicleNumber?: string | null;
  status: "AVAILABLE" | "ON_DELIVERY" | "OFFLINE" | "INACTIVE";
  activeOrderId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const getBootstrap = (restaurantId: string, outletId?: string | null) =>
  apiFetch<any>(`/orders/bootstrap${outletId ? `?outletId=${outletId}` : ""}`, restaurantId, {}, outletId);

export const startOrder = (
  restaurantId: string,
  body: {
    outletId: string;
    tableNo?: string;
    customerPhone?: string;
    note?: string;
    orderType?: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
    packagingChargePaise?: number;
    deliveryChargePaise?: number;
    adjustments?: Array<{ id: string; label: string; value: string; amountPaise: number }>;
    delivery?: DeliveryDetailsInput;
    items?: Array<{ itemId: string; qty: number; note?: string; variantId?: string; addonIds?: string[] }>;
  }
) => apiFetch<any>("/orders/send-to-kitchen", restaurantId, { method: "POST", body: JSON.stringify(body) }, body.outletId);

export const getOrder = (restaurantId: string, orderId: string, outletId?: string | null) =>
  apiFetch<any>(`/orders/${orderId}`, restaurantId, {}, outletId);

export const listOrders = (restaurantId: string, params?: { status?: string; orderStatus?: string; outletId?: string; limit?: number; tableOccupied?: boolean }) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
  ).toString();
  return apiFetch<any[]>(`/orders/list${qs ? `?${qs}` : ""}`, restaurantId, {}, params?.outletId);
};

export const addOrderItem = (
  restaurantId: string,
  orderId: string,
  body: { itemId: string; qty?: number; note?: string; variantId?: string; addonIds?: string[] },
  outletId?: string | null
) =>
  apiFetch<any>(
    "/orders/add-round",
    restaurantId,
    {
      method: "POST",
      body: JSON.stringify({
        orderId,
        items: [{ itemId: body.itemId, qty: body.qty || 1, note: body.note, variantId: body.variantId, addonIds: body.addonIds }],
      }),
    },
    outletId
  );

export const addOrderRound = (
  restaurantId: string,
  orderId: string,
  body: {
    items: Array<{ itemId: string; qty: number; note?: string; variantId?: string; addonIds?: string[] }>;
    adjustments?: Array<{ id: string; label: string; value: string; amountPaise: number }>;
    settle?: { method: string };
  },
  outletId?: string | null
) =>
  apiFetch<any>(
    "/orders/add-round",
    restaurantId,
    { method: "POST", body: JSON.stringify({ orderId, items: body.items, adjustments: body.adjustments, settle: body.settle }) },
    outletId
  );

export const freeTableOrder = (
  restaurantId: string,
  orderId: string,
  body?: { method?: string },
  outletId?: string | null
) =>
  apiFetch<any>(
    "/orders/free-table",
    restaurantId,
    { method: "POST", body: JSON.stringify({ orderId, method: body?.method, autoSettle: true }) },
    outletId
  );

export const updateOrderItemQty = (restaurantId: string, orderId: string, orderItemId: string, qty: number, outletId?: string | null) =>
  apiFetch<any>(
    "/kitchen/advance-item-status",
    restaurantId,
    { method: "POST", body: JSON.stringify({ orderId, orderItemId, action: "qty", qty }) },
    outletId
  );

export const updateOrderItemStatus = (
  restaurantId: string,
  orderId: string,
  orderItemId: string,
  body: { status?: string; action?: "next" | "close" | "cancel" },
  outletId?: string | null
) => {
  if (body.action === "cancel") {
    return apiFetch<any>(
      "/kitchen/cancel-item",
      restaurantId,
      { method: "POST", body: JSON.stringify({ orderId, orderItemId, reason: "Cancelled from KDS" }) },
      outletId
    );
  }
  return apiFetch<any>(
    "/kitchen/advance-item-status",
    restaurantId,
    { method: "POST", body: JSON.stringify({ orderId, orderItemId, status: body.status, action: body.action }) },
    outletId
  );
};

export const removeOrderItem = (restaurantId: string, orderId: string, orderItemId: string, outletId?: string | null) =>
  apiFetch<any>(
    "/kitchen/cancel-item",
    restaurantId,
    { method: "POST", body: JSON.stringify({ orderId, orderItemId, reason: "Removed item" }) },
    outletId
  );

export const settleOrder = (
  restaurantId: string,
  orderId: string,
  body: {
    method?: string;
    customerPhone?: string;
    adjustments?: Array<{ id: string; label: string; value: string; amountPaise: number }>;
  },
  outletId?: string | null
) =>
  apiFetch<any>(
    "/orders/settle-bill",
    restaurantId,
    { method: "POST", body: JSON.stringify({ orderId, method: body.method, customerPhone: body.customerPhone, adjustments: body.adjustments }) },
    outletId
  );

/** Create + settle in a single API call — faster Settle & Send. */
export const createSettledOrder = (
  restaurantId: string,
  body: {
    outletId: string;
    tableNo?: string;
    customerPhone?: string;
    note?: string;
    method?: string;
    orderType?: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
    packagingChargePaise?: number;
    deliveryChargePaise?: number;
    adjustments?: Array<{ id: string; label: string; value: string; amountPaise: number }>;
    delivery?: DeliveryDetailsInput;
    items?: Array<{ itemId: string; qty: number; note?: string; variantId?: string; addonIds?: string[] }>;
  }
) =>
  apiFetch<any>("/orders/create-settled", restaurantId, { method: "POST", body: JSON.stringify(body) }, body.outletId);

export const sendOrderWhatsApp = (
  restaurantId: string,
  orderId: string,
  body: { phone?: string },
  outletId?: string | null
) =>
  apiFetch<any>(
    "/orders/send-whatsapp-receipt",
    restaurantId,
    { method: "POST", body: JSON.stringify({ orderId, phone: body.phone }) },
    outletId
  );

export const voidOrder = (restaurantId: string, orderId: string, outletId?: string | null) =>
  apiFetch<any>(
    "/orders/void",
    restaurantId,
    { method: "POST", body: JSON.stringify({ orderId, reason: "Voided by staff" }) },
    outletId
  );

export const markKotPrinted = (restaurantId: string, orderId: string, outletId?: string | null) =>
  apiFetch<any>(
    "/orders/mark-kot-printed",
    restaurantId,
    { method: "POST", body: JSON.stringify({ orderId }) },
    outletId
  );

// ─── Kitchen Display (KDS) ──────────────────────────────────────────────────────

export const getKitchenOrders = (restaurantId: string, outletId?: string | null) =>
  apiFetch<any[]>("/kitchen/active-tickets", restaurantId, {}, outletId);

export const markOrderReady = (restaurantId: string, orderId: string, outletId?: string | null) =>
  apiFetch<any>(
    "/kitchen/mark-order-ready",
    restaurantId,
    { method: "POST", body: JSON.stringify({ orderId }) },
    outletId
  );

// ─── Menu ─────────────────────────────────────────────────────────────────────

export const getCategories = (restaurantId: string, outletId?: string | null) =>
  apiFetch<any[]>(`/menu/categories${outletId ? `?outletId=${outletId}` : ""}`, restaurantId, {}, outletId);

export const createCategory = (restaurantId: string, body: { name: string; description?: string; sortOrder?: number; outletId?: string | null }, outletId?: string | null) =>
  apiFetch<any>("/menu/categories", restaurantId, { method: "POST", body: JSON.stringify(body) }, outletId ?? body.outletId);

export const updateCategory = (restaurantId: string, id: string, body: any, outletId?: string | null) =>
  apiFetch<any>(`/menu/categories/${id}`, restaurantId, { method: "PUT", body: JSON.stringify(body) }, outletId);

export const deleteCategory = (restaurantId: string, id: string, outletId?: string | null) =>
  apiFetch<any>(`/menu/categories/${id}`, restaurantId, { method: "DELETE" }, outletId);

export const reorderCategories = (restaurantId: string, items: { id: string; sortOrder: number }[], outletId?: string | null) =>
  apiFetch<any>("/menu/categories/reorder", restaurantId, { method: "PATCH", body: JSON.stringify(items) }, outletId);

export const getItems = (restaurantId: string, categoryId?: string, outletId?: string | null) => {
  const params = new URLSearchParams();
  if (categoryId) params.append("categoryId", categoryId);
  if (outletId) params.append("outletId", outletId);
  const qs = params.toString();
  return apiFetch<any[]>(`/menu/items${qs ? `?${qs}` : ""}`, restaurantId, {}, outletId);
};

export const getItem = (restaurantId: string, id: string, outletId?: string | null) =>
  apiFetch<any>(`/menu/items/${id}`, restaurantId, {}, outletId);

export const createItem = (
  restaurantId: string,
  body: {
    categoryId: string;
    name: string;
    pricePaise: number;
    description?: string;
    imageUrl?: string | null;
    outletId?: string | null;
    variants?: any[];
    addons?: any[];
  },
  outletId?: string | null
) =>
  apiFetch<any>("/menu/items", restaurantId, { method: "POST", body: JSON.stringify(body) }, outletId ?? body.outletId);

export const updateItem = (restaurantId: string, id: string, body: any, outletId?: string | null) =>
  apiFetch<any>(`/menu/items/${id}`, restaurantId, { method: "PUT", body: JSON.stringify(body) }, outletId);

export const deleteItem = (restaurantId: string, id: string, outletId?: string | null) =>
  apiFetch<any>(`/menu/items/${id}`, restaurantId, { method: "DELETE" }, outletId);

export const toggleItem = (restaurantId: string, id: string, outletId?: string | null) =>
  apiFetch<any>(`/menu/items/${id}/toggle`, restaurantId, { method: "PATCH" }, outletId);

export const uploadItemImage = (
  restaurantId: string,
  id: string,
  file: File,
  outletId?: string | null
) => {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch<any>(`/menu/items/${id}/image`, restaurantId, {
    method: "POST",
    body: formData,
  }, outletId);
};

export const deleteItemImage = (
  restaurantId: string,
  id: string,
  outletId?: string | null
) =>
  apiFetch<any>(`/menu/items/${id}/image`, restaurantId, { method: "DELETE" }, outletId);

// ─── Restaurant & Outlets ────────────────────────────────────────────────────

export const getRestaurant = (restaurantId: string) =>
  apiFetch<any>("/restaurants/me", restaurantId);

export const updateRestaurant = (restaurantId: string, body: any) =>
  apiFetch<any>(`/restaurants/${restaurantId}`, restaurantId, { method: "PUT", body: JSON.stringify(body) });

export const getMyRole = (restaurantId: string) =>
  apiFetch<{ role: string; roleName?: string; permissions?: string[]; outletIds: string[]; allOutlets: boolean }>("/restaurants/my-role", restaurantId);

export const getOutlets = (restaurantId: string) =>
  apiFetch<any[]>("/outlets", restaurantId);

export const createOutlet = (
  restaurantId: string,
  body: { name: string; address?: string; phone?: string; upiId?: string; planTier?: string; billingCycle?: string; status?: string }
) =>
  apiFetch<any>("/outlets", restaurantId, { method: "POST", body: JSON.stringify(body) });

export const updateOutlet = (restaurantId: string, outletId: string, body: any) =>
  apiFetch<any>(`/outlets/${outletId}`, restaurantId, { method: "PUT", body: JSON.stringify(body) });

export const deleteOutlet = (restaurantId: string, outletId: string) =>
  apiFetch<any>(`/outlets/${outletId}`, restaurantId, { method: "DELETE" });

export const setDefaultOutlet = (restaurantId: string, outletId: string) =>
  apiFetch<any>(`/outlets/${outletId}/set-default`, restaurantId, { method: "PATCH" });

export const getBillingData = (restaurantId: string) =>
  apiFetch<{
    restaurant: { id: string; name: string };
    outlets: Array<{
      id: string;
      restaurantId: string;
      name: string;
      address?: string | null;
      phone?: string | null;
      upiId?: string | null;
      status: string;
      planTier: string;
      planName: string;
      billingCycle: string;
      trialEndsAt?: string | null;
      subscriptionExpiresAt?: string | null;
      trialDaysRemaining?: number | null;
      monthlyPrice: number;
      annualPrice: number;
      isDefault: boolean;
      createdAt: string;
      updatedAt: string;
    }>;
    plans: Array<{
      id: string;
      name: string;
      monthlyPrice: number;
      annualPrice: number;
      popular?: boolean;
      features: string[];
    }>;
    invoices: Array<{
      id: string;
      date: string;
      outletName: string;
      planName: string;
      billingCycle: string;
      amount: number;
      tax: number;
      total: number;
      status: string;
    }>;
  }>("/outlets/billing", restaurantId);

export const updateOutletSubscription = (
  restaurantId: string,
  outletId: string,
  body: { planTier: string; billingCycle?: string; status?: string }
) =>
  apiFetch<any>(`/outlets/${outletId}/subscription`, restaurantId, {
    method: "PUT",
    body: JSON.stringify(body),
  });

export const initiateOutletOneTimePay = (
  restaurantId: string,
  outletId: string,
  body: { planTier: 'BASIC' | 'PRO'; billingCycle?: 'MONTHLY' | 'ANNUAL' }
) =>
  apiFetch<{
    success: boolean;
    orderId: string;
    checkoutUrl: string;
    upiString: string;
    amount: number;
    frequency: string;
  }>(`/outlets/${outletId}/payment/one-time`, restaurantId, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const initiateOutletAutopay = (
  restaurantId: string,
  outletId: string,
  body: { planTier: 'BASIC' | 'PRO'; billingCycle?: 'MONTHLY' | 'ANNUAL' }
) =>
  apiFetch<{
    success: boolean;
    mandateId: string;
    checkoutUrl: string;
    upiString: string;
    recurringAmount: number;
    frequency: string;
  }>(`/outlets/${outletId}/autopay/initiate`, restaurantId, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const cancelOutletAutopay = (restaurantId: string, outletId: string) =>
  apiFetch<any>(`/outlets/${outletId}/autopay/cancel`, restaurantId, {
    method: "POST",
  });

// ─── Roles & Permissions ──────────────────────────────────────────────────

export interface RoleItem {
  id: string;
  restaurantId: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  permissions: string[];
  allOutlets: boolean;
  memberCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionModuleInfo {
  module: string;
  name: string;
  description: string;
  permissions: {
    key: string;
    label: string;
    description: string;
    badge?: string;
  }[];
}

export interface RolesListResponse {
  roles: RoleItem[];
  modules: PermissionModuleInfo[];
}

export const getRoles = (restaurantId: string) =>
  apiFetch<RolesListResponse>("/roles", restaurantId);

export const createRole = async (restaurantId: string, body: { name: string; description?: string; permissions: string[]; allOutlets?: boolean }) => {
  const res = await apiFetch<any>("/roles", restaurantId, { method: "POST", body: JSON.stringify(body) });
  return (res?.role || res) as RoleItem;
};

export const updateRole = async (restaurantId: string, id: string, body: { name?: string; description?: string; permissions?: string[]; allOutlets?: boolean }) => {
  const res = await apiFetch<any>(`/roles/${id}`, restaurantId, { method: "PUT", body: JSON.stringify(body) });
  return (res?.role || res) as RoleItem;
};

export const deleteRole = (restaurantId: string, id: string) =>
  apiFetch<{ success: boolean; message: string }>(`/roles/${id}`, restaurantId, { method: "DELETE" });

export const resetRolePermissions = async (restaurantId: string, id: string) => {
  const res = await apiFetch<any>(`/roles/${id}/reset`, restaurantId, { method: "POST" });
  return (res?.role || res) as RoleItem;
};

// ─── Staff ───────────────────────────────────────────────────────────────────

export const listStaff = (restaurantId: string) =>
  apiFetch<any[]>("/staff", restaurantId);

export const addStaff = (
  restaurantId: string,
  body: { name?: string; phone: string; role: string; outletIds: string[] }
) =>
  apiFetch<any>("/staff", restaurantId, { method: "POST", body: JSON.stringify(body) });

export const inviteStaff = addStaff;

export const updateStaff = (
  restaurantId: string,
  staffId: string,
  body: { name?: string; role?: string; outletIds?: string[]; status?: "ACTIVE" | "INACTIVE" }
) =>
  apiFetch<any>(`/staff/${staffId}`, restaurantId, { method: "PUT", body: JSON.stringify(body) });

export const removeStaff = (restaurantId: string, staffId: string) =>
  apiFetch<any>(`/staff/${staffId}`, restaurantId, { method: "DELETE" });

// ─── Tables ──────────────────────────────────────────────────────────────────

export const getTables = (restaurantId: string, outletId?: string, includeInactive?: boolean) => {
  const params = new URLSearchParams();
  if (outletId) params.set("outletId", outletId);
  if (includeInactive) params.set("includeInactive", "true");
  const qs = params.toString();
  return apiFetch<any[]>(`/tables${qs ? `?${qs}` : ""}`, restaurantId, {}, outletId);
};

export const createTable = (restaurantId: string, body: { outletId: string; name: string; section?: string; capacity?: number }) =>
  apiFetch<any>("/tables", restaurantId, { method: "POST", body: JSON.stringify(body) }, body.outletId);

export const updateTable = (restaurantId: string, tableId: string, body: any, outletId?: string) =>
  apiFetch<any>(`/tables/${tableId}`, restaurantId, { method: "PUT", body: JSON.stringify(body) }, outletId);

export const toggleTable = (restaurantId: string, tableId: string, outletId?: string) =>
  apiFetch<any>(`/tables/${tableId}/toggle`, restaurantId, { method: "PATCH" }, outletId);

export const deleteTable = (restaurantId: string, tableId: string, outletId?: string) =>
  apiFetch<any>(`/tables/${tableId}`, restaurantId, { method: "DELETE" }, outletId);

// ─── Reports ─────────────────────────────────────────────────────────────────

export type ReportType =
  | "summary"
  | "invoice-detail"
  | "item-wise-invoice"
  | "sales-report"
  | "average-order-value"
  | "gross-report"
  | "top-items"
  | "net-sales-report"
  | "sales-by-hour"
  | "hourly"
  | "sales-by-day"
  | "daily-trend"
  | "sales-by-month"
  | "sales-by-order-type"
  | "orders-by-status"
  | "sales-by-table"
  | "payment-methods"
  | "discount-report"
  | "void-invoices"
  | "cancelled-invoices";

export const getReport = (restaurantId: string, type: ReportType, from: string, to: string, outletId?: string | null) => {
  const qs = new URLSearchParams({ from, to, ...(outletId ? { outletId } : {}) }).toString();
  return apiFetch<{ type: string; from: string; to: string; outletId: string | null; data: any }>(
    `/reports/${type}?${qs}`,
    restaurantId,
    {},
    outletId,
  );
};

// ─── Onboarding ───────────────────────────────────────────────────────────────

export const createRestaurant = async (body: { name: string; address: string; phone?: string; outletName?: string }) => {
  const res = await fetch(`${API_BASE}/onboarding/restaurant`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err?.message || `HTTP ${res.status}`);
  }
  return res.json();
};

// ─── Customers ────────────────────────────────────────────────────────────────

export interface CustomerProfileData {
  customer: {
    phone: string;
    rawPhone: string;
    name: string | null;
    email: string | null;
    image: string | null;
    tags: string[];
    notes: string;
  };
  scope: {
    filterOutletId: string | null;
    activeOutletName: string;
    restaurantName: string;
  };
  metrics: {
    totalOrdersCount: number;
    completedOrdersCount: number;
    cancelledOrdersCount: number;
    openOrdersCount: number;
    lifetimeSpendPaise: number;
    averageOrderValuePaise: number;
    highestOrderPaise: number;
    firstVisitAt: string | null;
    lastVisitAt: string | null;
    daysSinceLastVisit: number | null;
    visitFrequencyDays: number | null;
    dineInCount: number;
    takeawayCount: number;
    deliveryCount?: number;
    preferredDineMode: "Dine-In" | "Takeaway" | "Delivery";
    preferredTable: string | null;
    preferredPaymentMethod: string | null;
    paymentMethodsBreakdown: Array<{ method: string; count: number; totalPaise: number }>;
    mostVisitedDay?: string | null;
    mostVisitedDayCount?: number;
    visitedDaysBreakdown?: Array<{ day: string; short: string; count: number; percentage: number }>;
    dietaryPreference: {
      vegCount: number;
      nonVegCount: number;
      totalDishes: number;
      primary: "Veg" | "Non-Veg" | "Mixed";
    };
  };
  overallChainMetrics: {
    totalChainOrders: number;
    totalChainSpendPaise: number;
    outletBreakdown: Array<{
      outletId: string;
      outletName: string;
      ordersCount: number;
      totalSpendPaise: number;
      lastVisit: string | null;
    }>;
  };
  favoriteItems: Array<{
    itemId: string;
    name: string;
    isNonVeg: boolean;
    qty: number;
    totalSpendPaise: number;
    orderCount: number;
    lastOrderedAt: string;
  }>;
  orders: Array<{
    id: string;
    orderNo: number;
    outletId: string;
    outletName: string;
    tableNo: string;
    orderType?: string;
    customerPhone: string | null;
    status: string;
    orderStatus: string;
    subtotalPaise: number;
    paidPaise: number;
    method: string | null;
    note: string | null;
    createdAt: string | null;
    settledAt: string | null;
    itemsCount: number;
    items: Array<{
      id: string;
      itemId: string;
      name: string;
      pricePaise: number;
      qty: number;
      variant?: any;
      addons?: any[];
      status: string;
      paymentStatus: string;
      round: number;
      note?: string;
    }>;
  }>;
}

export const getCustomerProfile = (
  restaurantId: string,
  phone: string,
  outletId?: string | null
) => {
  const qs = outletId ? `?outletId=${encodeURIComponent(outletId)}` : "";
  return apiFetch<CustomerProfileData>(
    `/customers/${encodeURIComponent(phone)}${qs}`,
    restaurantId,
    {},
    outletId
  );
};

export const updateCustomerNotes = (
  restaurantId: string,
  phone: string,
  body: { notes?: string; tags?: string[] },
  outletId?: string | null
) =>
  apiFetch<{ success: boolean; notes: string; tags: string[] }>(
    `/customers/${encodeURIComponent(phone)}/notes`,
    restaurantId,
    { method: "PUT", body: JSON.stringify(body) },
    outletId
  );

export const sendCustomerWhatsApp = (
  restaurantId: string,
  phone: string,
  body: { message: string },
  outletId?: string | null
) =>
  apiFetch<{ success: boolean; waResponse: any }>(
    `/customers/${encodeURIComponent(phone)}/whatsapp`,
    restaurantId,
    { method: "POST", body: JSON.stringify(body) },
    outletId
  );

export interface CrmCustomerItem {
  id: string;
  phone: string;
  displayPhone: string;
  name: string | null;
  email: string | null;
  dob: string | null;
  anniversary: string | null;
  gender: string | null;
  address: string | null;
  tags: string[];
  notes: string | null;
  dietaryPreference: "VEG" | "NON_VEG" | "MIXED" | "UNKNOWN";
  preferredChannel: "DINE_IN" | "TAKEAWAY" | "DELIVERY" | null;
  totalOrders: number;
  totalSpendPaise: number;
  avgOrderPaise: number;
  firstVisitAt: string | null;
  lastVisitAt: string | null;
  daysSinceLastVisit: number;
  isBlacklisted: boolean;
  createdAt: string | null;
  segments: string[];
  isVip: boolean;
  isRegular: boolean;
  isNew: boolean;
  isAtRisk: boolean;
  isInactive: boolean;
  isHighSpend: boolean;
  isVeg: boolean;
  isNonVeg: boolean;
  isDelivery: boolean;
}

export interface CrmDirectoryResponse {
  customers: CrmCustomerItem[];
  totalCount: number;
  metrics: {
    totalGuests: number;
    vipGuests: number;
    regularGuests: number;
    newGuests: number;
    atRiskGuests: number;
    inactiveGuests: number;
    highSpendGuests: number;
    repeatRate: number;
    totalLifetimeSpendPaise: number;
    avgGuestSpendPaise: number;
  };
  segmentCounts: Record<string, number>;
  limit: number;
  offset: number;
}

export interface CreateCustomerInput {
  phone: string;
  name?: string | null;
  email?: string | null;
  dob?: string | null;
  anniversary?: string | null;
  gender?: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY" | null;
  address?: string | null;
  tags?: string[];
  notes?: string | null;
  dietaryPreference?: "VEG" | "NON_VEG" | "MIXED" | "UNKNOWN";
  preferredChannel?: "DINE_IN" | "TAKEAWAY" | "DELIVERY" | null;
}

export interface BroadcastWhatsAppInput {
  message: string;
  segment?: string;
  phoneNumbers?: string[];
  testOnly?: boolean;
}

export const getCustomersDirectory = (
  restaurantId: string,
  params?: {
    search?: string;
    segment?: string;
    outletId?: string | null;
    sortBy?: string;
    limit?: number;
    offset?: number;
  },
  outletId?: string | null
) => {
  const q = new URLSearchParams();
  if (params?.search) q.set("search", params.search);
  if (params?.segment) q.set("segment", params.segment);
  if (params?.outletId || outletId) q.set("outletId", (params?.outletId || outletId)!);
  if (params?.sortBy) q.set("sortBy", params.sortBy);
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.offset) q.set("offset", String(params.offset));
  const qs = q.toString() ? `?${q.toString()}` : "";
  return apiFetch<CrmDirectoryResponse>(`/customers${qs}`, restaurantId, {}, outletId);
};

export const createCrmCustomer = (
  restaurantId: string,
  body: CreateCustomerInput,
  outletId?: string | null
) =>
  apiFetch<CrmCustomerItem>("/customers", restaurantId, { method: "POST", body: JSON.stringify(body) }, outletId);

export const updateCrmCustomer = (
  restaurantId: string,
  id: string,
  body: Partial<CreateCustomerInput>,
  outletId?: string | null
) =>
  apiFetch<CrmCustomerItem>(`/customers/${id}`, restaurantId, { method: "PUT", body: JSON.stringify(body) }, outletId);

export const broadcastWhatsApp = (
  restaurantId: string,
  body: BroadcastWhatsAppInput,
  outletId?: string | null
) =>
  apiFetch<any>("/customers/broadcast-whatsapp", restaurantId, { method: "POST", body: JSON.stringify(body) }, outletId);


// ─── Customer Portal API ─────────────────────────────────────────────────────

export interface CustomerOrderItem {
  id: string;
  itemId?: string;
  name: string;
  pricePaise: number;
  qty: number;
  variant?: any;
  addons?: any;
  status?: string;
  round?: number;
  note?: string;
  isNonVeg?: boolean;
  createdAt?: string | null;
}

export interface CustomerPortalOrder {
  id: string;
  orderNo?: number;
  tokenNo: number | null;
  restaurantId: string;
  restaurantName: string;
  restaurantPhone: string | null;
  outletId: string;
  outletName: string;
  outletAddress: string | null;
  outletPhone?: string | null;
  tableNo: string;
  status: string;
  orderStatus?: string;
  subtotalPaise: number;
  paidPaise: number;
  method: string;
  note?: string | null;
  createdAt: string | null;
  settledAt: string | null;
  itemsCount: number;
  maxRound?: number;
  progress?: {
    totalQty: number;
    servedQty: number;
    preparedQty: number;
    preparingQty: number;
    orderedQty: number;
    percentComplete: number;
  };
  items: CustomerOrderItem[];
  orderType?: "DINE_IN" | "TAKEAWAY" | "DELIVERY" | string;
  packagingChargePaise?: number;
  deliveryChargePaise?: number;
  delivery?: DeliveryDetails | null;
  activeWaiterRequest?: {
    id: string;
    serviceType: string;
    serviceLabel: string;
    note?: string | null;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    createdAt: string | null;
    updatedAt: string | null;
    completedAt: string | null;
  } | null;
  qrMenuSettings?: {
    allowCustomerOrdering?: boolean;
    requireCustomerAuth?: boolean;
    allowCallWaiter?: boolean;
    allowPayAtTable?: boolean;
    allowOrderNotes?: boolean;
    welcomeMessage?: string;
  } | null;
  diningSettings?: {
    dineInEnabled?: boolean;
    takeawayEnabled?: boolean;
    deliveryEnabled?: boolean;
    defaultOrderType?: string;
    packagingChargePaise?: number;
    deliveryFeePaise?: number;
    freeDeliveryThresholdPaise?: number;
    minDeliveryOrderPaise?: number;
  } | null;
  outlet?: {
    id: string;
    name: string;
    address?: string | null;
    phone?: string | null;
    restaurantName?: string | null;
    upiId?: string | null;
    qrMenuSettings?: any;
    diningSettings?: any;
  } | null;
  feedback?: OrderFeedbackData | null;
}

export interface CustomerMenuItem {
  id: string;
  categoryId: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  pricePaise: number;
  isNonVeg: boolean;
  variants: Array<{ id: string; name: string; pricePaise: number }>;
  addons: Array<{ id: string; name: string; pricePaise: number }>;
  ratingAvg?: number | null;
  ratingCount?: number | null;
}

export interface CustomerMenuCategory {
  id: string;
  name: string;
  description?: string | null;
  sortOrder?: number;
}

export interface CustomerMenuResponse {
  outlet: { id: string; name: string };
  categories: CustomerMenuCategory[];
  items: CustomerMenuItem[];
}

export interface CustomerPortalData {
  customer: {
    id: string;
    name?: string | null;
    phone: string;
    rawPhone: string;
    email?: string | null;
    loyaltyTier: string;
    dietaryPreference: string;
  };
  activeOrders: CustomerPortalOrder[];
  pastOrders: CustomerPortalOrder[];
  stats: {
    lifetimeSpendPaise: number;
    totalOrdersCount: number;
    activeOrdersCount: number;
    completedOrdersCount: number;
    favoriteDishes: Array<{
      itemId: string;
      name: string;
      isNonVeg: boolean;
      qty: number;
      totalSpendPaise: number;
      orderCount: number;
    }>;
    vegItemsCount: number;
    nonVegItemsCount: number;
  };
}

export const getCustomerPortal = async (): Promise<CustomerPortalData> => {
  const res = await fetch(`${API_BASE}/portal/session`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err?.message || `HTTP ${res.status}`);
  }
  return res.json();
};

export const updateCustomerProfile = async (body: {
  name?: string;
  email?: string;
}): Promise<{ success: boolean; message: string }> => {
  const res = await fetch(`${API_BASE}/portal/update-profile`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err?.message || `HTTP ${res.status}`);
  }
  return res.json();
};

export const getCustomerOutletMenu = async (outletId: string): Promise<CustomerMenuResponse> => {
  const res = await fetch(`${API_BASE}/portal/menu/${encodeURIComponent(outletId)}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err?.message || `HTTP ${res.status}`);
  }
  return res.json();
};

export const addCustomerOrderItems = async (
  orderId: string,
  body: {
    items: Array<{
      itemId: string;
      qty: number;
      variantId?: string;
      addonIds?: string[];
      note?: string;
    }>;
    roundNote?: string;
  }
): Promise<{ success: boolean; message: string; round: number; addedCount: number; subtotalPaise: number }> => {
  const res = await fetch(`${API_BASE}/portal/add-round`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ orderId, items: body.items, roundNote: body.roundNote }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err?.message || `HTTP ${res.status}`);
  }
  return res.json();
};

export const callWaiterAssistance = async (
  orderId: string,
  body: {
    serviceType: "WATER" | "CUTLERY" | "BILL" | "CLEAN_TABLE" | "OTHER";
    note?: string;
    outletId?: string;
    tableNo?: string;
  }
): Promise<{ success: boolean; message: string; serviceType: string; serviceLabel: string; timestamp: number }> => {
  const res = await fetch(`${API_BASE}/portal/call-waiter`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ orderId, ...body }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err?.message || `HTTP ${res.status}`);
  }
  return res.json();
};

// ─── Waiter Requests & Floor Assistance ──────────────────────────────────────

export const getWaiterRequests = (
  restaurantId: string,
  outletId?: string | null,
  params?: { status?: string; tableNo?: string; limit?: number }
) => {
  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params ?? {})
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    )
  ).toString();
  return apiFetch<any[]>(`/waiter/active-requests${qs ? `?${qs}` : ""}`, restaurantId, {}, outletId);
};

export const getWaiterStats = (restaurantId: string, outletId?: string | null) =>
  apiFetch<any>(`/waiter/stats`, restaurantId, {}, outletId);

export const createWaiterRequest = (
  restaurantId: string,
  body: {
    outletId?: string;
    tableNo: string;
    serviceType: "WATER" | "CUTLERY" | "BILL" | "CLEAN_TABLE" | "OTHER";
    serviceLabel?: string;
    note?: string;
    orderId?: string;
    customerPhone?: string;
  },
  outletId?: string | null
) =>
  apiFetch<any>(
    "/waiter/call-assistance",
    restaurantId,
    { method: "POST", body: JSON.stringify({ ...body, outletId: outletId || body.outletId }) },
    outletId || body.outletId
  );

export const updateWaiterRequestStatus = (
  restaurantId: string,
  requestId: string,
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED",
  outletId?: string | null
) =>
  apiFetch<any>(
    "/waiter/update-request-status",
    restaurantId,
    { method: "POST", body: JSON.stringify({ requestId, status }) },
    outletId
  );

// ─── Delivery Module ──────────────────────────────────────────────────────────

export const getCustomerAddresses = (restaurantId: string, phone: string, outletId?: string | null) =>
  apiFetch<CustomerAddress[]>(`/delivery/customer-addresses/${encodeURIComponent(phone)}`, restaurantId, {}, outletId);

export const saveCustomerAddress = (restaurantId: string, body: any, outletId?: string | null) =>
  apiFetch<CustomerAddress>("/delivery/save-address", restaurantId, { method: "POST", body: JSON.stringify(body) }, outletId);

export const getDeliveryRiders = (restaurantId: string, outletId?: string | null) =>
  apiFetch<DeliveryRider[]>(`/delivery/riders${outletId ? `?outletId=${outletId}` : ""}`, restaurantId, {}, outletId);

export const createDeliveryRider = (restaurantId: string, body: any, outletId?: string | null) =>
  apiFetch<DeliveryRider>("/delivery/register-rider", restaurantId, { method: "POST", body: JSON.stringify(body) }, outletId ?? body.outletId);

export const updateDeliveryStatus = (
  restaurantId: string,
  orderId: string,
  body: {
    status: "ASSIGNED" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";
    riderId?: string;
    deliveryOtp?: string;
    failedReason?: string;
  },
  outletId?: string | null
) => {
  if (body.status === "DELIVERED" || body.deliveryOtp) {
    return apiFetch<DeliveryDetails>(
      "/delivery/verify-otp-and-complete",
      restaurantId,
      { method: "POST", body: JSON.stringify({ orderId, deliveryOtp: body.deliveryOtp }) },
      outletId
    );
  }
  if (body.status === "OUT_FOR_DELIVERY") {
    return apiFetch<DeliveryDetails>(
      "/delivery/dispatch-order",
      restaurantId,
      { method: "POST", body: JSON.stringify({ orderId }) },
      outletId
    );
  }
  return apiFetch<DeliveryDetails>(
    "/delivery/assign-rider",
    restaurantId,
    { method: "POST", body: JSON.stringify({ orderId, riderId: body.riderId }) },
    outletId
  );
};

export const updateDeliveryRiderStatus = (
  restaurantId: string,
  riderId: string,
  status: "AVAILABLE" | "ON_DELIVERY" | "OFFLINE",
  outletId?: string | null
) =>
  apiFetch<DeliveryRider>(
    "/delivery/update-rider-duty",
    restaurantId,
    { method: "POST", body: JSON.stringify({ riderId, status }) },
    outletId
  );

// ─── Reservations ─────────────────────────────────────────────────────────────

export interface TableReservation {
  id: string;
  restaurantId: string;
  outletId: string;
  tableId?: string | null;
  tableName?: string | null;
  guestName: string;
  guestPhone: string;
  guestEmail?: string | null;
  partySize: number;
  reservationDate: string;
  startTime: string;
  endTime?: string | null;
  status: "CONFIRMED" | "SEATED" | "CANCELLED" | "COMPLETED";
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const getReservations = (
  restaurantId: string,
  params?: { outletId?: string | null; date?: string; status?: string }
) => {
  const query = new URLSearchParams();
  if (params?.outletId) query.set("outletId", params.outletId);
  if (params?.date) query.set("date", params.date);
  if (params?.status) query.set("status", params.status);
  const qs = query.toString();
  return apiFetch<TableReservation[]>(
    `/reservations${qs ? `?${qs}` : ""}`,
    restaurantId,
    {},
    params?.outletId || undefined
  );
};

export const createReservation = (
  restaurantId: string,
  body: {
    outletId: string;
    tableId?: string | null;
    tableName?: string | null;
    guestName: string;
    guestPhone: string;
    guestEmail?: string | null;
    partySize: number;
    reservationDate: string;
    startTime: string;
    endTime?: string | null;
    notes?: string | null;
  }
) =>
  apiFetch<TableReservation>(
    "/reservations",
    restaurantId,
    { method: "POST", body: JSON.stringify(body) },
    body.outletId
  );

export const updateReservation = (
  restaurantId: string,
  id: string,
  body: Partial<{
    tableId?: string | null;
    tableName?: string | null;
    guestName?: string;
    guestPhone?: string;
    guestEmail?: string | null;
    partySize?: number;
    reservationDate?: string;
    startTime?: string;
    endTime?: string | null;
    status?: "CONFIRMED" | "SEATED" | "CANCELLED" | "COMPLETED";
    notes?: string | null;
  }>,
  outletId?: string | null
) =>
  apiFetch<TableReservation>(
    `/reservations/${id}`,
    restaurantId,
    { method: "PATCH", body: JSON.stringify(body) },
    outletId || undefined
  );

export const deleteReservation = (
  restaurantId: string,
  id: string,
  outletId?: string | null
) =>
  apiFetch<{ success: boolean; message: string }>(
    `/reservations/${id}`,
    restaurantId,
    { method: "DELETE" },
    outletId || undefined
  );

// ─── Inventory Module ─────────────────────────────────────────────────────────

export interface InventoryItem {
  id: string;
  restaurantId: string;
  outletId: string;
  name: string;
  sku?: string | null;
  category: string;
  baseUom: string;
  purchaseUom?: string | null;
  purchaseConversionFactor?: number | null;
  costPerBaseUnitPaise: number;
  currentStock: number;
  lowStockThreshold?: number | null;
  idealStock?: number | null;
  supplierId?: string | null;
  supplierName?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeIngredient {
  id?: string;
  ingredientId: string;
  ingredientName?: string;
  category?: string;
  baseUom?: string;
  quantity: number;
  wastePercent?: number;
  costPerBaseUnitPaise?: number;
  lineCostPaise?: number;
  variantId?: string | null;
  addonId?: string | null;
}

export interface DishRecipeDetail {
  menuItemId: string;
  menuItemName: string;
  pricePaise: number;
  variants: any[];
  addons: any[];
  totalCostPaise: number;
  foodCostPercent: number;
  grossMarginPercent: number;
  ingredients: RecipeIngredient[];
}

export interface DishRecipeSummary {
  id: string;
  name: string;
  categoryName: string;
  pricePaise: number;
  hasRecipe: boolean;
  ingredientCount: number;
  totalCostPaise: number;
  foodCostPercent: number;
  grossMarginPercent: number;
}

export interface InventoryTransaction {
  id: string;
  restaurantId: string;
  outletId: string;
  ingredientId: string;
  ingredientName?: string;
  baseUom?: string;
  type: string;
  quantity: number;
  balanceAfter: number;
  unitCostPaise?: number | null;
  referenceId?: string | null;
  referenceNote?: string | null;
  createdAt: string;
  createdBy?: string | null;
}

export interface PurchaseOrder {
  id: string;
  restaurantId: string;
  outletId: string;
  supplierId?: string | null;
  supplierName?: string;
  poNumber: string;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  status: string;
  totalAmountPaise: number;
  notes?: string | null;
  receivedAt?: string | null;
  createdAt: string;
  createdBy?: string | null;
}

export interface InventorySupplier {
  id: string;
  restaurantId: string;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
  address?: string | null;
  paymentTerms?: string | null;
  active: boolean;
  createdAt: string;
}

export interface InventoryOverview {
  totalStockValuePaise: number;
  totalItemsCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  todayConsumptionPaise: number;
  todayWastagePaise: number;
  inventorySettings: InventorySettings;
}

export interface InventorySettings {
  enabled: boolean;
  autoDeductOn: "ON_ORDER" | "ON_SETTLE" | "MANUAL";
  allowNegativeStock: boolean;
  lowStockAlerts: boolean;
  auto86OnDepletion: boolean;
}

export const getInventoryOverview = (restaurantId: string, outletId?: string | null) =>
  apiFetch<InventoryOverview>(
    `/inventory/overview${outletId ? `?outletId=${outletId}` : ""}`,
    restaurantId,
    {},
    outletId || undefined
  );

export const getInventoryItems = (
  restaurantId: string,
  outletId?: string | null,
  category?: string,
  lowStock?: boolean
) => {
  const params = new URLSearchParams();
  if (outletId) params.set("outletId", outletId);
  if (category) params.set("category", category);
  if (lowStock) params.set("lowStock", "true");
  const q = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<InventoryItem[]>(`/inventory/items${q}`, restaurantId, {}, outletId || undefined);
};

export const createInventoryItem = (restaurantId: string, outletId: string, data: any) =>
  apiFetch<InventoryItem>(
    `/inventory/items`,
    restaurantId,
    { method: "POST", body: JSON.stringify(data) },
    outletId
  );

export const updateInventoryItem = (restaurantId: string, id: string, data: any, outletId?: string | null) =>
  apiFetch<InventoryItem>(
    `/inventory/items/${id}`,
    restaurantId,
    { method: "PATCH", body: JSON.stringify(data) },
    outletId || undefined
  );

export const deleteInventoryItem = (restaurantId: string, id: string, outletId?: string | null) =>
  apiFetch<{ success: boolean; message: string }>(
    `/inventory/items/${id}`,
    restaurantId,
    { method: "DELETE" },
    outletId || undefined
  );

export const getMenuRecipes = (restaurantId: string, outletId?: string | null) =>
  apiFetch<DishRecipeSummary[]>(
    `/inventory/recipes${outletId ? `?outletId=${outletId}` : ""}`,
    restaurantId,
    {},
    outletId || undefined
  );

export const getMenuRecipe = (restaurantId: string, menuItemId: string, outletId?: string | null) =>
  apiFetch<DishRecipeDetail>(
    `/inventory/recipes/${menuItemId}`,
    restaurantId,
    {},
    outletId || undefined
  );

export const saveMenuRecipe = (restaurantId: string, menuItemId: string, ingredients: any[], outletId?: string | null) =>
  apiFetch<{ success: boolean; count: number }>(
    `/inventory/recipes/${menuItemId}`,
    restaurantId,
    { method: "PUT", body: JSON.stringify({ ingredients }) },
    outletId || undefined
  );

export const adjustInventoryStock = (restaurantId: string, data: { ingredientId: string; newStock: number; reason: string }, outletId?: string | null) =>
  apiFetch<{ success: boolean; previousStock: number; newStock: number; difference: number }>(
    `/inventory/adjust`,
    restaurantId,
    { method: "POST", body: JSON.stringify(data) },
    outletId || undefined
  );

export const logInventoryWastage = (restaurantId: string, data: { ingredientId: string; quantity: number; reason: string }, outletId?: string | null) =>
  apiFetch<{ success: boolean; quantityWasted: number; remainingStock: number }>(
    `/inventory/wastage`,
    restaurantId,
    { method: "POST", body: JSON.stringify(data) },
    outletId || undefined
  );

export const getInventoryTransactions = (
  restaurantId: string,
  outletId?: string | null,
  ingredientId?: string,
  type?: string
) => {
  const params = new URLSearchParams();
  if (outletId) params.set("outletId", outletId);
  if (ingredientId) params.set("ingredientId", ingredientId);
  if (type) params.set("type", type);
  const q = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<InventoryTransaction[]>(`/inventory/transactions${q}`, restaurantId, {}, outletId || undefined);
};

export const getPurchaseOrders = (restaurantId: string, outletId?: string | null) =>
  apiFetch<PurchaseOrder[]>(
    `/inventory/purchases${outletId ? `?outletId=${outletId}` : ""}`,
    restaurantId,
    {},
    outletId || undefined
  );

export const createPurchaseOrder = (restaurantId: string, outletId: string, data: any) =>
  apiFetch<PurchaseOrder>(
    `/inventory/purchases`,
    restaurantId,
    { method: "POST", body: JSON.stringify(data) },
    outletId
  );

export const getInventorySuppliers = (restaurantId: string) =>
  apiFetch<InventorySupplier[]>(`/inventory/suppliers`, restaurantId);

export const createInventorySupplier = (restaurantId: string, data: any) =>
  apiFetch<InventorySupplier>(
    `/inventory/suppliers`,
    restaurantId,
    { method: "POST", body: JSON.stringify(data) }
  );

export const updateInventorySupplier = (restaurantId: string, id: string, data: any) =>
  apiFetch<InventorySupplier>(
    `/inventory/suppliers/${id}`,
    restaurantId,
    { method: "PATCH", body: JSON.stringify(data) }
  );

export const getInventorySettings = (restaurantId: string, outletId: string) =>
  apiFetch<InventorySettings>(
    `/inventory/settings?outletId=${outletId}`,
    restaurantId,
    {},
    outletId
  );

export const updateInventorySettings = (restaurantId: string, outletId: string, data: Partial<InventorySettings>) =>
  apiFetch<InventorySettings>(
    `/inventory/settings`,
    restaurantId,
    { method: "PATCH", body: JSON.stringify(data) },
    outletId
  );

// ─── Relay Gateway Integrations (Swiggy, Zomato, ONDC, Magicpin) ──────────────

const RELAY_BASE = process.env.NEXT_PUBLIC_RELAY_URL || "https://relay.logixsoft.in";

export interface ChannelIntegration {
  channelCode: "SWIGGY" | "ZOMATO" | "MAGICPIN" | "ONDC" | string;
  channelName: string;
  isActiveChannel: boolean;
  isConfigured: boolean;
  merchantStoreId: string | null;
  isOnline: boolean;
  autoAcceptOrders: boolean;
  defaultPrepMinutes: number;
  channelPriceMarkupPercent: number;
  credentials?: {
    apiKey?: string;
    apiSecret?: string;
    webhookSecret?: string;
    bppId?: string;
    bppUri?: string;
    [key: string]: any;
  } | null;
  updatedAt?: string | null;
}

export interface WebhookUrlsResponse {
  instructions: string;
  webhooks: {
    SWIGGY?: {
      partnerPortal: string;
      orderWebhookUrl: string;
      riderStatusWebhookUrl: string;
      requiredHeaders?: string;
    };
    ZOMATO?: {
      partnerPortal: string;
      orderWebhookUrl: string;
      riderStatusWebhookUrl: string;
      requiredHeaders?: string;
    };
    MAGICPIN?: {
      partnerPortal: string;
      orderWebhookUrl: string;
    };
    ONDC?: {
      protocol: string;
      bppUri: string;
      supportedActions: string[];
    };
    DIRECT_D2C?: {
      ownlyWebhookUrl: string;
      toingWebhookUrl: string;
    };
  };
}

export async function fetchOutletIntegrations(
  outletId: string
): Promise<{ outletId: string; integrations: ChannelIntegration[] }> {
  const res = await fetch(`${RELAY_BASE}/outlets/${encodeURIComponent(outletId)}/integrations`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function saveOutletIntegration(
  outletId: string,
  data: {
    channelCode: string;
    merchantStoreId?: string;
    credentials?: Record<string, string>;
    isOnline?: boolean;
    autoAcceptOrders?: boolean;
    defaultPrepMinutes?: number;
    channelPriceMarkupPercent?: number;
  }
): Promise<{ success: boolean; message: string; integration: ChannelIntegration }> {
  const res = await fetch(`${RELAY_BASE}/outlets/${encodeURIComponent(outletId)}/integrations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchOutletWebhookUrls(
  outletId: string
): Promise<WebhookUrlsResponse> {
  const res = await fetch(`${RELAY_BASE}/outlets/${encodeURIComponent(outletId)}/webhook-urls`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Feedback & Reviews ────────────────────────────────────────────────────────

export interface OrderItemFeedbackItem {
  id?: string;
  menuItemId: string;
  itemName?: string;
  rating: number;
  comment?: string | null;
}

export interface OrderFeedbackData {
  id: string;
  orderId: string;
  orderNo?: number;
  tableNo?: string;
  orderType?: string;
  customerName?: string;
  customerPhone?: string;
  isAnonymous: boolean;
  rating: number;
  foodRating?: number | null;
  serviceRating?: number | null;
  deliveryRating?: number | null;
  tags?: string[];
  comment?: string | null;
  ownerReply?: string | null;
  ownerRepliedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: OrderItemFeedbackItem[];
  itemRatings?: OrderItemFeedbackItem[];
}

export interface FeedbackSummaryResponse {
  summary: {
    totalReviews: number;
    averageRating: number;
    distribution: Record<number, number>;
    categoryAverages: {
      food: number | null;
      service: number | null;
      delivery: number | null;
    };
    topTags: Array<{ tag: string; count: number }>;
    topItems: Array<{ id: string; name: string; ratingAvg: number; ratingCount: number }>;
    needsAttentionItems: Array<{ id: string; name: string; ratingAvg: number; ratingCount: number }>;
  };
  reviews: OrderFeedbackData[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const getOwnerFeedback = (
  restaurantId: string,
  params?: {
    outletId?: string | null;
    rating?: number | null;
    orderType?: string | null;
    search?: string | null;
    page?: number;
    limit?: number;
  }
) => {
  const query = new URLSearchParams();
  if (params?.outletId) query.set("outletId", params.outletId);
  if (params?.rating) query.set("rating", String(params.rating));
  if (params?.orderType) query.set("orderType", params.orderType);
  if (params?.search) query.set("search", params.search);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));

  const qs = query.toString();
  return apiFetch<FeedbackSummaryResponse>(
    `/feedback${qs ? `?${qs}` : ""}`,
    restaurantId,
    {},
    params?.outletId
  );
};

export const replyToFeedback = (
  restaurantId: string,
  reviewId: string,
  reply: string,
  outletId?: string | null
) =>
  apiFetch<{ success: boolean; message: string; ownerReply: string; ownerRepliedAt: string }>(
    `/feedback/${reviewId}/reply`,
    restaurantId,
    { method: "POST", body: JSON.stringify({ reply }) },
    outletId
  );

export const submitOrderFeedback = (data: {
  orderId: string;
  rating: number;
  foodRating?: number;
  serviceRating?: number;
  deliveryRating?: number;
  tags?: string[];
  comment?: string;
  isAnonymous?: boolean;
  itemRatings?: Array<{ itemId: string; rating: number; comment?: string }>;
}) =>
  apiFetch<{ success: boolean; message: string; reviewId: string; isUpdate: boolean }>(
    `/feedback/submit`,
    "", // Uses session cookie
    { method: "POST", body: JSON.stringify(data) }
  );

export const getOrderFeedback = (orderId: string) =>
  apiFetch<{ feedback: OrderFeedbackData | null }>(
    `/feedback/order/${orderId}`,
    ""
  );

// ─── Finance & Petty Cash ────────────────────────────────────────────────────

export interface ExpenseRecord {
  id: string;
  restaurantId: string;
  outletId: string;
  title: string;
  category: string;
  amountPaise: number;
  paymentMode: string;
  paidTo?: string | null;
  expenseDate: string;
  notes?: string | null;
  receiptUrl?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceSummary {
  date: string;
  formattedDate: string;
  restaurantName: string;
  outletName: string;
  ownerPhone: string | null;

  grossSalesPaise: number;
  netSalesPaise: number;
  totalOrdersSettled: number;
  averageOrderValuePaise: number;

  cashSalesPaise: number;
  cashOrdersCount: number;
  upiSalesPaise: number;
  upiOrdersCount: number;
  cardSalesPaise: number;
  cardOrdersCount: number;

  dineInOrdersCount: number;
  dineInSalesPaise: number;
  takeawayOrdersCount: number;
  takeawaySalesPaise: number;
  deliveryOrdersCount: number;
  deliverySalesPaise: number;

  voidOrdersCount: number;
  voidSalesPaise: number;

  totalExpensesPaise: number;
  cashExpensesPaise: number;
  onlineExpensesPaise: number;
  categoryExpenses: Array<{ category: string; label: string; amountPaise: number; count: number }>;

  openingFloatPaise: number;
  cashInHandPaise: number;
  netProfitPaise: number;

  topItems: Array<{ name: string; qty: number; totalPaise: number }>;
}

export interface CashRegisterData {
  id?: string;
  outletId: string;
  date: string;
  openingFloatPaise: number;
  cashWithdrawnPaise: number;
  closingCountedPaise?: number | null;
  notes?: string | null;
}

export const getExpenseSummary = (
  restaurantId: string,
  outletId?: string | null,
  date?: string
) => {
  const q = new URLSearchParams();
  if (outletId) q.set("outletId", outletId);
  if (date) q.set("date", date);
  const qs = q.toString();
  return apiFetch<FinanceSummary>(
    `/expenses/summary${qs ? `?${qs}` : ""}`,
    restaurantId,
    {},
    outletId
  );
};

export const getExpenses = (
  restaurantId: string,
  params?: {
    outletId?: string | null;
    startDate?: string;
    endDate?: string;
    category?: string;
    paymentMode?: string;
    limit?: number;
    offset?: number;
  }
) => {
  const q = new URLSearchParams();
  if (params?.outletId) q.set("outletId", params.outletId);
  if (params?.startDate) q.set("startDate", params.startDate);
  if (params?.endDate) q.set("endDate", params.endDate);
  if (params?.category) q.set("category", params.category);
  if (params?.paymentMode) q.set("paymentMode", params.paymentMode);
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.offset) q.set("offset", String(params.offset));
  const qs = q.toString();
  return apiFetch<{ expenses: ExpenseRecord[]; totalPaise: number; count: number }>(
    `/expenses${qs ? `?${qs}` : ""}`,
    restaurantId,
    {},
    params?.outletId
  );
};

export const createExpense = (
  restaurantId: string,
  data: {
    title: string;
    category: string;
    amountPaise: number;
    paymentMode: string;
    paidTo?: string | null;
    expenseDate: string;
    notes?: string | null;
    receiptUrl?: string | null;
    outletId?: string;
  },
  outletId?: string | null
) =>
  apiFetch<ExpenseRecord>(
    `/expenses`,
    restaurantId,
    { method: "POST", body: JSON.stringify(data) },
    outletId
  );

export const updateExpense = (
  restaurantId: string,
  id: string,
  data: Partial<{
    title: string;
    category: string;
    amountPaise: number;
    paymentMode: string;
    paidTo?: string | null;
    expenseDate: string;
    notes?: string | null;
    receiptUrl?: string | null;
  }>,
  outletId?: string | null
) =>
  apiFetch<ExpenseRecord>(
    `/expenses/${id}`,
    restaurantId,
    { method: "PUT", body: JSON.stringify(data) },
    outletId
  );

export const deleteExpense = (
  restaurantId: string,
  id: string,
  outletId?: string | null
) =>
  apiFetch<{ success: boolean; id: string }>(
    `/expenses/${id}`,
    restaurantId,
    { method: "DELETE" },
    outletId
  );

export const getCashRegister = (
  restaurantId: string,
  outletId?: string | null,
  date?: string
) => {
  const q = new URLSearchParams();
  if (outletId) q.set("outletId", outletId);
  if (date) q.set("date", date);
  const qs = q.toString();
  return apiFetch<CashRegisterData>(
    `/expenses/cash-register${qs ? `?${qs}` : ""}`,
    restaurantId,
    {},
    outletId
  );
};

export const setCashRegister = (
  restaurantId: string,
  data: {
    date: string;
    openingFloatPaise?: number;
    cashWithdrawnPaise?: number;
    closingCountedPaise?: number | null;
    notes?: string | null;
    outletId?: string;
  },
  outletId?: string | null
) =>
  apiFetch<CashRegisterData>(
    `/expenses/cash-register`,
    restaurantId,
    { method: "POST", body: JSON.stringify(data) },
    outletId
  );

export const sendClosingReportWhatsApp = (
  restaurantId: string,
  outletId: string,
  phone?: string,
  date?: string
) =>
  apiFetch<{ success: boolean; recipientPhone: string; message: string; summary: FinanceSummary }>(
    `/expenses/send-closing-report`,
    restaurantId,
    { method: "POST", body: JSON.stringify({ outletId, phone, date }) },
    outletId
  );

export const getClosingReportPreview = (
  restaurantId: string,
  outletId: string,
  date?: string
) => {
  const q = new URLSearchParams();
  if (outletId) q.set("outletId", outletId);
  if (date) q.set("date", date);
  const qs = q.toString();
  return apiFetch<{ summary: FinanceSummary; message: string; recipientPhone: string | null }>(
    `/expenses/closing-report-preview${qs ? `?${qs}` : ""}`,
    restaurantId,
    {},
    outletId
  );
};

// ─── Marketing Campaigns ──────────────────────────────────────────────────────

export interface MarketingCampaign {
  id: string;
  restaurantId: string;
  outletId?: string | null;
  title: string;
  message: string;
  mediaUrl?: string | null;
  offerCode?: string | null;
  targetAudience: string;
  status: "DRAFT" | "SCHEDULED" | "SENDING" | "COMPLETED" | "FAILED" | "CANCELLED";
  scheduledAt?: string | null;
  sentAt?: string | null;
  completedAt?: string | null;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
  recipientCount?: number;
}

export interface CampaignRecipient {
  id: string;
  campaignId: string;
  customerId?: string | null;
  customerName?: string | null;
  phone: string;
  status: "PENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED";
  whatsappMessageId?: string | null;
  errorMessage?: string | null;
  sentAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
}

export interface CampaignsResponse {
  campaigns: MarketingCampaign[];
  summary: {
    totalCampaigns: number;
    totalMessagesSent: number;
    totalFailed: number;
    scheduledCount: number;
    successRate: number;
  };
}

export interface CampaignDetailResponse {
  campaign: MarketingCampaign;
  recipients: CampaignRecipient[];
}

export interface CreateCampaignInput {
  title: string;
  message: string;
  mediaUrl?: string;
  offerCode?: string;
  targetAudience?: "ALL" | "OUTLET";
  outletId?: string;
  scheduledAt?: string;
  sendImmediately?: boolean;
}

export interface TestCampaignInput {
  message: string;
  mediaUrl?: string;
  offerCode?: string;
  testPhone: string;
}

export const getCampaigns = (
  restaurantId: string,
  outletId?: string | null
) => {
  const q = outletId ? `?outletId=${encodeURIComponent(outletId)}` : "";
  return apiFetch<CampaignsResponse>(
    `/campaigns${q}`,
    restaurantId,
    {},
    outletId
  );
};

export const getCampaign = (
  restaurantId: string,
  campaignId: string,
  outletId?: string | null
) =>
  apiFetch<CampaignDetailResponse>(
    `/campaigns/${campaignId}`,
    restaurantId,
    {},
    outletId
  );

export const createCampaign = (
  restaurantId: string,
  data: CreateCampaignInput,
  outletId?: string | null
) =>
  apiFetch<MarketingCampaign>(
    `/campaigns`,
    restaurantId,
    { method: "POST", body: JSON.stringify(data) },
    outletId
  );

export const testCampaign = (
  restaurantId: string,
  data: TestCampaignInput,
  outletId?: string | null
) =>
  apiFetch<{ success: boolean; recipient: string; message: string; mediaUrl?: string | null }>(
    `/campaigns/test`,
    restaurantId,
    { method: "POST", body: JSON.stringify(data) },
    outletId
  );

export const sendCampaignNow = (
  restaurantId: string,
  campaignId: string,
  outletId?: string | null
) =>
  apiFetch<{ success: boolean; sentCount: number; failedCount: number }>(
    `/campaigns/${campaignId}/send`,
    restaurantId,
    { method: "POST" },
    outletId
  );

export const cancelCampaign = (
  restaurantId: string,
  campaignId: string,
  outletId?: string | null
) =>
  apiFetch<{ success: boolean }>(
    `/campaigns/${campaignId}/cancel`,
    restaurantId,
    { method: "POST" },
    outletId
  );

export const deleteCampaign = (
  restaurantId: string,
  campaignId: string,
  outletId?: string | null
) =>
  apiFetch<{ success: boolean }>(
    `/campaigns/${campaignId}`,
    restaurantId,
    { method: "DELETE" },
    outletId
  );








