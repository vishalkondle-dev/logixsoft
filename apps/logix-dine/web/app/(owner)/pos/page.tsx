"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Grid, Paper, Title, Text, Group, Stack, Badge, Button, ActionIcon,
  TextInput, Loader, Center, Modal, Select, Divider, Menu,
  Drawer, Box, ScrollArea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconPlus, IconMinus, IconTrash, IconChevronRight,
  IconCheck, IconShoppingCart, IconCash, IconTableAlias,
} from "@tabler/icons-react";
import { useRestaurant } from "@/lib/restaurant-context";
import {
  getBootstrap, startOrder, addOrderItem, updateOrderItemQty,
  removeOrderItem, settleOrder, voidOrder, markKotPrinted,
} from "@/lib/api-client";
import { buildKotPayload, buildBillPayload } from "@/lib/ticket";
import { printTicket } from "@/lib/print";

interface CartItem {
  orderItemId: string;
  itemId: string;
  name: string;
  pricePaise: number;
  qty: number;
}

export default function POSPage() {
  const { restaurant, activeOutlet } = useRestaurant();
  const restaurantId = restaurant?.id ?? "";

  const [bootstrap, setBootstrap] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [currentOrder, setCurrentOrder] = useState<any>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [tableNo, setTableNo] = useState("");
  const [settleModal, setSettleModal] = useState(false);
  const [settleMethod, setSettleMethod] = useState<string>("Cash");
  const [settling, setSettling] = useState(false);
  const [starting, setStarting] = useState(false);

  const loadBootstrap = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const data = await getBootstrap(restaurantId);
      setBootstrap(data);
      if (data.categories?.length) setActiveCatId(data.categories[0].id);
    } catch (err: any) {
      notifications.show({ title: "Error", message: "Failed to load menu", color: "red" });
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => { loadBootstrap(); }, [loadBootstrap]);

  const syncOrder = useCallback(async (orderId: string) => {
    const updated = await getBootstrap(restaurantId); // minimal — just re-use bootstrap for now
    // fetch the actual order
    const { order, items } = await (async () => {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://dine-api.logixsoft.in";
      const r = await fetch(`${API_BASE}/billing/orders/${orderId}`, {
        credentials: "include",
        headers: { "X-Restaurant-Id": restaurantId },
      });
      return r.json();
    })();
    setCurrentOrder({ order, items });
  }, [restaurantId]);

  const handleStartOrder = async () => {
    if (!activeOutlet) {
      notifications.show({ title: "No outlet", message: "Select an outlet first", color: "red" });
      return;
    }
    setStarting(true);
    try {
      const result = await startOrder(restaurantId, { outletId: activeOutlet.id, tableNo: tableNo || undefined });
      setCurrentOrder(result);
      notifications.show({ title: `Order #${result.order.orderNo} started`, message: tableNo ? `Table ${tableNo}` : "No table", color: "dinePrimary", icon: <IconCheck size={16} /> });
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setStarting(false);
    }
  };

  const handleAddItem = async (item: any) => {
    if (!currentOrder) {
      // Auto-start order
      if (!activeOutlet) {
        notifications.show({ title: "No outlet", message: "Select an outlet first", color: "orange" });
        return;
      }
      setStarting(true);
      try {
        const result = await startOrder(restaurantId, { outletId: activeOutlet.id, tableNo: tableNo || undefined });
        setCurrentOrder(result);
        // Then add item
        const updated = await addOrderItem(restaurantId, result.order.id, { itemId: item.id, qty: 1 });
        setCurrentOrder(updated);
        // Print KOT automatically
        const kotPayload = buildKotPayload(updated, restaurant);
        const printResult = await printTicket(kotPayload);
        await markKotPrinted(restaurantId, result.order.id).catch(() => {});
        notifications.show({
          title: `KOT #${updated.order.orderNo}`,
          message: printResult === "ble" ? "Sent to printer" : printResult === "browser" ? "Sent to browser print" : "Print failed — reprint from Orders",
          color: printResult === "error" ? "orange" : "dinePrimary",
        });
      } catch (err: any) {
        notifications.show({ title: "Error", message: err.message, color: "red" });
      } finally {
        setStarting(false);
      }
      return;
    }

    try {
      const updated = await addOrderItem(restaurantId, currentOrder.order.id, { itemId: item.id, qty: 1 });
      setCurrentOrder(updated);
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  const handleUpdateQty = async (orderItemId: string, qty: number) => {
    if (qty < 1) {
      await handleRemoveItem(orderItemId);
      return;
    }
    try {
      const updated = await updateOrderItemQty(restaurantId, currentOrder.order.id, orderItemId, qty);
      setCurrentOrder(updated);
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  const handleRemoveItem = async (orderItemId: string) => {
    try {
      const updated = await removeOrderItem(restaurantId, currentOrder.order.id, orderItemId);
      setCurrentOrder(updated);
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  const handleSend = async () => {
    if (!currentOrder || !restaurant) return;
    const kotPayload = buildKotPayload(currentOrder, restaurant);
    const printResult = await printTicket(kotPayload);
    await markKotPrinted(restaurantId, currentOrder.order.id).catch(() => {});
    notifications.show({
      title: `Order #${currentOrder.order.orderNo} sent to kitchen`,
      message: printResult === "ble" ? "KOT printed via Bluetooth" : printResult === "browser" ? "KOT sent to browser print" : "Print failed — reprint from Orders",
      color: printResult === "error" ? "orange" : "dinePrimary",
      icon: <IconCheck size={16} />,
    });
  };

  const handleSettle = async () => {
    setSettling(true);
    try {
      const updated = await settleOrder(restaurantId, currentOrder.order.id, { method: settleMethod });
      setCurrentOrder(null);
      setSettleModal(false);
      setTableNo("");
      // Print bill
      if (restaurant) {
        const billPayload = buildBillPayload(updated, restaurant);
        const printResult = await printTicket(billPayload);
        notifications.show({
          title: "Order settled!",
          message: `#${updated.order.orderNo} — ₹${(updated.order.subtotalPaise / 100).toFixed(0)} via ${settleMethod}${printResult === "ble" ? " · Bill printed" : printResult === "browser" ? " · Bill sent to print" : ""}`,
          color: "green",
          icon: <IconCheck size={16} />,
        });
      } else {
        notifications.show({
          title: "Order settled!",
          message: `Order #${updated.order.orderNo} — ₹${(updated.order.subtotalPaise / 100).toFixed(0)} via ${settleMethod}`,
          color: "green",
          icon: <IconCheck size={16} />,
        });
      }
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSettling(false);
    }
  };

  const handleVoid = async () => {
    if (!confirm("Void this order?")) return;
    try {
      await voidOrder(restaurantId, currentOrder.order.id);
      setCurrentOrder(null);
      setTableNo("");
      notifications.show({ title: "Order voided", message: "", color: "gray" });
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  if (loading) return <Center py={100}><Loader size="lg" color="dinePrimary" /></Center>;
  if (!bootstrap) return null;

  const { categories, items } = bootstrap;
  const filteredItems = items
    .filter((i: any) => activeCatId ? i.categoryId === activeCatId : true)
    .filter((i: any) => i.available)
    .filter((i: any) => !searchQuery || i.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const cartItems = currentOrder?.items ?? [];
  const total = currentOrder?.order.subtotalPaise ?? 0;
  const cartCount = cartItems.reduce((s: number, i: any) => s + i.qty, 0);

  const CartPanel = () => (
    <Stack gap="sm" h="100%">
      <Group justify="space-between">
        <Title order={4}>Cart {currentOrder ? `#${currentOrder.order.orderNo}` : ""}</Title>
        {currentOrder?.order.tableNo && <Badge size="sm" leftSection={<IconTableAlias size={12} />}>{currentOrder.order.tableNo}</Badge>}
      </Group>

      {!currentOrder && (
        <Stack gap="xs">
          <TextInput
            placeholder="Table no. (optional)"
            size="sm"
            value={tableNo}
            onChange={(e) => setTableNo(e.target.value)}
            leftSection={<IconTableAlias size={14} />}
          />
        </Stack>
      )}

      <Divider />
      <ScrollArea flex={1} type="auto" style={{ minHeight: 0 }}>
        <Stack gap="xs">
          {cartItems.length === 0 && (
            <Text c="dimmed" size="sm" ta="center" py="xl">Add items to start an order</Text>
          )}
          {cartItems.map((item: any) => (
            <Paper key={item.id} withBorder p="xs" radius="sm">
              <Group justify="space-between" gap="xs" wrap="nowrap">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text size="sm" fw={500} lineClamp={1}>{item.nameSnapshot}</Text>
                  <Text size="xs" c="dimmed">₹{(item.pricePaiseSnapshot / 100).toFixed(0)} each</Text>
                </div>
                <Group gap={4} wrap="nowrap">
                  <ActionIcon size="xs" variant="light" onClick={() => handleUpdateQty(item.id, item.qty - 1)}>
                    <IconMinus size={10} />
                  </ActionIcon>
                  <Text size="sm" w={20} ta="center">{item.qty}</Text>
                  <ActionIcon size="xs" variant="light" onClick={() => handleUpdateQty(item.id, item.qty + 1)}>
                    <IconPlus size={10} />
                  </ActionIcon>
                  <ActionIcon size="xs" variant="light" color="red" onClick={() => handleRemoveItem(item.id)}>
                    <IconTrash size={10} />
                  </ActionIcon>
                </Group>
                <Text size="sm" fw={600} w={48} ta="right">₹{((item.pricePaiseSnapshot * item.qty) / 100).toFixed(0)}</Text>
              </Group>
            </Paper>
          ))}
        </Stack>
      </ScrollArea>

      <Divider />
      <Group justify="space-between">
        <Text fw={700}>Total</Text>
        <Text fw={700} c="dinePrimary" size="lg">₹{(total / 100).toFixed(0)}</Text>
      </Group>

      {currentOrder ? (
        <Stack gap="xs">
          {/* Split button: Send (primary) + chevron → Settle & Send */}
          <Group gap={0} grow>
            <Button
              color="dinePrimary"
              onClick={handleSend}
              style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0, flex: 1 }}
              disabled={cartItems.length === 0}
            >
              Send
            </Button>
            <Menu position="top-end" withinPortal>
              <Menu.Target>
                <Button
                  color="dinePrimary"
                  px="xs"
                  style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeft: "1px solid rgba(255,255,255,0.3)" }}
                  disabled={cartItems.length === 0}
                >
                  <IconChevronRight size={16} />
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconCash size={16} />}
                  onClick={() => setSettleModal(true)}
                >
                  Settle &amp; Send
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
          <Button fullWidth variant="light" color="red" onClick={handleVoid} size="xs">
            Void Order
          </Button>
        </Stack>
      ) : (
        <Button fullWidth color="dinePrimary" onClick={handleStartOrder} loading={starting} leftSection={<IconShoppingCart size={16} />}>
          New Order
        </Button>
      )}
    </Stack>
  );

  return (
    <Box
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 60px)",
        overflow: "hidden",
      }}
      px={{ base: "xs", sm: "md" }}
      pt="xs"
    >
      <Grid gap="md" style={{ flex: 1, overflow: "hidden", height: "100%" }}>
        {/* Menu Panel */}
        <Grid.Col
          span={{ base: 12, sm: 8 }}
          style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}
        >
          <Stack gap="sm" style={{ height: "100%", overflow: "hidden" }}>
            <Group>
              <TextInput
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                flex={1}
                size="sm"
              />
              {/* Mobile cart button */}
              <Button
                hiddenFrom="sm"
                color="dinePrimary"
                variant={cartCount > 0 ? "filled" : "light"}
                onClick={() => setCartOpen(true)}
                leftSection={<IconShoppingCart size={16} />}
                size="sm"
              >
                {cartCount > 0 ? `Cart (${cartCount}) — ₹${(total / 100).toFixed(0)}` : "Cart"}
              </Button>
            </Group>

            {/* Category Tabs */}
            <ScrollArea type="auto">
              <Group gap="xs" wrap="nowrap" pb="xs">
                {categories.map((cat: any) => (
                  <Button
                    key={cat.id}
                    size="xs"
                    variant={activeCatId === cat.id ? "filled" : "light"}
                    color="dinePrimary"
                    onClick={() => setActiveCatId(cat.id)}
                  >
                    {cat.name}
                  </Button>
                ))}
              </Group>
            </ScrollArea>

            {/* Item Grid - scrollable */}
            <ScrollArea flex={1} type="auto" style={{ minHeight: 0 }} pb={100}>
              <Grid gap="xs">
                {filteredItems.map((item: any) => {
                  const inCart = cartItems.find((ci: any) => ci.itemId === item.id);
                  return (
                    <Grid.Col key={item.id} span={{ base: 6, sm: 4, md: 3, lg: 2 }}>
                      <Paper
                        withBorder
                        p="sm"
                        radius="md"
                        onClick={() => handleAddItem(item)}
                        style={{ cursor: "pointer", position: "relative", borderColor: inCart ? "#af73d7" : undefined }}
                      >
                        {inCart && (
                          <Badge
                            size="xs"
                            color="dinePrimary"
                            style={{ position: "absolute", top: 6, right: 6 }}
                          >
                            ×{inCart.qty}
                          </Badge>
                        )}
                        <Text size="sm" fw={500} lineClamp={2} mb={4}>{item.name}</Text>
                        <Text size="sm" fw={700} c="dinePrimary">₹{(item.pricePaise / 100).toFixed(0)}</Text>
                      </Paper>
                    </Grid.Col>
                  );
                })}
                {!filteredItems.length && (
                  <Grid.Col span={12}>
                    <Text c="dimmed" size="sm" ta="center" py="xl">No items found</Text>
                  </Grid.Col>
                )}
              </Grid>
            </ScrollArea>
          </Stack>
        </Grid.Col>

        {/* Desktop Cart Panel */}
        <Grid.Col span={{ base: 0, sm: 4 }} visibleFrom="sm" style={{ height: "100%" }}>
          <Paper
            withBorder
            p="md"
            radius="md"
            style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}
          >
            <CartPanel />
          </Paper>
        </Grid.Col>
      </Grid>

      {/* Mobile Cart Drawer */}
      <Drawer
        opened={cartOpen}
        onClose={() => setCartOpen(false)}
        title="Cart"
        position="bottom"
        size="75%"
        hiddenFrom="sm"
      >
        <CartPanel />
      </Drawer>

      {/* Settle Modal */}
      <Modal opened={settleModal} onClose={() => setSettleModal(false)} title="Settle & Send" size="sm">
        <Stack>
          <Group justify="space-between">
            <Text>Order #{currentOrder?.order.orderNo}</Text>
            <Text fw={700} c="dinePrimary" size="xl">₹{(total / 100).toFixed(0)}</Text>
          </Group>
          <Select
            label="Payment Method"
            value={settleMethod}
            onChange={(v) => v && setSettleMethod(v)}
            data={[
              { value: "Cash", label: "💵 Cash" },
              { value: "UPI", label: "📱 UPI" },
              { value: "QR", label: "🔲 QR Code" },
            ]}
          />
          <Button fullWidth color="dinePrimary" onClick={handleSettle} loading={settling} leftSection={<IconCheck size={16} />}>
            Confirm Settlement
          </Button>
        </Stack>
      </Modal>
    </Box>
  );
}
