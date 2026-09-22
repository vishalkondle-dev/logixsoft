"use client";

import React, { useState } from "react";
import {
  Card,
  Group,
  Stack,
  Text,
  Badge,
  Button,
  Divider,
  Progress,
  Paper,
  Box,
  ThemeIcon,
  Tooltip,
  ActionIcon,
} from "@mantine/core";
import {
  IconFlame,
  IconReceipt,
  IconClock,
  IconToolsKitchen2,
  IconBellRinging,
  IconPlus,
  IconBrandWhatsapp,
  IconCheck,
  IconChecks,
  IconCircleDot,
  IconAlertCircle,
  IconShare,
  IconNotes,
} from "@tabler/icons-react";
import { VegNonVegIcon } from "@/components/common/veg-nonveg-icon";
import type { CustomerPortalOrder, CustomerOrderItem } from "@/lib/api-client";
import { CallWaiterModal } from "./call-waiter-modal";
import { BillBreakdownModal } from "./bill-breakdown-modal";
import { OrderMoreDrawer } from "./order-more-drawer";

interface ActiveOrderCardProps {
  order: CustomerPortalOrder;
  onRefresh?: () => void;
}

function formatINR(paise?: number | null): string {
  if (paise == null) return "₹0.00";
  return `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function ActiveOrderCard({ order, onRefresh }: ActiveOrderCardProps) {
  const [isWaiterModalOpen, setIsWaiterModalOpen] = useState(false);
  const [isOrderMoreOpen, setIsOrderMoreOpen] = useState(false);
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [lastWaiterCall, setLastWaiterCall] = useState<{ label: string; time: string } | null>(null);

  // Merge server activeWaiterRequest with local optimistic lastWaiterCall
  const serverReq = order.activeWaiterRequest;
  const activeWaiterCall = React.useMemo(() => {
    if (serverReq && serverReq.status !== "CANCELLED") {
      const time = serverReq.createdAt
        ? new Date(serverReq.createdAt).toLocaleTimeString("en-IN", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })
        : "";
      return {
        label: serverReq.serviceLabel,
        time,
        status: serverReq.status, // PENDING | IN_PROGRESS | COMPLETED
      };
    }
    if (lastWaiterCall) {
      return {
        label: lastWaiterCall.label,
        time: lastWaiterCall.time,
        status: "PENDING" as const,
      };
    }
    return null;
  }, [serverReq, lastWaiterCall]);

  // Group items by round
  const itemsByRound = React.useMemo(() => {
    const map = new Map<number, CustomerOrderItem[]>();
    order.items.forEach((item) => {
      const r = item.round || 1;
      const arr = map.get(r) || [];
      arr.push(item);
      map.set(r, arr);
    });
    // Sort rounds ascending
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [order.items]);

  const progress = order.progress || {
    totalQty: order.itemsCount || 0,
    servedQty: 0,
    preparedQty: 0,
    preparingQty: 0,
    orderedQty: order.itemsCount || 0,
    percentComplete: 0,
  };

  const handleWaiterCallSuccess = (label: string) => {
    const time = new Date().toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    setLastWaiterCall({ label, time });
  };

  const shareReceiptWhatsApp = () => {
    const itemsText = order.items
      .map(
        (it) =>
          `• ${it.name} × ${it.qty} = ₹${((it.pricePaise * it.qty) / 100).toFixed(2)}`
      )
      .join("\n");

    const message = `🧾 *Logix Dine Bill Summary*
🍽️ *${order.restaurantName}* (${order.outletName})
🎫 Token #${order.tokenNo || "N/A"} | Table: ${order.tableNo}
--------------------------------
${itemsText}
--------------------------------
💰 *Running Total: ${formatINR(order.subtotalPaise)}*
🙏 Enjoying dining with Logix Dine!`;

    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  const renderItemStatusBadge = (status?: string) => {
    const s = (status || "ORDERED").toUpperCase();
    switch (s) {
      case "ORDERED":
        return (
          <Badge
            size="xs"
            color="blue"
            variant="light"
            leftSection={<IconClock size={11} />}
          >
            Received
          </Badge>
        );
      case "PREPARING":
        return (
          <Badge
            size="xs"
            color="orange"
            variant="filled"
            leftSection={<IconFlame size={11} />}
          >
            Cooking
          </Badge>
        );
      case "PREPARED":
        return (
          <Badge
            size="xs"
            color="teal"
            variant="light"
            leftSection={<IconCheck size={11} />}
          >
            Ready
          </Badge>
        );
      case "SERVED":
        return (
          <Badge
            size="xs"
            color="green"
            variant="filled"
            leftSection={<IconChecks size={11} />}
          >
            Served
          </Badge>
        );
      case "CANCELLED":
        return (
          <Badge
            size="xs"
            color="red"
            variant="light"
            leftSection={<IconAlertCircle size={11} />}
          >
            Cancelled
          </Badge>
        );
      default:
        return (
          <Badge size="xs" color="gray" variant="light">
            {s}
          </Badge>
        );
    }
  };

  const renderOrderStatusBadge = (status?: string) => {
    const s = (status || "ORDERED").toUpperCase();
    switch (s) {
      case "PREPARING":
        return (
          <Badge color="orange" variant="filled" size="sm" leftSection={<IconFlame size={12} />}>
            Cooking in Kitchen
          </Badge>
        );
      case "PREPARED":
        return (
          <Badge color="teal" variant="filled" size="sm" leftSection={<IconCheck size={12} />}>
            Dishes Ready
          </Badge>
        );
      case "SERVED":
        return (
          <Badge color="green" variant="filled" size="sm" leftSection={<IconChecks size={12} />}>
            All Dishes Served
          </Badge>
        );
      case "BILL_PRINTED":
        return (
          <Badge color="violet" variant="filled" size="sm" leftSection={<IconReceipt size={12} />}>
            Bill Requested
          </Badge>
        );
      default:
        return (
          <Badge color="blue" variant="filled" size="sm" leftSection={<IconClock size={12} />}>
            Order Placed
          </Badge>
        );
    }
  };

  return (
    <>
      <Card
        radius="lg"
        withBorder
        shadow="sm"
        p={{ base: "sm", sm: "md" }}
        style={{
          borderColor: "rgba(175, 115, 215, 0.35)",
          borderLeft: "5px solid #af73d7",
          backgroundColor: "#fff",
        }}
      >
        {/* Card Header */}
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="xs">
          <div>
            <Group gap={6} align="center">
              <Text fw={800} size="md">
                {order.restaurantName}
              </Text>
              <Text size="xs" c="dimmed">
                • {order.outletName}
              </Text>
            </Group>
            <Group gap={6} mt={4} wrap="wrap">
              <Badge color="violet" variant="light" size="sm">
                Token #{order.tokenNo || "—"}
              </Badge>
              <Badge color="dark" variant="light" size="sm">
                Table: {order.tableNo}
              </Badge>
              {renderOrderStatusBadge(order.orderStatus)}
            </Group>
          </div>

          <Box style={{ textAlign: "right" }}>
            <Text size="xs" c="dimmed" fw={500}>
              Running Bill
            </Text>
            <Text fw={800} size="xl" style={{ color: "#af73d7" }}>
              {formatINR(order.subtotalPaise)}
            </Text>
          </Box>
        </Group>

        {/* Live Progress Bar Section */}
        <Paper
          mt="sm"
          p="xs"
          radius="md"
          withBorder
          style={{ backgroundColor: "rgba(248, 249, 250, 0.8)" }}
        >
          <Group justify="space-between" align="center" mb={6}>
            <Group gap={6} align="center">
              <ThemeIcon size={20} radius="xl" color="dinePrimary" variant="light">
                <IconToolsKitchen2 size={12} />
              </ThemeIcon>
              <Text fw={700} size="xs">
                Meal Progress
              </Text>
            </Group>
            <Text size="xs" fw={700} c="dimmed">
              {progress.servedQty} of {progress.totalQty} items served ({progress.percentComplete}%)
            </Text>
          </Group>

          <Progress
            value={progress.percentComplete}
            color={progress.percentComplete === 100 ? "teal" : "dinePrimary"}
            size="md"
            radius="xl"
            animated={progress.percentComplete < 100}
          />

          {/* Granular Counts Pill Bar */}
          <Group gap={6} mt={8} wrap="wrap">
            {progress.orderedQty > 0 && (
              <Badge size="xs" color="blue" variant="light" leftSection={<IconClock size={10} />}>
                {progress.orderedQty} Queued
              </Badge>
            )}
            {progress.preparingQty > 0 && (
              <Badge size="xs" color="orange" variant="light" leftSection={<IconFlame size={10} />}>
                {progress.preparingQty} Cooking
              </Badge>
            )}
            {progress.preparedQty > 0 && (
              <Badge size="xs" color="teal" variant="light" leftSection={<IconCheck size={10} />}>
                {progress.preparedQty} Ready
              </Badge>
            )}
            {progress.servedQty > 0 && (
              <Badge size="xs" color="green" variant="light" leftSection={<IconChecks size={10} />}>
                {progress.servedQty} Served
              </Badge>
            )}
          </Group>
        </Paper>

        {/* Waiter Assistance Alert Banner */}
        {activeWaiterCall && (
          <Paper
            mt="xs"
            p="xs"
            radius="md"
            style={{
              backgroundColor:
                activeWaiterCall.status === "COMPLETED"
                  ? "rgba(43, 138, 62, 0.08)"
                  : activeWaiterCall.status === "IN_PROGRESS"
                  ? "rgba(34, 139, 230, 0.08)"
                  : "rgba(255, 192, 0, 0.12)",
              border:
                activeWaiterCall.status === "COMPLETED"
                  ? "1px solid #40c057"
                  : activeWaiterCall.status === "IN_PROGRESS"
                  ? "1px solid #339af0"
                  : "1px solid #ffd43b",
            }}
          >
            <Group justify="space-between" align="center">
              <Group gap={6}>
                {activeWaiterCall.status === "COMPLETED" ? (
                  <IconCheck size={16} color="#2b8a3e" />
                ) : activeWaiterCall.status === "IN_PROGRESS" ? (
                  <IconClock size={16} color="#1971c2" />
                ) : (
                  <IconBellRinging size={16} color="#d9480f" />
                )}
                <Text
                  size="xs"
                  fw={600}
                  c={
                    activeWaiterCall.status === "COMPLETED"
                      ? "green.9"
                      : activeWaiterCall.status === "IN_PROGRESS"
                      ? "blue.9"
                      : "orange.9"
                  }
                >
                  {activeWaiterCall.status === "COMPLETED" ? (
                    <>Staff attended to <strong>{activeWaiterCall.label}</strong></>
                  ) : activeWaiterCall.status === "IN_PROGRESS" ? (
                    <>Staff is attending to <strong>{activeWaiterCall.label}</strong></>
                  ) : (
                    <>Staff alerted for <strong>{activeWaiterCall.label}</strong>{activeWaiterCall.time ? ` at ${activeWaiterCall.time}` : ""}</>
                  )}
                </Text>
              </Group>
              <Badge
                size="xs"
                color={
                  activeWaiterCall.status === "COMPLETED"
                    ? "green"
                    : activeWaiterCall.status === "IN_PROGRESS"
                    ? "blue"
                    : "yellow"
                }
                variant="filled"
              >
                {activeWaiterCall.status === "COMPLETED"
                  ? "Resolved ✓"
                  : activeWaiterCall.status === "IN_PROGRESS"
                  ? "Attending"
                  : "On the way"}
              </Badge>
            </Group>
          </Paper>
        )}

        {/* Order Instructions / Kitchen Notes Banner */}
        {order.note && (
          <Paper
            mt="xs"
            p="xs"
            radius="md"
            style={{
              backgroundColor: "rgba(175, 115, 215, 0.08)",
              border: "1px dashed #af73d7",
            }}
          >
            <Group gap={8} align="flex-start" wrap="nowrap">
              <ThemeIcon size={24} radius="md" color="violet" variant="light" style={{ flexShrink: 0, marginTop: 1 }}>
                <IconNotes size={14} />
              </ThemeIcon>
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Text size="xs" fw={700} c="violet.9">
                  Order Instructions:
                </Text>
                <Text size="xs" fw={500} c="dark.4" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {order.note}
                </Text>
              </Box>
            </Group>
          </Paper>
        )}

        {/* Quick Action Buttons Bar */}
        <Group justify="space-between" align="center" mt="sm" wrap="wrap" gap="xs">
          <Group gap="xs" wrap="wrap" style={{ flex: 1 }}>
            <Button
              color="orange"
              variant="filled"
              size="xs"
              radius="md"
              leftSection={<IconBellRinging size={14} />}
              onClick={() => setIsWaiterModalOpen(true)}
            >
              <Text span visibleFrom="xs">Call Waiter</Text>
              <Text span hiddenFrom="xs">Waiter</Text>
            </Button>

            <Button
              color="dinePrimary"
              variant="filled"
              size="xs"
              radius="md"
              leftSection={<IconPlus size={14} />}
              onClick={() => setIsOrderMoreOpen(true)}
            >
              <Text span visibleFrom="xs">Order More Items</Text>
              <Text span hiddenFrom="xs">+ Order Items</Text>
            </Button>

            <Button
              variant="light"
              color="violet"
              size="xs"
              radius="md"
              leftSection={<IconReceipt size={14} />}
              onClick={() => setIsBillModalOpen(true)}
            >
              <Text span visibleFrom="xs">View Bill Breakdown</Text>
              <Text span hiddenFrom="xs">Bill</Text>
            </Button>
          </Group>

          <ActionIcon
            variant="light"
            color="teal"
            size="md"
            radius="md"
            onClick={shareReceiptWhatsApp}
            title="Share on WhatsApp"
            aria-label="Share bill on WhatsApp"
          >
            <IconBrandWhatsapp size={16} />
          </ActionIcon>
        </Group>

        <Divider my="md" />

        {/* Rounds and Items List */}
        <Stack gap="md">
          {itemsByRound.map(([roundNumber, roundItems]) => (
            <Box key={roundNumber}>
              {/* Round Header */}
              <Group justify="space-between" align="center" mb={6}>
                <Group gap={6} align="center">
                  <Badge size="sm" color="violet" variant="filled">
                    Round {roundNumber}
                  </Badge>
                  <Text size="xs" fw={700} c="dimmed">
                    {roundNumber === 1 ? "Initial Order" : "Additional Items"} ({roundItems.length} items)
                  </Text>
                </Group>
                {roundItems[0]?.createdAt && (
                  <Text size="xs" c="dimmed">
                    Placed at {formatDate(roundItems[0].createdAt)}
                  </Text>
                )}
              </Group>

              {/* Items in this round */}
              <Stack gap="xs">
                {roundItems.map((item) => (
                  <Paper
                    key={item.id}
                    p="xs"
                    radius="md"
                    withBorder
                    style={{
                      backgroundColor: item.status === "SERVED" ? "rgba(43, 138, 62, 0.03)" : "#fff",
                      borderColor: item.status === "SERVED" ? "rgba(43, 138, 62, 0.25)" : "#e9ecef",
                    }}
                  >
                    <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
                      {/* Left: Veg/Non-veg + Qty + Name + Status */}
                      <Group gap="xs" wrap="nowrap" align="flex-start" style={{ flex: 1, minWidth: 0 }}>
                        <Box style={{ flexShrink: 0, marginTop: 4 }}>
                          <VegNonVegIcon isNonVeg={item.isNonVeg} size={14} />
                        </Box>

                        <Badge size="sm" circle color="dinePrimary" variant="light" style={{ flexShrink: 0 }}>
                          {item.qty}
                        </Badge>

                        <Box style={{ minWidth: 0, flex: 1 }}>
                          <Group gap={6} align="center" wrap="wrap">
                            <Text size="sm" fw={600} lineClamp={1}>
                              {item.name}
                            </Text>
                            {renderItemStatusBadge(item.status)}
                          </Group>

                          {/* Variant & Addons */}
                          {item.variant?.name && (
                            <Badge size="xs" variant="outline" color="gray" mt={2}>
                              {item.variant.name}
                            </Badge>
                          )}
                          {item.addons && item.addons.length > 0 && (
                            <Text size="xs" c="dimmed">
                              +{item.addons.map((a: any) => a.name).join(", ")}
                            </Text>
                          )}

                          {/* Item Cooking Note */}
                          {item.note && (
                            <Paper
                              mt={4}
                              p="3px 8px"
                              radius="sm"
                              withBorder
                              style={{
                                backgroundColor: "#fff9db",
                                borderColor: "#ffe066",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                maxWidth: "100%",
                              }}
                            >
                              <IconNotes size={12} color="#f59f00" style={{ flexShrink: 0 }} />
                              <Text size="xs" fw={600} c="yellow.9" style={{ wordBreak: "break-word" }}>
                                Note: {item.note}
                              </Text>
                            </Paper>
                          )}
                        </Box>
                      </Group>

                      {/* Right: Price */}
                      <Text size="sm" fw={700} style={{ flexShrink: 0 }}>
                        {formatINR(item.pricePaise * item.qty)}
                      </Text>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>

        {/* Card Footer */}
        <Divider my="sm" />
        <Group justify="space-between" align="center" wrap="wrap" gap="xs">
          <Text size="xs" c="dimmed">
            Order ID: #{order.id.slice(-8)} • Placed at {formatDate(order.createdAt)}
          </Text>
          {order.outletPhone && (
            <Button
              component="a"
              href={`tel:${order.outletPhone}`}
              size="xs"
              variant="subtle"
              color="gray"
            >
              Call Outlet ({order.outletPhone})
            </Button>
          )}
        </Group>
      </Card>

      {/* Modals & Drawers */}
      <CallWaiterModal
        opened={isWaiterModalOpen}
        onClose={() => setIsWaiterModalOpen(false)}
        order={order}
        onSuccess={handleWaiterCallSuccess}
      />

      <OrderMoreDrawer
        opened={isOrderMoreOpen}
        onClose={() => setIsOrderMoreOpen(false)}
        order={order}
        onSuccess={onRefresh}
      />

      <BillBreakdownModal
        opened={isBillModalOpen}
        onClose={() => setIsBillModalOpen(false)}
        order={order}
        onRequestBill={() => setIsWaiterModalOpen(true)}
      />
    </>
  );
}
