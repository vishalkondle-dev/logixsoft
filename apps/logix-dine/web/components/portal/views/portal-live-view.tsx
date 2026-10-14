"use client";

import React from "react";
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
  ActionIcon,
  Tooltip,
  Alert,
} from "@mantine/core";
import {
  IconFlame,
  IconClock,
  IconCheck,
  IconToolsKitchen2,
  IconBellRinging,
  IconReceipt2,
  IconMapPin,
  IconPhone,
  IconCalendar,
  IconUsers,
  IconChevronRight,
  IconPlus,
  IconArrowRight,
  IconCircleDot,
  IconAlertCircle,
  IconArmchair,
} from "@tabler/icons-react";
import { VegNonVegIcon } from "@/components/common/veg-nonveg-icon";
import type {
  CustomerPortalOrder,
  CustomerWaitlistEntry,
  CustomerReservationEntry,
} from "@/lib/api-client";

interface PortalLiveViewProps {
  activeOrders: CustomerPortalOrder[];
  activeWaitlist?: CustomerWaitlistEntry[];
  activeReservations?: CustomerReservationEntry[];
  onOpenCallWaiter: (order: CustomerPortalOrder) => void;
  onOpenOrderMore: (order: CustomerPortalOrder) => void;
  onOpenBillBreakdown: (order: CustomerPortalOrder) => void;
  onOpenReservationModal: () => void;
  onNavigateOrders: () => void;
  onNavigateHome: () => void;
}

