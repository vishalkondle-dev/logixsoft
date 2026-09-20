"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Grid, Paper, Title, Text, Group, Stack, Badge, Button, ActionIcon,
  TextInput, Textarea, Loader, Center, Modal, Select, Divider, Menu,
  Drawer, Box, ScrollArea, CloseButton, SegmentedControl,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useQueryClient } from "@tanstack/react-query";
import {
  IconPlus, IconMinus, IconTrash, IconChevronDown,
  IconCheck, IconShoppingCart, IconCash, IconTableAlias, IconBrandWhatsapp,
  IconNote, IconEdit, IconX, IconClock,
} from "@tabler/icons-react";
import { useRestaurant } from "@/lib/restaurant-context";
import { useCategories, useItems, useTables, useOrders, qk } from "@/lib/queries";
import {
  startOrder, settleOrder, markKotPrinted, createSettledOrder, addOrderRound,
} from "@/lib/api-client";
import { buildKotPayload, buildBillPayload } from "@/lib/ticket";
import { printTicket, printTicketSilent } from "@/lib/print";
import { UpiQrCode } from "@/components/common/upi-qr-code";
import { useOutletSync } from "@/lib/use-outlet-sync";

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

function normalizeTable(val?: string | null) {
  if (!val) return "";
  return val.toLowerCase().replace(/^(table|tbl|t)[\s\-_]*/i, "").trim();
}

