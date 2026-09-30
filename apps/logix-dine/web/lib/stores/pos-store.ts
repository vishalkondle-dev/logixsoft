import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartVariant {
  id: string;
  name: string;
  pricePaise: number;
}

export interface CartAddon {
  id: string;
  name: string;
  pricePaise: number;
}

export interface LocalCartItem {
  cartKey: string;
  itemId: string;
  name: string;
  pricePaise: number;
  qty: number;
  note?: string;
  variant?: CartVariant;
  addons?: CartAddon[];
}

export interface OrderAdjustment {
  id: string;
  label: string;
  value: string; // e.g. "5%" or "50" or "-10%"
  type: 'charge' | 'discount';
  amountPaise: number;
}

export function computeAdjustmentAmount(
  valueStr: string,
  isDiscount: boolean,
  itemsSubtotalPaise: number
): { amountPaise: number; isPercent: boolean; num: number } {
  const clean = (valueStr || '').trim();
  const isPercent = clean.includes('%');
  const num = parseFloat(clean.replace(/[%]/g, '').trim()) || 0;

  let paise = isPercent
    ? Math.round((itemsSubtotalPaise * Math.abs(num)) / 100)
    : Math.round(Math.abs(num) * 100);

  if (isDiscount || num < 0 || clean.startsWith('-')) {
    paise = -paise;
  }
  return { amountPaise: paise, isPercent, num };
}

export function generateCartKey(
  itemId: string,
  variantId?: string,
  addonIds?: string[]
): string {
  const parts = [itemId];
  if (variantId) parts.push(`v:${variantId}`);
  if (addonIds && addonIds.length > 0) {
    const sorted = [...addonIds].sort();
    parts.push(`a:${sorted.join(',')}`);
  }
  return parts.join('_');
}

export interface PosState {
  cart: LocalCartItem[];
  cartOpen: boolean;
  orderType: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  activeTable: string | null;
  customerPhone: string;
  customerName: string;
  customerAddress: string;
  orderNote: string;
  orderAdjustments: OrderAdjustment[];
  searchQuery: string;
  selectedCategory: string | null;
  filterVeg: boolean;
  filterNonVeg: boolean;
  paymentModalOpen: boolean;
  paymentMethod: string;
  amountReceivedPaise: number;

  // Delivery-specific details
  deliveryCustomerName: string;
  deliveryAddressLine1: string;
  deliveryLandmark: string;
  deliveryPincode: string;
  deliveryNotes: string;
  selectedRiderId: string | null;
  packagingCharge: number;
  deliveryCharge: number;

