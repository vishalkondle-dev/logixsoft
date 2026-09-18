"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Grid, Paper, Title, Text, Group, Stack, Badge, Button, ActionIcon,
  TextInput, Textarea, Loader, Center, Modal, Select, Divider, Menu,
  Drawer, Box, ScrollArea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconPlus, IconMinus, IconTrash, IconChevronDown,
  IconCheck, IconShoppingCart, IconCash, IconTableAlias, IconBrandWhatsapp,
  IconNote, IconEdit, IconX,
} from "@tabler/icons-react";
import { useRestaurant } from "@/lib/restaurant-context";
import {
  getBootstrap, startOrder, settleOrder, markKotPrinted, getTables,
} from "@/lib/api-client";
import { buildKotPayload, buildBillPayload } from "@/lib/ticket";
import { printTicket } from "@/lib/print";

interface LocalCartItem {
  itemId: string;
  name: string;
  pricePaise: number;
  qty: number;
  note?: string;
}

const DEFAULT_NOTE_CHIPS = [
  "Less Spicy",
  "Extra Spicy",
  "No Onion / Garlic",
  "Jain",
  "Less Oil",
  "Extra Crispy",
  "Parcel",
  "No Ice",
  "Less Sugar",
  "Serve Hot",
];

interface CartPanelProps {
  cartItems: LocalCartItem[];
  cartCount: number;
  total: number;
  tableNo: string;
  setTableNo: (table: string) => void;
  customerPhone: string;
  setCustomerPhone: (phone: string) => void;
  tableSelectData: { value: string; label: string }[];
  handleClearCart: () => void;
  openNoteModal: (item: LocalCartItem) => void;
  handleUpdateQty: (itemId: string, qty: number) => void;
  handleRemoveItem: (itemId: string) => void;
  handleSend: () => void;
  sending: boolean;
  setSettleModal: (open: boolean) => void;
}

