"use client";

import React, { useState } from "react";
import {
  Container, Title, Stack, Paper, Group, Text, Badge, Select, Button,
  Loader, Center, Modal, Divider, Box, ActionIcon, Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconReceipt, IconRefresh, IconPrinter, IconArrowRight, IconX,
  IconBan, IconCheck,
} from "@tabler/icons-react";
import { useRestaurant } from "@/lib/restaurant-context";
import { useOrders } from "@/lib/queries";
import { buildKotPayload, buildBillPayload } from "@/lib/ticket";
import { printTicket } from "@/lib/print";
import { updateOrderItemStatus, voidOrder } from "@/lib/api-client";
import {
  getStatusVisual,
  ORDER_STATUS_CONFIG,
  PAYMENT_STATUS_CONFIG,
  getNextItemStatus,
  type OrderItemStatus,
} from "@/lib/order-status-ui";

export default function OrdersPage() {
  const { restaurant, activeOutlet, allOutlets } = useRestaurant();
  const restaurantId = restaurant?.id ?? "";
  const outletId = activeOutlet?.id ?? null;

  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [reprinting, setReprinting] = useState<"KOT" | "BILL" | null>(null);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);

  const enabled = !!restaurantId && (allOutlets || !!outletId);

  // Distinguish whether statusFilter is an orderStatus (ORDERED, PREPARING, etc.) or a billing status (OPEN, PAID, VOID)
  const isBillingStatus = statusFilter === "OPEN" || statusFilter === "PAID" || statusFilter === "VOID";
  const { data: orders = [], isLoading: loading, refetch } = useOrders(
    restaurantId,
    {
      status: isBillingStatus ? statusFilter : undefined,
      orderStatus: !isBillingStatus && statusFilter ? statusFilter : undefined,
      outletId: outletId ?? undefined,
      limit: 100,
    },
    enabled,
  );

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

  const handleUpdateItemStatus = async (item: any, actionPayload: { status?: string; action?: "next" | "close" | "cancel" }) => {
    if (!selected) return;
    const itemId = item.id;
    setUpdatingItemId(itemId);
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
      setUpdatingItemId(null);
    }
  };

  if (!restaurant) return null;

  return (
    <Container size="xl" pt="sm" pb={100} px={{ base: "sm", sm: "md" }}>
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={2}>Orders</Title>
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
              { group: "Order Lifecycle", items: [
                { value: "ORDERED", label: "Ordered" },
                { value: "PREPARING", label: "Preparing" },
                { value: "PREPARED", label: "Prepared" },
                { value: "SERVED", label: "Served" },
                { value: "CANCELLED", label: "Cancelled" },
              ]},
              { group: "Payment Status", items: [
                { value: "OPEN", label: "Unpaid (Open)" },
                { value: "PAID", label: "Paid" },
                { value: "VOID", label: "Void" },
              ]},
            ]}
            w={170}
          />
          <Button size="sm" variant="light" leftSection={<IconRefresh size={14} />} onClick={() => refetch()}>
            Refresh
          </Button>
        </Group>
      </Group>

      {!allOutlets && !outletId ? (
        <Text c="dimmed" ta="center" py="xl">Select an outlet to view orders</Text>
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

            return (
              <Paper
                key={order.id}
                withBorder
                p="md"
                radius="md"
                onClick={() => setSelected(entry)}
                style={{ cursor: "pointer", transition: "border-color 0.15s ease" }}
              >
                <Group justify="space-between">
                  <Group gap="xs" align="center" wrap="wrap">
                    <Text fw={700}>#{order.orderNo}</Text>
                    {order.id && (
                      <Badge size="xs" variant="light" color="gray" style={{ textTransform: "none", fontFamily: "monospace" }}>
                        {order.id}
                      </Badge>
                    )}
                    {order.tableNo && (
                      <Badge size="xs" variant="outline">
                        {order.tableNo === "Takeaway" ? "Takeaway" : `T: ${order.tableNo}`}
                      </Badge>
                    )}
                    {order.customerPhone && <Badge size="xs" variant="outline" color="teal">WA</Badge>}

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
                      variant="outline"
                      color={paymentVisual.color}
                    >
                      {paymentVisual.label}
                    </Badge>
                  </Group>

                  <Group gap="xs">
                    <Text fw={600} c="dinePrimary">₹{(order.subtotalPaise / 100).toFixed(0)}</Text>
                    <Text size="xs" c="dimmed">
                      {new Date(order.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </Group>
                </Group>

                <Group justify="space-between" mt={6} align="center">
                  <Text size="xs" c="dimmed">
                    {items.length} item{items.length !== 1 ? "s" : ""}
                    {order.method ? ` · ${order.method}` : ""}
                    {order.kotPrintedAt ? " · KOT ✓" : ""}
                  </Text>
                  {/* Summary of active items progress */}
                  <Group gap={4}>
                    {items.slice(0, 4).map((it: any) => {
                      const itVisual = getStatusVisual(it.status || "ORDERED");
                      return (
                        <Badge key={it.id} size="xs" variant="dot" color={itVisual.color}>
                          {it.nameSnapshot || it.name}
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
        title={`Order #${selected?.order?.orderNo} (${selected?.order?.id})`}
        size="lg"
      >
        {selected && (
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <Text size="xs" c="dimmed" ff="monospace">ID: {selected.order.id}</Text>
              <Group gap="xs">
                {(() => {
                  const oVisual = getStatusVisual(selected.order.orderStatus || "ORDERED");
                  const OIcon = oVisual.icon;
                  const pVisual = PAYMENT_STATUS_CONFIG[selected.order.status] || { color: "gray", label: selected.order.status };
                  return (
                    <>
                      <Badge color={oVisual.color} leftSection={<OIcon size={12} />}>
                        {oVisual.label}
                      </Badge>
                      <Badge variant="outline" color={pVisual.color}>
                        {pVisual.label}
                      </Badge>
                    </>
                  );
                })()}
              </Group>
            </Group>

            <Group gap="md">
              {selected.order.tableNo && (
                <Text size="sm" fw={500}>
                  {selected.order.tableNo === "Takeaway" ? "Takeaway" : `Table: ${selected.order.tableNo}`}
                </Text>
              )}
              {selected.order.customerPhone && (
                <Text size="xs" c="dimmed">Customer: {selected.order.customerPhone}</Text>
              )}
            </Group>

            <Divider my="xs" label="Order Items" labelPosition="center" />

            <Stack gap="xs">
              {selected.items.map((item: any) => {
                const itemStatus = item.status || "ORDERED";
                const isCancelled = itemStatus === "CANCELLED";
                const isServed = itemStatus === "SERVED";
                const itemVisual = getStatusVisual(itemStatus);
                const ItemIcon = itemVisual.icon;
                const nextStatus = getNextItemStatus(itemStatus);
                const canNext = Boolean(nextStatus);
                const canClose = !isCancelled && !isServed;

                return (
                  <Paper
                    key={item.id}
                    withBorder
                    p="xs"
                    radius="sm"
                    style={{
                      backgroundColor: isCancelled ? "rgba(255, 0, 0, 0.03)" : undefined,
                      opacity: isCancelled ? 0.7 : 1,
                    }}
                  >
                    <Group justify="space-between" align="center" wrap="nowrap">
                      {/* Left side: item details */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Group gap="xs" align="center">
                          <Text
                            size="sm"
                            fw={600}
                            style={{ textDecoration: isCancelled ? "line-through" : "none" }}
                          >
                            {item.nameSnapshot || item.name}
                          </Text>
                          <Badge size="xs" variant="light" color="gray">× {item.qty}</Badge>
                          <Text size="sm" c="dimmed">
                            ₹{(((item.pricePaiseSnapshot ?? item.pricePaise ?? 0) * item.qty) / 100).toFixed(0)}
                          </Text>
                        </Group>

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
                              loading={updatingItemId === item.id}
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
                              loading={updatingItemId === item.id}
                              onClick={() => handleUpdateItemStatus(item, { action: "close" })}
                              aria-label="Cancel item"
                            >
                              <IconX size={15} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Group>
                    </Group>
                  </Paper>
                );
              })}
            </Stack>

            <Divider my="xs" />

            <Group justify="space-between">
              <Text fw={700}>Total</Text>
              <Text fw={700} c="dinePrimary" size="lg">₹{(selected.order.subtotalPaise / 100).toFixed(0)}</Text>
            </Group>

            {selected.order.method && <Text size="xs" c="dimmed">Payment: {selected.order.method}</Text>}
            {selected.order.kotPrintedAt && (
              <Text size="xs" c="dimmed">
                KOT printed: {new Date(selected.order.kotPrintedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </Text>
            )}
            {selected.order.readyAt && (
              <Text size="xs" c="teal">
                Kitchen ready: {new Date(selected.order.readyAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </Text>
            )}
            {selected.order.settledAt && (
              <Text size="xs" c="dimmed">Settled: {new Date(selected.order.settledAt).toLocaleString("en-IN")}</Text>
            )}

            <Divider />

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
              {selected.order.status === "PAID" && (
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
          </Stack>
        )}
      </Modal>
    </Container>
  );
}
