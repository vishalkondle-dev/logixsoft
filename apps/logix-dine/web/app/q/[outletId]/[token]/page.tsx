"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  Container, Paper, Title, Text, Stack, Badge, Group,
  ThemeIcon, Center, Loader, Alert, Button, Divider, Accordion,
  ActionIcon, Card
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconUsers, IconClock, IconBrandWhatsapp, IconCheck,
  IconAlertCircle, IconArmchair, IconSparkles, IconBellRinging,
  IconChefHat, IconPlus, IconMinus, IconTrash, IconShoppingCart
} from "@tabler/icons-react";

export default function QueueTrackerPage() {
  const params = useParams();
  const outletId = (params?.outletId as string) || "";
  const waitlistId = (params?.token as string) || "";

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preOrderCart, setPreOrderCart] = useState<Record<string, number>>({});
  const [savingPreOrder, setSavingPreOrder] = useState(false);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "https://dine-api.logixsoft.in";

  const fetchStatus = () => {
    if (!outletId || !waitlistId) return;
    fetch(`${apiBase}/waitlist/public/${outletId}/${waitlistId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Could not load queue status");
        return r.json();
      })
      .then((res) => {
        setData(res);
        // Load initial pre-orders if present
        if (Array.isArray(res.entry?.preOrderItems) && res.entry.preOrderItems.length > 0) {
          const map: Record<string, number> = {};
          for (const item of res.entry.preOrderItems) {
            map[item.itemId] = item.qty;
          }
          setPreOrderCart((prev) => (Object.keys(prev).length === 0 ? map : prev));
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStatus();
    // Live polling every 6 seconds for live queue position countdown
    const interval = setInterval(fetchStatus, 6000);
    return () => clearInterval(interval);
  }, [outletId, waitlistId, apiBase]);

  const handleUpdateQty = (itemId: string, delta: number) => {
    setPreOrderCart((prev) => {
      const current = prev[itemId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return { ...prev, [itemId]: next };
    });
  };

  const handleSubmitPreOrder = async () => {
    if (!data?.items) return;
    setSavingPreOrder(true);
    try {
      const itemsToSubmit = Object.entries(preOrderCart).map(([itemId, qty]) => {
        const dish = data.items.find((d: any) => d.id === itemId);
        return {
          itemId,
          name: dish?.name || "Dish",
          qty,
          pricePaise: dish?.pricePaise || 0,
        };
      });

      const res = await fetch(`${apiBase}/waitlist/public/pre-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outletId,
          waitlistId,
          items: itemsToSubmit,
        }),
      });

      if (!res.ok) throw new Error("Failed to save pre-order");

      notifications.show({
        title: "Pre-Order Saved!",
        message: `${itemsToSubmit.length} dish(es) queued for your table. Food will be prepared upon seating!`,
        color: "teal",
        icon: <IconCheck size={16} />,
      });
      fetchStatus();
    } catch (err: any) {
      notifications.show({ title: "Failed to save pre-order", message: err.message, color: "red" });
    } finally {
      setSavingPreOrder(false);
    }
  };

  if (loading) {
    return (
      <Center style={{ minHeight: "100vh", backgroundColor: "#f8f9fa" }}>
        <Stack align="center" gap="sm">
          <Loader size="md" color="indigo" />
          <Text size="sm" c="dimmed">Fetching your live queue ticket...</Text>
        </Stack>
      </Center>
    );
  }

  if (error || !data) {
    return (
      <Center style={{ minHeight: "100vh", backgroundColor: "#f8f9fa", padding: 16 }}>
        <Alert icon={<IconAlertCircle size={20} />} title="Ticket Not Found" color="red" radius="md">
          {error || "Could not find queue details for this ticket."}
        </Alert>
      </Center>
    );
  }

  const { entry, queuePosition, partiesAhead, restaurant, outlet, categories = [], items = [] } = data;
  const isCalled = entry.status === "CALLED";
  const isSeated = entry.status === "SEATED";
  const isWaiting = entry.status === "WAITING";
  const isCancelled = entry.status === "CANCELLED" || entry.status === "NO_SHOW";

  const totalPreOrderPaise = Object.entries(preOrderCart).reduce((sum, [itemId, qty]) => {
    const dish = items.find((d: any) => d.id === itemId);
    return sum + (dish?.pricePaise || 0) * qty;
  }, 0);

  const preOrderCount = Object.values(preOrderCart).reduce((a, b) => a + b, 0);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f3f4f6", paddingBottom: 60 }}>
      <Container size="xs" py="md">
        <Stack gap="md">
          {/* Top Brand Banner */}
          <Paper p="sm" radius="md" withBorder style={{ textAlign: "center" }}>
            <Text fw={700} size="md" c="indigo.8">{restaurant.name}</Text>
            <Text size="xs" c="dimmed">{outlet.name} • {restaurant.address}</Text>
          </Paper>

          {/* Status Alert Banner */}
          {isCalled && (
            <Paper p="lg" radius="lg" withBorder style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", color: "#fff", textAlign: "center" }}>
              <ThemeIcon size={48} radius="xl" color="white" style={{ color: "#059669", margin: "0 auto 8px" }}>
                <IconBellRinging size={28} />
              </ThemeIcon>
              <Title order={2} style={{ color: "#fff" }}>YOUR TABLE IS READY! 🎉</Title>
              <Text size="sm" mt={4} style={{ opacity: 0.95 }}>
                Please proceed to the entrance / hostess desk now to be seated.
              </Text>
            </Paper>
          )}

          {isSeated && (
            <Paper p="md" radius="lg" withBorder style={{ backgroundColor: "#ecfdf5", borderColor: "#10b981", textAlign: "center" }}>
              <ThemeIcon size={40} radius="xl" color="teal" style={{ margin: "0 auto 6px" }}>
                <IconCheck size={22} />
              </ThemeIcon>
              <Title order={3} c="teal.9">You Are Seated!</Title>
              <Text size="xs" c="teal.7">Welcome to your dining table. Enjoy your meal! 🍽️</Text>
            </Paper>
          )}

          {isCancelled && (
            <Paper p="md" radius="lg" withBorder style={{ backgroundColor: "#fef2f2", borderColor: "#ef4444", textAlign: "center" }}>
              <Title order={3} c="red.9">Queue Ticket Cancelled</Title>
              <Text size="xs" c="red.7">This waitlist entry has been cancelled or marked as no-show.</Text>
            </Paper>
          )}

          {/* Digital Token & Queue Position Card */}
          <Paper p="xl" radius="lg" withBorder shadow="sm" style={{ textAlign: "center" }}>
            <Badge size="lg" variant="light" color={isCalled ? "teal" : isWaiting ? "indigo" : "gray"}>
              {entry.status}
            </Badge>

            <Text size="sm" c="dimmed" mt="xs">Your Waitlist Token</Text>
            <Title order={1} style={{ fontSize: "3rem", color: "#4f46e5", letterSpacing: -1 }}>
              #{entry.tokenNumber}
            </Title>
            <Text fw={600} size="md">{entry.guestName}</Text>

            <Divider my="md" />

            {/* Live Queue Countdown */}
            {isWaiting && (
              <Stack gap="xs" mb="sm">
                <Group justify="center" gap="xs">
                  <ThemeIcon size={28} radius="xl" color="indigo" variant="light">
                    <IconUsers size={16} />
                  </ThemeIcon>
                  <Text fw={700} size="lg">
                    {partiesAhead === 0 ? "You're next in line!" : `Position #${queuePosition} in Queue`}
                  </Text>
                </Group>

                <Text size="xs" c="dimmed">
                  {partiesAhead === 0
                    ? "Your table will be called momentarily."
                    : `${partiesAhead} ${partiesAhead === 1 ? "party" : "parties"} waiting ahead of you`}
                </Text>

                <Paper p="sm" radius="md" bg="#f8fafc" withBorder mt="xs">
                  <Group justify="space-around">
                    <div>
                      <Text size="xs" c="dimmed">Party Size</Text>
                      <Text fw={700} size="sm">{entry.partySize} Guests</Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">Seating</Text>
                      <Text fw={700} size="sm">{entry.seatingPreference}</Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">Est. Wait</Text>
                      <Text fw={700} size="sm" c="indigo.8">~{entry.estimatedWaitMinutes} mins</Text>
                    </div>
                  </Group>
                </Paper>
              </Stack>
            )}

            <Text size="xs" c="dimmed" mt="sm">
              Keep this screen open. We will alert you on WhatsApp and update this screen live when your table is ready.
            </Text>
          </Paper>

          {/* Pre-Order Menu Section */}
          {items.length > 0 && isWaiting && (
            <Paper p="md" radius="lg" withBorder shadow="sm">
              <Group justify="space-between" mb="xs">
                <div>
                  <Group gap={6}>
                    <IconChefHat size={18} color="#4f46e5" />
                    <Text fw={700} size="sm">Pre-Order from Menu</Text>
                  </Group>
                  <Text size="xs" c="dimmed">Select dishes now so food is fired right after you sit!</Text>
                </div>
                {preOrderCount > 0 && (
                  <Badge color="indigo" size="sm">{preOrderCount} items (₹{(totalPreOrderPaise / 100).toFixed(0)})</Badge>
                )}
              </Group>

              <Accordion variant="separated" radius="md">
                {categories.map((cat: any) => {
                  const catItems = items.filter((it: any) => it.categoryId === cat.id);
                  if (catItems.length === 0) return null;
                  return (
                    <Accordion.Item key={cat.id} value={cat.id}>
                      <Accordion.Control>
                        <Text fw={600} size="sm">{cat.name} ({catItems.length})</Text>
                      </Accordion.Control>
                      <Accordion.Panel>
                        <Stack gap="xs">
                          {catItems.map((dish: any) => {
                            const qty = preOrderCart[dish.id] || 0;
                            return (
                              <Group key={dish.id} justify="space-between" p={6} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <Text size="sm" fw={600}>{dish.name}</Text>
                                  <Text size="xs" c="dimmed">₹{((dish.pricePaise || 0) / 100).toFixed(0)}</Text>
                                </div>
                                <Group gap={6}>
                                  {qty > 0 ? (
                                    <>
                                      <ActionIcon size="sm" variant="subtle" color="red" onClick={() => handleUpdateQty(dish.id, -1)}>
                                        <IconMinus size={14} />
                                      </ActionIcon>
                                      <Text size="sm" fw={700}>{qty}</Text>
                                      <ActionIcon size="sm" variant="subtle" color="teal" onClick={() => handleUpdateQty(dish.id, 1)}>
                                        <IconPlus size={14} />
                                      </ActionIcon>
                                    </>
                                  ) : (
                                    <Button size="xs" variant="light" color="indigo" onClick={() => handleUpdateQty(dish.id, 1)}>
                                      Add
                                    </Button>
                                  )}
                                </Group>
                              </Group>
                            );
                          })}
                        </Stack>
                      </Accordion.Panel>
                    </Accordion.Item>
                  );
                })}
              </Accordion>

              {preOrderCount > 0 && (
                <Button
                  fullWidth
                  mt="md"
                  color="indigo"
                  size="md"
                  loading={savingPreOrder}
                  onClick={handleSubmitPreOrder}
                  leftSection={<IconShoppingCart size={18} />}
                >
                  Save Pre-Order ({preOrderCount} items • ₹{(totalPreOrderPaise / 100).toFixed(0)})
                </Button>
              )}
            </Paper>
          )}
        </Stack>
      </Container>
    </div>
  );
}