function isTableMatch(name1?: string | null, name2?: string | null) {
  if (!name1 || !name2) return false;
  if (name1.trim().toLowerCase() === name2.trim().toLowerCase()) return true;
  const n1 = normalizeTable(name1);
  const n2 = normalizeTable(name2);
  return n1.length > 0 && n1 === n2;
}

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
  onClose?: () => void;
  activeTableOrder?: any;
  nextRound?: number;
  currentRound?: number;
  onViewExistingItems?: () => void;
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
  onClose,
  activeTableOrder,
  nextRound = 2,
  currentRound = 1,
  onViewExistingItems,
}: CartPanelProps) {
  return (
    <Stack gap="sm" h="100%">
      <Group justify="space-between" align="center">
        <Group gap="xs" align="center">
          <Title order={4}>Cart</Title>
          {cartCount > 0 && <Badge size="sm" color="dinePrimary">{cartCount}</Badge>}
        </Group>
        <Group gap="xs" align="center">
          {(cartItems.length > 0 || customerPhone.length > 0 || tableNo !== "Takeaway") && (
            <Button variant="subtle" color="red" size="compact-xs" onClick={handleClearCart}>
              Clear
            </Button>
          )}
          {onClose && (
            <CloseButton onClick={onClose} size="sm" aria-label="Close cart" />
          )}
        </Group>
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

        {activeTableOrder && (() => {
          const paidPaise = activeTableOrder.order.paidPaise || 0;
          const totalPaise = activeTableOrder.order.subtotalPaise || 0;
          const duePaise = Math.max(0, totalPaise - paidPaise);
          const isAllPaid = duePaise === 0 && totalPaise > 0;

          return (
            <Paper
              p="xs"
              radius="sm"
              bg="white"
            >
              <Group justify="space-between" align="center" mb={2}>
                <Badge
                  size="xs"
                  color={isAllPaid ? "teal" : "orange"}
                  variant="filled"
                  leftSection={isAllPaid ? <IconCheck size={10} /> : <IconClock size={10} />}
                >
                  Round {currentRound} Active {isAllPaid ? "· All Paid" : ""}
                </Badge>
                <Text size="xs" fw={800} c={isAllPaid ? "teal.9" : "orange.9"}>
                  Token #{activeTableOrder.order.orderNo}
                </Text>
              </Group>
              <Group justify="space-between" align="center" mt={4}>
                <Text size="11px" c="dimmed">
                  Bill: ₹{(totalPaise / 100).toFixed(0)} · Paid: ₹{(paidPaise / 100).toFixed(0)} · Due: ₹{(duePaise / 100).toFixed(0)}
                </Text>
                {onViewExistingItems && (
                  <Button
                    variant="subtle"
                    color="dinePrimary"
                    size="compact-xs"
                    onClick={onViewExistingItems}
                  >
                    View Items
                  </Button>
                )}
              </Group>
            </Paper>
          );
        })()}
      </Stack>

      <Divider />
      <ScrollArea flex={1} type="auto" style={{ minHeight: 0 }}>
        <Stack gap="xs">
          {cartItems.length === 0 && (
            <Text c="dimmed" size="sm" ta="center" py="xl">Add items from menu to start an order</Text>
          )}
          {cartItems.map((item) => (
            <Paper key={item.itemId} p="xs" radius="sm" bg="white">
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
          color={activeTableOrder ? "orange" : "dinePrimary"}
          onClick={handleSend}
          loading={sending}
          style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0, flex: 1 }}
          disabled={cartItems.length === 0}
          leftSection={activeTableOrder ? <IconPlus size={16} /> : <IconShoppingCart size={16} />}
        >
          {activeTableOrder ? `Send Round ${nextRound} to Kitchen` : "Send"}
        </Button>
        <Menu position="top-end" withinPortal zIndex={1500}>
          <Menu.Target>
            <ActionIcon
              color={activeTableOrder ? "orange" : "dinePrimary"}
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
              {activeTableOrder ? `Settle & Send Round ${nextRound}` : "Settle & Send"}
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
  const queryClient = useQueryClient();

  // Server data via React Query — same cache keys as MenuManagement → zero refetch on page switch
  const { data: categories = [], isLoading: catsLoading } = useCategories(restaurantId, outletId);
  const { data: items = [], isLoading: itemsLoading } = useItems(restaurantId, outletId);
  const loading = catsLoading || itemsLoading;
  const { data: tablesData } = useTables(restaurantId, outletId);
  const tables = (tablesData ?? []).filter((t: any) => t.active);

  // Real-time live sync via Cloudflare Durable Object
  const { isConnected } = useOutletSync(restaurantId, outletId);

  // Table orders for instant occupancy and active table matching (real-time push, 30s safety fallback when offline)
  const { data: openOrders = [] } = useOrders(
    restaurantId,
    { tableOccupied: true, outletId: outletId ?? undefined },
    Boolean(restaurantId && outletId),
    { refetchInterval: isConnected ? false : 30_000 }
  );

  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Local cart state — orders are only created upon clicking Send
  const [cartItems, setCartItems] = useState<LocalCartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [tableNo, setTableNo] = useState<string>("Takeaway");
  const [customerPhone, setCustomerPhone] = useState<string>("");

  // Active table order matching & round computation
  const activeTableOrder = useMemo(() => {
    if (!tableNo || tableNo === "Takeaway") return null;
    return openOrders.find((entry: any) => isTableMatch(tableNo, entry.order?.tableNo)) ?? null;
  }, [openOrders, tableNo]);

  const currentRound = useMemo(() => {
    if (!activeTableOrder) return 1;
    const activeItems = activeTableOrder.items ?? [];
    return activeItems.reduce((max: number, it: any) => Math.max(max, it.round || 1), 1);
  }, [activeTableOrder]);

  const nextRound = currentRound + 1;
  const [showExistingItemsModal, setShowExistingItemsModal] = useState(false);

  // Sync table from URL if provided (e.g. from Tables page)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tableParam = params.get("table");
      if (tableParam) {
        setTableNo(tableParam);
      }
    }
  }, []);

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

    // Auto-select first category when categories load
  useEffect(() => {
    if (categories.length) {
      setActiveCatId((prev) => prev ?? (categories[0] as any).id);
    }
  }, [categories]);

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
      if (activeTableOrder) {
        // MULTIPLE ROUNDS: Append new round of items to active table order
        const roundRes = await addOrderRound(
          restaurantId,
          activeTableOrder.order.id,
          {
            items: cartItems.map((i) => ({ itemId: i.itemId, qty: i.qty, note: i.note })),
          },
          activeOutlet.id
        );

        const currentRoundNum = roundRes.round || nextRound;

        // Reset cart immediately — don't wait for print
        setCartItems([]);
        if (cartOpen) setCartOpen(false);

        // Print KOT for ONLY newly added items in this round
        const kotPayload = buildKotPayload(
          { order: activeTableOrder.order, items: roundRes.addedItems || cartItems },
          restaurant,
          { round: currentRoundNum }
        );

        printTicketSilent(kotPayload)
          .then((printResult) => {
            notifications.show({
              title: `Round ${currentRoundNum} sent to kitchen!`,
              message: `${activeTableOrder.order.tableNo} (Token #${activeTableOrder.order.orderNo}) · ${printResult === "ble" ? "KOT printed via Bluetooth" : printResult === "browser" ? "KOT sent to print" : "KOT dispatched"}`,
              color: "dinePrimary",
              icon: <IconCheck size={16} />,
            });
          })
          .catch(() => {
            notifications.show({
              title: `Round ${currentRoundNum} sent to kitchen!`,
              message: `${activeTableOrder.order.tableNo} (Token #${activeTableOrder.order.orderNo})`,
              color: "dinePrimary",
              icon: <IconCheck size={16} />,
            });
          });

        queryClient.invalidateQueries({ queryKey: qk.orders(restaurantId) });
        queryClient.invalidateQueries({ queryKey: qk.kitchenOrders(restaurantId, activeOutlet.id) });
        queryClient.invalidateQueries({ queryKey: qk.tables(restaurantId, activeOutlet.id) });
      } else {
        const created = await startOrder(restaurantId, {
          outletId: activeOutlet.id,
          tableNo: tableNo || "Takeaway",
          customerPhone: customerPhone.trim() || undefined,
          items: cartItems.map((i) => ({ itemId: i.itemId, qty: i.qty, note: i.note })),
        });

        // Reset cart immediately — don't wait for print
        setCartItems([]);
        setCustomerPhone("");
        setTableNo("Takeaway");
        if (cartOpen) setCartOpen(false);

        // Print KOT + mark printed in background (non-blocking)
        const kotPayload = buildKotPayload(created, restaurant, { round: 1 });
        printTicketSilent(kotPayload).then((printResult) => {
          markKotPrinted(restaurantId, created.order.id, activeOutlet.id).catch(() => {});
          const phoneNote = customerPhone.trim() ? ` · WA to ${customerPhone.trim()}` : "";
          notifications.show({
            title: `Order #${created.order.orderNo} sent to kitchen`,
            message: `${created.order.tableNo || "Takeaway"}${phoneNote} · ${printResult === "ble" ? "KOT printed via Bluetooth" : printResult === "browser" ? "KOT sent to print" : "Order placed"}`,
            color: "dinePrimary",
            icon: <IconCheck size={16} />,
          });
        }).catch(() => {
          notifications.show({
            title: `Order #${created.order.orderNo} sent`,
            message: `${created.order.tableNo || "Takeaway"} — KOT print skipped`,
            color: "dinePrimary",
            icon: <IconCheck size={16} />,
          });
        });

        queryClient.invalidateQueries({ queryKey: qk.orders(restaurantId) });
        queryClient.invalidateQueries({ queryKey: qk.kitchenOrders(restaurantId, activeOutlet.id) });
        queryClient.invalidateQueries({ queryKey: qk.tables(restaurantId, activeOutlet.id) });
      }
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSending(false);
    }
  };

  // Settle & Send: single API call creates + settles in one transaction
  const handleSettleAndSend = async () => {
    if (cartItems.length === 0) return;
    if (!activeOutlet) {
      notifications.show({ title: "No outlet", message: "Select an outlet first", color: "red" });
      return;
    }

    setSettling(true);
    try {
      if (activeTableOrder) {
        const addedRound = await addOrderRound(
          restaurantId,
          activeTableOrder.order.id,
          {
            items: cartItems.map((i) => ({ itemId: i.itemId, qty: i.qty, note: i.note })),
            settle: { method: settleMethod },
          },
          activeOutlet.id
        );

        const currentRoundNum = addedRound.round || nextRound;

        setCartItems([]);
        setCustomerPhone("");
        setSettleModal(false);
        if (cartOpen) setCartOpen(false);

        // Print KOT for newly added round
        const kotPayload = buildKotPayload(
          { order: activeTableOrder.order, items: addedRound.addedItems || cartItems },
          restaurant,
          { round: currentRoundNum }
        );
        printTicketSilent(kotPayload).catch(() => {});

        notifications.show({
          title: `Round ${currentRoundNum} Settled & Sent!`,
          message: `${activeTableOrder.order.tableNo} (Token #${activeTableOrder.order.orderNo}) — ₹${(total / 100).toFixed(0)} paid via ${settleMethod}. Table remains occupied.`,
          color: "green",
          icon: <IconCheck size={16} />,
        });

        queryClient.invalidateQueries({ queryKey: qk.orders(restaurantId) });
        queryClient.invalidateQueries({ queryKey: qk.kitchenOrders(restaurantId, activeOutlet.id) });
        queryClient.invalidateQueries({ queryKey: qk.tables(restaurantId, activeOutlet.id) });
      } else {
        const result = await createSettledOrder(restaurantId, {
          outletId: activeOutlet.id,
          tableNo: tableNo || "Takeaway",
          customerPhone: customerPhone.trim() || undefined,
          method: settleMethod,
          items: cartItems.map((i) => ({ itemId: i.itemId, qty: i.qty, note: i.note })),
        });

        // Success — close modal and clear cart
        setCartItems([]);
        setCustomerPhone("");
        setTableNo("Takeaway");
        setSettleModal(false);
        if (cartOpen) setCartOpen(false);

        // Print KOT + Bill silently (BLE only — no browser popup after settle)
        printTicketSilent(buildKotPayload(result, restaurant, { round: 1 })).catch(() => {});
        printTicketSilent(buildBillPayload(result, restaurant)).catch(() => {});

        const phoneNote = customerPhone.trim() ? ` · WA sent` : "";
        notifications.show({
          title: "Order settled!",
          message: `#${result.order.orderNo} — ₹${(result.order.subtotalPaise / 100).toFixed(0)} via ${settleMethod}${phoneNote}`,
          color: "green",
          icon: <IconCheck size={16} />,
        });

        queryClient.invalidateQueries({ queryKey: qk.orders(restaurantId) });
        queryClient.invalidateQueries({ queryKey: qk.kitchenOrders(restaurantId, activeOutlet.id) });
        queryClient.invalidateQueries({ queryKey: qk.tables(restaurantId, activeOutlet.id) });
      }
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSettling(false);
    }
  };

  if (loading) return <Center py={100}><Loader size="lg" color="dinePrimary" /></Center>;
  if (!categories.length && !loading) {
    return (
      <Center py={100}>
        <Stack align="center" gap="sm">
          <Text size="lg" fw={600} c="dimmed">No Menu Items Found</Text>
          <Text size="sm" c="dimmed">Add categories and dishes in Menu Management to start taking orders.</Text>
        </Stack>
      </Center>
    );
  }

  const hasSearch = Boolean(searchQuery.trim());
  const filteredItems = items
    .filter((i: any) => i.available)
    .filter((i: any) => hasSearch ? true : (activeCatId ? i.categoryId === activeCatId : true))
    .filter((i: any) => !hasSearch || i.name.toLowerCase().includes(searchQuery.trim().toLowerCase()));

  const total = cartItems.reduce((s, i) => s + i.pricePaise * i.qty, 0);
  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0);

  const tableSelectData = [
    { value: "Takeaway", label: "Takeaway" },
    ...tables.map((t: any) => {
      const occ = openOrders.find((entry: any) => isTableMatch(t.name, entry.order?.tableNo));
      let label = t.section ? `${t.name} · ${t.section}` : t.name;
      if (occ) {
        const r = (occ.items ?? []).reduce((m: number, i: any) => Math.max(m, i.round || 1), 1);
        label += ` (Occupied · Round ${r})`;
      }
      return { value: t.name, label };
    }),
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
    activeTableOrder,
    nextRound,
    currentRound,
    onViewExistingItems: () => setShowExistingItemsModal(true),
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
            <ScrollArea type="auto" offsetScrollbars={false} scrollbars="x">
              <Group gap="xs" wrap="nowrap" pb="xs" style={{ minWidth: "max-content" }}>
                {categories.map((cat: any) => (
                  <Button
                    key={cat.id}
                    size="xs"
                    variant={activeCatId === cat.id ? "filled" : "light"}
                    color="dinePrimary"
                    onClick={() => setActiveCatId(cat.id)}
                    style={{ flexShrink: 0, whiteSpace: "nowrap" }}
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
                        p="sm"
                        radius="md"
                        bg="white"
                        onClick={() => handleAddItem(item)}
                        style={{
                          cursor: "pointer",
                          position: "relative",
                          boxShadow: inCart ? "0 0 0 2px #af73d7" : "0 1px 3px rgba(0, 0, 0, 0.05)",
                        }}
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
            p="md"
            radius="md"
            bg="white"
            style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              position: "relative",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
            }}
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
        position="bottom"
        size="80%"
        zIndex={1200}
        hiddenFrom="sm"
        withCloseButton={false}
        styles={{
          body: {
            height: "100%",
            display: "flex",
            flexDirection: "column",
            paddingTop: "16px",
            paddingBottom: "max(16px, env(safe-area-inset-bottom))",
          },
        }}
      >
        <CartPanel {...cartPanelProps} onClose={() => setCartOpen(false)} />
      </Drawer>

      {/* Settle Modal */}
      <Modal
        opened={settleModal}
        onClose={() => setSettleModal(false)}
        title={activeTableOrder ? `Settle & Send Round ${nextRound}` : "Settle & Send"}
        size="sm"
        zIndex={1300}
      >
        <Stack>
          <Group justify="space-between">
            <Text fw={500}>{activeTableOrder ? `Round ${nextRound} Total` : "Order Total"}</Text>
            <Text fw={700} c="dinePrimary" size="xl">₹{(total / 100).toFixed(0)}</Text>
          </Group>
          <Text size="xs" c="dimmed">
            Table: {tableNo || "Takeaway"}{activeTableOrder ? " · Table remains occupied after round payment" : ""}
          </Text>
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
          <div>
            <Text size="sm" fw={600} mb={6}>
              Payment Method
            </Text>
            <SegmentedControl
              fullWidth
              value={settleMethod}
              onChange={setSettleMethod}
              data={[
                { value: "Cash", label: "💵 Cash" },
                { value: "UPI", label: "📱 UPI" },
                { value: "QR", label: "🔲 QR Code" },
              ]}
              color="dinePrimary"
            />
          </div>
          {(settleMethod === "UPI" || settleMethod === "QR") && activeOutlet?.upiId && (
            <UpiQrCode
              upiId={activeOutlet.upiId}
              payeeName={activeOutlet.name || restaurant?.name}
              amount={total / 100}
              transactionId={
                activeTableOrder?.order?.orderNo
                  ? `Ord-${activeTableOrder.order.orderNo}-R${nextRound}`
                  : (tableNo && tableNo !== "Takeaway" ? `Table-${tableNo}` : `POS-${Date.now().toString().slice(-4)}`)
              }
            />
          )}
          <Button
            fullWidth
            color="dinePrimary"
            onClick={handleSettleAndSend}
            loading={settling}
            leftSection={<IconCheck size={16} />}
          >
            {activeTableOrder ? `Confirm Settlement & Send Round ${nextRound}` : "Confirm Settlement & Send"}
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

      {/* ─── Existing Order Items Modal ────────────────────────────────────── */}
      <Modal
        opened={showExistingItemsModal}
        onClose={() => setShowExistingItemsModal(false)}
        title={activeTableOrder ? `Table ${activeTableOrder.order.tableNo} · Token #${activeTableOrder.order.orderNo}` : "Active Order"}
        size="md"
        zIndex={1400}
      >
        {activeTableOrder && (() => {
          const paidPaise = activeTableOrder.order.paidPaise || 0;
          const totalPaise = activeTableOrder.order.subtotalPaise || 0;
          const duePaise = Math.max(0, totalPaise - paidPaise);

          return (
            <Stack gap="sm">
              <Group justify="space-between" align="center" wrap="wrap">
                <Badge color={duePaise === 0 ? "teal" : "orange"} variant="light" size="sm" leftSection={<IconClock size={12} />}>
                  Round {currentRound} Active {duePaise === 0 ? "· All Paid" : ""}
                </Badge>
                <Text size="xs" c="dimmed">
                  Ordered at {new Date(activeTableOrder.order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </Group>

              <Divider />

              <ScrollArea.Autosize mah={360}>
                <Stack gap="xs">
                  {(activeTableOrder.items ?? []).map((item: any) => {
                    const priceTotal = (((item.pricePaiseSnapshot ?? item.pricePaise ?? 0) * item.qty) / 100).toFixed(0);
                    const isPaid = item.paymentStatus === "PAID" || activeTableOrder.order.status === "PAID";
                    const statusColor =
                      item.status === "SERVED"
                        ? "green"
                        : item.status === "PREPARED"
                        ? "teal"
                        : item.status === "PREPARING"
                        ? "yellow"
                        : item.status === "CANCELLED"
                        ? "red"
                        : "blue";

                    return (
                      <Paper key={item.id} p="xs" radius="sm" bg="white">
                        <Stack gap={4}>
                          {/* Row 1: Item Name & Qty on left, Price on right */}
                          <Group justify="space-between" align="flex-start" wrap="nowrap">
                            <Group gap={6} align="center" style={{ flex: 1, minWidth: 0 }}>
                              <Text size="sm" fw={600} style={{ wordBreak: "break-word" }}>
                                {item.nameSnapshot || item.name}
                              </Text>
                              <Badge size="xs" color="dark" variant="filled" style={{ flexShrink: 0 }}>
                                ×{item.qty}
                              </Badge>
                            </Group>
                            <Text size="sm" fw={700} c="dark" style={{ flexShrink: 0, marginLeft: 8 }}>
                              ₹{priceTotal}
                            </Text>
                          </Group>

                          {/* Row 2: Left: Round & Payment Tags, Right: Fulfillment Status Tag */}
                          <Group justify="space-between" align="center" mt={2} wrap="nowrap">
                            <Group gap={6} align="center" wrap="wrap">
                              {item.round && item.round > 1 && (
                                <Badge size="xs" color="grape" variant="light" style={{ flexShrink: 0 }}>
                                  Round {item.round}
                                </Badge>
                              )}
                              <Badge
                                size="xs"
                                color={isPaid ? "teal" : "orange"}
                                variant="light"
                                style={{ flexShrink: 0 }}
                              >
                                {isPaid ? "Paid" : "Unpaid"}
                              </Badge>
                            </Group>

                            <Badge
                              size="xs"
                              color={statusColor}
                              variant="light"
                              style={{ flexShrink: 0 }}
                            >
                              {item.status || "ORDERED"}
                            </Badge>
                          </Group>

                          {item.note && (
                            <Text size="xs" c="dinePrimary" fs="italic" mt={1}>
                              Note: {item.note}
                            </Text>
                          )}
                        </Stack>
                      </Paper>
                    );
                  })}
                </Stack>
              </ScrollArea.Autosize>

              <Divider />

              <Group justify="space-between" align="center">
                <Text fw={700}>Total Bill</Text>
                <Text fw={800} size="lg" c="dinePrimary">
                  ₹{(totalPaise / 100).toFixed(0)}
                </Text>
              </Group>

              <Group justify="space-between" align="center">
                <Text size="sm" c="dimmed">Paid: ₹{(paidPaise / 100).toFixed(0)}</Text>
                <Badge
                  size="md"
                  color={duePaise === 0 ? "teal" : "orange"}
                  variant="light"
                >
                  {duePaise === 0 ? "All Paid" : `Due: ₹${(duePaise / 100).toFixed(0)}`}
                </Badge>
              </Group>

              <Button fullWidth variant="default" onClick={() => setShowExistingItemsModal(false)}>
                Close
              </Button>
            </Stack>
          );
        })()}
      </Modal>
    </Box>
  );
}
