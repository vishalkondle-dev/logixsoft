"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Container,
  Paper,
  Title,
  Text,
  Button,
  Group,
  Stack,
  Modal,
  TextInput,
  Loader,
  Center,
  ThemeIcon,
  Box,
} from "@mantine/core";
import {
  IconBrandWhatsapp,
  IconCheck,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useAuth } from "@/lib/auth-context";
import { useRestaurant } from "@/lib/restaurant-context";
import { useCustomerPortal, useUpdateCustomerProfile } from "@/lib/queries";
import { useCustomerSync } from "@/lib/use-customer-sync";
import type { CustomerPortalOrder } from "@/lib/api-client";
import { PortalBottomNav, type PortalTab } from "@/components/portal/portal-bottom-nav";
import { PortalHeader } from "@/components/portal/portal-header";
import { PortalHomeView } from "@/components/portal/views/portal-home-view";
import { PortalOrdersView } from "@/components/portal/views/portal-orders-view";
import { PortalMenuView } from "@/components/portal/views/portal-menu-view";
import { PortalRewardsView } from "@/components/portal/views/portal-rewards-view";
import { PortalProfileView } from "@/components/portal/views/portal-profile-view";
import { RateOrderModal } from "@/components/portal/rate-order-modal";
import { CallWaiterModal } from "@/components/portal/call-waiter-modal";
import { OrderMoreDrawer } from "@/components/portal/order-more-drawer";
import { BillBreakdownModal } from "@/components/portal/bill-breakdown-modal";
import { ReservationModal } from "@/components/portal/reservation-modal";