function CartPanel({
  cartItems,
  cartCount,
  total,
  tableNo,
  setTableNo,
  customerPhone,
  setCustomerPhone,
  tableSelectData,
  handleClearCart,
  openNoteModal,
  handleUpdateQty,
  handleRemoveItem,
  handleSend,
  sending,
  setSettleModal,
}: CartPanelProps) {
  return (
    <Stack gap="sm" h="100%">
      <Group justify="space-between">
        <Group gap="xs">
          <Title order={4}>Cart</Title>
          {cartCount > 0 && <Badge size="sm" color="dinePrimary">{cartCount}</Badge>}
        </Group>
        {(cartItems.length > 0 || customerPhone.length > 0 || tableNo !== "Takeaway") && (
          <Button variant="subtle" color="red" size="compact-xs" onClick={handleClearCart}>
            Clear
          </Button>
        )}
      </Group>

      {/* Cart Selection: Table select (default to Takeaway) + optional Customer Phone */}
      <Stack gap="xs">
        <Select
          label="Table / Order Type"
          placeholder="Select table"
          size="sm"
          value={tableNo}
          onChange={(v) => setTableNo(v || "Takeaway")}
          data={tableSelectData}
          leftSection={<IconTableAlias size={16} />}
          allowDeselect={false}
          comboboxProps={{ withinPortal: true, zIndex: 1500 }}
        />

        <TextInput
          label="Customer Phone (optional)"
          placeholder="WhatsApp number (e.g. 9876543210)"
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={20}
          size="sm"
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, "").slice(0, 15))}
          leftSection={<IconBrandWhatsapp size={16} color="#25D366" />}
        />
      </Stack>

      <Divider />
      <ScrollArea flex={1} type="auto" style={{ minHeight: 0 }}>
        <Stack gap="xs">
          {cartItems.length === 0 && (
            <Text c="dimmed" size="sm" ta="center" py="xl">Add items from menu to start an order</Text>
          )}
          {cartItems.map((item) => (
            <Paper key={item.itemId} withBorder p="xs" radius="sm">
              <Group justify="space-between" gap="xs" wrap="nowrap" align="center">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text size="sm" fw={500} lineClamp={1}>{item.name}</Text>
                  <Group gap={6} align="center" mt={2} wrap="nowrap">
                    <Text size="xs" c="dimmed">₹{(item.pricePaise / 100).toFixed(0)}</Text>
                    <Text size="xs" c="dimmed">·</Text>
                    {item.note ? (
                      <Badge
                        size="xs"
                        variant="light"
                        color="dinePrimary"
                        style={{ cursor: "pointer", maxWidth: 130 }}
                        onClick={() => openNoteModal(item)}
                        title="Click to edit note"
                        rightSection={<IconEdit size={10} />}
                      >
                        {item.note}
                      </Badge>
                    ) : (
                      <Button
                        variant="subtle"
                        color="dinePrimary"
                        size="compact-xs"
                        px={4}
                        h={18}
                        style={{ fontSize: 11, fontWeight: 500 }}
                        onClick={() => openNoteModal(item)}
                      >
                        + Note
                      </Button>
                    )}
                  </Group>
                </div>
                <Group gap={6} wrap="nowrap" align="center">
                  <ActionIcon size={30} variant="light" onClick={() => handleUpdateQty(item.itemId, item.qty - 1)} aria-label="Decrease quantity">
                    <IconMinus size={15} />
                  </ActionIcon>
                  <Text size="sm" fw={600} w={22} ta="center">{item.qty}</Text>
                  <ActionIcon size={30} variant="light" color="dinePrimary" onClick={() => handleUpdateQty(item.itemId, item.qty + 1)} aria-label="Increase quantity">
                    <IconPlus size={15} />
                  </ActionIcon>
                  <ActionIcon size={30} variant="light" color="red" onClick={() => handleRemoveItem(item.itemId)} aria-label="Remove item">
                    <IconTrash size={15} />
                  </ActionIcon>
                </Group>
                <Text size="sm" fw={600} w={52} ta="right">₹{((item.pricePaise * item.qty) / 100).toFixed(0)}</Text>
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

      {/* Split button: Send (primary) + small compact chevron down → Settle & Send */}
      <Group gap={0} wrap="nowrap" style={{ width: "100%" }}>
        <Button
          color="dinePrimary"
          onClick={handleSend}
          loading={sending}
          style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0, flex: 1 }}
          disabled={cartItems.length === 0}
          leftSection={<IconShoppingCart size={16} />}
        >
          Send
        </Button>
        <Menu position="top-end" withinPortal zIndex={1500}>
          <Menu.Target>
            <ActionIcon
              color="dinePrimary"
              variant="filled"
              size={36}
              style={{
                borderTopLeftRadius: 0,
                borderBottomLeftRadius: 0,
                borderLeft: "1px solid rgba(255,255,255,0.3)",
                flexShrink: 0,
                width: 36,
                height: 36,
              }}
              disabled={cartItems.length === 0 || sending}
              aria-label="More order options"
            >
              <IconChevronDown size={16} />
            </ActionIcon>
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
    </Stack>
  );
}

