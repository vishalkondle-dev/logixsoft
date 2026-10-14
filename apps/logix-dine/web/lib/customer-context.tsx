"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCustomerPortal, useUpdateCustomerProfile } from "@/lib/queries";
import { useCustomerSync } from "@/lib/use-customer-sync";
import type {
  CustomerPortalData,
  CustomerPortalOrder,
  CustomerWaitlistEntry,
  CustomerReservationEntry,
} from "@/lib/api-client";
import { notifications } from "@mantine/notifications";
import { RateOrderModal } from "@/components/portal/rate-order-modal";
import { CallWaiterModal } from "@/components/portal/call-waiter-modal";
import { OrderMoreDrawer } from "@/components/portal/order-more-drawer";
import { BillBreakdownModal } from "@/components/portal/bill-breakdown-modal";
import { ReservationModal } from "@/components/portal/reservation-modal";

interface CustomerContextValue {
  data?: CustomerPortalData;
  isLoading: boolean;
  isRefetching: boolean;
  refetch: () => Promise<any>;
  activeOrders: CustomerPortalOrder[];
  activeWaitlist: CustomerWaitlistEntry[];
  activeReservations: CustomerReservationEntry[];
  pastOrders: CustomerPortalOrder[];
  customer?: CustomerPortalData["customer"];
  stats?: CustomerPortalData["stats"];
  primaryActiveOrder?: CustomerPortalOrder;
  openCallWaiter: (order?: CustomerPortalOrder) => void;
  openOrderMore: (order?: CustomerPortalOrder) => void;
  openBillBreakdown: (order?: CustomerPortalOrder) => void;
  openRateModal: (order: CustomerPortalOrder) => void;
  openReservationModal: () => void;
  shareReceiptWhatsApp: (order: CustomerPortalOrder) => void;
}

const CustomerContext = createContext<CustomerContextValue | undefined>(undefined);

