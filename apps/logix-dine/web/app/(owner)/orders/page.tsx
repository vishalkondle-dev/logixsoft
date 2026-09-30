"use client";

import React, { useState, useMemo } from "react";
import {
  Title, Stack, Paper, Group, Text, Badge, Select, Button,
  Loader, Center, Modal, Divider, Box, ActionIcon, Tooltip, Radio,
  SimpleGrid, Alert, SegmentedControl,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import Link from "next/link";
import {
  IconReceipt, IconPrinter, IconArrowRight, IconX,
  IconBan, IconCheck, IconCash, IconDoorExit, IconAlertCircle,
  IconUser, IconMotorbike, IconMapPin, IconNotes, IconQrcode, IconCreditCard,
} from "@tabler/icons-react";
import { useRestaurant } from "@/lib/restaurant-context";
import { useOrders } from "@/lib/queries";
import { buildKotPayload, buildBillPayload } from "@/lib/ticket";
import { printTicket } from "@/lib/print";
import { UpiQrCode } from "@/components/common/upi-qr-code";
import { useOutletSync } from "@/lib/use-outlet-sync";
import {
  updateOrderItemStatus,
  voidOrder,
  settleOrder,
  freeTableOrder,
} from "@/lib/api-client";
import {
  getStatusVisual,
  ORDER_STATUS_CONFIG,
  PAYMENT_STATUS_CONFIG,
  getNextItemStatus,
  type OrderItemStatus,
} from "@/lib/order-status-ui";
import { getOrderChannel } from "@/lib/channel-helpers";

export default function OrdersPage() {
  const { restaurant, activeOutlet, allOutlets, outlets } = useRestaurant();
  const restaurantId = restaurant?.id ?? "";
  const outletId = activeOutlet?.id ?? null;

  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [reprinting, setReprinting] = useState<"KOT" | "BILL" | null>(null);
  const [updatingAction, setUpdatingAction] = useState<{ itemId: string; action: "next" | "close" } | null>(null);

  // Settle / Free / Void modals & action state
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [settleMethod, setSettleMethod] = useState<string>("Cash");
  const [isSettling, setIsSettling] = useState(false);

  const [freeModalOpen, setFreeModalOpen] = useState(false);
  const [isFreeing, setIsFreeing] = useState(false);

  const [isVoiding, setIsVoiding] = useState(false);
  const [voidConfirmOpen, setVoidConfirmOpen] = useState(false);
  const [cancelItemConfirm, setCancelItemConfirm] = useState<{ item: any; actionPayload: any } | null>(null);

  // Real-time live sync via Cloudflare Durable Object
  const { isConnected, isConnecting } = useOutletSync(restaurantId, outletId);

  const enabled = !!restaurantId && !!outletId;

  const isDeliveryFilter = statusFilter === "DELIVERY";
  const isBillingStatus =
    statusFilter === "OPEN" ||
    statusFilter === "PARTIAL" ||
    statusFilter === "PAID" ||
    statusFilter === "VOID";
  const { data: rawOrders = [], isLoading: loading, refetch } = useOrders(
    restaurantId,
    {
      status: isBillingStatus ? statusFilter : undefined,
      orderStatus: !isBillingStatus && !isDeliveryFilter && statusFilter ? statusFilter : undefined,
      outletId: outletId ?? undefined,
      limit: 100,
    },
    enabled,
  );

  const orders = useMemo(() => {
    if (!isDeliveryFilter) return rawOrders;
    return rawOrders.filter((entry: any) =>
      entry.order?.orderType === "DELIVERY" || Boolean(entry.delivery) || entry.order?.tableNo === "Delivery"
    );
  }, [rawOrders, isDeliveryFilter]);

  const handleReprint = async (type: "KOT" | "BILL") => {
    if (!selected || !restaurant) return;
    setReprinting(type);
    try {
      const payload = type === "KOT"
        ? buildKotPayload(selected, restaurant)
        : buildBillPayload(selected, restaurant);
      const result = await printTicket(payload);
      notifications.show({
        title: `${type} reprinted`,
        message: result === "ble" ? "Sent to printer" : result === "browser" ? "Sent to browser print" : "Print failed",
        color: result === "error" ? "red" : "green",
      });
    } finally {
      setReprinting(null);
    }
  };

  const handleSettle = async () => {
    if (!selected || !restaurant) return;
    setIsSettling(true);
    try {
      const res = await settleOrder(
        restaurantId,
        selected.order.id,
        { method: settleMethod },
        outletId,
      );
      notifications.show({
        title: "Order Settled",
        message: `Order #${selected.order.orderNo} marked as paid via ${settleMethod}`,
        color: "green",
      });
      setSettleModalOpen(false);
      if (res?.order) {
        setSelected({ ...selected, order: res.order, items: res.items ?? selected.items });
      } else {
        setSelected(null);
      }
      refetch();
    } catch (err: any) {
      notifications.show({
        title: "Failed to settle order",
        message: err.message || "An error occurred",
        color: "red",
      });
    } finally {
      setIsSettling(false);
    }
  };

  const handleFreeTable = async () => {
    if (!selected || !restaurant) return;
    setIsFreeing(true);
    try {
      const paidPaise = selected.order.paidPaise ?? (selected.order.status === "PAID" ? selected.order.subtotalPaise : 0);
      const duePaise = Math.max(0, (selected.order.subtotalPaise || 0) - paidPaise);
      const res = await freeTableOrder(
        restaurantId,
        selected.order.id,
        { method: settleMethod },
        outletId,
      );
      notifications.show({
        title: "Table Freed",
        message: `Table ${selected.order.tableNo} is now vacant and ready for new guests`,
        color: "green",
      });
      setFreeModalOpen(false);
      if (res?.order) {
        setSelected({ ...selected, order: res.order, items: res.items ?? selected.items });
      } else {
        setSelected(null);
      }
      refetch();
    } catch (err: any) {
      notifications.show({
        title: "Failed to free table",
        message: err.message || "An error occurred",
        color: "red",
      });
    } finally {
      setIsFreeing(false);
    }
  };

  const handleVoid = () => {
    if (!selected || !restaurant) return;
    setVoidConfirmOpen(true);
  };

  const handleConfirmVoid = async () => {
    if (!selected || !restaurant) return;
    setIsVoiding(true);
    try {
      await voidOrder(restaurantId, selected.order.id, outletId);
      notifications.show({
        title: "Order Voided",
        message: `Order #${selected.order.orderNo} has been voided`,
        color: "orange",
      });
      setVoidConfirmOpen(false);
      setSelected(null);
      refetch();
    } catch (err: any) {
      notifications.show({
        title: "Failed to void order",
        message: err.message || "An error occurred",
        color: "red",
      });
    } finally {
      setIsVoiding(false);
    }
  };

  const handleConfirmCancelItem = async () => {
    if (!cancelItemConfirm || !selected) return;
    const { item, actionPayload } = cancelItemConfirm;
    setCancelItemConfirm(null);
    await executeUpdateItemStatus(item, actionPayload);
  };

  const handleUpdateItemStatus = async (item: any, actionPayload: { status?: string; action?: "next" | "close" | "cancel" }) => {
    if (actionPayload.action === "close" || actionPayload.action === "cancel") {
      setCancelItemConfirm({ item, actionPayload });
      return;
    }
    await executeUpdateItemStatus(item, actionPayload);
  };

  const executeUpdateItemStatus = async (item: any, actionPayload: { status?: string; action?: "next" | "close" | "cancel" }) => {
    if (!selected) return;
    const itemId = item.id;
    const actionType = actionPayload.action === "close" || actionPayload.action === "cancel" ? "close" : "next";
    setUpdatingAction({ itemId, action: actionType });
    try {
      const updatedOrderWithItems = await updateOrderItemStatus(
        restaurantId,
        selected.order.id,
        itemId,
        actionPayload,
        outletId,
      );
      setSelected(updatedOrderWithItems);
      refetch();

      const actionText = actionPayload.action === "close"
        ? "Cancelled"
        : `Moved to ${actionPayload.status || "next stage"}`;
      notifications.show({
        title: "Item status updated",
        message: `${item.nameSnapshot || item.name}: ${actionText}`,
        color: actionPayload.action === "close" ? "red" : "green",
        icon: actionPayload.action === "close" ? <IconBan size={16} /> : <IconCheck size={16} />,
      });
    } catch (err: any) {
      notifications.show({
        title: "Failed to update item",
        message: err.message || "An error occurred",
        color: "red",
      });
    } finally {
      setUpdatingAction(null);
    }
  };

  if (!restaurant) return null;

  return (
    <Box pt="sm" pb={100} px={{ base: "xs", sm: "md" }}>
      <Group justify="space-between" mb="lg">
        <div>
          <Group gap="xs" align="center">
            <Title order={2}>Orders</Title>
            <Badge
              size="sm"
              variant="dot"
              color={isConnected ? "teal" : isConnecting ? "yellow" : "gray"}
            >
              {isConnected ? "Live Synced" : isConnecting ? "Connecting..." : "Offline"}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">Track order fulfillment and item progress</Text>
        </div>
        <Group>
          <Select
            size="sm"
            placeholder="All statuses"
            clearable
            value={statusFilter}
            onChange={setStatusFilter}
            data={[
              { group: "Order Type", items: [
                { value: "DELIVERY", label: "Delivery" },
              ]},
              { group: "Order Lifecycle", items: [
                { value: "ORDERED", label: "Ordered" },
                { value: "PREPARING", label: "Preparing" },
                { value: "PREPARED", label: "Prepared" },
                { value: "SERVED", label: "Served" },
                { value: "CANCELLED", label: "Cancelled" },
              ]},
              { group: "Payment Status", items: [
                { value: "OPEN", label: "Unpaid (Open)" },
                { value: "PARTIAL", label: "Partially Paid" },
                { value: "PAID", label: "Paid" },
                { value: "VOID", label: "Void" },
              ]},
            ]}
            w={170}
          />
        </Group>
      </Group>

      {!outletId ? (
        <Text c="dimmed" ta="center" py="xl">Select an outlet from the top navigation bar to view orders</Text>
      ) : loading ? (
        <Center py={60}><Loader color="dinePrimary" /></Center>
      ) : !orders.length ? (
        <Text c="dimmed" ta="center" py="xl">No orders found</Text>
      ) : (
        <Stack gap="xs">
          {orders.map((entry: any) => {
            const { order, items } = entry;
            const orderStatusVisual = getStatusVisual(order.orderStatus || "ORDERED");
            const OrderStatusIcon = orderStatusVisual.icon;
            const paymentVisual = PAYMENT_STATUS_CONFIG[order.status] || { color: "gray", label: order.status };
            const paidPaise = order.paidPaise ?? (order.status === "PAID" ? order.subtotalPaise : 0);
            const duePaise = Math.max(0, (order.subtotalPaise || 0) - paidPaise);
            const maxRound = (items || []).reduce((max: number, it: any) => Math.max(max, it.round || 1), 1);
            const isDelivery = order.orderType === "DELIVERY" || Boolean(entry.delivery) || order.tableNo === "Delivery";
            const channel = getOrderChannel(order, entry.delivery);
            const isTable = Boolean(!isDelivery && !channel && order.tableNo && order.tableNo !== "Takeaway");
            const isTableFreed = Boolean(order.tableFreedAt);

            return (
              <Paper
                key={order.id}
                p="md"
                radius="md"
                onClick={() => setSelected(entry)}
                style={{ cursor: "pointer" }}
              >
                <Group justify="space-between">
                  <Group gap="xs" align="center" wrap="wrap">
                    <Text fw={700}>#{order.orderNo}</Text>
                    {order.id && (
                      <Badge size="xs" variant="light" color="gray" style={{ textTransform: "none", fontFamily: "monospace" }}>
                        {order.id}
                      </Badge>
                    )}
                    {channel ? (
                      <Group gap={4} align="center">
                        <Badge
                          size="xs"
                          color={channel.color}
                          variant="filled"
                          leftSection={<IconMotorbike size={11} />}
                        >
                          {channel.name}
                        </Badge>
                        {channel.tag && (
                          <Badge size="xs" color={channel.color} variant="light">
                            {channel.tag}
                          </Badge>
                        )}
                      </Group>
                    ) : isDelivery ? (
                      <Badge size="xs" color="teal" variant="filled" leftSection={<IconMotorbike size={11} />}>
                        Delivery
                      </Badge>
                    ) : order.tableNo ? (
                      <Badge size="xs" variant="outline">
                        {order.tableNo === "Takeaway" ? "Takeaway" : `T: ${order.tableNo}`}
                      </Badge>
                    ) : null}

                    {isDelivery && entry.delivery?.status && (
                      <Badge
                        size="xs"
                        variant="light"
                        color={entry.delivery.status === "DELIVERED" ? "green" : entry.delivery.status === "OUT_FOR_DELIVERY" ? "orange" : "blue"}
                        leftSection={entry.delivery.status === "OUT_FOR_DELIVERY" ? <IconMotorbike size={11} /> : undefined}
                      >
                        {entry.delivery.status === "OUT_FOR_DELIVERY" ? "Out" : entry.delivery.status === "DELIVERED" ? "Delivered" : entry.delivery.status}
                      </Badge>
                    )}

                    {isDelivery && entry.delivery?.riderName && (
                      <Badge size="xs" variant="outline" color="blue" leftSection={<IconUser size={11} />}>
                        {entry.delivery.riderName}
                      </Badge>
                    )}

                    {isTable && (
                      <Badge
                        size="xs"
                        variant={isTableFreed ? "light" : "filled"}
                        color={isTableFreed ? "gray" : order.status === "PAID" ? "teal" : "red"}
                      >
                        {isTableFreed ? "Table Freed" : "Occupied"}
                      </Badge>
                    )}
                    {maxRound > 1 && (
                      <Badge size="xs" variant="filled" color="grape">
                        ↻ {maxRound} Rounds
                      </Badge>
                    )}
                    {order.customerPhone && (
                      <Badge
                        component={Link}
                        href={`/customers/${order.customerPhone}`}
                        size="xs"
                        variant="light"
                        color="teal"
                        style={{ cursor: "pointer" }}
                        onClick={(e: any) => e.stopPropagation()}
                      >
                        {order.customerPhone}
                      </Badge>
                    )}

                    {/* Order Fulfillment Status Badge */}
                    <Badge
                      size="xs"
                      color={orderStatusVisual.color}
                      leftSection={<OrderStatusIcon size={11} />}
                    >
                      {orderStatusVisual.label}
                    </Badge>

                    {/* Payment Status Badge */}
                    <Badge
                      size="xs"
                      variant={order.status === "PAID" ? "filled" : "outline"}
                      color={paymentVisual.color}
                    >
                      {paymentVisual.label}
                    </Badge>
                  </Group>

                  <Group gap="xs" align="baseline">
                    {order.status === "PARTIAL" && duePaise > 0 ? (
                      <Group gap={6} align="baseline">
                        <Text size="xs" c="teal" fw={500}>Paid: ₹{(paidPaise / 100).toFixed(0)}</Text>
                        <Text fw={700} c="orange">Due: ₹{(duePaise / 100).toFixed(0)}</Text>
                      </Group>
                    ) : order.status === "OPEN" ? (
                      <Group gap={6} align="baseline">
                        <Text size="xs" c="dimmed">Unpaid</Text>
                        <Text fw={700} c="red">₹{((order.subtotalPaise || 0) / 100).toFixed(0)}</Text>
                      </Group>
                    ) : (
                      <Text fw={600} c="dinePrimary">₹{((order.subtotalPaise || 0) / 100).toFixed(0)}</Text>
                    )}
                    <Text size="xs" c="dimmed">
                      {new Date(order.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </Group>
                </Group>

                <Group justify="space-between" mt={6} align="center">
                  <Text size="xs" c="dimmed">
                    {items.length} item{items.length !== 1 ? "s" : ""}
                    {order.method ? ` · ${order.method}` : ""}
                    {order.kotPrintedAt ? " · KOT Printed" : ""}
                    {order.readyAt ? " · Ready" : ""}
                  </Text>
                  {/* Summary of active items progress */}
                  <Group gap={4}>
                    {items.slice(0, 4).map((it: any) => {
                      const itVisual = getStatusVisual(it.status || "ORDERED");
                      return (
                        <Badge key={it.id} size="xs" variant="dot" color={itVisual.color}>
                          {it.round && it.round > 1 ? `[R${it.round}] ` : ""}{it.nameSnapshot || it.name}
                        </Badge>
                      );
                    })}
                    {items.length > 4 && (
                      <Text size="10px" c="dimmed">+{items.length - 4} more</Text>
                    )}
                  </Group>
                </Group>
              </Paper>
            );
          })}
        </Stack>
      )}

      {/* Order Detail & Items Management Modal */}
      <Modal
        opened={!!selected}
        onClose={() => setSelected(null)}
        title={
          selected ? (
            <Group gap="xs" align="center">
              <Text fw={700}>Order #{selected.order.orderNo}</Text>
              <Badge size="xs" variant="light" color="gray" style={{ textTransform: "none", fontFamily: "monospace" }}>
                {selected.order.id}
              </Badge>
            </Group>
          ) : "Order"
        }
        size="lg"
      >
        {selected && (() => {
          const { order, items } = selected;
          const orderStatusVisual = getStatusVisual(order.orderStatus || "ORDERED");
          const OrderStatusIcon = orderStatusVisual.icon;
          const paymentVisual = PAYMENT_STATUS_CONFIG[order.status] || { color: "gray", label: order.status };
          const paidPaise = order.paidPaise ?? (order.status === "PAID" ? order.subtotalPaise : 0);
          const duePaise = Math.max(0, (order.subtotalPaise || 0) - paidPaise);
          const maxRound = (items || []).reduce((max: number, it: any) => Math.max(max, it.round || 1), 1);
          const isDelivery = order.orderType === "DELIVERY" || order.tableNo === "Delivery" || Boolean(selected.delivery);
          const channel = getOrderChannel(order, selected.delivery);
          const isTakeaway = !isDelivery && !channel && (order.orderType === "TAKEAWAY" || order.tableNo === "Takeaway");
          const isTable = Boolean(!isDelivery && !isTakeaway && !channel && order.tableNo);
          const isTableFreed = Boolean(order.tableFreedAt);

          return (
            <Stack gap="sm">
              {/* Header Badges & Table Occupancy */}
              <Group justify="space-between" align="center" wrap="wrap">
                <Group gap="xs" align="center">
                  {channel ? (
                    <Group gap={4} align="center">
                      <Badge size="sm" color={channel.color} variant="filled" leftSection={<IconMotorbike size={12} />}>
                        {channel.name} Delivery
                      </Badge>
                      {channel.tag && (
                        <Badge size="sm" color={channel.color} variant="light">
                          {channel.tag}
                        </Badge>
                      )}
                    </Group>
                  ) : order.tableNo ? (
                    <Badge size="sm" variant="outline">
                      {isDelivery ? "Delivery" : isTakeaway ? "Takeaway" : `Table: ${order.tableNo}`}
                    </Badge>
                  ) : null}
                  {isTable && (
                    <Badge
                      size="sm"
                      variant={isTableFreed ? "light" : "filled"}
                      color={isTableFreed ? "gray" : order.status === "PAID" ? "teal" : "red"}
                      leftSection={isTableFreed ? <IconDoorExit size={12} /> : undefined}
                    >
                      {isTableFreed ? "Table Freed" : "Occupied"}
                    </Badge>
                  )}
                  {maxRound > 1 && (
                    <Badge size="sm" variant="filled" color="grape">
                      ↻ {maxRound} Rounds
                    </Badge>
                  )}
                </Group>

                <Group gap="xs">
                  <Badge color={orderStatusVisual.color} leftSection={<OrderStatusIcon size={12} />}>
                    {orderStatusVisual.label}
                  </Badge>
                  <Badge variant="filled" color={paymentVisual.color}>
                    {paymentVisual.label}
                  </Badge>
                </Group>
              </Group>

              {order.customerPhone && (
                <Group gap="xs" align="center">
                  <Text size="xs" c="dimmed">Customer: <b>{order.customerPhone}</b></Text>
                  <Button
                    component={Link}
                    href={`/customers/${order.customerPhone}`}
                    size="compact-xs"
                    variant="light"
                    color="dinePrimary"
                    leftSection={<IconUser size={12} />}
                  >
                    View Profile
                  </Button>
                </Group>
              )}

              {/* Delivery Details Card if delivery order */}
              {(Boolean(selected.delivery) || isDelivery || channel) && (
                <Paper p="sm" radius="md" withBorder style={{ backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }}>
                  <Group justify="space-between" align="center" mb={6}>
                    <Group gap={6} align="center">
                      <IconMotorbike size={14} color="var(--mantine-color-teal-9)" />
                      <Text size="xs" fw={700} c="teal.9">
                        DELIVERY DETAILS {channel ? `(${channel.name.toUpperCase()})` : ""}
                      </Text>
                    </Group>
                    {channel ? (
                      <Badge size="xs" color={channel.color} variant="filled">
                        via {channel.name}
                      </Badge>
                    ) : selected.delivery?.status ? (
                      <Badge size="xs" color="teal" variant="filled">
                        {selected.delivery.status}
                      </Badge>
                    ) : null}
                  </Group>

                  <Stack gap={4}>
                    {selected.delivery?.customerName && (
                      <Text size="xs">Recipient: <b>{selected.delivery.customerName}</b></Text>
                    )}
                    {selected.delivery?.addressLine1 && (
                      <Group gap={4} align="center" wrap="nowrap">
                        <IconMapPin size={12} color="var(--mantine-color-dimmed)" />
                        <Text size="xs">Address: {selected.delivery.addressLine1}{selected.delivery.landmark ? ` (${selected.delivery.landmark})` : ""}</Text>
                      </Group>
                    )}
                    {selected.delivery?.pincode && (
                      <Text size="xs">Pincode: {selected.delivery.pincode}</Text>
                    )}
                    {selected.delivery?.deliveryNotes && (
                      <Group gap={4} align="center" wrap="nowrap">
                        <IconNotes size={12} color="var(--mantine-color-orange-8)" />
                        <Text size="xs" c="orange.8">Note: {selected.delivery.deliveryNotes}</Text>
                      </Group>
                    )}
                    {selected.delivery?.riderName && (
                      <Group gap={4} align="center" wrap="nowrap">
                        <IconUser size={12} color="var(--mantine-color-blue-8)" />
                        <Text size="xs" c="blue.8">Rider: <b>{selected.delivery.riderName}</b> {selected.delivery.riderPhone ? `(${selected.delivery.riderPhone})` : ""}</Text>
                      </Group>
                    )}
                    {!channel && selected.delivery?.deliveryOtp && (
                      <Group gap={6} mt={2}>
                        <Text size="xs" fw={600}>Delivery PIN:</Text>
                        <Badge size="xs" color="teal" variant="outline">{selected.delivery.deliveryOtp}</Badge>
                      </Group>
                    )}
                    {((selected.order?.packagingChargePaise || 0) > 0 || (selected.order?.deliveryChargePaise || 0) > 0) && (
                      <Text size="xs" c="dimmed" mt={2}>
                        Packaging: ₹{((selected.order?.packagingChargePaise || 0) / 100).toFixed(0)} | Delivery Fee: ₹{((selected.order?.deliveryChargePaise || 0) / 100).toFixed(0)}
                      </Text>
                    )}
                  </Stack>
                </Paper>
              )}

              <Divider my="xs" label={`Order Items (${items.length})`} labelPosition="center" />

              <Stack gap="xs">
                {([...(items || [])].sort((a: any, b: any) => (a.round || 1) - (b.round || 1) || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())).map((item: any) => {
                  const itemStatus = item.status || "ORDERED";
                  const isCancelled = itemStatus === "CANCELLED";
                  const isServed = itemStatus === "SERVED";
                  const itemVisual = getStatusVisual(itemStatus);
                  const ItemIcon = itemVisual.icon;
                  const nextStatus = getNextItemStatus(itemStatus);
                  const canNext = Boolean(nextStatus);
                  const canClose = !isCancelled && !isServed;
                  const itemIsPaid = item.paymentStatus === "PAID" || order.status === "PAID";

                  const isThisItemUpdating = updatingAction?.itemId === item.id;
                  const isNextLoading = isThisItemUpdating && updatingAction?.action === "next";
                  const isCloseLoading = isThisItemUpdating && updatingAction?.action === "close";
                  const isNextDisabled = isThisItemUpdating && !isNextLoading;
                  const isCloseDisabled = isThisItemUpdating && !isCloseLoading;

                  return (
                    <Paper
                      key={item.id}
                      p="xs"
                      radius="sm"
                      style={{
                        backgroundColor: isCancelled ? "rgba(255, 0, 0, 0.03)" : undefined,
                        opacity: isCancelled ? 0.7 : 1,
                      }}
                    >
                      {/* Desktop layout: item on left, status + actions on right */}
                      <Group justify="space-between" align="center" wrap="nowrap" visibleFrom="sm">
                        {/* Left side: item details */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Group gap="xs" align="center" wrap="wrap">
                            <Text
                              size="sm"
                              fw={600}
                              style={{ textDecoration: isCancelled ? "line-through" : "none" }}
                            >
                              {item.nameSnapshot || item.name}
                            </Text>
                            {item.variant && (
                              <Badge size="xs" variant="light" color="blue">
                                {item.variant.name}
                              </Badge>
                            )}
                            <Badge size="xs" variant="light" color="gray">× {item.qty}</Badge>
                            {maxRound > 1 && (
                              <Badge size="xs" variant="light" color="grape">
                                Round {item.round || 1}
                              </Badge>
                            )}
                            <Badge
                              size="xs"
                              variant="light"
                              color={itemIsPaid ? "teal" : "orange"}
                            >
                              {itemIsPaid ? "Paid" : "Unpaid"}
                            </Badge>
                            <Text size="sm" c="dimmed">
                              ₹{(((item.pricePaiseSnapshot ?? item.pricePaise ?? 0) * item.qty) / 100).toFixed(0)}
                            </Text>
                          </Group>

                          {Array.isArray(item.addons) && item.addons.length > 0 && (
                            <Text size="xs" c="dimmed" mt={2}>
                              + {item.addons.map((a: any) => a.name).join(", ")}
                            </Text>
                          )}

                          {item.note && (
                            <Text size="xs" c="dinePrimary" fs="italic" mt={2}>
                              Note: {item.note}
                            </Text>
                          )}
                        </div>

                        {/* Right side: Status badge, Next button, Close button */}
                        <Group gap={6} align="center" wrap="nowrap">
                          <Badge
                            size="sm"
                            variant="light"
                            color={itemVisual.color}
                            leftSection={<ItemIcon size={12} />}
                          >
                            {itemVisual.label}
                          </Badge>

                          {/* Next Button */}
                          {canNext && nextStatus && (
                            <Tooltip label={`Next: Mark ${getStatusVisual(nextStatus).label}`} withArrow position="top">
                              <ActionIcon
                                size="md"
                                variant="light"
                                color="dinePrimary"
                                loading={isNextLoading}
                                disabled={isNextDisabled}
                                onClick={() => handleUpdateItemStatus(item, { action: "next" })}
                                aria-label={`Advance item to ${nextStatus}`}
                              >
                                <IconArrowRight size={15} />
                              </ActionIcon>
                            </Tooltip>
                          )}

                          {/* Close / Cancel Button */}
                          {canClose && (
                            <Tooltip label="Close (Cancel item)" withArrow position="top">
                              <ActionIcon
                                size="md"
                                variant="subtle"
                                color="red"
                                loading={isCloseLoading}
                                disabled={isCloseDisabled}
                                onClick={() => handleUpdateItemStatus(item, { action: "close" })}
                                aria-label="Cancel item"
                              >
                                <IconX size={15} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </Group>
                      </Group>

                      {/* Small screens layout: 2-row clean card with icons only */}
                      <Stack gap={6} hiddenFrom="sm">
                        {/* Row 1: Item name & quantity on left, price on right */}
                        <Group justify="space-between" align="flex-start" wrap="nowrap">
                          <Group gap="xs" align="center" style={{ flex: 1, minWidth: 0 }} wrap="wrap">
                            <Text
                              size="sm"
                              fw={600}
                              style={{ textDecoration: isCancelled ? "line-through" : "none", wordBreak: "break-word" }}
                            >
                              {item.nameSnapshot || item.name}
                            </Text>
                            {item.variant && (
                              <Badge size="xs" variant="light" color="blue">
                                {item.variant.name}
                              </Badge>
                            )}
                            <Badge size="xs" variant="light" color="gray" style={{ flexShrink: 0 }}>× {item.qty}</Badge>
                          </Group>
                          <Text size="sm" fw={700} c="dimmed" style={{ flexShrink: 0, marginLeft: 8 }}>
                            ₹{(((item.pricePaiseSnapshot ?? item.pricePaise ?? 0) * item.qty) / 100).toFixed(0)}
                          </Text>
                        </Group>

                        {Array.isArray(item.addons) && item.addons.length > 0 && (
                          <Text size="xs" c="dimmed">
                            + {item.addons.map((a: any) => a.name).join(", ")}
                          </Text>
                        )}

                        {item.note && (
                          <Text size="xs" c="dinePrimary" fs="italic">
                            Note: {item.note}
                          </Text>
                        )}

                        {/* Row 2: Badges on left (Rounds, Payment, Status), Action icons on right */}
                        <Group justify="space-between" align="center" mt={2} wrap="wrap">
                          <Group gap={6} align="center" wrap="wrap">
                            {maxRound > 1 && (
                              <Badge size="xs" variant="light" color="grape" style={{ flexShrink: 0 }}>
                                R{item.round || 1}
                              </Badge>
                            )}
                            <Badge
                              size="xs"
                              variant="light"
                              color={itemIsPaid ? "teal" : "orange"}
                              style={{ flexShrink: 0 }}
                            >
                              {itemIsPaid ? "Paid" : "Unpaid"}
                            </Badge>
                            <Badge
                              size="sm"
                              variant="light"
                              color={itemVisual.color}
                              leftSection={<ItemIcon size={12} />}
                              style={{ flexShrink: 0 }}
                            >
                              {itemVisual.label}
                            </Badge>
                          </Group>

                          <Group gap={6} align="center">
                            {canNext && nextStatus && (
                              <Tooltip label={`Next: Mark ${getStatusVisual(nextStatus).label}`} withArrow position="top">
                                <ActionIcon
                                  size="md"
                                  variant="light"
                                  color="dinePrimary"
                                  loading={isNextLoading}
                                  disabled={isNextDisabled}
                                  onClick={() => handleUpdateItemStatus(item, { action: "next" })}
                                  aria-label={`Advance item to ${nextStatus}`}
                                >
                                  <IconArrowRight size={15} />
                                </ActionIcon>
                              </Tooltip>
                            )}

                            {canClose && (
                              <Tooltip label="Cancel item" withArrow position="top">
                                <ActionIcon
                                  size="md"
                                  variant="subtle"
                                  color="red"
                                  loading={isCloseLoading}
                                  disabled={isCloseDisabled}
                                  onClick={() => handleUpdateItemStatus(item, { action: "close" })}
                                  aria-label="Cancel item"
                                >
                                  <IconX size={15} />
                                </ActionIcon>
                              </Tooltip>
                            )}
                          </Group>
                        </Group>
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>

              <Divider my="xs" />

              {/* Financial Breakdown Summary Box */}
              <Paper p="sm" radius="md">
                <Group justify="space-between" align="center" mb={8}>
                  <Text size="sm" fw={700}>Financial Summary</Text>
                  <Badge
                    size="md"
                    color={(duePaise === 0 || order.status === "PAID") ? "teal" : order.status === "PARTIAL" ? "orange" : "red"}
                    variant="filled"
                  >
                    {(duePaise === 0 || order.status === "PAID") ? "PAID IN FULL" : `DUE BALANCE: ₹${(duePaise / 100).toFixed(0)}`}
                  </Badge>
                </Group>

                {Array.isArray((order as any).adjustments) && (order as any).adjustments.length > 0 && (
                  <Stack gap={4} mb="xs" p="xs" style={{ background: "var(--mantine-color-gray-0)", borderRadius: 6, border: "1px dashed var(--mantine-color-gray-3)" }}>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">Items Subtotal</Text>
                      <Text size="xs" fw={600}>
                        ₹{(
                          (selected.items?.reduce((sum: number, it: any) => {
                            if (it.status === "CANCELLED") return sum;
                            return sum + (it.pricePaiseSnapshot ?? it.pricePaise ?? 0) * (it.qty ?? 1);
                          }, 0) || 0) / 100
                        ).toFixed(0)}
                      </Text>
                    </Group>
                    {((order as any).adjustments as any[]).map((adj, idx) => {
                      const isDiscount = adj.isDiscount || String(adj.value || "").startsWith("-") || (adj.amountPaise !== undefined && adj.amountPaise < 0);
                      const itemsTotal = selected.items?.reduce((sum: number, it: any) => {
                        if (it.status === "CANCELLED") return sum;
                        return sum + (it.pricePaiseSnapshot ?? it.pricePaise ?? 0) * (it.qty ?? 1);
                      }, 0) || 0;
                      const amountPaise = adj.amountPaise !== undefined
                        ? Math.abs(adj.amountPaise)
                        : (String(adj.value).endsWith("%")
                            ? Math.round((itemsTotal * Math.abs(parseFloat(adj.value))) / 100)
                            : Math.round(Math.abs(parseFloat(adj.value) || 0) * 100));
                      return (
                        <Group key={adj.id || idx} justify="space-between">
                          <Group gap={6}>
                            <Text size="xs" c={isDiscount ? "teal" : "dimmed"}>{adj.label}</Text>
                            <Badge size="xs" variant="light" color={isDiscount ? "teal" : "gray"}>{adj.value}</Badge>
                          </Group>
                          <Text size="xs" fw={600} c={isDiscount ? "teal" : "dark"}>
                            {isDiscount ? "-" : "+"}₹{(amountPaise / 100).toFixed(0)}
                          </Text>
                        </Group>
                      );
                    })}
                  </Stack>
                )}

                <SimpleGrid cols={{ base: 3, sm: 3 }} spacing="xs">
                  <div>
                    <Text size="xs" c="dimmed">Total Bill</Text>
                    <Text size="md" fw={700} c="dark">₹{((order.subtotalPaise || 0) / 100).toFixed(0)}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Total Paid</Text>
                    <Text size="md" fw={700} c="teal">₹{(paidPaise / 100).toFixed(0)}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Balance Due</Text>
                    <Text size="md" fw={700} c={duePaise > 0 ? "orange" : "gray"}>
                      ₹{(duePaise / 100).toFixed(0)}
                    </Text>
                  </div>
                </SimpleGrid>

                {(order.method || order.kotPrintedAt || order.readyAt || order.settledAt || order.tableFreedAt) && (
                  <Group gap="md" mt="xs" pt="xs" style={{ borderTop: "1px dashed #e0e0e0" }} wrap="wrap">
                    {order.method && (
                      <Text size="xs" c="dimmed">
                        Payment: <Text span fw={600} c="dark">{order.method}</Text>
                      </Text>
                    )}
                    {order.kotPrintedAt && (
                      <Text size="xs" c="dimmed">
                        KOT: {new Date(order.kotPrintedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </Text>
                    )}
                    {order.readyAt && (
                      <Text size="xs" c="teal">
                        Ready: {new Date(order.readyAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </Text>
                    )}
                    {order.settledAt && (
                      <Text size="xs" c="dimmed">
                        Settled: {new Date(order.settledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </Text>
                    )}
                    {isTable && order.tableFreedAt && (
                      <Text size="xs" c="dimmed">
                        Table Freed: {new Date(order.tableFreedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </Text>
                    )}
                  </Group>
                )}
              </Paper>

              <Divider />

              {/* Action Buttons: Reprint, Settle, Free Table, Void */}
              <Group justify="space-between" align="center" wrap="wrap">
                <Group gap="xs">
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<IconPrinter size={14} />}
                    loading={reprinting === "KOT"}
                    onClick={() => handleReprint("KOT")}
                  >
                    Reprint KOT
                  </Button>
                  {(order.status === "PAID" || order.status === "PARTIAL") && (
                    <Button
                      size="xs"
                      variant="light"
                      color="green"
                      leftSection={<IconReceipt size={14} />}
                      loading={reprinting === "BILL"}
                      onClick={() => handleReprint("BILL")}
                    >
                      Reprint Bill
                    </Button>
                  )}
                </Group>

                <Group gap="xs">
                  {/* Settle Balance Button */}
                  {duePaise > 0 && order.status !== "VOID" && order.status !== "PAID" && (
                    <Button
                      size="xs"
                      color="teal"
                      leftSection={<IconCash size={14} />}
                      onClick={() => setSettleModalOpen(true)}
                    >
                      Settle ₹{(duePaise / 100).toFixed(0)}
                    </Button>
                  )}

                  {/* Free Table Button */}
                  {isTable && !isTableFreed && order.status !== "VOID" && (
                    <Button
                      size="xs"
                      color="blue"
                      variant="light"
                      leftSection={<IconDoorExit size={14} />}
                      onClick={() => setFreeModalOpen(true)}
                    >
                      Free Table
                    </Button>
                  )}

                  {/* Void Order Button */}
                  {(order.status === "OPEN" || order.status === "PARTIAL") && (
                    <Button
                      size="xs"
                      color="red"
                      variant="subtle"
                      leftSection={<IconBan size={14} />}
                      loading={isVoiding}
                      onClick={handleVoid}
                    >
                      Void Order
                    </Button>
                  )}
                </Group>
              </Group>
            </Stack>
          );
        })()}
      </Modal>

      {/* Settle Balance Sub-Modal */}
      <Modal
        opened={settleModalOpen}
        onClose={() => {
          if (!isSettling) setSettleModalOpen(false);
        }}
        title={`Settle Order #${selected?.order?.orderNo}`}
        size="sm"
        zIndex={1300}
      >
        {selected && (() => {
          const paidPaise = selected.order.paidPaise ?? (selected.order.status === "PAID" ? selected.order.subtotalPaise : 0);
          const duePaise = Math.max(0, (selected.order.subtotalPaise || 0) - paidPaise);
          return (
            <Stack gap="md">
              <Paper p="sm" radius="md">
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Balance Due:</Text>
                  <Text size="lg" fw={700} c="orange">₹{(duePaise / 100).toFixed(0)}</Text>
                </Group>
                <Group justify="space-between" mt={4}>
                  <Text size="xs" c="dimmed">Total Bill: ₹{((selected.order.subtotalPaise || 0) / 100).toFixed(0)}</Text>
                  <Text size="xs" c="teal">Paid: ₹{(paidPaise / 100).toFixed(0)}</Text>
                </Group>
              </Paper>

              <div>
                <Text size="sm" fw={600} mb={6}>Payment Method:</Text>
                <SegmentedControl
                  value={settleMethod}
                  onChange={setSettleMethod}
                  fullWidth
                  color="dinePrimary"
                  data={[
                    { value: "Cash", label: <Group gap={4} justify="center" wrap="nowrap"><IconCash size={14} /><span>Cash</span></Group> },
                    { value: "UPI", label: <Group gap={4} justify="center" wrap="nowrap"><IconQrcode size={14} /><span>UPI</span></Group> },
                    { value: "Card", label: <Group gap={4} justify="center" wrap="nowrap"><IconCreditCard size={14} /><span>Card</span></Group> },
                    { value: "Other", label: "Other" },
                  ]}
                />
                {settleMethod === "UPI" && (() => {
                  const outlet = outlets.find((o) => o.id === selected.order.outletId) || activeOutlet;
                  return outlet?.upiId ? (
                    <Box mt="sm">
                      <UpiQrCode
                        upiId={outlet.upiId}
                        payeeName={outlet.name || restaurant?.name}
                        amount={duePaise / 100}
                        transactionId={`Ord-${selected.order.orderNo}`}
                      />
                    </Box>
                  ) : null;
                })()}
              </div>

              <Divider />

              <Group justify="flex-end" gap="xs">
                <Button variant="default" size="sm" onClick={() => setSettleModalOpen(false)} disabled={isSettling}>
                  Cancel
                </Button>
                <Button color="teal" size="sm" loading={isSettling} onClick={handleSettle} leftSection={<IconCheck size={16} />}>
                  Confirm Payment
                </Button>
              </Group>
            </Stack>
          );
        })()}
      </Modal>

      {/* Free Table Sub-Modal */}
      <Modal
        opened={freeModalOpen}
        onClose={() => {
          if (!isFreeing) setFreeModalOpen(false);
        }}
        title={`Free Table ${selected?.order?.tableNo}`}
        size="sm"
        zIndex={1300}
      >
        {selected && (() => {
          const paidPaise = selected.order.paidPaise ?? (selected.order.status === "PAID" ? selected.order.subtotalPaise : 0);
          const duePaise = Math.max(0, (selected.order.subtotalPaise || 0) - paidPaise);
          return (
            <Stack gap="md">
              {duePaise > 0 ? (
                <>
                  <Alert color="orange" icon={<IconAlertCircle size={16} />}>
                    This table has an unpaid balance of <Text span fw={700}>₹{(duePaise / 100).toFixed(0)}</Text>.
                    Freeing the table will settle this balance and vacate the table.
                  </Alert>

                  <div>
                    <Text size="sm" fw={600} mb={6}>Payment Method for remaining balance:</Text>
                    <SegmentedControl
                      value={settleMethod}
                      onChange={setSettleMethod}
                      fullWidth
                      color="dinePrimary"
                      data={[
                        { value: "Cash", label: <Group gap={4} justify="center" wrap="nowrap"><IconCash size={14} /><span>Cash</span></Group> },
                        { value: "UPI", label: <Group gap={4} justify="center" wrap="nowrap"><IconQrcode size={14} /><span>UPI</span></Group> },
                        { value: "Card", label: <Group gap={4} justify="center" wrap="nowrap"><IconCreditCard size={14} /><span>Card</span></Group> },
                        { value: "Other", label: "Other" },
                      ]}
                    />
                    {settleMethod === "UPI" && (() => {
                      const outlet = outlets.find((o) => o.id === selected.order.outletId) || activeOutlet;
                      return outlet?.upiId ? (
                        <Box mt="sm">
                          <UpiQrCode
                            upiId={outlet.upiId}
                            payeeName={outlet.name || restaurant?.name}
                            amount={duePaise / 100}
                            transactionId={`Table-${selected.order.tableNo}`}
                          />
                        </Box>
                      ) : null;
                    })()}
                  </div>
                </>
              ) : (
                <Alert color="teal" icon={<IconCheck size={16} />}>
                  All orders for Table {selected.order.tableNo} have been settled.
                  Confirming will vacate the table and mark it available for new guests.
                </Alert>
              )}

              {/* Open Items Warning Banner */}
              {(() => {
                const openItems = (selected.items ?? []).filter(
                  (i: any) => i.status !== "SERVED" && i.status !== "CANCELLED"
                );
                if (openItems.length === 0) return null;
                return (
                  <Alert
                    color="red"
                    variant="light"
                    title="Cannot Free Table: Open Items Pending"
                    icon={<IconAlertCircle size={16} />}
                  >
                    <Stack gap={4}>
                      <Text size="xs">
                        There are <b>{openItems.length} item(s)</b> not yet served or cancelled ({openItems.slice(0, 3).map((i: any) => `${i.nameSnapshot || i.name} [${i.status || "ORDERED"}]`).join(", ")}{openItems.length > 3 ? ` +${openItems.length - 3} more` : ""}).
                      </Text>
                      <Text size="xs" c="dimmed">
                        All items must be served or cancelled in kitchen before freeing this table.
                      </Text>
                    </Stack>
                  </Alert>
                );
              })()}

              <Divider />

              {(() => {
                const openItems = (selected.items ?? []).filter(
                  (i: any) => i.status !== "SERVED" && i.status !== "CANCELLED"
                );
                const hasOpenItems = openItems.length > 0;
                return (
                  <Group justify="flex-end" gap="xs">
                    <Button variant="default" size="sm" onClick={() => setFreeModalOpen(false)} disabled={isFreeing}>
                      Cancel
                    </Button>
                    <Tooltip
                      label="All items must be served or cancelled before freeing table"
                      disabled={!hasOpenItems}
                    >
                      <Button
                        color="teal"
                        size="sm"
                        loading={isFreeing}
                        disabled={hasOpenItems}
                        onClick={handleFreeTable}
                        leftSection={<IconDoorExit size={16} />}
                      >
                        {duePaise > 0 ? `Settle ₹${(duePaise / 100).toFixed(0)} & Free Table` : "Free Table"}
                      </Button>
                    </Tooltip>
                  </Group>
                );
              })()}
            </Stack>
          );
        })()}
      </Modal>

      {/* ─── Void Order Confirmation Modal ─── */}
      <Modal
        opened={voidConfirmOpen}
        onClose={() => {
          if (!isVoiding) setVoidConfirmOpen(false);
        }}
        title="Confirm Void Order"
        size="sm"
        zIndex={1400}
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to void order <b>#{selected?.order?.orderNo}</b>? This action cannot be undone.
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="default" size="sm" onClick={() => setVoidConfirmOpen(false)} disabled={isVoiding}>
              Cancel
            </Button>
            <Button color="red" size="sm" loading={isVoiding} onClick={handleConfirmVoid} leftSection={<IconBan size={16} />}>
              Void Order
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ─── Cancel Item Confirmation Modal ─── */}
      <Modal
        opened={Boolean(cancelItemConfirm)}
        onClose={() => setCancelItemConfirm(null)}
        title="Cancel Item Confirmation"
        size="sm"
        zIndex={1400}
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to cancel{" "}
            <b>
              {cancelItemConfirm?.item?.qty}x {cancelItemConfirm?.item?.nameSnapshot || cancelItemConfirm?.item?.name}
            </b>{" "}
            from Order #{selected?.order?.orderNo}?
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="default" size="sm" onClick={() => setCancelItemConfirm(null)}>
              Keep Item
            </Button>
            <Button color="red" size="sm" onClick={handleConfirmCancelItem} leftSection={<IconX size={16} />}>
              Cancel Item
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
