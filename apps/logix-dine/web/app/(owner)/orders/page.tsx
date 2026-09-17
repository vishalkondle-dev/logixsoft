"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Container, Title, Stack, Paper, Group, Text, Badge, Select, Button,
  Loader, Center, Modal, Divider,
} from "@mantine/core";
import { IconReceipt, IconRefresh } from "@tabler/icons-react";
import { useRestaurant } from "@/lib/restaurant-context";
import { listOrders } from "@/lib/api-client";

const STATUS_COLORS: Record<string, string> = { OPEN: "blue", PAID: "green", VOID: "gray" };

export default function OrdersPage() {
  const { restaurant } = useRestaurant();
  const restaurantId = restaurant?.id ?? "";
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<any>(null);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const data = await listOrders(restaurantId, { status: statusFilter ?? undefined, limit: 100 });
      setOrders(data);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, statusFilter]);  // restaurantId in deps → reloads when restaurant loads

  useEffect(() => { load(); }, [load]);

  if (!restaurant) return null;

  return (
    <Container size="lg" py="xl" px={0}>
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

      {loading ? (
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
                    {order.tableNo && <Badge size="xs" variant="outline">T: {order.tableNo}</Badge>}
                    <Badge size="xs" color={STATUS_COLORS[order.status] ?? "gray"}>{order.status}</Badge>
                  </Group>
                  <Group gap="xs">
                    <Text fw={600} c="dinePrimary">₹{(order.subtotalPaise / 100).toFixed(0)}</Text>
                    <Text size="xs" c="dimmed">{new Date(order.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</Text>
                  </Group>
                </Group>
                <Text size="xs" c="dimmed" mt={4}>{items.length} item{items.length !== 1 ? "s" : ""}{order.method ? ` · ${order.method}` : ""}</Text>
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
              {selected.order.tableNo && <Text size="sm">Table: {selected.order.tableNo}</Text>}
            </Group>
            <Divider />
            {selected.items.map((item: any) => (
              <Group key={item.id} justify="space-between">
                <Text size="sm">{item.nameSnapshot} × {item.qty}</Text>
                <Text size="sm">₹{((item.pricePaiseSnapshot * item.qty) / 100).toFixed(0)}</Text>
              </Group>
            ))}
            <Divider />
            <Group justify="space-between">
              <Text fw={700}>Total</Text>
              <Text fw={700} c="dinePrimary">₹{(selected.order.subtotalPaise / 100).toFixed(0)}</Text>
            </Group>
            {selected.order.method && <Text size="xs" c="dimmed">Payment: {selected.order.method}</Text>}
            {selected.order.settledAt && <Text size="xs" c="dimmed">Settled: {new Date(selected.order.settledAt).toLocaleString("en-IN")}</Text>}
          </Stack>
        )}
      </Modal>
    </Container>
  );
}