export function CustomerProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [activeOutletIds, setActiveOutletIds] = useState<string[]>([]);

  // Real-time live sync via Cloudflare Durable Object WebSocket
  useCustomerSync(
    isAuthenticated ? user?.phoneNumber : null,
    { activeOutletIds }
  );

  // Poll fallback every 8 seconds if live orders are in progress
  const { data, isLoading, isRefetching, refetch } = useCustomerPortal({
    refetchInterval: (query: any) => {
      const activeCount = query.state.data?.activeOrders?.length || 0;
      return activeCount > 0 ? 8000 : false;
    },
  });

  const activeOrders = useMemo(() => data?.activeOrders || [], [data?.activeOrders]);
  const activeWaitlist = useMemo(() => data?.activeWaitlist || [], [data?.activeWaitlist]);
  const activeReservations = useMemo(() => data?.activeReservations || [], [data?.activeReservations]);
  const pastOrders = useMemo(() => data?.pastOrders || [], [data?.pastOrders]);
  const customer = data?.customer;
  const stats = data?.stats;
  const primaryActiveOrder = activeOrders[0];

  useEffect(() => {
    if (activeOrders.length > 0) {
      const ids = Array.from(new Set(activeOrders.map((o) => o.outletId).filter(Boolean)));
      setActiveOutletIds((prev) => {
        const prevKey = prev.slice().sort().join(",");
        const nextKey = ids.slice().sort().join(",");
        return prevKey === nextKey ? prev : ids;
      });
    }
  }, [activeOrders]);

  // Modals state
  const [ratingOrder, setRatingOrder] = useState<CustomerPortalOrder | null>(null);
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);

  const [waiterOrder, setWaiterOrder] = useState<CustomerPortalOrder | null>(null);
  const [isWaiterModalOpen, setIsWaiterModalOpen] = useState(false);

  const [orderMoreTarget, setOrderMoreTarget] = useState<CustomerPortalOrder | null>(null);
  const [isOrderMoreOpen, setIsOrderMoreOpen] = useState(false);

  const [billOrder, setBillOrder] = useState<CustomerPortalOrder | null>(null);
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);

  const [isReservationOpen, setIsReservationOpen] = useState(false);

  const openCallWaiter = (order?: CustomerPortalOrder) => {
    const target = order || primaryActiveOrder;
    if (!target) return;
    setWaiterOrder(target);
    setIsWaiterModalOpen(true);
  };

  const openOrderMore = (order?: CustomerPortalOrder) => {
    const target = order || primaryActiveOrder;
    if (!target) return;
    setOrderMoreTarget(target);
    setIsOrderMoreOpen(true);
  };

  const openBillBreakdown = (order?: CustomerPortalOrder) => {
    const target = order || primaryActiveOrder;
    if (!target) return;
    setBillOrder(target);
    setIsBillModalOpen(true);
  };

  const openRateModal = (order: CustomerPortalOrder) => {
    setRatingOrder(order);
    setIsRateModalOpen(true);
  };

  const openReservationModal = () => {
    setIsReservationOpen(true);
  };

  const shareReceiptWhatsApp = (order: CustomerPortalOrder) => {
    const restaurantName = order.restaurantName || "Restaurant";
    const totalPaid = (order.paidPaise || order.subtotalPaise || 0) / 100;
    const itemsList = (order.items || [])
      .map((i) => `• ${i.name} × ${i.qty}`)
      .join("\n");

    const message = `*${restaurantName}* - Dining Receipt\nToken #${order.tokenNo || order.orderNo}\n\n*Items:*\n${itemsList}\n\n*Total Paid:* ₹${totalPaid.toFixed(2)}\nThank you for dining with us!`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(waUrl, "_blank");
  };

  return (
    <CustomerContext.Provider
      value={{
        data,
        isLoading,
        isRefetching,
        refetch,
        activeOrders,
        activeWaitlist,
        activeReservations,
        pastOrders,
        customer,
        stats,
        primaryActiveOrder,
        openCallWaiter,
        openOrderMore,
        openBillBreakdown,
        openRateModal,
        openReservationModal,
        shareReceiptWhatsApp,
      }}
    >
      {children}

      {/* Modals & Drawers */}
      {waiterOrder && (
        <CallWaiterModal
          opened={isWaiterModalOpen}
          onClose={() => setIsWaiterModalOpen(false)}
          order={waiterOrder}
          onSuccess={() => {
            refetch();
            notifications.show({
              title: "Request Sent",
              message: "Staff has been notified and is on their way.",
              color: "teal",
            });
          }}
        />
      )}

      {billOrder && (
        <BillBreakdownModal
          opened={isBillModalOpen}
          onClose={() => setIsBillModalOpen(false)}
          order={billOrder}
          onRequestBill={() => refetch()}
        />
      )}

      {orderMoreTarget && (
        <OrderMoreDrawer
          opened={isOrderMoreOpen}
          onClose={() => setIsOrderMoreOpen(false)}
          order={orderMoreTarget}
          onSuccess={() => {
            refetch();
            notifications.show({
              title: "Round Added to Table",
              message: "Kitchen is preparing your new dishes.",
              color: "teal",
            });
          }}
        />
      )}

      {ratingOrder && (
        <RateOrderModal
          opened={isRateModalOpen}
          onClose={() => setIsRateModalOpen(false)}
          order={ratingOrder}
          onSuccess={() => refetch()}
        />
      )}

      <ReservationModal
        opened={isReservationOpen}
        onClose={() => setIsReservationOpen(false)}
        customerName={customer?.name || user?.name || ""}
        customerPhone={customer?.phone || user?.phoneNumber || ""}
        outletId={primaryActiveOrder?.outletId}
      />
    </CustomerContext.Provider>
  );
}

export function useCustomer(): CustomerContextValue {
  const context = useContext(CustomerContext);
  if (!context) {
    throw new Error("useCustomer must be used within a CustomerProvider");
  }
  return context;
}