function formatINR(paise?: number | null): string {
  if (paise == null) return "₹0.00";
  return `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function CustomerPortalInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab") || "home";

  // Map backward-compatible tabs: 'active' -> 'orders', 'past' -> 'orders', 'loyalty' -> 'rewards'
  const activeTab: PortalTab = useMemo(() => {
    if (rawTab === "active" || rawTab === "past" || rawTab === "orders") return "orders";
    if (rawTab === "rewards" || rawTab === "loyalty") return "rewards";
    if (rawTab === "menu") return "menu";
    if (rawTab === "profile") return "profile";
    return "home";
  }, [rawTab]);

  const initialSubTab: "active" | "past" = rawTab === "past" ? "past" : "active";

  const { user, isAuthenticated, isLoading: authLoading, openLoginModal, signOut } = useAuth();
  const { restaurant, activeOutlet, role } = useRestaurant();
  const [activeOutletIds, setActiveOutletIds] = useState<string[]>([]);

  // Real-time live sync via Cloudflare Durable Object (quiet background sync, zero tech jargon shown to diner)
  useCustomerSync(
    isAuthenticated ? user?.phoneNumber : null,
    { activeOutletIds }
  );

  // Auto-refreshes in real-time
  const { data, isLoading: dataLoading, isRefetching, refetch } = useCustomerPortal({
    refetchInterval: false,
  });
  const updateProfileMutation = useUpdateCustomerProfile();

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");

  const [ratingOrder, setRatingOrder] = useState<CustomerPortalOrder | null>(null);
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);

  const [waiterOrder, setWaiterOrder] = useState<CustomerPortalOrder | null>(null);
  const [isWaiterModalOpen, setIsWaiterModalOpen] = useState(false);

  const [orderMoreTarget, setOrderMoreTarget] = useState<CustomerPortalOrder | null>(null);
  const [isOrderMoreOpen, setIsOrderMoreOpen] = useState(false);

  const [billOrder, setBillOrder] = useState<CustomerPortalOrder | null>(null);
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);

  const [isReservationOpen, setIsReservationOpen] = useState(false);

  const customer = data?.customer;
  const stats = data?.stats;
  const activeOrders = data?.activeOrders || [];
  const pastOrders = data?.pastOrders || [];

  useEffect(() => {
    if (data?.customer) {
      setEditName(data.customer.name || "");
      setEditEmail(data.customer.email || "");
    } else if (user) {
      setEditName(user.name || "");
      setEditEmail(user.email || "");
    }
  }, [data, user]);

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

  const handleTabChange = (newTab: PortalTab) => {
    router.push(`/portal?tab=${newTab}`, { scroll: false });
  };

  const handleOpenRateModal = (order: CustomerPortalOrder) => {
    setRatingOrder(order);
    setIsRateModalOpen(true);
  };

  const handleOpenCallWaiter = (order: CustomerPortalOrder) => {
    setWaiterOrder(order);
    setIsWaiterModalOpen(true);
  };

  const handleOpenOrderMore = (order: CustomerPortalOrder) => {
    setOrderMoreTarget(order);
    setIsOrderMoreOpen(true);
  };

  const handleOpenBillBreakdown = (order: CustomerPortalOrder) => {
    setBillOrder(order);
    setIsBillModalOpen(true);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      notifications.show({
        title: "Name required",
        message: "Please enter your name",
        color: "red",
      });
      return;
    }

    try {
      await updateProfileMutation.mutateAsync({
        name: editName.trim(),
        email: editEmail.trim() || undefined,
      });
      notifications.show({
        title: "Profile Updated",
        message: "Your profile details have been saved successfully.",
        color: "teal",
        icon: <IconCheck size={16} />,
      });
      setIsEditModalOpen(false);
      refetch();
    } catch (err: any) {
      notifications.show({
        title: "Update Failed",
        message: err.message || "Failed to update profile",
        color: "red",
      });
    }
  };

  const shareReceiptWhatsApp = (order: CustomerPortalOrder) => {
    const itemsText = order.items
      .map((it) => {
        const vName = it.variant?.name || (typeof it.variant === "object" ? it.variant?.name : it.variant) || "";
        const variantText = vName && !it.name.toLowerCase().includes(String(vName).toLowerCase()) ? ` (${vName})` : "";
        const eachPriceText = it.qty > 1 ? ` (@ ₹${(it.pricePaise / 100).toFixed(2)} each)` : "";
        return `• ${it.name}${variantText} × ${it.qty} = ₹${((it.pricePaise * it.qty) / 100).toFixed(2)}${eachPriceText}`;
      })
      .join("\n");

    const itemsSubtotalPaise = order.items.reduce(
      (sum, it) => sum + (it.pricePaise || 0) * (it.qty || 1),
      0
    );
    const packagingChargePaise = order.packagingChargePaise || 0;
    const deliveryChargePaise = order.deliveryChargePaise || 0;
    const totalPaid = order.paidPaise || order.subtotalPaise || 0;
    const otherChargesOrTaxesPaise = Math.max(
      0,
      totalPaid - (itemsSubtotalPaise + packagingChargePaise + deliveryChargePaise)
    );
    const discountPaise = Math.max(
      0,
      itemsSubtotalPaise + packagingChargePaise + deliveryChargePaise - totalPaid
    );

    const chargesLines: string[] = [];
    chargesLines.push(`Items Subtotal: ${formatINR(itemsSubtotalPaise)}`);
    if (packagingChargePaise > 0) chargesLines.push(`Packaging Charge: ${formatINR(packagingChargePaise)}`);
    if (deliveryChargePaise > 0) chargesLines.push(`Delivery Fee: ${formatINR(deliveryChargePaise)}`);
    if (otherChargesOrTaxesPaise > 0) chargesLines.push(`Taxes & Charges: ${formatINR(otherChargesOrTaxesPaise)}`);
    if (discountPaise > 0) chargesLines.push(`Discount: -${formatINR(discountPaise)}`);

    const isDelivery = order.orderType === "DELIVERY" || (order.tableNo || "").toLowerCase() === "delivery" || Boolean(order.delivery);
    const isTakeaway = (order.tableNo || "").toLowerCase() === "takeaway" || order.orderType === "TAKEAWAY";
    const restaurantName = order.restaurantName || order.outlet?.restaurantName || "Restaurant";
    const outletName = order.outletName || order.outlet?.name || "";
    const channelLabel = isDelivery ? "Direct Delivery" : isTakeaway ? "Takeaway" : `Table: ${order.tableNo}`;

    const message = `*Logix Dine Bill Receipt*
*${restaurantName}*${outletName ? ` (${outletName})` : ""}
Token #${order.tokenNo || order.orderNo || "N/A"} | ${channelLabel}
Date: ${formatDate(order.settledAt || order.createdAt)}
--------------------------------
${itemsText}
--------------------------------
${chargesLines.join("\n")}
--------------------------------
*Total Paid: ${formatINR(totalPaid)}*
Payment: ${order.method || "Cash"}
Thank you for dining with us!`;

    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  // 1. Auth Loading State
  if (authLoading) {
    return (
      <Center py={100} style={{ minHeight: "70vh" }}>
        <Stack align="center" gap="md">
          <Loader size="lg" color="dinePrimary" />
          <Text size="sm" c="dimmed">
            Loading your dining portal...
          </Text>
        </Stack>
      </Center>
    );
  }

  // 2. Not Logged In State
  if (!isAuthenticated) {
    return (
      <Container size="sm" py={60}>
        <Paper
          p={{ base: "lg", sm: "xl" }}
          radius="xl"
          withBorder
          shadow="md"
          style={{ textAlign: "center", background: "#fff" }}
        >
          <Stack align="center" gap="lg">
            <ThemeIcon size={72} radius="xl" color="dinePrimary" variant="light">
              <IconBrandWhatsapp size={38} />
            </ThemeIcon>

            <div>
              <Title order={2} style={{ fontSize: "1.75rem", fontWeight: 800 }}>
                Customer Dining Portal
              </Title>
              <Text c="dimmed" size="sm" mt={6} maw={420} mx="auto">
                Sign in with your mobile number to track live dine-in orders, check past bills, and view your VIP loyalty rewards.
              </Text>
            </div>

            <Button
              size="lg"
              color="dinePrimary"
              leftSection={<IconBrandWhatsapp size={22} />}
              onClick={openLoginModal}
              radius="md"
              fullWidth
              maw={320}
            >
              Sign In with WhatsApp OTP
            </Button>
          </Stack>
        </Paper>
      </Container>
    );
  }

  return (
    <Container size="md" py={{ base: "xs", sm: "md" }} pb={100}>
      {/* ─── Modern App-Bar Header (Zero Tech DO Jargon) ─── */}
      <PortalHeader
        customerName={customer?.name || user?.name}
        phoneNumber={customer?.phone || user?.phoneNumber}
        loyaltyTier={customer?.loyaltyTier}
        restaurantName={activeOrders[0]?.restaurantName}
        outletName={activeOrders[0]?.outletName}
        activeOrders={activeOrders}
        isRefetching={isRefetching}
        onRefresh={() => refetch()}
        onSelectActiveOrder={() => handleTabChange("orders")}
        onOpenProfile={() => handleTabChange("profile")}
        staffRole={role}
        activeOutletId={activeOutlet?.id}
      />

      {/* ─── Multi-Page Feature Views ─── */}
      {dataLoading ? (
        <Center py={60}>
          <Loader size="md" color="dinePrimary" />
        </Center>
      ) : (
        <Box>
          {activeTab === "home" && (
            <PortalHomeView
              data={data}
              onNavigateTab={handleTabChange}
              onOpenCallWaiter={handleOpenCallWaiter}
              onOpenOrderMore={handleOpenOrderMore}
              onOpenBillBreakdown={handleOpenBillBreakdown}
              onOpenReservationModal={() => setIsReservationOpen(true)}
            />
          )}

          {activeTab === "orders" && (
            <PortalOrdersView
              activeOrders={activeOrders}
              pastOrders={pastOrders}
              lifetimeSpendPaise={stats?.lifetimeSpendPaise}
              initialSubTab={rawTab === "past" || (rawTab === "orders" && activeOrders.length === 0) ? "past" : "active"}
              onRefresh={() => refetch()}
              onOpenRateModal={handleOpenRateModal}
              onNavigateTab={handleTabChange}
              onShareReceiptWhatsApp={shareReceiptWhatsApp}
            />
          )}

          {activeTab === "menu" && (
            <PortalMenuView
              outletId={activeOrders[0]?.outletId}
              restaurantName={activeOrders[0]?.restaurantName}
              outletName={activeOrders[0]?.outletName}
              activeOrder={activeOrders[0] || null}
              pastOrders={pastOrders}
              onOpenOrderMore={handleOpenOrderMore}
            />
          )}

          {activeTab === "rewards" && (
            <PortalRewardsView data={data} />
          )}

          {activeTab === "profile" && (
            <PortalProfileView
              data={data}
              onOpenEditModal={() => setIsEditModalOpen(true)}
              onSignOut={signOut}
            />
          )}
        </Box>
      )}

      {/* ─── Floating Frosted-Glass Bottom Nav Bar ─── */}
      <PortalBottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        activeOrdersCount={activeOrders.length}
      />

      {/* ─── Modals & Drawers ─── */}
      {/* 1. Edit Profile Modal */}
      <Modal
        opened={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={<Text fw={700}>Edit Customer Profile</Text>}
        radius="md"
        centered
        zIndex={1500}
      >
        <form onSubmit={handleUpdateProfile}>
          <Stack gap="md">
            <TextInput
              label="Full Name"
              placeholder="e.g. Vishal Kondle"
              required
              value={editName}
              onChange={(e) => setEditName(e.currentTarget.value)}
            />
            <TextInput
              label="Email Address (Optional)"
              placeholder="e.g. name@example.com"
              type="email"
              description="For receiving digital invoices and billing updates."
              value={editEmail}
              onChange={(e) => setEditEmail(e.currentTarget.value)}
            />
            <TextInput
              label="Phone Number"
              disabled
              value={customer?.phone || user?.phoneNumber || ""}
              description="Phone number is verified and tied to your WhatsApp account."
            />
            <Group justify="flex-end" mt="md">
              <Button variant="default" size="xs" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button color="dinePrimary" size="xs" type="submit" loading={updateProfileMutation.isPending}>
                Save Changes
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* 2. Rate Order Modal */}
      <RateOrderModal
        opened={isRateModalOpen}
        onClose={() => setIsRateModalOpen(false)}
        order={ratingOrder}
        existingFeedback={ratingOrder?.feedback}
        onSuccess={() => refetch()}
      />

      {/* 3. Call Waiter Modal */}
      {waiterOrder && (
        <CallWaiterModal
          opened={isWaiterModalOpen}
          onClose={() => setIsWaiterModalOpen(false)}
          order={waiterOrder}
          onSuccess={() => refetch()}
        />
      )}

      {/* 4. Order More Drawer */}
      {orderMoreTarget && (
        <OrderMoreDrawer
          opened={isOrderMoreOpen}
          onClose={() => setIsOrderMoreOpen(false)}
          order={orderMoreTarget}
          onSuccess={() => refetch()}
        />
      )}

      {/* 5. Bill Breakdown Modal */}
      {billOrder && (
        <BillBreakdownModal
          opened={isBillModalOpen}
          onClose={() => setIsBillModalOpen(false)}
          order={billOrder}
        />
      )}

      {/* 6. Reservation Modal */}
      <ReservationModal
        opened={isReservationOpen}
        onClose={() => setIsReservationOpen(false)}
        restaurantId={restaurant?.id || activeOrders[0]?.restaurantId}
        outletId={activeOutlet?.id || activeOrders[0]?.outletId}
        customerName={customer?.name || user?.name}
        customerPhone={customer?.phone || user?.phoneNumber}
      />
    </Container>
  );
}

export default function CustomerPortalPage() {
  return (
    <Suspense
      fallback={
        <Center py={100}>
          <Loader size="lg" color="dinePrimary" />
        </Center>
      }
    >
      <CustomerPortalInner />
    </Suspense>
  );
}
