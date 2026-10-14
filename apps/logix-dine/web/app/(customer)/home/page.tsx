"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useCustomer } from "@/lib/customer-context";
import { PortalHomeView } from "@/components/portal/views/portal-home-view";
import type { PortalTab } from "@/components/portal/portal-bottom-nav";

export default function CustomerHomePage() {
  const router = useRouter();
  const {
    data,
    openCallWaiter,
    openOrderMore,
    openBillBreakdown,
    openReservationModal,
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
    <PortalHomeView
      data={data}
      onNavigateTab={handleNavigateTab}
      onOpenCallWaiter={openCallWaiter}
      onOpenOrderMore={openOrderMore}
      onOpenBillBreakdown={openBillBreakdown}
      onOpenReservationModal={openReservationModal}
    />
  );
}