export default function POSPage() {
  const { restaurant, activeOutlet } = useRestaurant();
  const restaurantId = restaurant?.id ?? "";
  const outletId = activeOutlet?.id ?? null;

  const [bootstrap, setBootstrap] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Local cart state — orders are only created upon clicking Send
  const [cartItems, setCartItems] = useState<LocalCartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [tableNo, setTableNo] = useState<string>("Takeaway");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [tables, setTables] = useState<any[]>([]);

  // Settle modal state
  const [settleModal, setSettleModal] = useState(false);
  const [settleMethod, setSettleMethod] = useState<string>("Cash");
  const [settling, setSettling] = useState(false);
  const [sending, setSending] = useState(false);

  // Item note modal state
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteTargetItemId, setNoteTargetItemId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const openNoteModal = (item: LocalCartItem) => {
    setNoteTargetItemId(item.itemId);
    setNoteText(item.note || "");
    setNoteModalOpen(true);
  };

  const handleToggleChip = (chip: string) => {
    const parts = noteText.split(",").map((s) => s.trim()).filter(Boolean);
    const exists = parts.some((p) => p.toLowerCase() === chip.toLowerCase());
    let newText = "";
    if (exists) {
      newText = parts.filter((p) => p.toLowerCase() !== chip.toLowerCase()).join(", ");
    } else {
      newText = parts.length > 0 ? `${parts.join(", ")}, ${chip}` : chip;
    }
    setNoteText(newText);
  };

  const handleSaveNote = () => {
    if (!noteTargetItemId) return;
    const trimmed = noteText.trim();
    setCartItems((prev) =>
      prev.map((ci) =>
        ci.itemId === noteTargetItemId
          ? { ...ci, note: trimmed || undefined }
          : ci
      )
    );
    setNoteModalOpen(false);
    setNoteTargetItemId(null);
    setNoteText("");
  };

  const handleClearItemNote = () => {
    if (!noteTargetItemId) return;
    setCartItems((prev) =>
      prev.map((ci) =>
        ci.itemId === noteTargetItemId
          ? { ...ci, note: undefined }
          : ci
      )
    );
    setNoteModalOpen(false);
    setNoteTargetItemId(null);
    setNoteText("");
  };

  const handleClearCart = () => {
    setCartItems([]);
    setTableNo("Takeaway");
    setCustomerPhone("");
    if (cartOpen) setCartOpen(false);
  };

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

  // Load the outlet's table registry
  useEffect(() => {
    if (!restaurantId || !outletId) {
      setTables([]);
      return;
    }
    getTables(restaurantId, outletId)
      .then((rows) => setTables(rows.filter((t: any) => t.active)))
      .catch(() => setTables([]));
  }, [restaurantId, outletId]);

  // Handle adding items to local cart
  const handleAddItem = (item: any) => {
    setCartItems((prev) => {
      const existing = prev.find((ci) => ci.itemId === item.id);
      if (existing) {
        return prev.map((ci) =>
          ci.itemId === item.id ? { ...ci, qty: ci.qty + 1 } : ci
        );
      }
      return [
        ...prev,
        {
          itemId: item.id,
          name: item.name,
          pricePaise: item.pricePaise,
          qty: 1,
        },
      ];
    });
  };

  const handleUpdateQty = (itemId: string, qty: number) => {
    if (qty < 1) {
      handleRemoveItem(itemId);
      return;
    }
    setCartItems((prev) =>
      prev.map((ci) => (ci.itemId === itemId ? { ...ci, qty } : ci))
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setCartItems((prev) => prev.filter((ci) => ci.itemId !== itemId));
  };

  // Order created only after clicking Send
  const handleSend = async () => {
    if (cartItems.length === 0) return;
    if (!activeOutlet) {
      notifications.show({ title: "No outlet", message: "Select an outlet first", color: "red" });
      return;
    }

    setSending(true);
    try {
      const created = await startOrder(restaurantId, {
        outletId: activeOutlet.id,
        tableNo: tableNo || "Takeaway",
        customerPhone: customerPhone.trim() || undefined,
        items: cartItems.map((i) => ({ itemId: i.itemId, qty: i.qty, note: i.note })),
      });

      // Print KOT automatically
      const kotPayload = buildKotPayload(created, restaurant);
      const printResult = await printTicket(kotPayload);
      await markKotPrinted(restaurantId, created.order.id, activeOutlet.id).catch(() => {});

      const phoneNote = customerPhone.trim() ? ` · WA to ${customerPhone.trim()}` : "";
      notifications.show({
        title: `Order #${created.order.orderNo} sent to kitchen`,
        message: `${created.order.id} · ${created.order.tableNo || "Takeaway"}${phoneNote} · ${printResult === "ble" ? "KOT printed via Bluetooth" : printResult === "browser" ? "KOT sent to print" : "Order placed"}`,
        color: "dinePrimary",
        icon: <IconCheck size={16} />,
      });

      // Reset cart for subsequent orders
      setCartItems([]);
      setCustomerPhone("");
      setTableNo("Takeaway");
      if (cartOpen) setCartOpen(false);
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSending(false);
    }
  };

  // Settle & Send: create order, settle immediately, and dispatch receipt
  const handleSettleAndSend = async () => {
    if (cartItems.length === 0) return;
    if (!activeOutlet) {
      notifications.show({ title: "No outlet", message: "Select an outlet first", color: "red" });
      return;
    }

    setSettling(true);
    try {
      // 1. Create order
      const created = await startOrder(restaurantId, {
        outletId: activeOutlet.id,
        tableNo: tableNo || "Takeaway",
        customerPhone: customerPhone.trim() || undefined,
        items: cartItems.map((i) => ({ itemId: i.itemId, qty: i.qty, note: i.note })),
      });

      // 2. Settle order
      const settled = await settleOrder(
        restaurantId,
        created.order.id,
        { method: settleMethod, customerPhone: customerPhone.trim() || undefined },
        activeOutlet.id
      );

      // 3. Print KOT & Bill
      const kotPayload = buildKotPayload(settled, restaurant);
      await printTicket(kotPayload);
      await markKotPrinted(restaurantId, created.order.id, activeOutlet.id).catch(() => {});

      if (restaurant) {
        const billPayload = buildBillPayload(settled, restaurant);
        await printTicket(billPayload);
      }

      const phoneNote = customerPhone.trim() ? ` · WA sent` : "";
      notifications.show({
        title: "Order settled!",
        message: `#${settled.order.orderNo} (${settled.order.id}) — ₹${(settled.order.subtotalPaise / 100).toFixed(0)} via ${settleMethod}${phoneNote}`,
        color: "green",
        icon: <IconCheck size={16} />,
      });

      // Reset cart and modal
      setCartItems([]);
      setCustomerPhone("");
      setTableNo("Takeaway");
      setSettleModal(false);
      if (cartOpen) setCartOpen(false);
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSettling(false);
    }
  };

  if (loading) return <Center py={100}><Loader size="lg" color="dinePrimary" /></Center>;
  if (!bootstrap) return null;

  const { categories, items } = bootstrap;
  const filteredItems = items
    .filter((i: any) => activeCatId ? i.categoryId === activeCatId : true)
    .filter((i: any) => i.available)
    .filter((i: any) => !searchQuery || i.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const total = cartItems.reduce((s, i) => s + i.pricePaise * i.qty, 0);
  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0);

  const tableSelectData = [
    { value: "Takeaway", label: "Takeaway" },
    ...tables.map((t) => ({
      value: t.name,
      label: t.section ? `${t.name} · ${t.section}` : t.name,
    })),
  ];

  const cartPanelProps: CartPanelProps = {
    cartItems,
    cartCount,
    total,
    tableNo,
    setTableNo,
    customerPhone,
    setCustomerPhone,
    tableSelectData,
    handleClearCart,
    openNoteModal,
    handleUpdateQty,
    handleRemoveItem,
    handleSend,
    sending,
    setSettleModal,
  };

  return (
    <Box
      style={{
        height: "calc(100dvh - var(--app-shell-header-offset, 60px))",
        maxHeight: "calc(100dvh - var(--app-shell-header-offset, 60px))",
        display: "flex",
        flexDirection: "column",
      }}
      px={{ base: "xs", sm: "md" }}
      pt="xs"
    >
      <Grid gap="md" style={{ flex: 1, height: "100%", overflow: "visible" }}>
        {/* Menu Panel */}
        <Grid.Col
          span={{ base: 12, sm: 8 }}
          style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}
        >
          <Stack gap="sm" style={{ height: "100%", overflow: "hidden" }}>
            <TextInput
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="sm"
            />

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
                  const inCart = cartItems.find((ci) => ci.itemId === item.id);
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
          style={{ height: "100%", display: "flex", flexDirection: "column", position: "relative" }}
          >
            <CartPanel {...cartPanelProps} />
          </Paper>
        </Grid.Col>
      </Grid>

      {/* Floating Cart Button on Mobile: right bottom above bottom navbar (only visible if items added) */}
      {!cartOpen && cartCount > 0 && (
        <Box
          hiddenFrom="sm"
          style={{
            position: "fixed",
            bottom: "calc(80px + env(safe-area-inset-bottom, 0px))",
            right: 16,
            zIndex: 110,
          }}
        >
          <Button
            color="dinePrimary"
            variant="filled"
            radius="xl"
            size="md"
            onClick={() => setCartOpen(true)}
            leftSection={<IconShoppingCart size={20} />}
            style={{
              boxShadow: "0 6px 20px rgba(175, 115, 215, 0.45), 0 2px 8px rgba(0, 0, 0, 0.15)",
              fontWeight: 600,
            }}
          >
            Cart ({cartCount}) — ₹{(total / 100).toFixed(0)}
          </Button>
        </Box>
      )}

      {/* Mobile Cart Drawer */}
      <Drawer
        opened={cartOpen}
        onClose={() => setCartOpen(false)}
        title="Cart"
        position="bottom"
        size="80%"
        zIndex={1200}
        hiddenFrom="sm"
        styles={{
          body: {
            height: "calc(100% - 60px)",
            display: "flex",
            flexDirection: "column",
            paddingBottom: "max(16px, env(safe-area-inset-bottom))",
          },
        }}
      >
        <CartPanel {...cartPanelProps} />
      </Drawer>

      {/* Settle Modal */}
      <Modal opened={settleModal} onClose={() => setSettleModal(false)} title="Settle & Send" size="sm" zIndex={1300}>
        <Stack>
          <Group justify="space-between">
            <Text fw={500}>Order Total</Text>
            <Text fw={700} c="dinePrimary" size="xl">₹{(total / 100).toFixed(0)}</Text>
          </Group>
          <Text size="xs" c="dimmed">Table: {tableNo || "Takeaway"}</Text>
          <TextInput
            label="Customer Phone (WhatsApp)"
            placeholder="WhatsApp number (e.g. 9876543210)"
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={20}
            size="sm"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, "").slice(0, 15))}
            leftSection={<IconBrandWhatsapp size={16} color="#25D366" />}
          />
          <Select
            label="Payment Method"
            value={settleMethod}
            onChange={(v) => v && setSettleMethod(v)}
            data={[
              { value: "Cash", label: "💵 Cash" },
              { value: "UPI", label: "📱 UPI" },
              { value: "QR", label: "🔲 QR Code" },
            ]}
            comboboxProps={{ withinPortal: true, zIndex: 1500 }}
          />
          <Button
            fullWidth
            color="dinePrimary"
            onClick={handleSettleAndSend}
            loading={settling}
            leftSection={<IconCheck size={16} />}
          >
            Confirm Settlement &amp; Send
          </Button>
        </Stack>
      </Modal>

      {/* Item Note Modal */}
      <Modal
        opened={noteModalOpen}
        onClose={() => {
          setNoteModalOpen(false);
          setNoteTargetItemId(null);
        }}
        title={
          <Group gap="xs">
            <IconNote size={18} color="#af73d7" />
            <Text fw={600}>
              Note for {cartItems.find((ci) => ci.itemId === noteTargetItemId)?.name || "Item"}
            </Text>
          </Group>
        }
        size="sm"
        zIndex={1300}
      >
        <Stack gap="sm">
          <Text size="xs" c="dimmed">
            Select suggestions or type special cooking/packing instructions:
          </Text>
          <Group gap={6}>
            {DEFAULT_NOTE_CHIPS.map((chip) => {
              const parts = noteText.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
              const isSelected = parts.includes(chip.toLowerCase());
              return (
                <Button
                  key={chip}
                  size="compact-xs"
                  variant={isSelected ? "filled" : "light"}
                  color="dinePrimary"
                  radius="xl"
                  onClick={() => handleToggleChip(chip)}
                  leftSection={isSelected ? <IconCheck size={12} /> : undefined}
                >
                  {chip}
                </Button>
              );
            })}
          </Group>
          <Textarea
            label="Special Instructions"
            placeholder="e.g. Less spicy, pack separately, extra chutney..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            minRows={2}
            autosize
          />
          <Group justify="space-between" mt="xs">
            {noteTargetItemId && cartItems.find((ci) => ci.itemId === noteTargetItemId)?.note ? (
              <Button variant="subtle" color="red" size="xs" onClick={handleClearItemNote} leftSection={<IconX size={14} />}>
                Remove Note
              </Button>
            ) : <div />}
            <Group gap="xs">
              <Button variant="default" size="xs" onClick={() => setNoteModalOpen(false)}>
                Cancel
              </Button>
              <Button color="dinePrimary" size="xs" onClick={handleSaveNote} leftSection={<IconCheck size={14} />}>
                Save Note
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