  // Actions
  setCartItems: (
    items: LocalCartItem[] | ((prev: LocalCartItem[]) => LocalCartItem[])
  ) => void;
  setCartOpen: (open: boolean) => void;
  addToCart: (
    item: { id: string; name: string; pricePaise: number },
    qty?: number,
    variant?: CartVariant,
    addons?: CartAddon[]
  ) => void;
  updateCartItemQty: (cartKey: string, qty: number) => void;
  updateCartItemNote: (cartKey: string, note: string) => void;
  removeFromCart: (cartKey: string) => void;
  clearCart: () => void;
  setOrderType: (type: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY') => void;
  setActiveTable: (tableName: string | null) => void;
  setCustomer: (phone: string, name?: string, address?: string) => void;
  clearCustomer: () => void;
  setOrderNote: (note: string) => void;
  addAdjustment: (adjustment: OrderAdjustment) => void;
  removeAdjustment: (id: string) => void;
  setOrderAdjustments: (
    adjustments: OrderAdjustment[] | ((prev: OrderAdjustment[]) => OrderAdjustment[])
  ) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (catId: string | null) => void;
  setFilterVeg: (filter: boolean) => void;
  setFilterNonVeg: (filter: boolean) => void;
  setPaymentModalOpen: (open: boolean) => void;
  setPaymentMethod: (method: string) => void;
  setAmountReceivedPaise: (amount: number) => void;
  setPackagingCharge: (charge: number) => void;
  setDeliveryCharge: (charge: number) => void;
  setDeliveryDetails: (
    details: Partial<{
      customerName: string;
      addressLine1: string;
      landmark: string;
      pincode: string;
      notes: string;
      riderId: string | null;
    }>
  ) => void;
  resetPos: () => void;

  // Computed helper getters
  getItemsSubtotalPaise: () => number;
  getTotalAdjustmentPaise: () => number;
  getGrandTotalPaise: () => number;
  getTotalItemCount: () => number;
}

export const usePosStore = create<PosState>()(
  persist(
    (set, get) => ({
      cart: [],
      cartOpen: false,
      orderType: 'DINE_IN',
      activeTable: null,
      customerPhone: '',
      customerName: '',
      customerAddress: '',
      orderNote: '',
      orderAdjustments: [],
      searchQuery: '',
      selectedCategory: null,
      filterVeg: false,
      filterNonVeg: false,
      paymentModalOpen: false,
      paymentMethod: 'CASH',
      amountReceivedPaise: 0,
      deliveryCustomerName: '',
      deliveryAddressLine1: '',
      deliveryLandmark: '',
      deliveryPincode: '',
      deliveryNotes: '',
      selectedRiderId: null,
      packagingCharge: 15,
      deliveryCharge: 40,

      setCartItems: (items) => {
        if (typeof items === 'function') {
          set((state) => ({ cart: items(state.cart) }));
        } else {
          set({ cart: items });
        }
      },

      setCartOpen: (open) => set({ cartOpen: open }),

      addToCart: (item, qty = 1, variant, addons = []) => {
        const cartKey = generateCartKey(
          item.id,
          variant?.id,
          addons.map((a) => a.id)
        );

        const basePrice = variant ? variant.pricePaise : item.pricePaise;
        const addonsTotal = addons.reduce((sum, a) => sum + a.pricePaise, 0);
        const unitPrice = basePrice + addonsTotal;

        const currentCart = get().cart;
        const existingIndex = currentCart.findIndex((c) => c.cartKey === cartKey);

        if (existingIndex > -1) {
          const updated = [...currentCart];
          updated[existingIndex] = {
            ...updated[existingIndex],
            qty: updated[existingIndex].qty + qty,
          };
          set({ cart: updated });
        } else {
          const newItem: LocalCartItem = {
            cartKey,
            itemId: item.id,
            name: item.name,
            pricePaise: unitPrice,
            qty,
            variant,
            addons,
          };
          set({ cart: [...currentCart, newItem] });
        }
      },

      updateCartItemQty: (cartKey: string, qty: number) => {
        if (qty <= 0) {
          get().removeFromCart(cartKey);
          return;
        }
        const updated = get().cart.map((c) =>
          c.cartKey === cartKey ? { ...c, qty } : c
        );
        set({ cart: updated });
      },

      updateCartItemNote: (cartKey: string, note: string) => {
        const updated = get().cart.map((c) =>
          c.cartKey === cartKey ? { ...c, note } : c
        );
        set({ cart: updated });
      },

      removeFromCart: (cartKey: string) => {
        set({ cart: get().cart.filter((c) => c.cartKey !== cartKey) });
      },

      clearCart: () => {
        set({ cart: [], orderAdjustments: [], orderNote: '' });
      },

      setOrderType: (type) => set({ orderType: type }),
      setActiveTable: (tableName) => set({ activeTable: tableName }),

      setCustomer: (phone, name = '', address = '') =>
        set({ customerPhone: phone, customerName: name, customerAddress: address }),

      clearCustomer: () =>
        set({ customerPhone: '', customerName: '', customerAddress: '' }),

      setOrderNote: (note) => set({ orderNote: note }),

      addAdjustment: (adjustment) => {
        const current = get().orderAdjustments.filter((a) => a.id !== adjustment.id);
        set({ orderAdjustments: [...current, adjustment] });
      },

      removeAdjustment: (id) => {
        set({ orderAdjustments: get().orderAdjustments.filter((a) => a.id !== id) });
      },

      setOrderAdjustments: (adjustments) => {
        if (typeof adjustments === 'function') {
          set((state) => ({ orderAdjustments: adjustments(state.orderAdjustments) }));
        } else {
          set({ orderAdjustments: adjustments });
        }
      },

      setSearchQuery: (query) => set({ searchQuery: query }),
      setSelectedCategory: (catId) => set({ selectedCategory: catId }),
      setFilterVeg: (filter) => set({ filterVeg: filter }),
      setFilterNonVeg: (filter) => set({ filterNonVeg: filter }),
      setPaymentModalOpen: (open) => set({ paymentModalOpen: open }),
      setPaymentMethod: (method) => set({ paymentMethod: method }),
      setAmountReceivedPaise: (amount) => set({ amountReceivedPaise: amount }),
      setPackagingCharge: (charge) => set({ packagingCharge: charge }),
      setDeliveryCharge: (charge) => set({ deliveryCharge: charge }),
      setDeliveryDetails: (details) =>
        set((state) => ({
          deliveryCustomerName: details.customerName ?? state.deliveryCustomerName,
          deliveryAddressLine1: details.addressLine1 ?? state.deliveryAddressLine1,
          deliveryLandmark: details.landmark ?? state.deliveryLandmark,
          deliveryPincode: details.pincode ?? state.deliveryPincode,
          deliveryNotes: details.notes ?? state.deliveryNotes,
          selectedRiderId: details.riderId !== undefined ? details.riderId : state.selectedRiderId,
        })),

      resetPos: () =>
        set({
          cart: [],
          orderType: 'DINE_IN',
          activeTable: null,
          customerPhone: '',
          customerName: '',
          customerAddress: '',
          orderNote: '',
          orderAdjustments: [],
          searchQuery: '',
          selectedCategory: null,
          filterVeg: false,
          filterNonVeg: false,
          paymentModalOpen: false,
          amountReceivedPaise: 0,
          deliveryCustomerName: '',
          deliveryAddressLine1: '',
          deliveryLandmark: '',
          deliveryPincode: '',
          deliveryNotes: '',
          selectedRiderId: null,
        }),

      getItemsSubtotalPaise: () => {
        return get().cart.reduce((sum, item) => sum + item.pricePaise * item.qty, 0);
      },

      getTotalAdjustmentPaise: () => {
        return get().orderAdjustments.reduce((sum, a) => sum + a.amountPaise, 0);
      },

      getGrandTotalPaise: () => {
        const subtotal = get().getItemsSubtotalPaise();
        const adjustments = get().getTotalAdjustmentPaise();
        return Math.max(0, subtotal + adjustments);
      },

      getTotalItemCount: () => {
        return get().cart.reduce((sum, item) => sum + item.qty, 0);
      },
    }),
    {
      name: 'logix-dine-pos-state',
      partialize: (state) => ({
        cart: state.cart,
        orderType: state.orderType,
        activeTable: state.activeTable,
        packagingCharge: state.packagingCharge,
        deliveryCharge: state.deliveryCharge,
      }),
    }
  )
);
