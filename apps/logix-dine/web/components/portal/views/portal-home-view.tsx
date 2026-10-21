"use client";

import React, { useMemo } from "react";
import {
  Stack,
  Paper,
  Group,
  Text,
  Title,
  Badge,
  Button,
  SimpleGrid,
  Card,
  ThemeIcon,
  Progress,
  Box,
  Divider,
  UnstyledButton,
} from "@mantine/core";
import {
  IconToolsKitchen2,
  IconFlame,
  IconBellRinging,
  IconPlus,
  IconReceipt2,
  IconStar,
  IconCalendar,
  IconChevronRight,
  IconClock,
  IconMapPin,
  IconPhone,
  IconWifi,
  IconShieldCheck,
  IconShoppingBag,
  IconMotorbike,
  IconCheck,
  IconUser,
  IconHistory,
} from "@tabler/icons-react";
import { VegNonVegIcon } from "@/components/common/veg-nonveg-icon";
import { MarketplaceExplore } from "@/components/marketplace/marketplace-explore";
import type { CustomerPortalData, CustomerPortalOrder } from "@/lib/api-client";
import type { PortalTab } from "../portal-bottom-nav";

interface PortalHomeViewProps {
  data?: CustomerPortalData;
  onNavigateTab: (tab: PortalTab) => void;
  onOpenCallWaiter: (order: CustomerPortalOrder) => void;
  onOpenOrderMore: (order: CustomerPortalOrder) => void;
  onOpenBillBreakdown: (order: CustomerPortalOrder) => void;
  onOpenReservationModal: () => void;
}

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
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function PortalHomeView({
  data,
  onNavigateTab,
  onOpenCallWaiter,
  onOpenOrderMore,
  onOpenBillBreakdown,
  onOpenReservationModal,
}: PortalHomeViewProps) {
  const customer = data?.customer;
  const stats = data?.stats;
  const activeOrders = data?.activeOrders || [];
  const pastOrders = data?.pastOrders || [];
  const primaryActiveOrder = activeOrders[0];

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const isDelivery =
    primaryActiveOrder?.orderType === "DELIVERY" ||
    (primaryActiveOrder?.tableNo || "").toLowerCase() === "delivery" ||
    Boolean(primaryActiveOrder?.delivery);
  const isTakeaway =
    (primaryActiveOrder?.tableNo || "").toLowerCase() === "takeaway" ||
    primaryActiveOrder?.orderType === "TAKEAWAY";

  // Calculate live order cooking stage
  const liveStage = useMemo(() => {
    if (!primaryActiveOrder) return null;
    const items = primaryActiveOrder.items || [];
    const hasReady = items.some((i) => i.status === "READY");
    const hasCooking = items.some((i) => i.status === "PREPARING");
    const allServed = items.length > 0 && items.every((i) => i.status === "SERVED");

    if (allServed) return { label: "Served & Enjoying", percent: 100, color: "green", icon: "🍽️" };
    if (hasReady) return { label: "Ready to Serve", percent: 80, color: "teal", icon: "✨" };
    if (hasCooking) return { label: "Cooking in Kitchen", percent: 50, color: "orange", icon: "🔥" };
    return { label: "Order Confirmed", percent: 25, color: "violet", icon: "📋" };
  }, [primaryActiveOrder]);

  return (
    <Stack gap="lg" pb={30}>
      {/* ─── 1. Warm Personalized Greeting ─── */}
      <Paper
        p={{ base: "md", sm: "lg" }}
        radius="xl"
        withBorder
        style={{
          background: "linear-gradient(135deg, rgba(121, 80, 242, 0.08) 0%, rgba(243, 232, 255, 0.5) 100%)",
          borderColor: "rgba(121, 80, 242, 0.2)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Group justify="space-between" align="center" wrap="wrap" gap="sm">
          <div>
            <Group gap={6} align="center">
              <Text size="xs" fw={700} c="dimmed" style={{ textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {greeting},
              </Text>
            </Group>
            <Title order={2} style={{ fontSize: "1.45rem", fontWeight: 800, marginTop: 2 }}>
              {customer?.name || "Valued Diner"}
            </Title>
            <Text size="xs" c="dimmed" mt={2}>
              {primaryActiveOrder
                ? `Currently dining at ${primaryActiveOrder.restaurantName || "Restaurant"}${primaryActiveOrder.outletName ? ` (${primaryActiveOrder.outletName})` : ""}. Enjoy your meal!`
                : "Welcome to your personal dining hub. Track your live orders, past receipts, and explore the menu."}
            </Text>
          </div>
        </Group>
      </Paper>

      {/* ─── 2. Active Order Banner (Concise Basic Info) ─── */}
      {primaryActiveOrder ? (
        <Paper
          p="md"
          radius="xl"
          withBorder
          style={{
            background: "linear-gradient(135deg, rgba(255, 107, 107, 0.08) 0%, rgba(255, 235, 235, 0.6) 100%)",
            borderColor: "rgba(255, 107, 107, 0.35)",
            boxShadow: "0 6px 20px rgba(255, 107, 107, 0.08)",
          }}
        >
          <Group justify="space-between" align="center" wrap="wrap" gap="sm">
            <Group gap="sm" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
              <ThemeIcon size={46} radius="xl" color="red" variant="filled">
                <IconFlame size={24} />
              </ThemeIcon>
              <Box style={{ minWidth: 0 }}>
                <Group gap={6} align="center">
                  <Text fw={800} size="sm" lineClamp={1}>
                    {primaryActiveOrder.restaurantName || "Restaurant"} • {isDelivery ? "Direct Delivery" : isTakeaway ? "Takeaway" : `Table ${primaryActiveOrder.tableNo || "Dine-In"}`}
                  </Text>
                  <Badge size="xs" color="red" variant="filled">
                    LIVE
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed" mt={2} lineClamp={1}>
                  Token #{primaryActiveOrder.tokenNo || primaryActiveOrder.orderNo} • {primaryActiveOrder.items?.length || 0} items ordered • {formatINR(primaryActiveOrder.subtotalPaise)}
                </Text>
              </Box>
            </Group>

            <Button
              size="sm"
              color="red"
              variant="filled"
              radius="md"
              rightSection={<IconChevronRight size={16} />}
              onClick={() => onNavigateTab("live")}
            >
              Go to Live Dining
            </Button>
          </Group>
        </Paper>
      ) : null}

      {/* ─── 3. Quick Action Hub (when active order) ─── */}
      {primaryActiveOrder ? (
        <div>
          <Text fw={700} size="xs" c="dimmed" mb="xs" style={{ textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Table Services & Actions
          </Text>
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
            {/* Live Dining */}
            <Paper
              p="md"
              radius="lg"
              withBorder
              onClick={() => onNavigateTab("live")}
              style={{
                background: "#fff",
                cursor: "pointer",
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
                borderColor: "rgba(255, 107, 107, 0.4)",
              }}
            >
              <ThemeIcon size={42} radius="md" color="red" variant="filled" mb="xs">
                <IconFlame size={22} />
              </ThemeIcon>
              <Text fw={700} size="sm">
                Live Dining
              </Text>
              <Text size="11px" c="dimmed">
                Table {primaryActiveOrder.tableNo || "TG3"} • Kitchen prep live
              </Text>
            </Paper>

            {/* Running Bill */}
            <Paper
              p="md"
              radius="lg"
              withBorder
              onClick={() => onOpenBillBreakdown(primaryActiveOrder)}
              style={{
                background: "#fff",
                cursor: "pointer",
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
              }}
            >
              <ThemeIcon size={42} radius="md" color="teal" variant="light" mb="xs">
                <IconReceipt2 size={22} />
              </ThemeIcon>
              <Text fw={700} size="sm">
                Running Bill
              </Text>
              <Text size="11px" c="dimmed">
                {formatINR(primaryActiveOrder.subtotalPaise)} • Pay or split
              </Text>
            </Paper>

            {/* Call Waiter */}
            <Paper
              p="md"
              radius="lg"
              withBorder
              onClick={() => onOpenCallWaiter(primaryActiveOrder)}
              style={{
                background: "#fff",
                cursor: "pointer",
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
              }}
            >
              <ThemeIcon size={42} radius="md" color="orange" variant="light" mb="xs">
                <IconBellRinging size={22} />
              </ThemeIcon>
              <Text fw={700} size="sm">
                Call Waiter
              </Text>
              <Text size="11px" c="dimmed">
                Water, cutlery, or service assistance
              </Text>
            </Paper>

            {/* Book Table */}
            <Paper
              p="md"
              radius="lg"
              withBorder
              onClick={onOpenReservationModal}
              style={{
                background: "#fff",
                cursor: "pointer",
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
              }}
            >
              <ThemeIcon size={42} radius="md" color="blue" variant="light" mb="xs">
                <IconCalendar size={22} />
              </ThemeIcon>
              <Text fw={700} size="sm">
                Book Table
              </Text>
              <Text size="11px" c="dimmed">
                Reserve upcoming dining
              </Text>
            </Paper>
          </SimpleGrid>
        </div>
      ) : null}

        {/* ─── 4. Direct Dine Marketplace Hub ─── */}
        <Box mt="xs">
          <MarketplaceExplore />
        </Box>

      {/* ─── 4. Re-order Your Favorites Carousel ─── */}
      {stats?.favoriteDishes && stats.favoriteDishes.length > 0 && (
        <div>
          <Group justify="space-between" align="center" mb="xs">
            <Group gap={6}>
              <Text fw={700} size="xs" c="dimmed" style={{ textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Your Favorite Dishes
              </Text>
              <Badge size="xs" variant="light" color="violet">
                Order Again in 1-Tap
              </Badge>
            </Group>
            <Button
              variant="subtle"
              size="compact-xs"
              color="dinePrimary"
              onClick={() => {
                if (primaryActiveOrder) {
                  onOpenOrderMore(primaryActiveOrder);
                } else {
                  onOpenReservationModal();
                }
              }}
            >
              {primaryActiveOrder ? "Add More to Table" : "Book Table to Dine"}
            </Button>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            {stats.favoriteDishes.map((dish) => (
              <Paper
                key={dish.name}
                p="sm"
                radius="md"
                withBorder
                style={{
                  background: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <Group gap="xs" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                  <VegNonVegIcon isNonVeg={dish.isNonVeg} size={15} />
                  <Box style={{ minWidth: 0 }}>
                    <Text fw={700} size="xs" lineClamp={1}>
                      {dish.name}
                    </Text>
                    <Group gap={6} mt={2}>
                      <Badge size="xs" variant="outline" color="gray">
                        Ordered {dish.qty}×
                      </Badge>
                      <Text size="xs" fw={700} c="dinePrimary">
                        {formatINR(dish.totalSpendPaise)}
                      </Text>
                    </Group>
                  </Box>
                </Group>

                <Button
                  size="compact-xs"
                  variant="light"
                  color="dinePrimary"
                  radius="xl"
                  onClick={() => {
                    if (primaryActiveOrder) {
                      onOpenOrderMore(primaryActiveOrder);
                    } else {
                      onOpenReservationModal();
                    }
                  }}
                >
                  {primaryActiveOrder ? "Add" : "Book Table"}
                </Button>
              </Paper>
            ))}
          </SimpleGrid>
        </div>
      )}


      {/* ─── 6. Table Dining Amenities (ONLY when dining actively at a table) ─── */}
      {primaryActiveOrder && (
        <Paper p="md" radius="lg" withBorder style={{ background: "#fafafa" }}>
          <Text fw={700} size="xs" c="dimmed" mb="sm" style={{ textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Table Dining Information
          </Text>
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
            <Group gap={8} wrap="nowrap">
              <ThemeIcon size="sm" radius="md" color="teal" variant="light">
                <IconWifi size={14} />
              </ThemeIcon>
              <div>
                <Text size="11px" fw={700}>Guest WiFi</Text>
                <Text size="10px" c="dimmed">Ask staff for network password</Text>
              </div>
            </Group>

            <Group gap={8} wrap="nowrap">
              <ThemeIcon size="sm" radius="md" color="blue" variant="light">
                <IconClock size={14} />
              </ThemeIcon>
              <div>
                <Text size="11px" fw={700}>Kitchen Service</Text>
                <Text size="10px" c="dimmed">Order live updates active</Text>
              </div>
            </Group>

            <Group gap={8} wrap="nowrap">
              <ThemeIcon size="sm" radius="md" color="green" variant="light">
                <IconShieldCheck size={14} />
              </ThemeIcon>
              <div>
                <Text size="11px" fw={700}>FSSAI Certified</Text>
                <Text size="10px" c="dimmed">100% Hygiene Verified</Text>
              </div>
            </Group>

            <Group gap={8} wrap="nowrap">
              <ThemeIcon size="sm" radius="md" color="orange" variant="light">
                <IconMapPin size={14} />
              </ThemeIcon>
              <div>
                <Text size="11px" fw={700}>Table Seating</Text>
                <Text size="10px" c="dimmed">
                  {primaryActiveOrder.tableNo ? `Table ${primaryActiveOrder.tableNo}` : "Takeaway / Delivery"}
                </Text>
              </div>
            </Group>
          </SimpleGrid>
        </Paper>
      )}

      {/* ─── 7. Recent Dining Visits (shown when no active orders) ─── */}
      {!primaryActiveOrder && pastOrders.length > 0 && (
        <div>
          <Group justify="space-between" align="center" mb="xs">
            <Group gap={6}>
              <Text fw={700} size="xs" c="dimmed" style={{ textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Recent Dining Visits
              </Text>
              <Badge size="xs" variant="light" color="teal">
                {pastOrders.length} completed
              </Badge>
            </Group>
            <Button
              variant="subtle"
              size="compact-xs"
              color="dinePrimary"
              onClick={() => onNavigateTab("orders")}
            >
              View All Receipts ({pastOrders.length})
            </Button>
          </Group>

          <Stack gap="xs">
            {pastOrders.slice(0, 3).map((order) => {
              const restaurantName = order.restaurantName || order.outlet?.restaurantName || "Restaurant";
              const outletName = order.outletName || order.outlet?.name || "";
              const totalPaid = order.paidPaise || order.subtotalPaise || 0;
              return (
                <Paper
                  key={order.id}
                  p="sm"
                  radius="md"
                  withBorder
                  onClick={() => onNavigateTab("orders")}
                  style={{
                    background: "#fff",
                    cursor: "pointer",
                    transition: "border-color 0.15s ease",
                  }}
                >
                  <Group justify="space-between" align="center" wrap="nowrap" gap="xs">
                    <Group gap="xs" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                      <ThemeIcon size="md" radius="md" color="violet" variant="light">
                        <IconReceipt2 size={16} />
                      </ThemeIcon>
                      <Box style={{ minWidth: 0 }}>
                        <Group gap={6} align="center" wrap="wrap">
                          <Text fw={700} size="xs" lineClamp={1}>
                            {restaurantName}
                          </Text>
                          {outletName && (
                            <Badge size="xs" variant="light" color="gray">
                              {outletName}
                            </Badge>
                          )}
                        </Group>
                        <Group gap={4} mt={1} align="center">
                          <Text size="11px" c="dimmed">
                            Token #{order.tokenNo || order.orderNo || "—"}
                          </Text>
                          <Text size="11px" c="dimmed">•</Text>
                          <Text size="11px" c="dimmed">
                            {formatDate(order.settledAt || order.createdAt)}
                          </Text>
                          {order.feedback && (
                            <>
                              <Text size="11px" c="dimmed">•</Text>
                              <Badge size="xs" color="yellow" variant="light">
                                {order.feedback.rating}.0 ★
                              </Badge>
                            </>
                          )}
                        </Group>
                      </Box>
                    </Group>

                    <Box style={{ textAlign: "right", flexShrink: 0 }}>
                      <Text fw={800} size="xs" style={{ color: "#2f9e44" }}>
                        {formatINR(totalPaid)}
                      </Text>
                      <Text size="10px" c="dimmed">
                        {order.items?.length || 0} items
                      </Text>
                    </Box>
                  </Group>
                </Paper>
              );
            })}
          </Stack>
        </div>
      )}
    </Stack>
  );
}
