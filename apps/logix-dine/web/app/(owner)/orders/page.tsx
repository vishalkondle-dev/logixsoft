"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Container, Title, Stack, Paper, Group, Text, Badge, Select, Button,
  Loader, Center, Modal, Divider, Box,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconReceipt, IconRefresh, IconPrinter } from "@tabler/icons-react";
import { useRestaurant } from "@/lib/restaurant-context";
import { listOrders } from "@/lib/api-client";
import { buildKotPayload, buildBillPayload } from "@/lib/ticket";
import { printTicket } from "@/lib/print";

const STATUS_COLORS: Record<string, string> = { OPEN: "blue", PAID: "green", VOID: "gray" };

export default function OrdersPage() {
  const { restaurant, activeOutlet, allOutlets } = useRestaurant();
  const restaurantId = restaurant?.id ?? "";
  const outletId = activeOutlet?.id ?? null;
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [reprinting, setReprinting] = useState<"KOT" | "BILL" | null>(null);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    // Non-owner/manager roles are outlet-scoped — the API requires an
    // explicit outletId for them (400 without it). Owner/manager may omit
    // it to see all outlets, or pass activeOutlet to filter.
    if (!allOutlets && !outletId) return;
    setLoading(true);
    try {
      const data = await listOrders(restaurantId, {
        status: statusFilter ?? undefined,
        outletId: outletId ?? undefined,
        limit: 100,
      });
      setOrders(data);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, statusFilter, outletId, allOutlets]);

  useEffect(() => { load(); }, [load]);

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

  if (!restaurant) return null;

  return (
    <Container size="xl" pt="sm" pb={100} px={{ base: "sm", sm: "md" }}>
      <Group justify="space-between" mb="lg">
        <Title order={2}>Orders</Title>
        <Group>
          <Select
            size="sm"
            placeholder="All statuses"
            clearable
            value={statusFilter}
            onChange={setStatusFilter}
            data={[
              { value: "OPEN", label: "Open" },
              { value: "PAID", label: "Paid" },
              { value: "VOID", label: "Void" },
            ]}
            w={140}
          />
          <Button size="sm" variant="light" leftSection={<IconRefresh size={14} />} onClick={load}>Refresh</Button>
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
            return (
              <Paper
                key={order.id}
                withBorder
                p="md"
                radius="md"
                onClick={() => setSelected(entry)}
                style={{ cursor: "pointer" }}
              >
                <Group justify="space-between">
                  <Group gap="xs">
                    <Text fw={700}>#{order.orderNo}</Text>
                    {order.tableNo && <Badge size="xs" variant="outline">{order.tableNo === "Takeaway" ? "Takeaway" : `T: ${order.tableNo}`}</Badge>}
                    {order.customerPhone && <Badge size="xs" variant="outline" color="teal">WA</Badge>}
                    <Badge size="xs" color={STATUS_COLORS[order.status] ?? "gray"}>{order.status}</Badge>
                  </Group>
                  <Group gap="xs">
                    <Text fw={600} c="dinePrimary">₹{(order.subtotalPaise / 100).toFixed(0)}</Text>
                    <Text size="xs" c="dimmed">{new Date(order.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</Text>
                  </Group>
                </Group>
                <Text size="xs" c="dimmed" mt={4}>
                  {items.length} item{items.length !== 1 ? "s" : ""}
                  {order.method ? ` · ${order.method}` : ""}
                  {order.kotPrintedAt ? " · KOT ✓" : ""}
                </Text>
              </Paper>
            );
          })}
        </Stack>
      )}

      <Modal opened={!!selected} onClose={() => setSelected(null)} title={`Order #${selected?.order?.orderNo}`} size="sm">
        {selected && (
          <Stack>
            <Group justify="space-between">
              <Badge color={STATUS_COLORS[selected.order.status]}>{selected.order.status}</Badge>
              {selected.order.tableNo && <Text size="sm">{selected.order.tableNo === "Takeaway" ? "Takeaway" : `Table: ${selected.order.tableNo}`}</Text>}
            </Group>
            {selected.order.customerPhone && (
              <Text size="xs" c="dimmed">Customer: {selected.order.customerPhone}</Text>
            )}
            <Divider />
            {selected.items.map((item: any) => (
              <Group key={item.orderItemId ?? item.id} justify="space-between">
                <Text size="sm">{item.name ?? item.nameSnapshot} × {item.qty}</Text>
                <Text size="sm">₹{((item.pricePaiseSnapshot * item.qty) / 100).toFixed(0)}</Text>
              </Group>
            ))}
            <Divider />
            <Group justify="space-between">
              <Text fw={700}>Total</Text>
              <Text fw={700} c="dinePrimary">₹{(selected.order.subtotalPaise / 100).toFixed(0)}</Text>
            </Group>
            {selected.order.method && <Text size="xs" c="dimmed">Payment: {selected.order.method}</Text>}
            {selected.order.kotPrintedAt && (
              <Text size="xs" c="dimmed">
                KOT printed: {new Date(selected.order.kotPrintedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
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
