"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useCustomer } from "@/lib/customer-context";
import { PortalOrdersView } from "@/components/portal/views/portal-orders-view";
import type { PortalTab } from "@/components/portal/portal-bottom-nav";

export default function CustomerMyOrdersPage() {
  const router = useRouter();
  const {
    activeOrders,
    pastOrders,
    activeReservations,
    stats,
    refetch,
    openRateModal,
    openReservationModal,
    shareReceiptWhatsApp,
  } = useCustomer();

  const handleNavigateTab = (tab: PortalTab) => {
    switch (tab) {
      case "home":
        router.push("/home");
        break;
      case "live":
        router.push("/live");
        break;
      case "orders":
        router.push("/my-orders");
        break;
      case "profile":
        router.push("/profile");
        break;
    }
  };

  return (
    <PortalOrdersView
      activeOrders={activeOrders}
      pastOrders={pastOrders}
      activeReservations={activeReservations}
      lifetimeSpendPaise={stats?.lifetimeSpendPaise}
      initialSubTab="past"
      onRefresh={refetch}
      onOpenRateModal={openRateModal}
      onOpenReservationModal={openReservationModal}
      onNavigateTab={handleNavigateTab}
      onShareReceiptWhatsApp={shareReceiptWhatsApp}
    />
  );
}
