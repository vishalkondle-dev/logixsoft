"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Container, Title, Text, SimpleGrid, Paper, Badge, Button, Group, Stack, Center, Loader, ActionIcon, Select } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCheck, IconClock, IconLogout, IconTableAlias, IconRefresh } from "@tabler/icons-react";
import { useAuth } from "@/lib/auth-context";
import { useRestaurant } from "@/lib/restaurant-context";
import { getKitchenOrders, markOrderReady } from "@/lib/api-client";

const REFRESH_MS = 10_000;

function urgency(createdAt: string): { color: string; label: string; minutes: number } {
  const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (minutes >= 20) return { color: "#e03131", label: `${minutes}m`, minutes };
  if (minutes >= 10) return { color: "#f59f00", label: `${minutes}m`, minutes };
  return { color: "#2f9e44", label: `${minutes}m`, minutes };
}

export default function KitchenPage() {
  const { isAuthenticated, isLoading: authLoading, openLoginModal, signOut } = useAuth();
  const { restaurant, outlets, activeOutlet, setActiveOutlet, isLoading: restLoading, role } = useRestaurant();
  const restaurantId = restaurant?.id ?? "";
  const outletId = activeOutlet?.id ?? null;

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState<string | null>(null);
  const [, forceTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const data = await getKitchenOrders(restaurantId, outletId);
      setOrders(data.filter((o: any) => !o.order.readyAt));
    } catch {
      // stay on last known list; auto-refresh will retry
    } finally {
      setLoading(false);
    }
  }, [restaurantId, outletId]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 10s + re-render every 30s to update elapsed-time badges
  useEffect(() => {
    intervalRef.current = setInterval(load, REFRESH_MS);
    const tick = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      clearInterval(tick);
    };
  }, [load]);

  const handleMarkReady = async (orderId: string) => {
    setMarking(orderId);
    try {
      await markOrderReady(restaurantId, orderId, outletId);
      setOrders((prev) => prev.filter((o) => o.order.id !== orderId));
      notifications.show({ title: "Marked ready", message: "", color: "green", icon: <IconCheck size={16} /> });
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setMarking(null);
    }
  };

  if (authLoading || restLoading) {
    return (
      <Center py={100} style={{ minHeight: "100dvh" }}>
        <Loader size="lg" color="dinePrimary" />
      </Center>
    );
  }

  if (!isAuthenticated) {
    return (
      <Center style={{ minHeight: "100dvh" }}>
        <Stack align="center" gap="md">
          <Title order={2} c="white">Kitchen Display</Title>
          <Button size="lg" color="dinePrimary" onClick={openLoginModal}>Sign In</Button>
        </Stack>
      </Center>
    );
  }

  if (!restaurant) {
    return (
      <Center style={{ minHeight: "100dvh" }}>
        <Text c="white">No restaurant found for this account.</Text>
      </Center>
    );
  }

  return (
    <Container size="xl" py="md" px={{ base: "sm", sm: "md" }}>
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={2} c="white">Kitchen Display</Title>
          <Text size="sm" c="gray.4">{restaurant.name}{activeOutlet ? ` · ${activeOutlet.name}` : ""}</Text>
        </div>
        <Group>
          {outlets.length > 1 && (
            <Select
              size="xs"
              value={activeOutlet?.id ?? null}
              onChange={(v) => v && setActiveOutlet(v)}
              data={outlets.map((o) => ({ value: o.id, label: o.name }))}
              w={140}
            />
          )}
          <ActionIcon size="lg" variant="light" color="gray" onClick={load} title="Refresh now">
            <IconRefresh size={18} />
          </ActionIcon>
          {role !== "KITCHEN" && (
            // Owner/Manager previewing the KDS can navigate back; KITCHEN-only
            // accounts have nowhere else to go, so we just offer sign out.
            <Button component="a" href="/pos" size="sm" variant="light" color="gray">Back to POS</Button>
          )}
          <ActionIcon size="lg" variant="light" color="red" onClick={() => signOut()} title="Sign out">
            <IconLogout size={18} />
          </ActionIcon>
        </Group>
      </Group>

      {loading ? (
        <Center py={100}><Loader color="dinePrimary" /></Center>
      ) : !orders.length ? (
        <Center py={100}>
          <Stack align="center" gap="xs">
            <IconCheck size={48} color="#2f9e44" />
            <Text c="gray.4" size="lg">All caught up — no pending orders</Text>
          </Stack>
        </Center>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
          {orders.map((entry: any) => {
            const { order, items } = entry;
            const u = urgency(order.createdAt);
            return (
              <Paper key={order.id} radius="md" p="md" style={{ background: "#252525", borderLeft: `4px solid ${u.color}` }}>
                <Group justify="space-between" mb="xs">
                  <Text fw={800} size="xl" c="white">#{order.orderNo}</Text>
                  <Badge size="lg" style={{ background: u.color, color: "white" }} leftSection={<IconClock size={12} />}>
                    {u.label}
                  </Badge>
                </Group>
                {order.tableNo && (
                  <Badge size="sm" variant="light" color="gray" mb="sm" leftSection={<IconTableAlias size={12} />}>
                    Table {order.tableNo}
                  </Badge>
                )}
                <Stack gap={4} mb="md">
                  {items.map((item: any) => (
                    <Group key={item.id} justify="space-between" wrap="nowrap">
                      <Text size="sm" c="gray.2" style={{ flex: 1 }}>{item.nameSnapshot}</Text>
                      <Text size="sm" fw={700} c="white">×{item.qty}</Text>
                    </Group>
                  ))}
                </Stack>
                <Button
                  fullWidth
                  color="green"
                  leftSection={<IconCheck size={16} />}
                  loading={marking === order.id}
                  onClick={() => handleMarkReady(order.id)}
                >
                  Ready
                </Button>
              </Paper>
            );
          })}
        </SimpleGrid>
      )}
    </Container>
  );
}
