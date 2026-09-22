"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Grid, Paper, Title, Text, Group, Stack, Badge, Button, ActionIcon,
  TextInput, Textarea, Loader, Center, Modal, Select, Divider, Menu,
  Drawer, Box, ScrollArea, CloseButton, SegmentedControl, Checkbox, SimpleGrid,
  UnstyledButton, Tooltip, Alert,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useQueryClient } from "@tanstack/react-query";
import {
  IconPlus, IconMinus, IconTrash, IconChevronDown,
  IconCheck, IconShoppingCart, IconCash, IconTableAlias, IconBrandWhatsapp,
  IconNote, IconEdit, IconX, IconClock, IconToolsKitchen2, IconSearch,
  IconUser, IconAlertCircle,
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
  cartKey: string;
  itemId: string;
  name: string;
  pricePaise: number;
  qty: number;
  note?: string;
  variant?: { id: string; name: string; pricePaise: number };
  addons?: { id: string; name: string; pricePaise: number }[];
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

function checkIsNonVeg(name?: string | null): boolean {
  if (!name) return false;
  return /chicken|mutton|fish|prawn|egg|lamb|meat|keema|beef|pork|seafood/i.test(name) && !/veg/i.test(name);
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
  handleUpdateQty: (cartKey: string, qty: number) => void;
  handleRemoveItem: (cartKey: string) => void;
  handleSend: () => void;
  sending: boolean;
  setSettleModal: (open: boolean) => void;
  onClose?: () => void;
  activeTableOrder?: any;
  nextRound?: number;
  currentRound?: number;
  onViewExistingItems?: () => void;
  customerActiveOrderConflict?: { orderNo: number; tableNo: string | null; orderId: string } | null;
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
  customerActiveOrderConflict,
}: CartPanelProps) {
  return (
    <Box
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        maxHeight: "100%",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      {/* Top Fixed Section */}
      <Box style={{ flexShrink: 0 }}>
        <Group justify="space-between" align="center" mb="xs">
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
        <Stack gap="xs" mb="xs">
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
            rightSection={
              customerPhone.length >= 10 ? (
                <Tooltip label="View Customer Profile" withArrow position="left">
                  <ActionIcon
                    component={Link}
                    href={`/customers/${customerPhone}`}
                    size="sm"
                    color="dinePrimary"
                    variant="light"
                  >
                    <IconUser size={14} />
                  </ActionIcon>
                </Tooltip>
              ) : null
            }
          />

          {customerActiveOrderConflict && !activeTableOrder && (
            <Alert
              color="red"
              variant="light"
              p="xs"
              icon={<IconAlertCircle size={15} />}
              title="Customer Has Active Order"
            >
              <Text size="xs">
                This customer already has an active order (<b>Token #{customerActiveOrderConflict.orderNo}</b> on{" "}
                <b>{customerActiveOrderConflict.tableNo || "Takeaway"}</b>). A new order cannot be placed until that order is settled or freed.
              </Text>
            </Alert>
          )}

          {activeTableOrder && (() => {
            const paidPaise = activeTableOrder.order.paidPaise || 0;
            const totalPaise = activeTableOrder.order.subtotalPaise || 0;
            const duePaise = Math.max(0, totalPaise - paidPaise);
            const isAllPaid = duePaise === 0 && totalPaise > 0;

            return (
              <Paper
                p="xs"
                radius="sm"
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

        <Divider mb="xs" />
      </Box>

      {/* Middle Scrollable Section - Only Cart Items Scroll */}
      <ScrollArea flex={1} type="auto" offsetScrollbars style={{ minHeight: 0 }}>
        <Stack gap="xs" pr={4}>
          {cartItems.length === 0 && (
            <Text c="dimmed" size="sm" ta="center" py="xl">Add items from menu to start an order</Text>
          )}
          {cartItems.map((item) => (
            <Paper key={item.cartKey} p="xs" radius="sm">
              <Group justify="space-between" gap="xs" wrap="nowrap" align="center">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Group gap={6} align="center" wrap="wrap">
                    <Text size="sm" fw={500} lineClamp={1}>{item.name}</Text>
                    {item.variant && (
                      <Badge size="xs" variant="light" color="blue">
                        {item.variant.name}
                      </Badge>
                    )}
                  </Group>
                  {item.addons && item.addons.length > 0 && (
                    <Text size="11px" c="dimmed" lineClamp={1}>
                      + {item.addons.map((a) => a.name).join(", ")}
                    </Text>
                  )}
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
                  <ActionIcon size={30} variant="light" onClick={() => handleUpdateQty(item.cartKey, item.qty - 1)} aria-label="Decrease quantity">
                    <IconMinus size={15} />
                  </ActionIcon>
                  <Text size="sm" fw={600} w={22} ta="center">{item.qty}</Text>
                  <ActionIcon size={30} variant="light" color="dinePrimary" onClick={() => handleUpdateQty(item.cartKey, item.qty + 1)} aria-label="Increase quantity">
                    <IconPlus size={15} />
                  </ActionIcon>
                  <ActionIcon size={30} variant="light" color="red" onClick={() => handleRemoveItem(item.cartKey)} aria-label="Remove item">
                    <IconTrash size={15} />
                  </ActionIcon>
                </Group>
                <Text size="sm" fw={600} w={52} ta="right">₹{((item.pricePaise * item.qty) / 100).toFixed(0)}</Text>
              </Group>
            </Paper>
          ))}
        </Stack>
      </ScrollArea>

      {/* Bottom Fixed Section */}
      <Box style={{ flexShrink: 0, marginTop: "auto" }}>
        <Divider my="xs" />
        <Group justify="space-between" mb="xs">
          <Text fw={700}>Total</Text>
          <Text fw={700} c="dinePrimary" size="lg">₹{(total / 100).toFixed(0)}</Text>
        </Group>

        {/* Split button: Send (primary) + small compact chevron down → Settle & Send */}
        {(() => {
          const isBlockedByConflict = Boolean(customerActiveOrderConflict) && !activeTableOrder;
          return (
            <Tooltip
              label={`Customer has active order #${customerActiveOrderConflict?.orderNo}. Settle or add items to that order.`}
              disabled={!isBlockedByConflict}
            >
              <Group gap={0} wrap="nowrap" style={{ width: "100%" }}>
                <Button
                  color={activeTableOrder ? "orange" : "dinePrimary"}
                  onClick={handleSend}
                  loading={sending}
                  style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0, flex: 1 }}
                  disabled={cartItems.length === 0 || isBlockedByConflict}
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
                      disabled={cartItems.length === 0 || sending || isBlockedByConflict}
                      aria-label="More order options"
                    >
                      <IconChevronDown size={16} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item
                      leftSection={<IconCash size={16} />}
                      onClick={() => setSettleModal(true)}
                      disabled={isBlockedByConflict}
                    >
                      {activeTableOrder ? `Settle & Send Round ${nextRound}` : "Settle & Send"}
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>
            </Tooltip>
          );
        })()}
      </Box>
    </Box>
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
  const [filterVeg, setFilterVeg] = useState(false);
  const [filterNonVeg, setFilterNonVeg] = useState(false);

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

  // Sync table or customer phone from URL if provided (e.g. from Tables page or Customer Profile)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tableParam = params.get("table");
      if (tableParam) {
        setTableNo(tableParam);
      }
      const phoneParam = params.get("phone");
      if (phoneParam) {
        setCustomerPhone(phoneParam.replace(/\D/g, "").slice(0, 15));
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
  const [noteTargetCartKey, setNoteTargetCartKey] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const openNoteModal = (item: LocalCartItem) => {
    setNoteTargetCartKey(item.cartKey);
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
    if (!noteTargetCartKey) return;
    const trimmed = noteText.trim();
    setCartItems((prev) =>
      prev.map((ci) =>
        ci.cartKey === noteTargetCartKey
          ? { ...ci, note: trimmed || undefined }
          : ci
      )
    );
    setNoteModalOpen(false);
    setNoteTargetCartKey(null);
    setNoteText("");
  };

  const handleClearItemNote = () => {
    if (!noteTargetCartKey) return;
    setCartItems((prev) =>
      prev.map((ci) =>
        ci.cartKey === noteTargetCartKey
          ? { ...ci, note: undefined }
          : ci
      )
    );
    setNoteModalOpen(false);
    setNoteTargetCartKey(null);
    setNoteText("");
  };

  const handleClearCart = () => {
    setCartItems([]);
    setTableNo("Takeaway");
    setCustomerPhone("");
    if (cartOpen) setCartOpen(false);
  };

  // Categories loaded
  useEffect(() => {
    // Keep activeCatId as null by default to show All items
  }, [categories]);

  // Item customization modal state (variants & addons)
  const [customizingItem, setCustomizingItem] = useState<any | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<any | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<any[]>([]);
  const [customQty, setCustomQty] = useState<number>(1);
  const [customNote, setCustomNote] = useState<string>("");

  const handleItemClick = (item: any) => {
    const hasVariants = Array.isArray(item.variants) && item.variants.length > 0;
    const hasAddons = Array.isArray(item.addons) && item.addons.length > 0;

    if (!hasVariants && !hasAddons) {
      handleAddItemDirect(item);
      return;
    }

    setCustomizingItem(item);
    setSelectedVariant(hasVariants ? item.variants[0] : null);
    setSelectedAddons([]);
    setCustomQty(1);
    setCustomNote("");
  };

  const handleAddItemDirect = (item: any) => {
    const cartKey = item.id;
    setCartItems((prev) => {
      const existing = prev.find((ci) => ci.cartKey === cartKey);
      if (existing) {
        return prev.map((ci) =>
          ci.cartKey === cartKey ? { ...ci, qty: ci.qty + 1 } : ci
        );
      }
      return [
        ...prev,
        {
          cartKey,
          itemId: item.id,
          name: item.name,
          pricePaise: item.pricePaise,
          qty: 1,
        },
      ];
    });
  };

  const handleAddCustomizedToCart = () => {
    if (!customizingItem) return;

    const sortedAddonIds = selectedAddons.map((a) => a.id).sort().join(",");
    const cartKey = `${customizingItem.id}__${selectedVariant?.id || "none"}__${sortedAddonIds}`;

    const unitPricePaise =
      (selectedVariant ? selectedVariant.pricePaise : customizingItem.pricePaise) +
      selectedAddons.reduce((sum, a) => sum + (a.pricePaise || 0), 0);

    const cartItem: LocalCartItem = {
      cartKey,
      itemId: customizingItem.id,
      name: customizingItem.name,
      pricePaise: unitPricePaise,
      qty: customQty,
      note: customNote.trim() || undefined,
      variant: selectedVariant
        ? { id: selectedVariant.id, name: selectedVariant.name, pricePaise: selectedVariant.pricePaise }
        : undefined,
      addons: selectedAddons.map((a) => ({ id: a.id, name: a.name, pricePaise: a.pricePaise })),
    };

    setCartItems((prev) => {
      const existingIndex = prev.findIndex((ci) => ci.cartKey === cartKey);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          qty: next[existingIndex].qty + customQty,
          note: customNote.trim() || next[existingIndex].note,
        };
        return next;
      }
      return [...prev, cartItem];
    });

    setCustomizingItem(null);
  };

  const handleUpdateQty = (cartKey: string, qty: number) => {
    if (qty < 1) {
      handleRemoveItem(cartKey);
      return;
    }
    setCartItems((prev) =>
      prev.map((ci) => (ci.cartKey === cartKey ? { ...ci, qty } : ci))
    );
  };

  const handleRemoveItem = (cartKey: string) => {
    setCartItems((prev) => prev.filter((ci) => ci.cartKey !== cartKey));
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
            items: cartItems.map((i) => ({
              itemId: i.itemId,
              qty: i.qty,
              note: i.note,
              variantId: i.variant?.id,
              addonIds: i.addons?.map((a) => a.id),
            })),
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
        if (customerActiveOrderConflict) {
          notifications.show({
            title: "Customer Has Active Order",
            message: `Customer already has active Token #${customerActiveOrderConflict.orderNo} on ${customerActiveOrderConflict.tableNo || "Takeaway"}. Cannot place a new order until that order is settled or freed.`,
            color: "red",
          });
          setSending(false);
          return;
        }
        const created = await startOrder(restaurantId, {
          outletId: activeOutlet.id,
          tableNo: tableNo || "Takeaway",
          customerPhone: customerPhone.trim() || undefined,
          items: cartItems.map((i) => ({
            itemId: i.itemId,
            qty: i.qty,
            note: i.note,
            variantId: i.variant?.id,
            addonIds: i.addons?.map((a) => a.id),
          })),
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
            items: cartItems.map((i) => ({
              itemId: i.itemId,
              qty: i.qty,
              note: i.note,
              variantId: i.variant?.id,
              addonIds: i.addons?.map((a) => a.id),
            })),
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
        if (customerActiveOrderConflict) {
          notifications.show({
            title: "Customer Has Active Order",
            message: `Customer already has active Token #${customerActiveOrderConflict.orderNo} on ${customerActiveOrderConflict.tableNo || "Takeaway"}. Cannot place a new order until that order is settled or freed.`,
            color: "red",
          });
          setSettling(false);
          return;
        }
        const result = await createSettledOrder(restaurantId, {
          outletId: activeOutlet.id,
          tableNo: tableNo || "Takeaway",
          customerPhone: customerPhone.trim() || undefined,
          method: settleMethod,
          items: cartItems.map((i) => ({
            itemId: i.itemId,
            qty: i.qty,
            note: i.note,
            variantId: i.variant?.id,
            addonIds: i.addons?.map((a) => a.id),
          })),
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
    .filter((i: any) => !hasSearch || i.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    .filter((i: any) => {
      if (filterVeg && !filterNonVeg) return !checkIsNonVeg(i.name);
      if (filterNonVeg && !filterVeg) return checkIsNonVeg(i.name);
      return true;
    });

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

  const customerActiveOrderConflict = useMemo(() => {
    const raw = customerPhone.replace(/\D/g, "");
    if (raw.length < 7) return null;
    const last10 = raw.slice(-10);
    const found = openOrders.find((o: any) => {
      const p = (o.order?.customerPhone || "").replace(/\D/g, "");
      return p && (p === raw || p.endsWith(last10) || raw.endsWith(p.slice(-10)));
    });
    if (!found) return null;
    return {
      orderNo: found.order.orderNo,
      tableNo: found.order.tableNo,
      orderId: found.order.id,
    };
  }, [customerPhone, openOrders]);

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
    customerActiveOrderConflict,
  };

  return (
    <Box
      style={{
        height: "calc(100dvh - var(--app-shell-header-offset, 60px))",
        maxHeight: "calc(100dvh - var(--app-shell-header-offset, 60px))",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
      px={{ base: "xs", sm: "md" }}
      pt="xs"
      pb="xs"
    >
      <Grid
        gap="md"
        styles={{
          inner: {
            height: "100%",
            maxHeight: "100%",
            minHeight: 0,
          },
        }}
        style={{
          flex: 1,
          height: "100%",
          maxHeight: "100%",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {/* Menu Panel */}
        <Grid.Col
          span={{ base: 12, sm: 8 }}
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            maxHeight: "100%",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <Stack
            gap="sm"
            style={{
              height: "100%",
              maxHeight: "100%",
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            {/* Search Bar & Veg/Non-Veg Filter Checkboxes */}
            <Group gap="md" align="center" wrap="nowrap" style={{ width: "100%" }}>
              <TextInput
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                size="sm"
                style={{ flex: 1 }}
                leftSection={<IconSearch size={16} stroke={1.5} />}
                rightSection={
                  searchQuery ? (
                    <CloseButton
                      size="sm"
                      onClick={() => setSearchQuery("")}
                      aria-label="Clear search"
                    />
                  ) : null
                }
              />

              {/* Veg / Non-Veg Checkboxes Filter */}
              <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
                {/* Veg Filter Checkbox */}
                <UnstyledButton
                  role="checkbox"
                  aria-checked={filterVeg}
                  onClick={() => setFilterVeg((prev) => !prev)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: `1.5px solid ${filterVeg ? "#2e7d32" : "#ced4da"}`,
                    backgroundColor: filterVeg ? "#e8f5e9" : "#ffffff",
                    cursor: "pointer",
                    userSelect: "none",
                    transition: "all 120ms ease",
                  }}
                >
                  {/* Single Checkbox with Veg Icon inside */}
                  <Box
                    style={{
                      width: 17,
                      height: 17,
                      borderRadius: 3.5,
                      border: "1.5px solid #2e7d32",
                      backgroundColor: filterVeg ? "#2e7d32" : "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      transition: "all 120ms ease",
                    }}
                  >
                    {filterVeg ? (
                      <IconCheck size={12} stroke={3.5} color="#ffffff" />
                    ) : (
                      <Box
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          backgroundColor: "#2e7d32",
                        }}
                      />
                    )}
                  </Box>
                  <Text size="xs" fw={filterVeg ? 700 : 500} c={filterVeg ? "green.9" : "dark.4"}>
                    Veg
                  </Text>
                </UnstyledButton>

                {/* Non-Veg Filter Checkbox */}
                <UnstyledButton
                  role="checkbox"
                  aria-checked={filterNonVeg}
                  onClick={() => setFilterNonVeg((prev) => !prev)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: `1.5px solid ${filterNonVeg ? "#c62828" : "#ced4da"}`,
                    backgroundColor: filterNonVeg ? "#ffebee" : "#ffffff",
                    cursor: "pointer",
                    userSelect: "none",
                    transition: "all 120ms ease",
                  }}
                >
                  {/* Single Checkbox with Non-Veg Icon inside */}
                  <Box
                    style={{
                      width: 17,
                      height: 17,
                      borderRadius: 3.5,
                      border: "1.5px solid #c62828",
                      backgroundColor: filterNonVeg ? "#c62828" : "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      transition: "all 120ms ease",
                    }}
                  >
                    {filterNonVeg ? (
                      <IconCheck size={12} stroke={3.5} color="#ffffff" />
                    ) : (
                      <Box
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          backgroundColor: "#c62828",
                        }}
                      />
                    )}
                  </Box>
                  <Text size="xs" fw={filterNonVeg ? 700 : 500} c={filterNonVeg ? "red.9" : "dark.4"}>
                    Non-Veg
                  </Text>
                </UnstyledButton>
              </Group>
            </Group>

            {/* Category Tabs */}
            <ScrollArea type="always" scrollbarSize={4} offsetScrollbars="x" scrollbars="x">
              <Group gap="xs" wrap="nowrap" pb="xs" style={{ minWidth: "max-content" }}>
                <Button
                  size="xs"
                  variant={activeCatId === null ? "filled" : "light"}
                  color="dinePrimary"
                  onClick={() => setActiveCatId(null)}
                  style={{ flexShrink: 0, whiteSpace: "nowrap" }}
                >
                  All ({items.filter((i: any) => i.available).length})
                </Button>
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

            {/* Item Grid - scrollable with uniform card dimensions */}
            <ScrollArea flex={1} type="auto" style={{ minHeight: 0 }} pb={{ base: 100, md: "xs" }}>
              <SimpleGrid cols={{ base: 2, xs: 3, sm: 2, md: 3, lg: 4 }} spacing="sm" verticalSpacing="sm">
                {filteredItems.map((item: any) => {
                  const inCartQty = cartItems
                    .filter((ci) => ci.itemId === item.id)
                    .reduce((sum, ci) => sum + ci.qty, 0);
                  const hasVariants = Array.isArray(item.variants) && item.variants.length > 0;
                  const hasAddons = Array.isArray(item.addons) && item.addons.length > 0;
                  const displayPrice = hasVariants
                    ? `From ₹${(Math.min(...item.variants.map((v: any) => v.pricePaise)) / 100).toFixed(0)}`
                    : `₹${(item.pricePaise / 100).toFixed(0)}`;
                  const isNonVeg = checkIsNonVeg(item.name);

                  return (
                    <Paper
                      key={item.id}
                      p={0}
                      radius="md"
                      onClick={() => handleItemClick(item)}
                      style={{
                        height: 155,
                        display: "flex",
                        flexDirection: "column",
                        borderRadius: 10,
                        position: "relative",
                        overflow: "hidden",
                        backgroundColor: inCartQty > 0 ? "rgba(175, 115, 215, 0.04)" : "#ffffff",
                        border: inCartQty > 0 ? "2px solid #af73d7" : "1px solid rgba(0, 0, 0, 0.09)",
                        boxShadow: inCartQty > 0
                          ? "0 4px 14px rgba(175, 115, 215, 0.22)"
                          : "0 2px 6px rgba(0, 0, 0, 0.04)",
                        cursor: "pointer",
                        userSelect: "none",
                        transition: "transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = "0 6px 18px rgba(0, 0, 0, 0.09)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = inCartQty > 0
                          ? "0 4px 14px rgba(175, 115, 215, 0.22)"
                          : "0 2px 6px rgba(0, 0, 0, 0.04)";
                      }}
                      onMouseDown={(e) => {
                        e.currentTarget.style.transform = "scale(0.98)";
                      }}
                      onMouseUp={(e) => {
                        e.currentTarget.style.transform = "translateY(-2px)";
                      }}
                    >
                      {/* Top Thumbnail Section */}
                      <Box
                        style={{
                          height: 85,
                          width: "100%",
                          position: "relative",
                          backgroundColor: "#e9ecef",
                          overflow: "hidden",
                          flexShrink: 0,
                        }}
                      >
                        {/* Grey Background Placeholder with Item Name */}
                        <Box
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: "#e9ecef",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "8px 10px",
                            zIndex: 1,
                            userSelect: "none",
                          }}
                        >
                          <Text
                            size="xs"
                            fw={700}
                            ta="center"
                            style={{
                              lineHeight: 1.2,
                              color: "#495057",
                              fontSize: 11,
                              display: "-webkit-box",
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                              wordBreak: "break-word",
                            }}
                          >
                            {item.name}
                          </Text>
                        </Box>

                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            loading="lazy"
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              display: "block",
                              zIndex: 2,
                            }}
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : null}

                        {/* In-Cart Quantity Counter */}
                        {inCartQty > 0 && (
                          <Badge
                            size="sm"
                            variant="filled"
                            color="dinePrimary"
                            style={{
                              position: "absolute",
                              top: 5,
                              right: 5,
                              zIndex: 3,
                              fontWeight: 700,
                              fontSize: 10,
                              height: 18,
                              padding: "0 5px",
                              boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
                            }}
                          >
                            ×{inCartQty}
                          </Badge>
                        )}
                      </Box>

                      {/* Bottom Info Section */}
                      <Box
                        style={{
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          padding: "6px 8px 6px 8px",
                        }}
                      >
                        {/* Veg/Non-Veg Icon directly before Item Name */}
                        <Group gap={5} align="flex-start" wrap="nowrap" style={{ minWidth: 0 }}>
                          <Box
                            style={{
                              width: 13,
                              height: 13,
                              minWidth: 13,
                              borderRadius: 3,
                              border: `1.5px solid ${isNonVeg ? "#c62828" : "#2e7d32"}`,
                              backgroundColor: "#ffffff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              marginTop: 2,
                              flexShrink: 0,
                            }}
                            title={isNonVeg ? "Non-Vegetarian" : "Vegetarian"}
                          >
                            <Box
                              style={{
                                width: 5.5,
                                height: 5.5,
                                borderRadius: "50%",
                                backgroundColor: isNonVeg ? "#c62828" : "#2e7d32",
                              }}
                            />
                          </Box>

                          <Text
                            size="xs"
                            fw={600}
                            style={{
                              lineHeight: 1.25,
                              overflow: "hidden",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              color: "#212529",
                              fontSize: 12.5,
                              minWidth: 0,
                              flex: 1,
                            }}
                            title={item.name}
                          >
                            {item.name}
                          </Text>
                        </Group>

                        <Group justify="space-between" align="center" wrap="nowrap" mt="auto">
                          <Text
                            size="xs"
                            fw={700}
                            c="dinePrimary"
                            style={{ letterSpacing: "-0.2px", whiteSpace: "nowrap", fontSize: 13 }}
                          >
                            {displayPrice}
                          </Text>

                          {hasVariants ? (
                            <Badge
                              size="xs"
                              variant="light"
                              color="blue"
                              radius="sm"
                              style={{ fontWeight: 600, fontSize: 10, flexShrink: 0 }}
                            >
                              Options
                            </Badge>
                          ) : hasAddons ? (
                            <Badge
                              size="xs"
                              variant="light"
                              color="grape"
                              radius="sm"
                              style={{ fontWeight: 600, fontSize: 10, flexShrink: 0 }}
                            >
                              +Addons
                            </Badge>
                          ) : (
                            <Box
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: 9999,
                                background: inCartQty > 0 ? "#af73d7" : "rgba(175, 115, 215, 0.12)",
                                color: inCartQty > 0 ? "#ffffff" : "#af73d7",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                transition: "all 0.12s ease",
                              }}
                            >
                              <IconPlus size={13} stroke={2.5} />
                            </Box>
                          )}
                        </Group>
                      </Box>
                    </Paper>
                  );
                })}
              </SimpleGrid>
              {!filteredItems.length && (
                <Text c="dimmed" size="sm" ta="center" py="xl">No items found</Text>
              )}
            </ScrollArea>
          </Stack>
        </Grid.Col>

        {/* Desktop Cart Panel */}
        <Grid.Col
          span={{ base: 0, sm: 4 }}
          visibleFrom="sm"
          style={{
            height: "100%",
            maxHeight: "100%",
            minHeight: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Paper
            p="md"
            radius="md"
            withBorder
            style={{
              height: "100%",
              maxHeight: "100%",
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              position: "relative",
              overflow: "hidden",
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
        size="85%"
        zIndex={1200}
        hiddenFrom="sm"
        withCloseButton={false}
        styles={{
          body: {
            height: "100%",
            maxHeight: "100%",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
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

      {/* Item Customization Modal (Variants & Addons) */}
      <Modal
        opened={!!customizingItem}
        onClose={() => setCustomizingItem(null)}
        title={
          <div>
            <Text fw={700} size="md">{customizingItem?.name}</Text>
            {customizingItem?.description && (
              <Text size="xs" c="dimmed">{customizingItem.description}</Text>
            )}
          </div>
        }
        size="sm"
        zIndex={1350}
      >
        {customizingItem && (() => {
          const hasVariants = Array.isArray(customizingItem.variants) && customizingItem.variants.length > 0;
          const hasAddons = Array.isArray(customizingItem.addons) && customizingItem.addons.length > 0;

          const unitPaise =
            (selectedVariant ? selectedVariant.pricePaise : customizingItem.pricePaise) +
            selectedAddons.reduce((sum, a) => sum + (a.pricePaise || 0), 0);
          const totalModalPaise = unitPaise * customQty;

          return (
            <Stack gap="sm">
              {hasVariants && (
                <div>
                  <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={6}>
                    Select Option / Size
                  </Text>
                  <SimpleGrid cols={customizingItem.variants.length > 2 ? 3 : 2} spacing="xs">
                    {customizingItem.variants.map((v: any) => {
                      const isSelected = selectedVariant?.id === v.id;
                      return (
                        <Paper
                          key={v.id}
                          p="xs"
                          radius="sm"
                          onClick={() => setSelectedVariant(v)}
                          style={{
                            cursor: "pointer",
                            border: isSelected
                              ? "2px solid var(--mantine-color-dinePrimary-6)"
                              : "1px solid var(--mantine-color-gray-3)",
                            backgroundColor: isSelected ? "var(--mantine-color-dinePrimary-0)" : undefined,
                            textAlign: "center",
                          }}
                        >
                          <Text size="sm" fw={isSelected ? 700 : 500} c={isSelected ? "dinePrimary" : undefined}>
                            {v.name}
                          </Text>
                          <Text size="xs" fw={600} c="dimmed">
                            ₹{(v.pricePaise / 100).toFixed(0)}
                          </Text>
                        </Paper>
                      );
                    })}
                  </SimpleGrid>
                </div>
              )}

              {hasAddons && (
                <div>
                  <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={6}>
                    Addons & Extras
                  </Text>
                  <Stack gap="xs">
                    {customizingItem.addons.map((addon: any) => {
                      const isChecked = selectedAddons.some((a) => a.id === addon.id);
                      return (
                        <Paper
                          key={addon.id}
                          p="xs"
                          radius="sm"
                          onClick={() => {
                            setSelectedAddons((prev) =>
                              isChecked ? prev.filter((a) => a.id !== addon.id) : [...prev, addon]
                            );
                          }}
                          style={{
                            cursor: "pointer",
                            border: isChecked
                              ? "1px solid var(--mantine-color-dinePrimary-6)"
                              : "1px solid var(--mantine-color-gray-3)",
                            backgroundColor: isChecked ? "var(--mantine-color-dinePrimary-0)" : undefined,
                          }}
                        >
                          <Group justify="space-between" align="center">
                            <Group gap="xs">
                              <Checkbox
                                checked={isChecked}
                                onChange={() => {}}
                                color="dinePrimary"
                                size="xs"
                              />
                              <Text size="sm" fw={isChecked ? 600 : 400}>
                                {addon.name}
                              </Text>
                            </Group>
                            <Text size="xs" fw={600} c="dimmed">
                              {addon.pricePaise > 0 ? `+₹${(addon.pricePaise / 100).toFixed(0)}` : "Free"}
                            </Text>
                          </Group>
                        </Paper>
                      );
                    })}
                  </Stack>
                </div>
              )}

              <div>
                <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={4}>
                  Special Note (Optional)
                </Text>
                <TextInput
                  placeholder="e.g. Less Spicy, Extra Crispy"
                  size="xs"
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                />
              </div>

              <Divider my={4} />

              <Group justify="space-between" align="center">
                <Group gap={6} align="center">
                  <ActionIcon
                    size={32}
                    variant="light"
                    onClick={() => setCustomQty(Math.max(1, customQty - 1))}
                    disabled={customQty <= 1}
                  >
                    <IconMinus size={16} />
                  </ActionIcon>
                  <Text size="sm" fw={700} w={28} ta="center">
                    {customQty}
                  </Text>
                  <ActionIcon
                    size={32}
                    variant="light"
                    color="dinePrimary"
                    onClick={() => setCustomQty(customQty + 1)}
                  >
                    <IconPlus size={16} />
                  </ActionIcon>
                </Group>
                <Button
                  color="dinePrimary"
                  onClick={handleAddCustomizedToCart}
                  leftSection={<IconPlus size={16} />}
                >
                  Add · ₹{(totalModalPaise / 100).toFixed(0)}
                </Button>
              </Group>
            </Stack>
          );
        })()}
      </Modal>

      {/* Item Note Modal */}
      <Modal
        opened={noteModalOpen}
        onClose={() => {
          setNoteModalOpen(false);
          setNoteTargetCartKey(null);
        }}
        title={
          <Group gap="xs">
            <IconNote size={18} color="#af73d7" />
            <Text fw={600}>
              Note for {cartItems.find((ci) => ci.cartKey === noteTargetCartKey)?.name || "Item"}
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
            {noteTargetCartKey && cartItems.find((ci) => ci.cartKey === noteTargetCartKey)?.note ? (
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
                      <Paper key={item.id} p="xs" radius="sm">
                        <Stack gap={4}>
                          {/* Row 1: Item Name & Qty on left, Price on right */}
                          <Group justify="space-between" align="flex-start" wrap="nowrap">
                            <Group gap={6} align="center" style={{ flex: 1, minWidth: 0 }} wrap="wrap">
                              <Text size="sm" fw={600} style={{ wordBreak: "break-word" }}>
                                {item.nameSnapshot || item.name}
                              </Text>
                              {item.variant && (
                                <Badge size="xs" variant="light" color="blue">
                                  {item.variant.name}
                                </Badge>
                              )}
                              <Badge size="xs" color="dark" variant="filled" style={{ flexShrink: 0 }}>
                                ×{item.qty}
                              </Badge>
                            </Group>
                            <Text size="sm" fw={700} c="dark" style={{ flexShrink: 0, marginLeft: 8 }}>
                              ₹{priceTotal}
                            </Text>
                          </Group>
                          {Array.isArray(item.addons) && item.addons.length > 0 && (
                            <Text size="11px" c="dimmed">
                              + {item.addons.map((a: any) => a.name).join(", ")}
                            </Text>
                          )}

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
