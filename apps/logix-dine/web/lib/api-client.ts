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
  apiFetch<{ role: string; outletIds: string[]; allOutlets: boolean }>("/restaurants/my-role", restaurantId);

export const getOutlets = (restaurantId: string) =>
  apiFetch<any[]>("/outlets", restaurantId);

export const createOutlet = (restaurantId: string, body: { name: string; address?: string; phone?: string; upiId?: string }) =>
  apiFetch<any>("/outlets", restaurantId, { method: "POST", body: JSON.stringify(body) });

export const updateOutlet = (restaurantId: string, outletId: string, body: any) =>
  apiFetch<any>(`/outlets/${outletId}`, restaurantId, { method: "PUT", body: JSON.stringify(body) });

export const deleteOutlet = (restaurantId: string, outletId: string) =>
  apiFetch<any>(`/outlets/${outletId}`, restaurantId, { method: "DELETE" });

export const setDefaultOutlet = (restaurantId: string, outletId: string) =>
  apiFetch<any>(`/outlets/${outletId}/set-default`, restaurantId, { method: "PATCH" });

// ─── Staff ───────────────────────────────────────────────────────────────────

export const listStaff = (restaurantId: string) =>
  apiFetch<any[]>("/staff", restaurantId);

export const inviteStaff = (restaurantId: string, body: { phone: string; role: string; outletIds: string[] }) =>
  apiFetch<any>("/staff/invite", restaurantId, { method: "POST", body: JSON.stringify(body) });

export const updateStaff = (restaurantId: string, memberId: string, body: { role?: string; outletIds?: string[] }) =>
  apiFetch<any>(`/staff/${memberId}`, restaurantId, { method: "PUT", body: JSON.stringify(body) });

export const removeStaff = (restaurantId: string, memberId: string) =>
  apiFetch<any>(`/staff/${memberId}`, restaurantId, { method: "DELETE" });

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