function formatINR(paise?: number | null): string {
  if (paise == null) return "₹0.00";
  return `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatTime(dateStr?: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getItemStatusMeta(status?: string) {
  switch (status?.toUpperCase()) {
    case "SERVED":
      return {
        label: "Served",
        color: "teal",
        variant: "filled" as const,
        icon: IconCheck,
        bg: "rgba(32, 201, 151, 0.12)",
      };
    case "READY":
      return {
        label: "Ready to Serve",
        color: "cyan",
        variant: "filled" as const,
        icon: IconBellRinging,
        bg: "rgba(21, 170, 191, 0.12)",
      };
    case "PREPARING":
      return {
        label: "Cooking in Kitchen",
        color: "orange",
        variant: "filled" as const,
        icon: IconFlame,
        bg: "rgba(253, 126, 20, 0.12)",
      };
    case "ACCEPTED":
      return {
        label: "Kitchen Confirmed",
        color: "blue",
        variant: "light" as const,
        icon: IconToolsKitchen2,
        bg: "rgba(34, 139, 230, 0.08)",
      };
    case "CANCELLED":
      return {
        label: "Cancelled",
        color: "red",
        variant: "light" as const,
        icon: IconAlertCircle,
        bg: "rgba(250, 82, 82, 0.08)",
      };
    case "ORDERED":
    case "PENDING":
    default:
      return {
        label: "Order Received",
        color: "gray",
        variant: "light" as const,
        icon: IconClock,
        bg: "rgba(134, 142, 150, 0.08)",
      };
  }
}

export function PortalLiveView({
  activeOrders = [],
  activeWaitlist = [],
  activeReservations = [],
  onOpenCallWaiter,
  onOpenOrderMore,
  onOpenBillBreakdown,
  onOpenReservationModal,
  onNavigateOrders,
  onNavigateHome,
}: PortalLiveViewProps) {
  const hasActiveOrder = activeOrders.length > 0;
  const hasWaitlist = activeWaitlist.length > 0;
  const hasReservation = activeReservations.length > 0;
  const hasAnyLive = hasActiveOrder || hasWaitlist || hasReservation;

  return (
    <Stack gap="lg" pb={60}>
      {/* ─── Top Live Bar Header ─── */}
      <Paper
        p="md"
        radius="lg"
        style={{
          background: hasAnyLive
            ? "linear-gradient(135deg, #18191c 0%, #2b1f3d 100%)"
            : "#fff",
          border: hasAnyLive ? "none" : "1px solid #e9ecef",
          color: hasAnyLive ? "#fff" : "inherit",
          boxShadow: hasAnyLive ? "0 8px 24px rgba(0, 0, 0, 0.12)" : "none",
        }}
      >
        <Group justify="space-between" align="center" wrap="wrap" gap="xs">
          <div>
            <Group gap={8} align="center">
              <ThemeIcon
                size={34}
                radius="xl"
                color={hasAnyLive ? "red" : "gray"}
                variant={hasAnyLive ? "filled" : "light"}
              >
                <IconFlame size={18} />
              </ThemeIcon>
              <div>
                <Group gap={6} align="center">
                  <Title order={3} style={{ fontSize: "1.2rem", fontWeight: 800 }}>
                    Live Dining & Activity
                  </Title>
                  {hasAnyLive && (
                    <Badge color="red" variant="filled" size="xs">
                      LIVE
                    </Badge>
                  )}
                </Group>
                <Text size="xs" c={hasAnyLive ? "gray.3" : "dimmed"}>
                  {hasActiveOrder
                    ? "Live seated table & real-time kitchen preparation status"
                    : hasWaitlist
                    ? "Live waitlist queue position & updates"
                    : hasReservation
                    ? "Today's confirmed dining reservations"
                    : "No active dining session currently in progress"}
                </Text>
              </div>
            </Group>
          </div>

          {hasActiveOrder && (
            <Badge size="sm" variant="light" color="teal">
              {activeOrders.length} Seated Order{activeOrders.length > 1 ? "s" : ""}
            </Badge>
          )}
        </Group>
      </Paper>

      {/* ─── 1. ACTIVE SEATED DINE-IN ORDERS ─── */}
      {activeOrders.map((order) => {
        const items = order.items || [];
        const nonCancelledItems = items.filter((i) => i.status !== "CANCELLED");
        const totalItemsCount = nonCancelledItems.reduce((acc, it) => acc + (it.qty || 1), 0);
        const servedCount = nonCancelledItems
          .filter((i) => i.status?.toUpperCase() === "SERVED")
          .reduce((acc, it) => acc + (it.qty || 1), 0);
        const prepProgress =
          totalItemsCount > 0 ? Math.round((servedCount / totalItemsCount) * 100) : 0;

        const tableLabel = order.tableNo ? `Table ${order.tableNo}` : "Takeaway / Delivery";
        const restaurantName = order.restaurantName || "Restaurant";
        const outletName = order.outletName || "";

        return (
          <Paper
            key={order.id}
            p={{ base: "md", sm: "lg" }}
            radius="xl"
            withBorder
            style={{
              background: "#fff",
              boxShadow: "0 8px 30px rgba(0, 0, 0, 0.06)",
              borderColor: "#e3daf9",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Top Accent Strip */}
            <Box
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                background: "linear-gradient(90deg, #7950f2 0%, #fa5252 50%, #40c057 100%)",
              }}
            />

            {/* Seated Table Header */}
            <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm" mb="md">
              <div>
                <Group gap={8} align="center">
                  <ThemeIcon size="lg" radius="md" color="violet" variant="light">
                    <IconArmchair size={20} />
                  </ThemeIcon>
                  <div>
                    <Group gap={6} align="center">
                      <Title order={2} style={{ fontSize: "1.35rem", fontWeight: 800 }}>
                        {tableLabel}
                      </Title>
                      <Badge color="violet" variant="filled" size="xs">
                        {order.orderType || "DINE-IN"}
                      </Badge>
                    </Group>
                    <Text size="xs" c="dimmed" mt={1}>
                      {restaurantName} {outletName ? `• ${outletName}` : ""}
                    </Text>
                  </div>
                </Group>
              </div>

              <Box style={{ textAlign: "right" }}>
                <Text size="xs" c="dimmed">
                  Token #{order.tokenNo || order.orderNo}
                </Text>
                <Text size="11px" c="dimmed">
                  Ordered at {formatTime(order.createdAt)}
                </Text>
              </Box>
            </Group>

            {/* Live Kitchen Preparation Progress Bar */}
            <Paper p="sm" radius="md" mb="md" style={{ background: "#f8f9fa" }}>
              <Group justify="space-between" align="center" mb={6}>
                <Group gap={6}>
                  <ThemeIcon size="xs" radius="xl" color="orange" variant="filled">
                    <IconFlame size={12} />
                  </ThemeIcon>
                  <Text fw={700} size="xs">
                    Kitchen Preparation Status
                  </Text>
                </Group>
                <Text fw={700} size="xs" c={prepProgress === 100 ? "teal" : "dimmed"}>
                  {servedCount} of {totalItemsCount} items served ({prepProgress}%)
                </Text>
              </Group>
              <Progress
                value={prepProgress}
                size="md"
                radius="xl"
                color={prepProgress === 100 ? "teal" : "orange"}
                animated={prepProgress > 0 && prepProgress < 100}
              />
            </Paper>

            {/* Real-time Ordered Items Status List */}
            <Stack gap="xs" mb="lg">
              <Text fw={700} size="xs" c="dimmed" style={{ textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Item-by-Item Status ({items.length} items)
              </Text>

              {items.map((item, idx) => {
                const meta = getItemStatusMeta(item.status);
                const StatusIcon = meta.icon;

                return (
                  <Paper
                    key={item.id || idx}
                    p="xs"
                    radius="md"
                    withBorder
                    style={{
                      background: meta.bg,
                      borderColor: meta.color === "orange" ? "rgba(253, 126, 20, 0.3)" : "#f1f3f5",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <Group justify="space-between" align="center" wrap="nowrap" gap="xs">
                      <Group gap="xs" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                        <VegNonVegIcon isNonVeg={item.isNonVeg} size={15} />
                        <Box style={{ minWidth: 0 }}>
                          <Group gap={6} align="center">
                            <Text fw={700} size="xs" lineClamp={1}>
                              {item.name}
                            </Text>
                            <Badge size="xs" variant="outline" color="gray">
                              ×{item.qty}
                            </Badge>
                            {item.round && item.round > 1 && (
                              <Badge size="xs" variant="light" color="indigo">
                                Round {item.round}
                              </Badge>
                            )}
                          </Group>
                          {item.variant && (
                            <Text size="10px" c="dimmed">
                              Variant: {item.variant}
                            </Text>
                          )}
                          {item.note && (
                            <Text size="10px" c="orange" fw={600}>
                              Note: {item.note}
                            </Text>
                          )}
                        </Box>
                      </Group>

                      <Badge
                        size="sm"
                        color={meta.color}
                        variant={meta.variant}
                        leftSection={<StatusIcon size={12} />}
                        style={{ flexShrink: 0 }}
                      >
                        {meta.label}
                      </Badge>
                    </Group>
                  </Paper>
                );
              })}
            </Stack>

            {/* Active Waiter Call Notification */}
            {order.activeWaiterRequest && (
              <Alert
                icon={<IconBellRinging size={16} />}
                title="Waiter Assistance Requested"
                color="orange"
                radius="md"
                mb="md"
                variant="light"
              >
                Requested for: <strong>{order.activeWaiterRequest.serviceLabel || order.activeWaiterRequest.serviceType}</strong> • Staff has been notified and is heading to your table.
              </Alert>
            )}

            {/* Seated Table Action Controls (Call Waiter, Running Bill, Order More) */}
            <Divider mb="md" />

            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xs">
              {/* 1. Add Dishes / Table Menu */}
              <Button
                color="violet"
                variant="filled"
                radius="md"
                leftSection={<IconToolsKitchen2 size={16} />}
                onClick={() => onOpenOrderMore(order)}
                fullWidth
              >
                Table Menu & Add Dishes
              </Button>

              {/* 2. Call Waiter */}
              <Button
                color="orange"
                variant="light"
                radius="md"
                leftSection={<IconBellRinging size={16} />}
                onClick={() => onOpenCallWaiter(order)}
                fullWidth
              >
                Call Waiter Service
              </Button>

              {/* 3. Running Bill */}
              <Button
                color="teal"
                variant="light"
                radius="md"
                leftSection={<IconReceipt2 size={16} />}
                onClick={() => onOpenBillBreakdown(order)}
                fullWidth
              >
                Running Bill ({formatINR(order.subtotalPaise)})
              </Button>
            </SimpleGrid>
          </Paper>
        );
      })}

      {/* ─── 2. ACTIVE WAITLIST & QUEUE TRACKER ─── */}
      {activeWaitlist.map((wait) => (
        <Paper
          key={wait.id}
          p="lg"
          radius="xl"
          withBorder
          style={{
            background: "#fff",
            borderColor: "#ffe066",
            boxShadow: "0 8px 24px rgba(250, 176, 5, 0.12)",
          }}
        >
          <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
            <Group gap="sm" align="center">
              <ThemeIcon size={44} radius="xl" color="yellow" variant="light">
                <IconUsers size={22} />
              </ThemeIcon>
              <div>
                <Group gap={6} align="center">
                  <Badge color="yellow" variant="filled" size="sm">
                    QUEUE TOKEN {wait.tokenNumber}
                  </Badge>
                  <Badge color={wait.status === "CALLED" ? "teal" : "orange"} variant="light" size="xs">
                    {wait.status === "CALLED" ? "TABLE READY!" : "WAITING IN QUEUE"}
                  </Badge>
                </Group>
                <Title order={3} style={{ fontSize: "1.1rem", fontWeight: 800, marginTop: 4 }}>
                  {wait.restaurantName} {wait.outletName ? `• ${wait.outletName}` : ""}
                </Title>
                <Text size="xs" c="dimmed">
                  Party size: {wait.partySize} guests • Seating: {wait.seatingPreference}
                </Text>
              </div>
            </Group>

            {wait.estimatedWaitMinutes != null && (
              <Box style={{ textAlign: "right" }}>
                <Text size="xs" c="dimmed">Estimated Wait</Text>
                <Text fw={800} size="md" c="orange">
                  ~{wait.estimatedWaitMinutes} mins
                </Text>
              </Box>
            )}
          </Group>

          {wait.status === "CALLED" && (
            <Alert
              icon={<IconCheck size={16} />}
              title="Your Table Is Ready!"
              color="teal"
              radius="md"
              mt="md"
              variant="filled"
            >
              Please approach the host desk. Your party is now being seated.
            </Alert>
          )}

          <Group justify="flex-end" mt="md">
            <Button
              component="a"
              href={`/q/${wait.outletId}/${encodeURIComponent(wait.tokenNumber)}`}
              color="yellow"
              variant="light"
              size="xs"
              radius="md"
              rightSection={<IconChevronRight size={14} />}
            >
              Open Live Queue Tracker
            </Button>
          </Group>
        </Paper>
      ))}

      {/* ─── 3. TODAY'S & UPCOMING RESERVATIONS ─── */}
      {activeReservations.map((res) => (
        <Paper
          key={res.id}
          p="lg"
          radius="xl"
          withBorder
          style={{
            background: "#fff",
            borderColor: "#d0ebff",
            boxShadow: "0 6px 20px rgba(34, 139, 230, 0.08)",
          }}
        >
          <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
            <Group gap="sm" align="center">
              <ThemeIcon size={44} radius="xl" color="blue" variant="light">
                <IconCalendar size={22} />
              </ThemeIcon>
              <div>
                <Group gap={6} align="center">
                  <Badge color="blue" variant="filled" size="xs">
                    RESERVED TABLE
                  </Badge>
                  <Badge color="teal" variant="light" size="xs">
                    {res.status}
                  </Badge>
                </Group>
                <Title order={3} style={{ fontSize: "1.1rem", fontWeight: 800, marginTop: 4 }}>
                  {res.restaurantName} {res.outletName ? `• ${res.outletName}` : ""}
                </Title>
                <Text size="xs" c="dimmed">
                  {res.reservationDate} at {res.startTime} • {res.partySize} Guests
                  {res.tableName ? ` • Assigned to ${res.tableName}` : ""}
                </Text>
              </div>
            </Group>

            {res.outletPhone && (
              <Button
                component="a"
                href={`tel:${res.outletPhone}`}
                variant="subtle"
                color="blue"
                size="xs"
                radius="md"
                leftSection={<IconPhone size={14} />}
              >
                Call Outlet
              </Button>
            )}
          </Group>

          {res.notes && (
            <Text size="11px" c="dimmed" mt="xs">
              Special Request: {res.notes}
            </Text>
          )}
        </Paper>
      ))}

      {/* ─── 4. EMPTY STATE (When no active dining session) ─── */}
      {!hasAnyLive && (
        <Paper
          p={{ base: "xl", sm: 40 }}
          radius="xl"
          withBorder
          style={{
            textAlign: "center",
            background: "#fff",
            boxShadow: "0 8px 30px rgba(0, 0, 0, 0.04)",
          }}
        >
          <Stack align="center" gap="md" maw={460} mx="auto">
            <ThemeIcon size={70} radius="xl" color="gray" variant="light">
              <IconToolsKitchen2 size={36} />
            </ThemeIcon>

            <div>
              <Title order={2} style={{ fontSize: "1.4rem", fontWeight: 800 }}>
                No Live Dining Session Active
              </Title>
              <Text size="sm" c="dimmed" mt={6} style={{ lineHeight: 1.5 }}>
                When you visit any Logix Dine restaurant and sit at a table, your table session, real-time kitchen preparation status, table menu, and service controls will appear right here.
              </Text>
            </div>

            <Divider w="100%" my="xs" />

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" w="100%">
              <Button
                color="blue"
                variant="light"
                radius="md"
                leftSection={<IconCalendar size={16} />}
                onClick={onOpenReservationModal}
              >
                Book a Table
              </Button>
              <Button
                color="teal"
                variant="light"
                radius="md"
                leftSection={<IconReceipt2 size={16} />}
                onClick={onNavigateOrders}
              >
                View Past Receipts
              </Button>
            </SimpleGrid>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
