"use client";

import React, { useState, useMemo } from "react";
import {
  Drawer,
  Box,
  Group,
  Stack,
  Text,
  Title,
  Badge,
  Button,
  SimpleGrid,
  Card,
  ActionIcon,
  Divider,
  TextInput,
  SegmentedControl,
  Paper,
  Loader,
  Center,
  ScrollArea,
} from "@mantine/core";
import {
  IconX,
  IconPlus,
  IconMinus,
  IconShoppingBag,
  IconMotorbike,
  IconCar,
  IconCheck,
  IconClock,
  IconMapPin,
  IconPhone,
  IconSparkles,
  IconFlame,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { VegNonVegIcon } from "@/components/common/veg-nonveg-icon";
import { getMarketplaceOutlet, type MarketplaceOutletDetail } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

interface CartItem {
  id: string;
  name: string;
  pricePaise: number;
  qty: number;
  isNonVeg: boolean;
}

interface OutletMenuDrawerProps {
  opened: boolean;
  onClose: () => void;
  outletId: string | null;
  outletName?: string;
  restaurantName?: string;
}

function formatINR(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function OutletMenuDrawer({
  opened,
  onClose,
  outletId,
  outletName,
  restaurantName,
}: OutletMenuDrawerProps) {
  const router = useRouter();
  const { user, isAuthenticated, openLoginModal } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [orderMode, setOrderMode] = useState<"TAKEAWAY" | "DELIVERY">("TAKEAWAY");
  const [vehicleDetails, setVehicleDetails] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: detailData, isLoading } = useQuery<MarketplaceOutletDetail>({
    queryKey: ["marketplaceOutlet", outletId],
    queryFn: () => getMarketplaceOutlet(outletId!),
    enabled: !!outletId && opened,
  });

  const outlet = detailData?.outlet;
  const sections = detailData?.sections || [];

  const handleAddToCart = (item: any) => {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(item.id);
      if (existing) {
        next.set(item.id, { ...existing, qty: existing.qty + 1 });
      } else {
        next.set(item.id, {
          id: item.id,
          name: item.name,
          pricePaise: item.pricePaise,
          qty: 1,
          isNonVeg: item.dietaryPreference === "NON_VEG",
        });
      }
      return next;
    });
  };

  const handleRemoveFromCart = (itemId: string) => {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(itemId);
      if (!existing) return next;
      if (existing.qty <= 1) {
        next.delete(itemId);
      } else {
        next.set(itemId, { ...existing, qty: existing.qty - 1 });
      }
      return next;
    });
  };

  const cartList = useMemo(() => Array.from(cart.values()), [cart]);
  const cartTotalPaise = useMemo(
    () => cartList.reduce((sum, item) => sum + item.pricePaise * item.qty, 0),
    [cartList]
  );
  const cartCount = useMemo(
    () => cartList.reduce((sum, item) => sum + item.qty, 0),
    [cartList]
  );

  const filteredSections = useMemo(() => {
    if (selectedCategory === "ALL") return sections;
    return sections.filter((s) => s.id === selectedCategory);
  }, [sections, selectedCategory]);

  const handlePlaceOrder = async () => {
    if (!isAuthenticated) {
      openLoginModal();
      return;
    }

    if (!outletId || cartList.length === 0) return;

    if (orderMode === "DELIVERY" && !deliveryAddress.trim()) {
      notifications.show({
        title: "Address Required",
        message: "Please enter your delivery address.",
        color: "red",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/portal/send-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          outletId,
          orderType: orderMode,
          tableNo: orderMode === "DELIVERY" ? "DELIVERY" : "TAKEAWAY",
          items: cartList.map((i) => ({ itemId: i.id, qty: i.qty })),
          note:
            orderMode === "TAKEAWAY" && vehicleDetails.trim()
              ? `Curbside Car Pickup: ${vehicleDetails.trim()}`
              : orderMode === "DELIVERY"
              ? `Delivery: ${deliveryAddress.trim()}`
              : undefined,
          customerName: user?.name || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err?.message || "Failed to place direct order");
      }

      notifications.show({
        title: "Order Placed Successfully!",
        message: "Your direct order has been received by the kitchen.",
        color: "teal",
        icon: <IconCheck size={16} />,
      });

      setCart(new Map());
      setIsCheckingOut(false);
      onClose();
      router.push("/live");
    } catch (err: any) {
      notifications.show({
        title: "Order Failed",
        message: err?.message || "Could not place order. Please try again.",
        color: "red",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="bottom"
      size="92%"
      radius="xl"
      withCloseButton={false}
      styles={{
        content: {
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          background: "#fdfdfd",
        },
        body: { padding: 0, height: "100%", display: "flex", flexDirection: "column" },
      }}
    >
      {/* ─── Drawer Header ─── */}
      <Box p="md" style={{ borderBottom: "1px solid #eee", background: "#fff" }}>
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Group gap="xs" align="center" mb={2}>
              <Title order={3} size="h4" lineClamp={1}>
                {outlet?.restaurantName || restaurantName || "Restaurant"}
              </Title>
              <Badge size="xs" variant="light" color="violet">
                Direct Kitchen
              </Badge>
            </Group>
            <Group gap={6} align="center">
              <IconMapPin size={13} color="#868e96" />
              <Text size="xs" c="dimmed" lineClamp={1}>
                {outlet?.address || "Hyderabad"}
              </Text>
            </Group>
          </Box>
          <ActionIcon variant="subtle" color="gray" size="lg" radius="xl" onClick={onClose}>
            <IconX size={18} />
          </ActionIcon>
        </Group>

        {/* Live Metrics Pill */}
        {outlet && (
          <Group gap="xs" mt="xs" wrap="wrap">
            <Badge
              size="sm"
              variant="dot"
              color={outlet.tables.availableNow ? "green" : "orange"}
            >
              {outlet.tables.free > 0
                ? `${outlet.tables.free} Tables Free`
                : outlet.waitlist.waitingCount > 0
                ? `Queue: ${outlet.waitlist.waitingCount} waiting`
                : "Seating Available"}
            </Badge>
            <Badge size="sm" variant="outline" color="teal">
              Zero Platform Markup
            </Badge>
          </Group>
        )}
      </Box>

      {/* ─── Main Content ─── */}
      <Box style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {isLoading ? (
          <Center py={60}>
            <Stack align="center" gap="xs">
              <Loader color="dinePrimary" size="md" />
              <Text size="sm" c="dimmed">
                Loading kitchen menu...
              </Text>
            </Stack>
          </Center>
        ) : isCheckingOut ? (
          /* ─── Checkout Screen ─── */
          <Box p="md" style={{ overflowY: "auto", flex: 1 }}>
            <Stack gap="md" maw={500} mx="auto">
              <Group justify="space-between" align="center">
                <Title order={4}>Review Direct Order</Title>
                <Button variant="subtle" size="xs" onClick={() => setIsCheckingOut(false)}>
                  ← Edit Menu
                </Button>
              </Group>

              {/* Order Mode Selection */}
              <Paper p="sm" radius="md" withBorder>
                <Text size="xs" fw={700} c="dimmed" mb="xs">
                  SELECT ORDER TYPE
                </Text>
                <SegmentedControl
                  fullWidth
                  value={orderMode}
                  onChange={(v) => setOrderMode(v as any)}
                  data={[
                    { label: "🥡 Takeaway Pickup", value: "TAKEAWAY" },
                    { label: "🛵 Direct Delivery", value: "DELIVERY" },
                  ]}
                  color="dinePrimary"
                />
              </Paper>

              {orderMode === "TAKEAWAY" && (
                <Paper p="sm" radius="md" withBorder style={{ background: "#fff9db" }}>
                  <Group gap="xs" align="flex-start" mb="xs">
                    <IconCar size={20} color="#f08c00" />
                    <div>
                      <Text size="xs" fw={700} c="yellow.9">
                        Curbside / Car Pickup (Optional)
                      </Text>
                      <Text size="11px" c="dimmed">
                        Staff will bring food to your vehicle when you arrive outside.
                      </Text>
                    </div>
                  </Group>
                  <TextInput
                    placeholder="e.g. White Swift - MH 12 AB 1234"
                    value={vehicleDetails}
                    onChange={(e) => setVehicleDetails(e.target.value)}
                    size="sm"
                  />
                </Paper>
              )}

              {orderMode === "DELIVERY" && (
                <Paper p="sm" radius="md" withBorder>
                  <Text size="xs" fw={700} c="dimmed" mb="xs">
                    DELIVERY ADDRESS
                  </Text>
                  <TextInput
                    placeholder="House/Flat No., Street, Landmark"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    size="sm"
                    required
                  />
                </Paper>
              )}

              {/* Order Items List */}
              <Paper p="sm" radius="md" withBorder>
                <Text size="xs" fw={700} c="dimmed" mb="xs">
                  ORDER SUMMARY ({cartCount} ITEMS)
                </Text>
                <Stack gap="xs">
                  {cartList.map((item) => (
                    <Group key={item.id} justify="space-between" align="center" wrap="nowrap">
                      <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                        <VegNonVegIcon isNonVeg={item.isNonVeg} size={14} />
                        <Text size="sm" fw={600} lineClamp={1}>
                          {item.name}
                        </Text>
                      </Group>
                      <Group gap="xs" wrap="nowrap">
                        <Group gap={4} align="center">
                          <ActionIcon
                            size="xs"
                            variant="light"
                            color="gray"
                            onClick={() => handleRemoveFromCart(item.id)}
                          >
                            <IconMinus size={11} />
                          </ActionIcon>
                          <Text size="xs" fw={700} w={18} ta="center">
                            {item.qty}
                          </Text>
                          <ActionIcon
                            size="xs"
                            variant="light"
                            color="dinePrimary"
                            onClick={() => handleAddToCart(item)}
                          >
                            <IconPlus size={11} />
                          </ActionIcon>
                        </Group>
                        <Text size="sm" fw={700} w={60} ta="right">
                          {formatINR(item.pricePaise * item.qty)}
                        </Text>
                      </Group>
                    </Group>
                  ))}
                </Stack>
                <Divider my="sm" />
                <Group justify="space-between">
                  <Text fw={700} size="sm">
                    Total Amount
                  </Text>
                  <Text fw={800} size="md" c="dinePrimary">
                    {formatINR(cartTotalPaise)}
                  </Text>
                </Group>
              </Paper>

              <Button
                size="md"
                color="dinePrimary"
                radius="md"
                fullWidth
                loading={isSubmitting}
                onClick={handlePlaceOrder}
              >
                Confirm Direct Order · {formatINR(cartTotalPaise)}
              </Button>
            </Stack>
          </Box>
        ) : (
          /* ─── Menu Browser ─── */
          <>
            {/* Category Filter Pills */}
            <Box px="md" py="xs" style={{ borderBottom: "1px solid #f1f3f5", background: "#fafafa" }}>
              <ScrollArea type="never">
                <Group gap="xs" wrap="nowrap">
                  <Badge
                    size="md"
                    variant={selectedCategory === "ALL" ? "filled" : "light"}
                    color="dinePrimary"
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelectedCategory("ALL")}
                  >
                    All Items
                  </Badge>
                  {sections.map((sec) => (
                    <Badge
                      key={sec.id}
                      size="md"
                      variant={selectedCategory === sec.id ? "filled" : "light"}
                      color={selectedCategory === sec.id ? "dinePrimary" : "gray"}
                      style={{ cursor: "pointer", whiteSpace: "nowrap" }}
                      onClick={() => setSelectedCategory(sec.id)}
                    >
                      {sec.name} ({sec.items.length})
                    </Badge>
                  ))}
                </Group>
              </ScrollArea>
            </Box>

            {/* Menu Sections & Items */}
            <Box p="md" style={{ overflowY: "auto", flex: 1, paddingBottom: 90 }}>
              <Stack gap="lg">
                {filteredSections.map((sec) => (
                  <Box key={sec.id}>
                    <Title order={4} size="h5" mb="xs" c="dark.8">
                      {sec.name}
                    </Title>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                      {sec.items.map((item) => {
                        const inCart = cart.get(item.id);
                        return (
                          <Card key={item.id} p="sm" radius="md" withBorder style={{ background: "#fff" }}>
                            <Group justify="space-between" align="flex-start" wrap="nowrap">
                              <Box style={{ flex: 1, minWidth: 0 }}>
                                <Group gap={6} align="center" mb={4}>
                                  <VegNonVegIcon
                                    isNonVeg={item.dietaryPreference === "NON_VEG"}
                                    size={14}
                                  />
                                  <Text fw={700} size="sm" lineClamp={1}>
                                    {item.name}
                                  </Text>
                                </Group>
                                {item.description && (
                                  <Text size="11px" c="dimmed" lineClamp={2} mb="xs">
                                    {item.description}
                                  </Text>
                                )}
                                <Text fw={800} size="sm" c="dark.9">
                                  {formatINR(item.pricePaise)}
                                </Text>
                              </Box>

                              {/* Add / Quantity Counter */}
                              <Box>
                                {inCart ? (
                                  <Group gap={4} align="center" style={{ background: "#f8f9fa", padding: "3px 6px", borderRadius: 8, border: "1px solid #dee2e6" }}>
                                    <ActionIcon
                                      size="xs"
                                      variant="subtle"
                                      color="gray"
                                      onClick={() => handleRemoveFromCart(item.id)}
                                    >
                                      <IconMinus size={12} />
                                    </ActionIcon>
                                    <Text size="xs" fw={700} w={16} ta="center">
                                      {inCart.qty}
                                    </Text>
                                    <ActionIcon
                                      size="xs"
                                      variant="subtle"
                                      color="dinePrimary"
                                      onClick={() => handleAddToCart(item)}
                                    >
                                      <IconPlus size={12} />
                                    </ActionIcon>
                                  </Group>
                                ) : (
                                  <Button
                                    size="xs"
                                    variant="light"
                                    color="dinePrimary"
                                    radius="md"
                                    onClick={() => handleAddToCart(item)}
                                  >
                                    + ADD
                                  </Button>
                                )}
                              </Box>
                            </Group>
                          </Card>
                        );
                      })}
                    </SimpleGrid>
                  </Box>
                ))}
              </Stack>
            </Box>
          </>
        )}
      </Box>

      {/* ─── Floating Cart Bottom Bar ─── */}
      {!isCheckingOut && cartCount > 0 && (
        <Box
          p="sm"
          style={{
            borderTop: "1px solid #dee2e6",
            background: "#fff",
            boxShadow: "0 -4px 16px rgba(0,0,0,0.06)",
          }}
        >
          <Group justify="space-between" align="center">
            <div>
              <Text size="xs" fw={700} c="dimmed">
                {cartCount} {cartCount === 1 ? "ITEM" : "ITEMS"} IN DIRECT CART
              </Text>
              <Text size="lg" fw={800} c="dinePrimary">
                {formatINR(cartTotalPaise)}
              </Text>
            </div>
            <Button
              size="md"
              color="dinePrimary"
              radius="md"
              onClick={() => setIsCheckingOut(true)}
              leftSection={<IconShoppingBag size={18} />}
            >
              Proceed to Order
            </Button>
          </Group>
        </Box>
      )}
    </Drawer>
  );
}
