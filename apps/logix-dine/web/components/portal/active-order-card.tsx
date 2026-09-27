"use client";

import React, { useState, useEffect } from "react";
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
  IconMotorbike,
  IconPhoneCall,
  IconShoppingBag,
  IconMapPin,
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

  useEffect(() => {
    if (serverReq) {
      setLastWaiterCall(null);
    }
  }, [serverReq]);

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
    const isDelivery = order.orderType === "DELIVERY" || Boolean(order.delivery) || order.tableNo === "Delivery";
    const isTakeaway = (order.tableNo || "").toLowerCase() === "takeaway" || order.orderType === "TAKEAWAY";
    const restaurantName = order.restaurantName || order.outlet?.restaurantName || "Restaurant";
    const outletName = order.outletName || order.outlet?.name || "";
    const channelLabel = isDelivery ? "Direct Delivery" : isTakeaway ? "Takeaway" : `Table: ${order.tableNo}`;

    const itemsText = order.items
      .map((it) => {
        const variantText = it.variant?.name
          ? ` (${it.variant.name})`
          : it.variant
          ? ` (${typeof it.variant === "object" ? it.variant.name : it.variant})`
          : "";
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
    const chargesLines: string[] = [];
    if (packagingChargePaise > 0) {
      chargesLines.push(`Packaging Charge: ${formatINR(packagingChargePaise)}`);
    }
    if (deliveryChargePaise > 0) {
      chargesLines.push(`Delivery Fee: ${formatINR(deliveryChargePaise)}`);
    }

    const message = `*Logix Dine Bill Summary*
*${restaurantName}*${outletName ? ` (${outletName})` : ""}
Token #${order.tokenNo || order.orderNo || "N/A"} | ${channelLabel}
--------------------------------
${itemsText}
--------------------------------
${chargesLines.length > 0 ? `Items Subtotal: ${formatINR(itemsSubtotalPaise)}\n${chargesLines.join("\n")}\n--------------------------------\n` : ""}*Running Total: ${formatINR(order.subtotalPaise)}*
Enjoying dining with Logix Dine!`;

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

  const isDelivery = order.orderType === "DELIVERY" || Boolean(order.delivery) || order.tableNo === "Delivery";
  const isTakeaway = (order.tableNo || "").toLowerCase() === "takeaway" || order.orderType === "TAKEAWAY";
  const restaurantName = order.restaurantName || order.outlet?.restaurantName || "Restaurant";
  const outletName = order.outletName || order.outlet?.name || "";
  const qrSettings = order.outlet?.qrMenuSettings || (order as any).qrMenuSettings;
  const allowCallWaiter = qrSettings?.allowCallWaiter !== false;
  const allowCustomerOrdering = qrSettings?.allowCustomerOrdering !== false;
  const allowPayAtTable = qrSettings?.allowPayAtTable !== false;

  return (
    <>
      <Card
        radius="lg"
        withBorder
        shadow="sm"
        p={{ base: "sm", sm: "md" }}
        style={{
          borderColor: isDelivery ? "rgba(12, 166, 120, 0.4)" : "rgba(175, 115, 215, 0.35)",
          borderLeft: isDelivery ? "5px solid #0ca678" : "5px solid #af73d7",
          backgroundColor: "#fff",
        }}
      >
        {/* Card Header */}
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="xs">
          <div>
            <Group gap={6} align="center" wrap="wrap">
              <Text fw={800} size="md">
                {restaurantName}
              </Text>
              {outletName && (
                <Text size="xs" c="dimmed">
                  • {outletName}
                </Text>
              )}
            </Group>
            <Group gap={6} mt={4} wrap="wrap">
              <Badge color="violet" variant="light" size="sm">
                Token #{order.tokenNo || order.orderNo || "—"}
              </Badge>
              {isDelivery ? (
                <Badge color="teal" variant="filled" size="sm" leftSection={<IconMotorbike size={12} />}>
                  Delivery
                </Badge>
              ) : isTakeaway ? (
                <Badge color="teal" variant="light" size="sm" leftSection={<IconShoppingBag size={12} />}>
                  Takeaway
                </Badge>
              ) : (
                <Badge color="dark" variant="light" size="sm" leftSection={<IconToolsKitchen2 size={12} />}>
                  Table: {order.tableNo}
                </Badge>
              )}
              {renderOrderStatusBadge(order.orderStatus)}
            </Group>
          </div>

          <Box style={{ textAlign: "right" }}>
            <Text size="xs" c="dimmed" fw={500}>
              Running Bill
            </Text>
            <Text fw={800} size="xl" style={{ color: isDelivery ? "#0ca678" : "#af73d7" }}>
              {formatINR(order.subtotalPaise)}
            </Text>
          </Box>
        </Group>

        {/* Delivery Order Info Banner */}
        {isDelivery && (
          <Paper
            mt="sm"
            p="xs"
            radius="md"
            style={{
              backgroundColor: "#f0fdf4",
              border: "1px solid #bbf7d0",
            }}
          >
            <Group justify="space-between" align="center" wrap="wrap" gap="xs">
              <Group gap={8} align="flex-start">
                <ThemeIcon size={28} radius="xl" color="teal" variant="light" mt={2}>
                  <IconMotorbike size={16} />
                </ThemeIcon>
                <div>
                  <Group gap={6} align="center">
                    <Text size="xs" fw={700} c="teal.9">
                      {order.delivery?.status === "OUT_FOR_DELIVERY"
                        ? "Rider is Out for Delivery!"
                        : order.delivery?.status === "ASSIGNED"
                        ? "Rider Assigned"
                        : order.delivery?.status === "DELIVERED"
                        ? "Order Delivered"
                        : "Delivery Order Confirmed"}
                    </Text>
                    {order.delivery?.deliveryOtp && (
                      <Badge color="teal" variant="filled" size="xs">
                        Delivery PIN: {order.delivery.deliveryOtp}
                      </Badge>
                    )}
                  </Group>
                  {order.delivery?.riderName && (
                    <Text size="xs" c="dimmed">
                      Rider: {order.delivery.riderName} {order.delivery.riderPhone ? `(${order.delivery.riderPhone})` : ""}
                    </Text>
                  )}
                  {order.delivery?.addressLine1 && (
                    <Group gap={4} align="center" wrap="nowrap">
                      <IconMapPin size={12} color="var(--mantine-color-dimmed)" />
                      <Text size="xs" c="dimmed" lineClamp={1}>
                        {order.delivery.addressLine1}{order.delivery.landmark ? ` (${order.delivery.landmark})` : ""}
                      </Text>
                    </Group>
                  )}
                </div>
              </Group>

              {order.delivery?.riderPhone && (
                <Button
                  component="a"
                  href={`tel:${order.delivery.riderPhone}`}
                  size="xs"
                  variant="light"
                  color="teal"
                  leftSection={<IconPhoneCall size={12} />}
                >
                  Call Rider
                </Button>
              )}
            </Group>
          </Paper>
        )}

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
                leftSection={activeWaiterCall.status === "COMPLETED" ? <IconCheck size={10} /> : undefined}
              >
                {activeWaiterCall.status === "COMPLETED"
                  ? "Resolved"
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
            {!isDelivery && !isTakeaway && allowCallWaiter && (
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
            )}

            {!isDelivery && allowCustomerOrdering && (
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
            )}

            {isDelivery && order.delivery?.riderPhone && (
              <Button
                component="a"
                href={`tel:${order.delivery.riderPhone}`}
                color="teal"
                variant="filled"
                size="xs"
                radius="md"
                leftSection={<IconPhoneCall size={14} />}
              >
                Call Rider
              </Button>
            )}

            {allowPayAtTable && (
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
            )}
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
                      {/* Left: Qty + Name with Veg/Non-veg + Status */}
                      <Group gap="xs" wrap="nowrap" align="flex-start" style={{ flex: 1, minWidth: 0 }}>
                        <Badge
                          size="sm"
                          variant="light"
                          color="dinePrimary"
                          radius="sm"
                          px={6}
                          style={{
                            flexShrink: 0,
                            fontWeight: 700,
                            fontSize: "11px",
                            minWidth: 26,
                            textAlign: "center",
                            marginTop: 1,
                          }}
                        >
                          {item.qty} ×
                        </Badge>

                        <Box style={{ minWidth: 0, flex: 1 }}>
                          <Group gap={6} align="flex-start" wrap="wrap">
                            <Text size="sm" fw={600} lineClamp={2} style={{ lineHeight: 1.35 }}>
                              <span
                                style={{
                                  display: "inline-flex",
                                  verticalAlign: "text-top",
                                  marginRight: 6,
                                }}
                              >
                                <VegNonVegIcon isNonVeg={item.isNonVeg} size={14} />
                              </span>
                              {item.name}
                            </Text>
                            {renderItemStatusBadge(item.status)}
                          </Group>

                          {/* Variant & Addons */}
                          {item.variant?.name && !item.name.toLowerCase().includes(item.variant.name.toLowerCase()) && (
                            <Badge size="xs" variant="outline" color="gray" mt={2} ml={20}>
                              {item.variant.name}
                            </Badge>
                          )}
                          {item.addons && item.addons.length > 0 && (
                            <Text size="xs" c="dimmed" ml={20}>
                              +{item.addons.map((a: any) => a.name).join(", ")}
                            </Text>
                          )}

                          {/* Item Cooking Note */}
                          {item.note && (
                            <Paper
                              mt={4}
                              ml={20}
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
                      <Box style={{ textAlign: "right", flexShrink: 0 }}>
                        <Text size="sm" fw={700}>
                          {formatINR(item.pricePaise * item.qty)}
                        </Text>
                        {item.qty > 1 && (
                          <Text size="10px" c="dimmed">
                            ({formatINR(item.pricePaise)} each)
                          </Text>
                        )}
                      </Box>
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
        onRequestBill={() => handleWaiterCallSuccess("Request Bill")}
      />
    </>
  );
}
