"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useCustomer } from "@/lib/customer-context";
import { PortalLiveView } from "@/components/portal/views/portal-live-view";

export default function CustomerLivePage() {
  const router = useRouter();
  const {
    activeOrders,
    activeWaitlist,
    activeReservations,
    openCallWaiter,
    openOrderMore,
    openBillBreakdown,
    openRateModal,
    shareReceiptWhatsApp,
    openReservationModal,
  } = useCustomer();

  return (
    <PortalLiveView
      activeOrders={activeOrders}
      activeWaitlist={activeWaitlist}
      activeReservations={activeReservations}
      onOpenCallWaiter={openCallWaiter}
      onOpenOrderMore={openOrderMore}
      onOpenBillBreakdown={openBillBreakdown}
      onOpenRateModal={openRateModal}
      onShareBillWhatsApp={shareReceiptWhatsApp}
      onOpenReservationModal={openReservationModal}
      onNavigateOrders={() => router.push("/my-orders")}
      onNavigateHome={() => router.push("/home")}
    />
  );
}
