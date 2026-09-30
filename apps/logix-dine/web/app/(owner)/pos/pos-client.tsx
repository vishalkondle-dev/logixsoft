"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  Grid, Paper, Title, Text, Group, Stack, Badge, Button, ActionIcon,
  TextInput, Textarea, Loader, Center, Modal, Select, Divider, Menu,
  Drawer, Box, ScrollArea, CloseButton, SegmentedControl, Checkbox, SimpleGrid,
  UnstyledButton, Tooltip, Alert, ThemeIcon, Collapse,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useQueryClient } from "@tanstack/react-query";
import {
  IconPlus, IconMinus, IconTrash, IconChevronDown, IconChevronUp,
  IconCheck, IconShoppingCart, IconCash, IconTableAlias, IconBrandWhatsapp,
  IconNote, IconEdit, IconX, IconClock, IconToolsKitchen2, IconSearch,
  IconUser, IconAlertCircle, IconMotorbike, IconMapPin, IconKey, IconPhoneCall,
  IconTruckDelivery, IconShoppingBag, IconQrcode, IconUsers, IconNotes, IconCircleFilled,
  IconReceiptTax, IconDiscount2, IconPercentage,
} from "@tabler/icons-react";
import { useRestaurant } from "@/lib/restaurant-context";
import {
  useCategories, useItems, useTables, useOrders, qk,
  useDeliveryRiders, useCustomerAddresses,
} from "@/lib/queries";
import {
  startOrder, settleOrder, markKotPrinted, createSettledOrder, addOrderRound,
  createDeliveryRider, updateDeliveryStatus,
} from "@/lib/api-client";
import { buildKotPayload, buildBillPayload } from "@/lib/ticket";
import { printTicket, printTicketSilent } from "@/lib/print";
import { UpiQrCode } from "@/components/common/upi-qr-code";
import { useOutletSync } from "@/lib/use-outlet-sync";
import { getOrderChannel } from "@/lib/channel-helpers";
import { usePosStore } from "@/lib/stores";

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

export interface OrderAdjustment {
  id: string;
  label: string;
  value: string; // e.g. "5%" or "50" or "-10%"
  type: "charge" | "discount";
  amountPaise: number;
}

export function computeAdjustmentAmount(
  valueStr: string,
  isDiscount: boolean,
  itemsSubtotalPaise: number
): { amountPaise: number; isPercent: boolean; num: number } {
  const clean = (valueStr || "").trim();
  const isPercent = clean.includes("%");
  const num = parseFloat(clean.replace(/[%]/g, "").trim()) || 0;

  let paise = isPercent
    ? Math.round((itemsSubtotalPaise * Math.abs(num)) / 100)
    : Math.round(Math.abs(num) * 100);

  if (isDiscount || num < 0 || clean.startsWith("-")) {
    paise = -paise;
  }
  return { amountPaise: paise, isPercent, num };
}

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
  itemsSubtotal: number;
  grandTotal: number;
  tableNo: string;
  setTableNo: (table: string) => void;
  orderType: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  setOrderType: (type: "DINE_IN" | "TAKEAWAY" | "DELIVERY") => void;
  customerPhone: string;
  setCustomerPhone: (phone: string) => void;
  deliveryCustomerName: string;
  setDeliveryCustomerName: (name: string) => void;
  deliveryAddressLine1: string;
  setDeliveryAddressLine1: (addr: string) => void;
  deliveryLandmark: string;
  setDeliveryLandmark: (landmark: string) => void;
  deliveryPincode: string;
  setDeliveryPincode: (pin: string) => void;
  deliveryNotes: string;
  setDeliveryNotes: (notes: string) => void;
  selectedRiderId: string | null;
  setSelectedRiderId: (id: string | null) => void;
  packagingCharge: number;
  setPackagingCharge: (charge: number) => void;
  deliveryCharge: number;
  setDeliveryCharge: (charge: number) => void;
  savedAddresses?: any[];
  riders?: any[];
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
  availableOrderModes?: { label: React.ReactNode; value: "DINE_IN" | "TAKEAWAY" | "DELIVERY" }[];
  isFreeDelivery?: boolean;
  minDeliveryOrder?: number;
  isMinDeliveryBlocked?: boolean;
  adjustments?: OrderAdjustment[];
  onOpenAdjustmentModal?: (adj?: OrderAdjustment) => void;
  onRemoveAdjustment?: (id: string) => void;
  deliveryExpanded?: boolean;
  setDeliveryExpanded?: React.Dispatch<React.SetStateAction<boolean>>;
}

function CartPanel({
  cartItems,
  cartCount,
  itemsSubtotal,
  grandTotal,
  tableNo,
  setTableNo,
  orderType,
  setOrderType,
  customerPhone,
  setCustomerPhone,
  deliveryCustomerName,
  setDeliveryCustomerName,
  deliveryAddressLine1,
  setDeliveryAddressLine1,
  deliveryLandmark,
  setDeliveryLandmark,
  deliveryPincode,
  setDeliveryPincode,
  deliveryNotes,
  setDeliveryNotes,
  selectedRiderId,
  setSelectedRiderId,
  packagingCharge,
  deliveryCharge,
  savedAddresses,
  riders,
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
  availableOrderModes,
  isFreeDelivery,
  minDeliveryOrder,
  isMinDeliveryBlocked,
  adjustments = [],
  onOpenAdjustmentModal,
  onRemoveAdjustment,
  deliveryExpanded,
  setDeliveryExpanded,
}: CartPanelProps) {
  const { can } = useRestaurant();
  const canOrderCreate = can("pos:order_create");
  const canSettle = can("pos:bill_settle");
  const canDiscount = can("pos:discount_apply");

  const [localDeliveryExpanded, setLocalDeliveryExpanded] = useState(false);
  const isDeliveryExpanded = deliveryExpanded !== undefined ? deliveryExpanded : localDeliveryExpanded;
  const toggleDeliveryExpanded = () => {
    if (setDeliveryExpanded) {
      setDeliveryExpanded((prev) => !prev);
    } else {
      setLocalDeliveryExpanded((prev) => !prev);
    }
  };
  const closeDeliveryExpanded = () => {
    if (setDeliveryExpanded) {
      setDeliveryExpanded(false);
    } else {
      setLocalDeliveryExpanded(false);
    }
  };

  const currentModes = (availableOrderModes && availableOrderModes.length > 0)
    ? availableOrderModes
    : [{ label: <Group gap={4} justify="center" wrap="nowrap"><IconShoppingBag size={14} /><span>Takeaway</span></Group>, value: "TAKEAWAY" as const }];
  const effectiveOrderType = currentModes.some((m) => m.value === orderType)
    ? orderType
    : currentModes[0].value;

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
            {(cartItems.length > 0 || customerPhone.length > 0 || tableNo !== "Takeaway" || effectiveOrderType !== "TAKEAWAY") && (
              <Button variant="subtle" color="red" size="compact-xs" onClick={handleClearCart}>
                Clear
              </Button>
            )}
            {onClose && (
              <CloseButton onClick={onClose} size="sm" aria-label="Close cart" />
            )}
          </Group>
        </Group>

        {/* Order Mode Segmented Control (Dynamically configured by outlet dining options) */}
        <SegmentedControl
          value={effectiveOrderType}
          onChange={(val) => {
            const nextType = val as "DINE_IN" | "TAKEAWAY" | "DELIVERY";
            setOrderType(nextType);
            if (nextType === "TAKEAWAY") setTableNo("Takeaway");
            else if (nextType === "DELIVERY") setTableNo("Delivery");
            else if (tableNo === "Takeaway" || tableNo === "Delivery" || !tableNo) {
              const firstTable = tableSelectData[0]?.value;
              setTableNo(firstTable || "");
            }
          }}
          data={currentModes}
          fullWidth
          size="xs"
          mb="xs"
          radius="md"
        />

        {/* Cart Selection: Table select (if Dine-In) + Customer Phone + Delivery fields */}
        <Stack gap="xs" mb="xs">
          {effectiveOrderType === "DINE_IN" && (
            <Select
              label="Table"
              placeholder={tableSelectData.length === 0 ? "No tables configured" : "Select table"}
              size="sm"
              value={tableNo && tableNo !== "Takeaway" && tableNo !== "Delivery" ? tableNo : null}
              onChange={(v) => setTableNo(v || "")}
              data={tableSelectData}
              leftSection={<IconTableAlias size={16} />}
              allowDeselect={false}
              comboboxProps={{ withinPortal: true, zIndex: 1500 }}
              nothingFoundMessage="No tables found"
            />
          )}

          <TextInput
            label={effectiveOrderType === "DELIVERY" ? "Customer Phone (Required)" : "Customer Phone (optional)"}
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

          {effectiveOrderType === "DELIVERY" && (
            <Paper p="xs" radius="sm" withBorder style={{ backgroundColor: "#fbfcfe" }}>
              <Group
                justify="space-between"
                align="center"
                style={{ cursor: "pointer", userSelect: "none" }}
                onClick={toggleDeliveryExpanded}
              >
                <Group gap={6} align="center" style={{ minWidth: 0, flex: 1 }}>
                  <ThemeIcon size={20} radius="sm" color="teal" variant="light">
                    <IconMotorbike size={12} />
                  </ThemeIcon>
                  <Box style={{ minWidth: 0, flex: 1 }}>
                    <Group gap={6} align="center" wrap="nowrap">
                      <Text size="xs" fw={700} c="teal.9">
                        DELIVERY ADDRESS
                      </Text>
                      {deliveryAddressLine1.trim() ? (
                        <Badge size="xs" color="teal" variant="light">
                          Address Set
                        </Badge>
                      ) : (
                        <Badge size="xs" color="orange" variant="light">
                          Required
                        </Badge>
                      )}
                    </Group>
                    {!isDeliveryExpanded && (
                      <Text size="xs" c={deliveryAddressLine1.trim() ? "dark" : "dimmed"} lineClamp={1} mt={1}>
                        {deliveryCustomerName ? <b>{deliveryCustomerName}: </b> : null}
                        {deliveryAddressLine1.trim()
                          ? `${deliveryAddressLine1}${deliveryLandmark ? ` (${deliveryLandmark})` : ""}${selectedRiderId ? ` · Rider assigned` : ""}`
                          : "Click to enter delivery address"}
                      </Text>
                    )}
                  </Box>
                </Group>

                <Group gap={6} align="center" wrap="nowrap">
                  {savedAddresses && savedAddresses.length > 0 && !isDeliveryExpanded && (
                    <Badge size="xs" color="teal" variant="outline">
                      {savedAddresses.length} saved
                    </Badge>
                  )}
                  <Button
                    variant="subtle"
                    color="gray"
                    size="compact-xs"
                    px={6}
                    h={22}
                    style={{ fontSize: 11 }}
                    rightSection={isDeliveryExpanded ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleDeliveryExpanded();
                    }}
                    aria-label={isDeliveryExpanded ? "Collapse delivery address" : "Expand delivery address"}
                  >
                    {isDeliveryExpanded ? "Collapse" : "Expand"}
                  </Button>
                </Group>
              </Group>

              <Collapse expanded={isDeliveryExpanded}>
                <Divider my={8} variant="dashed" />
                {savedAddresses && savedAddresses.length > 0 && (
                  <Box mb="xs">
                    <Group justify="space-between" align="center" mb={4}>
                      <Text size="xs" c="dimmed" fw={600}>Saved Addresses:</Text>
                      <Badge size="xs" color="teal" variant="light">
                        {savedAddresses.length} saved
                      </Badge>
                    </Group>
                    <Group gap={4} wrap="wrap">
                      {savedAddresses.map((addr: any) => (
                        <Badge
                          key={addr.id}
                          size="xs"
                          variant="outline"
                          color="teal"
                          leftSection={<IconMapPin size={10} />}
                          style={{ cursor: "pointer" }}
                          onClick={() => {
                            if (addr.receiverName) setDeliveryCustomerName(addr.receiverName);
                            setDeliveryAddressLine1(addr.addressLine1);
                            if (addr.landmark) setDeliveryLandmark(addr.landmark);
                            if (addr.pincode) setDeliveryPincode(addr.pincode);
                          }}
                        >
                          {addr.label || "Home"}: {addr.addressLine1.slice(0, 16)}...
                        </Badge>
                      ))}
                    </Group>
                  </Box>
                )}

                <Stack gap={6}>
                  <TextInput
                    placeholder="Recipient Name *"
                    size="xs"
                    value={deliveryCustomerName}
                    onChange={(e) => setDeliveryCustomerName(e.target.value)}
                  />
                  <TextInput
                    placeholder="House/Flat/Street Address *"
                    size="xs"
                    value={deliveryAddressLine1}
                    onChange={(e) => setDeliveryAddressLine1(e.target.value)}
                    leftSection={<IconMapPin size={13} />}
                  />
                  <Group grow gap={6}>
                    <TextInput
                      placeholder="Landmark (opt)"
                      size="xs"
                      value={deliveryLandmark}
                      onChange={(e) => setDeliveryLandmark(e.target.value)}
                    />
                    <TextInput
                      placeholder="Pincode (opt)"
                      size="xs"
                      value={deliveryPincode}
                      onChange={(e) => setDeliveryPincode(e.target.value)}
                    />
                  </Group>
                  <TextInput
                    placeholder="Delivery Notes (e.g. Leave at door)"
                    size="xs"
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                  />
                  {riders && riders.length > 0 && (
                    <Select
                      placeholder="Assign Rider (optional)"
                      size="xs"
                      data={riders.map((r: any) => ({
                        value: r.id,
                        label: `${r.name} (${r.status === "AVAILABLE" ? "Available" : "Busy"} · ${r.vehicleType || "Bike"})`,
                      }))}
                      value={selectedRiderId}
                      onChange={setSelectedRiderId}
                      clearable
                      leftSection={<IconMotorbike size={13} />}
                    />
                  )}
                  <Group justify="flex-end" mt={2}>
                    <Button
                      variant="light"
                      color="teal"
                      size="compact-xs"
                      onClick={closeDeliveryExpanded}
                      rightSection={<IconChevronUp size={12} />}
                    >
                      Done · Collapse Address
                    </Button>
                  </Group>
                </Stack>
              </Collapse>
            </Paper>
          )}

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
        {cartItems.length > 0 && (
          <Stack gap={3} mb="xs">
            {/* Items Subtotal */}
            <Group justify="space-between">
              <Text size="xs" c="dimmed">Items Subtotal</Text>
              <Text size="xs" fw={500}>₹{(itemsSubtotal / 100).toFixed(0)}</Text>
            </Group>

            {effectiveOrderType === "DELIVERY" && (
              <>
                {packagingCharge > 0 && (
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">Packaging Fee</Text>
                    <Text size="xs" fw={500}>₹{packagingCharge}</Text>
                  </Group>
                )}
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">Delivery Fee</Text>
                  {isFreeDelivery ? (
                    <Group gap={4}>
                      <Text size="xs" td="line-through" c="dimmed">₹{deliveryCharge}</Text>
                      <Badge size="xs" color="teal" variant="light">FREE</Badge>
                    </Group>
                  ) : (
                    <Text size="xs" fw={500}>₹{deliveryCharge}</Text>
                  )}
                </Group>
                {isMinDeliveryBlocked && minDeliveryOrder != null && (
                  <Alert color="orange" p="xs" py={4} radius="sm" icon={<IconAlertCircle size={14} />}>
                    <Text size="xs">Min delivery order ₹{minDeliveryOrder} (add ₹{Math.max(0, minDeliveryOrder - Math.round(itemsSubtotal / 100))} more)</Text>
                  </Alert>
                )}
              </>
            )}

            {effectiveOrderType === "TAKEAWAY" && packagingCharge > 0 && (
              <Group justify="space-between">
                <Text size="xs" c="dimmed">Packaging Fee</Text>
                <Text size="xs" fw={500}>₹{packagingCharge}</Text>
              </Group>
            )}

            {/* Custom Taxes, Charges & Discounts */}
            <Group justify="space-between" align="center" mt={2}>
              <Group gap={4} align="center">
                <IconReceiptTax size={13} color="#868e96" />
                <Text size="xs" fw={600} c="dimmed">Taxes & Discounts</Text>
              </Group>
              {onOpenAdjustmentModal && (
                <Button
                  variant="subtle"
                  color="dinePrimary"
                  size="compact-xs"
                  px={6}
                  h={20}
                  style={{ fontSize: 11, fontWeight: 600 }}
                  leftSection={<IconPlus size={11} />}
                  onClick={() => onOpenAdjustmentModal()}
                  aria-label="Add tax or discount"
                  disabled={!canDiscount}
                  title={!canDiscount ? "Permission required: pos:discount_apply" : undefined}
                >
                  Add
                </Button>
              )}
            </Group>

            {adjustments.map((adj) => {
              const isDisc = adj.amountPaise < 0;
              return (
                <Group key={adj.id} justify="space-between" align="center" wrap="nowrap" py={1}>
                  <Group gap={6} align="center" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                    <Text size="xs" fw={500} lineClamp={1}>{adj.label}</Text>
                    <Badge size="xs" variant="light" color={isDisc ? "green" : "teal"}>
                      {adj.value.includes("%") ? adj.value : `₹${adj.value}`}
                    </Badge>
                  </Group>
                  <Group gap={4} align="center" wrap="nowrap">
                    <Text size="xs" fw={600} c={isDisc ? "green" : "dinePrimary"}>
                      {isDisc ? "-" : "+"}₹{(Math.abs(adj.amountPaise) / 100).toFixed(0)}
                    </Text>
                    {onOpenAdjustmentModal && (
                      <ActionIcon
                        size={22}
                        variant="subtle"
                        color="gray"
                        onClick={() => onOpenAdjustmentModal(adj)}
                        title="Edit tax/discount"
                        aria-label={`Edit ${adj.label}`}
                      >
                        <IconEdit size={12} />
                      </ActionIcon>
                    )}
                    {onRemoveAdjustment && (
                      <ActionIcon
                        size={22}
                        variant="subtle"
                        color="red"
                        onClick={() => onRemoveAdjustment(adj.id)}
                        title="Remove"
                        aria-label={`Remove ${adj.label}`}
                      >
                        <IconTrash size={12} />
                      </ActionIcon>
                    )}
                  </Group>
                </Group>
              );
            })}
            <Divider variant="dashed" my={2} />
          </Stack>
        )}

        <Group justify="space-between" mb="xs">
          <Text fw={700}>Total</Text>
          <Text fw={700} c="dinePrimary" size="lg">₹{(grandTotal / 100).toFixed(0)}</Text>
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
                  disabled={cartItems.length === 0 || isBlockedByConflict || isMinDeliveryBlocked || !canOrderCreate}
                  title={!canOrderCreate ? "Permission required: pos:order_create" : undefined}
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
                      disabled={cartItems.length === 0 || sending || isBlockedByConflict || isMinDeliveryBlocked}
                      aria-label="More order options"
                    >
                      <IconChevronDown size={16} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item
                      leftSection={<IconCash size={16} />}
                      onClick={() => setSettleModal(true)}
                      disabled={isBlockedByConflict || !canSettle}
                      title={!canSettle ? "Permission required: pos:bill_settle" : undefined}
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
  const { restaurant, activeOutlet, can } = useRestaurant();
  const restaurantId = restaurant?.id ?? "";
  const outletId = activeOutlet?.id ?? null;
  const queryClient = useQueryClient();
  const canView = can("pos:view");

  // Server data via React Query — same cache keys as MenuManagement → zero refetch on page switch
  const { data: categories = [], isLoading: catsLoading } = useCategories(restaurantId, outletId);
  const { data: items = [], isLoading: itemsLoading } = useItems(restaurantId, outletId);
  const loading = catsLoading || itemsLoading;
  const { data: tablesData } = useTables(restaurantId, outletId);
  const tables = (tablesData ?? []).filter((t: any) => t.active);

  // Real-time live sync via Cloudflare Durable Object
  const { isConnected } = useOutletSync(restaurantId, outletId);

  // Table orders for instant occupancy and active table matching (real-time push via Durable Object)
  const { data: openOrders = [] } = useOrders(
    restaurantId,
    { tableOccupied: true, outletId: outletId ?? undefined },
    Boolean(restaurantId && outletId),
    { refetchInterval: false }
  );

  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterVeg, setFilterVeg] = useState(false);
  const [filterNonVeg, setFilterNonVeg] = useState(false);

  // Local cart state managed via Zustand usePosStore
  const cartItems = usePosStore((s) => s.cart);
  const setCartItems = usePosStore((s) => s.setCartItems);
  const cartOpen = usePosStore((s) => s.cartOpen);
  const setCartOpen = usePosStore((s) => s.setCartOpen);
  const [tableNo, setTableNo] = useState<string>("Takeaway");
  const [customerPhone, setCustomerPhone] = useState<string>("");

  // Outlet dining settings integration
  const diningSettings = useMemo(() => {
    if (!activeOutlet?.diningSettings) return null;
    if (typeof activeOutlet.diningSettings === "string") {
      try {
        return JSON.parse(activeOutlet.diningSettings);
      } catch {
        return null;
      }
    }
    return activeOutlet.diningSettings as any;
  }, [activeOutlet?.diningSettings]);

  const isDineInEnabled = diningSettings?.dineInEnabled !== false;
  const isTakeawayEnabled = diningSettings?.takeawayEnabled !== false;
  const isDeliveryEnabled = diningSettings?.deliveryEnabled !== false;

  const availableOrderModes = useMemo(() => {
    const modes: { label: React.ReactNode; value: "DINE_IN" | "TAKEAWAY" | "DELIVERY" }[] = [];
    if (isDineInEnabled) modes.push({ label: <Group gap={4} justify="center" wrap="nowrap"><IconToolsKitchen2 size={14} /><span>Dine-In</span></Group>, value: "DINE_IN" });
    if (isTakeawayEnabled) modes.push({ label: <Group gap={4} justify="center" wrap="nowrap"><IconShoppingBag size={14} /><span>Takeaway</span></Group>, value: "TAKEAWAY" });
    if (isDeliveryEnabled) modes.push({ label: <Group gap={4} justify="center" wrap="nowrap"><IconMotorbike size={14} /><span>Delivery</span></Group>, value: "DELIVERY" });
    if (modes.length === 0) modes.push({ label: <Group gap={4} justify="center" wrap="nowrap"><IconShoppingBag size={14} /><span>Takeaway</span></Group>, value: "TAKEAWAY" });
    return modes;
  }, [isDineInEnabled, isTakeawayEnabled, isDeliveryEnabled]);

  // Delivery state
  const [orderType, setOrderType] = useState<"DINE_IN" | "TAKEAWAY" | "DELIVERY">("TAKEAWAY");
  const [deliveryCustomerName, setDeliveryCustomerName] = useState("");
  const [deliveryAddressLine1, setDeliveryAddressLine1] = useState("");
  const [deliveryLandmark, setDeliveryLandmark] = useState("");
  const [deliveryPincode, setDeliveryPincode] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [selectedRiderId, setSelectedRiderId] = useState<string | null>(null);
  const [packagingCharge, setPackagingCharge] = useState(15);
  const [deliveryCharge, setDeliveryCharge] = useState(40);
  const [deliveryExpanded, setDeliveryExpanded] = useState(false);

  // Track whether we've applied the initial default from settings
  const defaultAppliedRef = useRef(false);

  // Synchronize orderType with available modes & default preferences
  useEffect(() => {
    if (availableOrderModes.length === 0) return;

    // If current orderType is not in available modes, force switch
    const currentValid = availableOrderModes.some((m) => m.value === orderType);
    // Apply default preference on first load OR when current mode is invalid
    if (!currentValid || !defaultAppliedRef.current) {
      const defaultPref = diningSettings?.defaultOrderType;
      const targetMode = (defaultPref && availableOrderModes.some((m) => m.value === defaultPref))
        ? defaultPref
        : availableOrderModes[0].value;
      defaultAppliedRef.current = true;
      if (targetMode !== orderType) {
        setOrderType(targetMode);
        if (targetMode === "TAKEAWAY") setTableNo("Takeaway");
        else if (targetMode === "DELIVERY") setTableNo("Delivery");
        else if (targetMode === "DINE_IN" && tables.length > 0) setTableNo(tables[0].name);
      }
    }
  }, [availableOrderModes, orderType, diningSettings?.defaultOrderType, tables]);

  // Sync charges from diningSettings
  useEffect(() => {
    if (diningSettings?.packagingChargePaise != null) {
      setPackagingCharge(Math.round(diningSettings.packagingChargePaise / 100));
    }
    if (diningSettings?.deliveryFeePaise != null) {
      setDeliveryCharge(Math.round(diningSettings.deliveryFeePaise / 100));
    }
  }, [diningSettings?.packagingChargePaise, diningSettings?.deliveryFeePaise]);

  // Delivery Drawer & Add Rider modal state
  const [deliveryDrawerOpen, setDeliveryDrawerOpen] = useState(false);
  const [deliveryDrawerTab, setDeliveryDrawerTab] = useState<"active" | "fleet">("active");
  const [addRiderModalOpen, setAddRiderModalOpen] = useState(false);
  const [newRiderName, setNewRiderName] = useState("");
  const [newRiderPhone, setNewRiderPhone] = useState("");
  const [newRiderVehicle, setNewRiderVehicle] = useState("Bike");
  const [creatingRider, setCreatingRider] = useState(false);

  // OTP Verification Modal state
  const [otpModalOrder, setOtpModalOrder] = useState<any | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // Assign Rider state
  const [assigningOrder, setAssigningOrder] = useState<any | null>(null);
  const [assignRiderId, setAssignRiderId] = useState<string | null>(null);
  const [assigningRider, setAssigningRider] = useState(false);

  // Delivery queries
  const { data: riders = [] } = useDeliveryRiders(restaurantId, outletId);
  const { data: savedAddresses = [] } = useCustomerAddresses(restaurantId, customerPhone);

  // All recent orders for active delivery tracking (real-time push via Durable Object)
  const { data: allRecentOrders = [] } = useOrders(
    restaurantId,
    { outletId: outletId ?? undefined, limit: 100 },
    Boolean(restaurantId && outletId),
    { refetchInterval: false }
  );

  const activeDeliveryOrders = useMemo(() => {
    return (allRecentOrders as any[]).filter((entry) => {
      const isDeliv = entry.order?.orderType === "DELIVERY" || Boolean(entry.delivery) || entry.order?.tableNo === "Delivery";
      if (!isDeliv) return false;
      const status = entry.delivery?.status;
      return status !== "DELIVERED" && status !== "CANCELLED" && entry.order?.status !== "VOID";
    });
  }, [allRecentOrders]);

  // Active table order matching & round computation
  const activeTableOrder = useMemo(() => {
    if (!tableNo || tableNo === "Takeaway" || tableNo === "Delivery") return null;
    return openOrders.find((entry: any) => isTableMatch(tableNo, entry.order?.tableNo)) ?? null;
  }, [openOrders, tableNo]);

  const currentRound = useMemo(() => {
    if (!activeTableOrder) return 1;
    const activeItems = activeTableOrder.items ?? [];
    return activeItems.reduce((max: number, it: any) => Math.max(max, it.round || 1), 1);
  }, [activeTableOrder]);

  const nextRound = currentRound + 1;
  const [showExistingItemsModal, setShowExistingItemsModal] = useState(false);

  // Active customer order conflict check (must be at top level before early returns)
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

  // Sync table or customer phone from URL if provided (e.g. from Tables page or Customer Profile)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tableParam = params.get("table");
      if (tableParam) {
        if (isDineInEnabled) {
          setTableNo(tableParam);
          setOrderType("DINE_IN");
        } else {
          notifications.show({
            title: "Dine-In Disabled",
            message: `Table "${tableParam}" requested, but Dine-In is turned off for this outlet.`,
            color: "orange",
          });
        }
      }
      const phoneParam = params.get("phone");
      if (phoneParam) {
        setCustomerPhone(phoneParam.replace(/\D/g, "").slice(0, 15));
      }
    }
  }, [isDineInEnabled]);

  // Auto-select first dining table when in DINE_IN mode if current tableNo is invalid
  useEffect(() => {
    if (isDineInEnabled && orderType === "DINE_IN" && (!tableNo || tableNo === "Takeaway" || tableNo === "Delivery") && tables.length > 0) {
      setTableNo(tables[0].name);
    }
  }, [isDineInEnabled, orderType, tableNo, tables]);

  // Settle modal state
  const [settleModal, setSettleModal] = useState(false);
  const [settleMethod, setSettleMethod] = useState<string>("Cash");
  const [settling, setSettling] = useState(false);
  const [sending, setSending] = useState(false);

  // Adjustments (Taxes, Charges & Discounts) state
  const [adjustments, setAdjustments] = useState<OrderAdjustment[]>([]);
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [editingAdjustment, setEditingAdjustment] = useState<OrderAdjustment | null>(null);
  const [adjLabel, setAdjLabel] = useState("");
  const [adjValue, setAdjValue] = useState("");
  const [adjType, setAdjType] = useState<"charge" | "discount">("charge");

  const handleOpenAdjustmentModal = (adj?: OrderAdjustment) => {
    if (adj) {
      setEditingAdjustment(adj);
      setAdjLabel(adj.label);
      setAdjValue(adj.value.replace(/^-/, ""));
      setAdjType(adj.type || (adj.amountPaise < 0 ? "discount" : "charge"));
    } else {
      setEditingAdjustment(null);
      setAdjLabel("");
      setAdjValue("");
      setAdjType("charge");
    }
    setAdjustmentModalOpen(true);
  };

  const handleSaveAdjustment = () => {
    const trimmedLabel = adjLabel.trim();
    const trimmedVal = adjValue.trim();
    if (!trimmedLabel) {
      notifications.show({ title: "Label Required", message: "Please enter a label for the tax, charge, or discount.", color: "red" });
      return;
    }
    if (!trimmedVal) {
      notifications.show({ title: "Value Required", message: "Please enter a value (e.g. 5% or 50).", color: "red" });
      return;
    }

    const isDiscount = adjType === "discount" || trimmedVal.startsWith("-") || trimmedLabel.toLowerCase().includes("discount");
    const parsed = computeAdjustmentAmount(trimmedVal, isDiscount, itemsSubtotal);
    if (isNaN(parsed.num) || parsed.num === 0) {
      notifications.show({ title: "Invalid Value", message: "Please enter a valid number or percentage (e.g. 5% or 50).", color: "red" });
      return;
    }

    const cleanValStr = parsed.isPercent ? `${parsed.num}%` : `${parsed.num}`;

    if (editingAdjustment) {
      setAdjustments((prev) =>
        prev.map((a) =>
          a.id === editingAdjustment.id
            ? {
                ...a,
                label: trimmedLabel,
                value: cleanValStr,
                type: isDiscount ? "discount" : "charge",
                amountPaise: parsed.amountPaise,
              }
            : a
        )
      );
    } else {
      const newAdj: OrderAdjustment = {
        id: `adj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        label: trimmedLabel,
        value: cleanValStr,
        type: isDiscount ? "discount" : "charge",
        amountPaise: parsed.amountPaise,
      };
      setAdjustments((prev) => [...prev, newAdj]);
    }

    setAdjustmentModalOpen(false);
    setEditingAdjustment(null);
    setAdjLabel("");
    setAdjValue("");
  };

  const handleRemoveAdjustment = (id: string) => {
    setAdjustments((prev) => prev.filter((a) => a.id !== id));
  };

  const outletTaxPresets = useMemo(() => {
    const presets: { l: string; v: string; type: "charge" | "discount" }[] = [];
    if (activeOutlet?.taxSettings) {
      try {
        const cfg = typeof activeOutlet.taxSettings === "string" ? JSON.parse(activeOutlet.taxSettings) : activeOutlet.taxSettings;
        if (cfg?.enableGst && Array.isArray(cfg?.slabs)) {
          for (const slab of cfg.slabs) {
            if (slab.rate > 0) {
              presets.push({ l: slab.name || `GST ${slab.rate}%`, v: `${slab.rate}%`, type: "charge" });
            }
          }
        }
        if (Array.isArray(cfg?.adjustments)) {
          for (const adj of cfg.adjustments) {
            if (adj.isActive !== false) {
              const isDisc = adj.sign === "SUBTRACT" || adj.category === "DISCOUNT";
              const valStr = adj.type === "PERCENTAGE" ? `${adj.value}%` : `${adj.value}`;
              presets.push({ l: adj.name, v: valStr, type: isDisc ? "discount" : "charge" });
            }
          }
        }
      } catch {}
    }
    return presets;
  }, [activeOutlet?.taxSettings]);

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
    setAdjustments([]);
    setTableNo("Takeaway");
    setCustomerPhone("");
    setDeliveryCustomerName("");
    setDeliveryAddressLine1("");
    setDeliveryLandmark("");
    setDeliveryPincode("");
    setDeliveryNotes("");
    setSelectedRiderId(null);
    setOrderType("TAKEAWAY");
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
            adjustments: computedAdjustments.map((a) => ({ id: a.id, label: a.label, value: a.value, amountPaise: a.amountPaise })),
          },
          activeOutlet.id
        );

        const currentRoundNum = roundRes.round || nextRound;

        // Reset cart immediately — don't wait for print
        setCartItems([]);
        setAdjustments([]);
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
        if (orderType === "DELIVERY") {
          if (isMinDeliveryBlocked) {
            notifications.show({
              title: "Minimum Order Required",
              message: `Minimum order for delivery is ₹${minDeliveryOrder}. Please add ₹${Math.max(0, minDeliveryOrder - Math.round(itemsSubtotal / 100))} more.`,
              color: "red",
            });
            setSending(false);
            return;
          }
          if (!customerPhone.trim() || customerPhone.replace(/\D/g, "").length < 10) {
            notifications.show({
              title: "Customer Phone Required",
              message: "Please enter a valid 10-digit customer phone number for delivery orders.",
              color: "red",
            });
            setSending(false);
            return;
          }
          if (!deliveryAddressLine1.trim()) {
            setDeliveryExpanded(true);
            notifications.show({
              title: "Delivery Address Required",
              message: "Please enter the delivery address.",
              color: "red",
            });
            setSending(false);
            return;
          }
        } else if (orderType === "DINE_IN" && (!tableNo || tableNo === "Takeaway" || tableNo === "Delivery")) {
          notifications.show({
            title: "Table Required",
            message: "Please select a dining table for Dine-In orders.",
            color: "red",
          });
          setSending(false);
          return;
        } else if (customerActiveOrderConflict) {
          notifications.show({
            title: "Customer Has Active Order",
            message: `Customer already has active Token #${customerActiveOrderConflict.orderNo} on ${customerActiveOrderConflict.tableNo || "Takeaway"}. Cannot place a new order until that order is settled or freed.`,
            color: "red",
          });
          setSending(false);
          return;
        }

        const deliveryPayload = orderType === "DELIVERY" ? {
          customerName: deliveryCustomerName.trim() || undefined,
          customerPhone: customerPhone.trim(),
          addressLine1: deliveryAddressLine1.trim(),
          landmark: deliveryLandmark.trim() || undefined,
          pincode: deliveryPincode.trim() || undefined,
          deliveryNotes: deliveryNotes.trim() || undefined,
          riderId: selectedRiderId || undefined,
        } : undefined;

        const created = await startOrder(restaurantId, {
          outletId: activeOutlet.id,
          tableNo: orderType === "DELIVERY" ? "Delivery" : (tableNo || "Takeaway"),
          customerPhone: customerPhone.trim() || undefined,
          orderType,
          packagingChargePaise: (orderType === "DELIVERY" || orderType === "TAKEAWAY") ? packagingCharge * 100 : 0,
          deliveryChargePaise: orderType === "DELIVERY" ? effectiveDeliveryFee * 100 : 0,
          adjustments: computedAdjustments.map((a) => ({ id: a.id, label: a.label, value: a.value, amountPaise: a.amountPaise })),
          delivery: deliveryPayload,
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
        setAdjustments([]);
        setCustomerPhone("");
        setDeliveryCustomerName("");
        setDeliveryAddressLine1("");
        setDeliveryLandmark("");
        setDeliveryPincode("");
        setDeliveryNotes("");
        setSelectedRiderId(null);
        setTableNo("Takeaway");
        setOrderType("TAKEAWAY");
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
            adjustments: computedAdjustments.map((a) => ({ id: a.id, label: a.label, value: a.value, amountPaise: a.amountPaise })),
            settle: { method: settleMethod },
          },
          activeOutlet.id
        );

        const currentRoundNum = addedRound.round || nextRound;

        setCartItems([]);
        setAdjustments([]);
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
          message: `${activeTableOrder.order.tableNo} (Token #${activeTableOrder.order.orderNo}) — ₹${(grandTotal / 100).toFixed(0)} paid via ${settleMethod}. Table remains occupied.`,
          color: "green",
          icon: <IconCheck size={16} />,
        });

        queryClient.invalidateQueries({ queryKey: qk.orders(restaurantId) });
        queryClient.invalidateQueries({ queryKey: qk.kitchenOrders(restaurantId, activeOutlet.id) });
        queryClient.invalidateQueries({ queryKey: qk.tables(restaurantId, activeOutlet.id) });
      } else {
        if (orderType === "DELIVERY") {
          if (isMinDeliveryBlocked) {
            notifications.show({
              title: "Minimum Order Required",
              message: `Minimum order for delivery is ₹${minDeliveryOrder}. Please add ₹${Math.max(0, minDeliveryOrder - Math.round(itemsSubtotal / 100))} more.`,
              color: "red",
            });
            setSettling(false);
            return;
          }
          if (!customerPhone.trim() || customerPhone.replace(/\D/g, "").length < 10) {
            notifications.show({
              title: "Customer Phone Required",
              message: "Please enter a valid 10-digit customer phone number for delivery orders.",
              color: "red",
            });
            setSettling(false);
            return;
          }
          if (!deliveryAddressLine1.trim()) {
            setDeliveryExpanded(true);
            notifications.show({
              title: "Delivery Address Required",
              message: "Please enter the delivery address.",
              color: "red",
            });
            setSettling(false);
            return;
          }
        } else if (orderType === "DINE_IN" && (!tableNo || tableNo === "Takeaway" || tableNo === "Delivery")) {
          notifications.show({
            title: "Table Required",
            message: "Please select a dining table for Dine-In orders.",
            color: "red",
            icon: <IconAlertCircle size={16} />,
          });
          setSettling(false);
          return;
        } else if (customerActiveOrderConflict) {
          notifications.show({
            title: "Customer Has Active Order",
            message: `Customer already has active Token #${customerActiveOrderConflict.orderNo} on ${customerActiveOrderConflict.tableNo || "Takeaway"}. Cannot place a new order until that order is settled or freed.`,
            color: "red",
          });
          setSettling(false);
          return;
        }

        const deliveryPayload = orderType === "DELIVERY" ? {
          customerName: deliveryCustomerName.trim() || undefined,
          customerPhone: customerPhone.trim(),
          addressLine1: deliveryAddressLine1.trim(),
          landmark: deliveryLandmark.trim() || undefined,
          pincode: deliveryPincode.trim() || undefined,
          deliveryNotes: deliveryNotes.trim() || undefined,
          riderId: selectedRiderId || undefined,
        } : undefined;

        const result = await createSettledOrder(restaurantId, {
          outletId: activeOutlet.id,
          tableNo: orderType === "DELIVERY" ? "Delivery" : (tableNo || "Takeaway"),
          customerPhone: customerPhone.trim() || undefined,
          orderType,
          packagingChargePaise: (orderType === "DELIVERY" || orderType === "TAKEAWAY") ? packagingCharge * 100 : 0,
          deliveryChargePaise: orderType === "DELIVERY" ? effectiveDeliveryFee * 100 : 0,
          adjustments: computedAdjustments.map((a) => ({ id: a.id, label: a.label, value: a.value, amountPaise: a.amountPaise })),
          delivery: deliveryPayload,
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
        setAdjustments([]);
        setCustomerPhone("");
        setDeliveryCustomerName("");
        setDeliveryAddressLine1("");
        setDeliveryLandmark("");
        setDeliveryPincode("");
        setDeliveryNotes("");
        setSelectedRiderId(null);
        setTableNo("Takeaway");
        setOrderType("TAKEAWAY");
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

  const handleAssignRider = async (orderId: string, riderId: string) => {
    if (!riderId) return;
    setAssigningRider(true);
    try {
      await updateDeliveryStatus(restaurantId, orderId, { status: "ASSIGNED", riderId }, outletId);
      notifications.show({
        title: "Rider Assigned",
        message: "Delivery rider assigned successfully.",
        color: "teal",
      });
      setAssigningOrder(null);
      setAssignRiderId(null);
      queryClient.invalidateQueries({ queryKey: qk.orders(restaurantId) });
      queryClient.invalidateQueries({ queryKey: qk.deliveryRiders(restaurantId, outletId) });
    } catch (err: any) {
      notifications.show({ title: "Error assigning rider", message: err.message, color: "red" });
    } finally {
      setAssigningRider(false);
    }
  };

  const handleMarkOutForDelivery = async (orderId: string, riderId?: string) => {
    try {
      await updateDeliveryStatus(restaurantId, orderId, { status: "OUT_FOR_DELIVERY", riderId }, outletId);
      notifications.show({
        title: "Out for Delivery",
        message: "Order marked as Out for Delivery.",
        color: "orange",
      });
      queryClient.invalidateQueries({ queryKey: qk.orders(restaurantId) });
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  const handleConfirmDelivered = async (orderId: string, otp?: string) => {
    setVerifyingOtp(true);
    try {
      await updateDeliveryStatus(
        restaurantId,
        orderId,
        { status: "DELIVERED", deliveryOtp: otp?.trim() || undefined },
        outletId
      );
      notifications.show({
        title: "Order Delivered!",
        message: "Delivery marked as complete and settled.",
        color: "green",
        icon: <IconCheck size={16} />,
      });
      setOtpModalOrder(null);
      setOtpInput("");
      queryClient.invalidateQueries({ queryKey: qk.orders(restaurantId) });
      queryClient.invalidateQueries({ queryKey: qk.deliveryRiders(restaurantId, outletId) });
    } catch (err: any) {
      notifications.show({ title: "Verification Failed", message: err.message || "Invalid OTP", color: "red" });
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleCreateRider = async () => {
    if (!newRiderName.trim() || !newRiderPhone.trim()) {
      notifications.show({ title: "Validation Error", message: "Rider Name and Phone are required", color: "red" });
      return;
    }
    setCreatingRider(true);
    try {
      await createDeliveryRider(restaurantId, {
        name: newRiderName.trim(),
        phone: newRiderPhone.trim(),
        vehicleType: newRiderVehicle,
        outletId,
      }, outletId);
      notifications.show({ title: "Rider Added", message: `${newRiderName.trim()} added to fleet`, color: "green" });
      setNewRiderName("");
      setNewRiderPhone("");
      setNewRiderVehicle("Bike");
      setAddRiderModalOpen(false);
      queryClient.invalidateQueries({ queryKey: qk.deliveryRiders(restaurantId, outletId) });
    } catch (err: any) {
      notifications.show({ title: "Failed to add rider", message: err.message, color: "red" });
    } finally {
      setCreatingRider(false);
    }
  };

  if (loading) return <Center py={100}><Loader size="lg" color="dinePrimary" /></Center>;

  if (!canView) {
    return (
      <Center py={100}>
        <Stack align="center" gap="md" style={{ maxWidth: 450, textAlign: "center" }}>
          <IconShoppingCart size={48} color="#af73d7" />
          <Title order={3}>Access Restricted</Title>
          <Text c="dimmed" size="sm">
            Your current role does not have authorization to view the POS Billing Register (<code>pos:view</code>).
          </Text>
        </Stack>
      </Center>
    );
  }
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

  const itemsSubtotal = cartItems.reduce((s, i) => s + i.pricePaise * i.qty, 0);

  // Delivery free threshold check
  const freeDeliveryThreshold = diningSettings?.freeDeliveryThresholdPaise != null
    ? Math.round(diningSettings.freeDeliveryThresholdPaise / 100)
    : 0;
  const isFreeDelivery = freeDeliveryThreshold > 0 && (itemsSubtotal / 100) >= freeDeliveryThreshold;

  // Minimum delivery check
  const minDeliveryOrder = diningSettings?.minDeliveryOrderPaise != null
    ? Math.round(diningSettings.minDeliveryOrderPaise / 100)
    : 0;
  const isMinDeliveryBlocked = orderType === "DELIVERY" && minDeliveryOrder > 0 && (itemsSubtotal / 100) < minDeliveryOrder;

  const effectiveDeliveryFee = isFreeDelivery ? 0 : deliveryCharge;
  const extraCharges = cartItems.length > 0
    ? orderType === "DELIVERY"
      ? (packagingCharge + effectiveDeliveryFee) * 100
      : orderType === "TAKEAWAY"
      ? (packagingCharge > 0 ? packagingCharge * 100 : 0)
      : 0
    : 0;

  const computedAdjustments = adjustments.map((adj) => {
    const isDiscount = adj.type === "discount" || adj.amountPaise < 0;
    const { amountPaise } = computeAdjustmentAmount(adj.value, isDiscount, itemsSubtotal);
    return { ...adj, amountPaise };
  });

  const totalAdjustmentsPaise = computedAdjustments.reduce((sum, adj) => sum + adj.amountPaise, 0);

  const grandTotal = Math.max(0, itemsSubtotal + extraCharges + totalAdjustmentsPaise);
  const total = grandTotal;
  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0);

  const tableSelectData = tables.map((t: any) => {
    const occ = openOrders.find((entry: any) => isTableMatch(t.name, entry.order?.tableNo));
    let label = t.section ? `${t.name} · ${t.section}` : t.name;
    if (occ) {
      const r = (occ.items ?? []).reduce((m: number, i: any) => Math.max(m, i.round || 1), 1);
      label += ` (Occupied · Round ${r})`;
    }
    return { value: t.name, label };
  });

  const cartPanelProps: CartPanelProps = {
    cartItems,
    cartCount,
    itemsSubtotal,
    grandTotal,
    tableNo,
    setTableNo,
    orderType,
    setOrderType,
    customerPhone,
    setCustomerPhone,
    deliveryCustomerName,
    setDeliveryCustomerName,
    deliveryAddressLine1,
    setDeliveryAddressLine1,
    deliveryLandmark,
    setDeliveryLandmark,
    deliveryPincode,
    setDeliveryPincode,
    deliveryNotes,
    setDeliveryNotes,
    selectedRiderId,
    setSelectedRiderId,
    packagingCharge,
    setPackagingCharge,
    deliveryCharge,
    setDeliveryCharge,
    savedAddresses,
    riders,
    tableSelectData,
    availableOrderModes,
    isFreeDelivery,
    minDeliveryOrder,
    isMinDeliveryBlocked,
    adjustments: computedAdjustments,
    onOpenAdjustmentModal: handleOpenAdjustmentModal,
    onRemoveAdjustment: handleRemoveAdjustment,
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
    deliveryExpanded,
    setDeliveryExpanded,
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

                {/* Delivery Quick Drawer Button */}
                <Button
                  size="xs"
                  variant={activeDeliveryOrders.length > 0 ? "filled" : "light"}
                  color="teal"
                  leftSection={<IconMotorbike size={15} />}
                  onClick={() => setDeliveryDrawerOpen(true)}
                  style={{
                    flexShrink: 0,
                    fontWeight: 600,
                    height: 29,
                  }}
                >
                  Deliveries {activeDeliveryOrders.length > 0 ? `(${activeDeliveryOrders.length})` : ""}
                </Button>
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
        <Stack gap="sm">
          {/* Detailed Bill Summary Card */}
          <Paper withBorder p="xs" radius="sm" bg="var(--mantine-color-gray-0)">
            <Stack gap={4}>
              <Group justify="space-between">
                <Text size="xs" c="dimmed">{activeTableOrder ? `Round ${nextRound} Items` : "Items Subtotal"}</Text>
                <Text size="xs" fw={500}>₹{(itemsSubtotal / 100).toFixed(0)}</Text>
              </Group>

              {packagingCharge > 0 && (orderType === "DELIVERY" || orderType === "TAKEAWAY") && (
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">Packaging Fee</Text>
                  <Text size="xs" fw={500}>₹{packagingCharge}</Text>
                </Group>
              )}

              {effectiveDeliveryFee > 0 && orderType === "DELIVERY" && (
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">Delivery Fee</Text>
                  <Text size="xs" fw={500}>₹{effectiveDeliveryFee}</Text>
                </Group>
              )}

              {computedAdjustments.map((adj) => {
                const isDisc = adj.amountPaise < 0;
                return (
                  <Group key={adj.id} justify="space-between" align="center" wrap="nowrap">
                    <Group gap={6} align="center" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                      <Text size="xs" fw={500} lineClamp={1}>{adj.label}</Text>
                      <Badge size="xs" variant="light" color={isDisc ? "green" : "teal"}>
                        {adj.value.includes("%") ? adj.value : `₹${adj.value}`}
                      </Badge>
                    </Group>
                    <Group gap={4} align="center" wrap="nowrap">
                      <Text size="xs" fw={600} c={isDisc ? "green" : "dinePrimary"}>
                        {isDisc ? "-" : "+"}₹{(Math.abs(adj.amountPaise) / 100).toFixed(0)}
                      </Text>
                      <ActionIcon
                        size={20}
                        variant="subtle"
                        color="gray"
                        onClick={() => handleOpenAdjustmentModal(adj)}
                        title="Edit tax/discount"
                        aria-label={`Edit ${adj.label}`}
                      >
                        <IconEdit size={12} />
                      </ActionIcon>
                      <ActionIcon
                        size={20}
                        variant="subtle"
                        color="red"
                        onClick={() => handleRemoveAdjustment(adj.id)}
                        title="Remove"
                        aria-label={`Remove ${adj.label}`}
                      >
                        <IconTrash size={12} />
                      </ActionIcon>
                    </Group>
                  </Group>
                );
              })}

              <Divider variant="dashed" my={2} />

              <Group justify="space-between" align="center">
                <Button
                  variant="subtle"
                  color="dinePrimary"
                  size="compact-xs"
                  px={4}
                  h={20}
                  style={{ fontSize: 11, fontWeight: 600 }}
                  leftSection={<IconPlus size={11} />}
                  onClick={() => handleOpenAdjustmentModal()}
                  aria-label="Add tax or discount"
                >
                  + Add Tax / Discount
                </Button>
                <Group gap={6} align="center">
                  <Text size="xs" fw={700}>Payable Total:</Text>
                  <Text size="md" fw={700} c="dinePrimary">₹{(total / 100).toFixed(0)}</Text>
                </Group>
              </Group>
            </Stack>
          </Paper>

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
                { value: "Cash", label: <Group gap={4} justify="center" wrap="nowrap"><IconCash size={14} /><span>Cash</span></Group> },
                { value: "UPI", label: <Group gap={4} justify="center" wrap="nowrap"><IconQrcode size={14} /><span>UPI</span></Group> },
                { value: "QR", label: <Group gap={4} justify="center" wrap="nowrap"><IconQrcode size={14} /><span>QR Code</span></Group> },
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

      {/* Add / Edit Tax, Charge & Discount Modal */}
      <Modal
        opened={adjustmentModalOpen}
        onClose={() => {
          setAdjustmentModalOpen(false);
          setEditingAdjustment(null);
        }}
        title={
          <Group gap={8} align="center">
            <ThemeIcon size={28} radius="md" color={adjType === "discount" ? "green" : "teal"} variant="light">
              {adjType === "discount" ? <IconDiscount2 size={16} /> : <IconReceiptTax size={16} />}
            </ThemeIcon>
            <div>
              <Text fw={700} size="sm">
                {editingAdjustment ? "Edit Tax / Charge / Discount" : "Add Tax / Charge / Discount"}
              </Text>
              <Text size="xs" c="dimmed">
                Apply a custom fee, tax, or discount to this order
              </Text>
            </div>
          </Group>
        }
        size="sm"
        zIndex={1400}
      >
        <Stack gap="sm">
          <div>
            <Text size="xs" fw={600} mb={4} c="dimmed">Type</Text>
            <SegmentedControl
              fullWidth
              value={adjType}
              onChange={(val: any) => setAdjType(val)}
              data={[
                { value: "charge", label: "+ Charge / Tax" },
                { value: "discount", label: "- Discount" },
              ]}
              color={adjType === "discount" ? "green" : "teal"}
            />
          </div>

          <TextInput
            label="Label"
            placeholder={adjType === "discount" ? "e.g. Staff Discount, Promo, Courtesy" : "e.g. GST, Service Charge, Packaging"}
            value={adjLabel}
            onChange={(e) => setAdjLabel(e.target.value)}
            required
            data-autofocus
          />

          <TextInput
            label="Value"
            placeholder={adjType === "discount" ? "e.g. 10% or 50" : "e.g. 5% or 30"}
            description="Enter a percentage (e.g. 5%) or flat amount in ₹ (e.g. 50)"
            value={adjValue}
            onChange={(e) => setAdjValue(e.target.value)}
            required
          />

          {/* Quick preset chips */}
          <div>
            <Text size="xs" fw={600} mb={6} c="dimmed">Quick Presets</Text>
            <Group gap={6} wrap="wrap">
              {adjType === "discount" ? (
                <>
                  {[
                    { l: "Discount 5%", v: "5%" },
                    { l: "Discount 10%", v: "10%" },
                    { l: "Discount 15%", v: "15%" },
                    { l: "Flat ₹50 Off", v: "50" },
                    { l: "Flat ₹100 Off", v: "100" },
                  ].map((preset) => (
                    <Button
                      key={preset.l}
                      size="compact-xs"
                      variant="light"
                      color="green"
                      onClick={() => {
                        setAdjLabel(preset.l);
                        setAdjValue(preset.v);
                      }}
                    >
                      {preset.l}
                    </Button>
                  ))}
                  {outletTaxPresets.filter((p) => p.type === "discount").map((preset) => (
                    <Button
                      key={`outlet-${preset.l}`}
                      size="compact-xs"
                      variant="outline"
                      color="green"
                      onClick={() => {
                        setAdjLabel(preset.l);
                        setAdjValue(preset.v);
                      }}
                    >
                      {preset.l}
                    </Button>
                  ))}
                </>
              ) : (
                <>
                  {[
                    { l: "GST 5%", v: "5%" },
                    { l: "GST 12%", v: "12%" },
                    { l: "GST 18%", v: "18%" },
                    { l: "Service Charge 5%", v: "5%" },
                    { l: "Packaging Charge", v: "20" },
                  ].map((preset) => (
                    <Button
                      key={preset.l}
                      size="compact-xs"
                      variant="light"
                      color="teal"
                      onClick={() => {
                        setAdjLabel(preset.l);
                        setAdjValue(preset.v);
                      }}
                    >
                      {preset.l}
                    </Button>
                  ))}
                  {outletTaxPresets.filter((p) => p.type === "charge").map((preset) => (
                    <Button
                      key={`outlet-${preset.l}`}
                      size="compact-xs"
                      variant="outline"
                      color="teal"
                      onClick={() => {
                        setAdjLabel(preset.l);
                        setAdjValue(preset.v);
                      }}
                    >
                      {preset.l}
                    </Button>
                  ))}
                </>
              )}
            </Group>
          </div>

          {/* Live Preview Card */}
          {(() => {
            const previewParsed = computeAdjustmentAmount(adjValue, adjType === "discount", itemsSubtotal);
            const previewAmtPaise = previewParsed.amountPaise;
            const previewAmtRs = (Math.abs(previewAmtPaise) / 100).toFixed(2);
            const isNegative = previewAmtPaise < 0;
            return (
              <Paper withBorder p="xs" radius="sm" bg="var(--mantine-color-gray-0)">
                <Stack gap={2}>
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">Current Items Subtotal:</Text>
                    <Text size="xs" fw={500}>₹{(itemsSubtotal / 100).toFixed(0)}</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">Calculated Adjustment:</Text>
                    <Text size="xs" fw={700} c={isNegative ? "green" : "teal"}>
                      {isNegative ? "-" : "+"}₹{previewAmtRs}
                      {previewParsed.isPercent && ` (${previewParsed.num}% of subtotal)`}
                    </Text>
                  </Group>
                </Stack>
              </Paper>
            );
          })()}

          <Group justify="flex-end" gap="xs" mt="xs">
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                setAdjustmentModalOpen(false);
                setEditingAdjustment(null);
              }}
            >
              Cancel
            </Button>
            <Button
              color={adjType === "discount" ? "green" : "dinePrimary"}
              size="sm"
              onClick={handleSaveAdjustment}
              leftSection={<IconCheck size={16} />}
            >
              {editingAdjustment ? "Update Adjustment" : "Apply to Order"}
            </Button>
          </Group>
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
                                readOnly
                                style={{ pointerEvents: "none" }}
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

      {/* Delivery Management Drawer */}
      <Drawer
        opened={deliveryDrawerOpen}
        onClose={() => setDeliveryDrawerOpen(false)}
        position="right"
        size="lg"
        title={
          <Group gap="xs">
            <IconMotorbike size={22} color="#0ca678" />
            <Text fw={700} size="md">
              Delivery Management
            </Text>
            {activeDeliveryOrders.length > 0 && (
              <Badge color="teal" variant="filled" size="sm">
                {activeDeliveryOrders.length} Active
              </Badge>
            )}
          </Group>
        }
        zIndex={1300}
      >
        <Stack gap="md" style={{ height: "100%" }}>
          <SegmentedControl
            value={deliveryDrawerTab}
            onChange={(val) => setDeliveryDrawerTab(val as "active" | "fleet")}
            data={[
              { label: <Group gap={4} justify="center" wrap="nowrap"><IconMotorbike size={14} /><span>Active Deliveries ({activeDeliveryOrders.length})</span></Group>, value: "active" },
              { label: <Group gap={4} justify="center" wrap="nowrap"><IconUsers size={14} /><span>Fleet Riders ({riders.length})</span></Group>, value: "fleet" },
            ]}
            fullWidth
            size="sm"
          />

          {deliveryDrawerTab === "active" ? (
            <ScrollArea style={{ flex: 1 }}>
              {activeDeliveryOrders.length === 0 ? (
                <Center py={60}>
                  <Stack align="center" gap="xs">
                    <IconTruckDelivery size={40} color="#adb5bd" />
                    <Text fw={600} c="dimmed">No Active Delivery Orders</Text>
                    <Text size="xs" c="dimmed" ta="center" style={{ maxWidth: 280 }}>
                      Choose "Delivery" mode in POS cart when taking orders to dispatch and track riders here.
                    </Text>
                  </Stack>
                </Center>
              ) : (
                <Stack gap="sm">
                  {activeDeliveryOrders.map((entry: any) => {
                    const { order, items, delivery } = entry;
                    const dStatus = delivery?.status || "PENDING_ASSIGNMENT";
                    const isOut = dStatus === "OUT_FOR_DELIVERY";
                    const isAssigned = dStatus === "ASSIGNED";
                    const isPending = dStatus === "PENDING_ASSIGNMENT";
                    const isPaid = order.status === "PAID";
                    const customerName = delivery?.customerName || "Customer";
                    const customerPhone = delivery?.customerPhone || order.customerPhone || "";
                    const fullAddr = [delivery?.addressLine1, delivery?.landmark, delivery?.pincode].filter(Boolean).join(", ");
                    // Detect aggregator channel (Swiggy, Zomato, ONDC, Magicpin)
                    const channel = getOrderChannel(order, delivery);
                    const isThirdPartyManaged = Boolean(channel?.isAggregator) || delivery?.deliveryMode === "THIRD_PARTY";
                    const providerLabel = channel?.name || delivery?.deliveryProvider || "Platform";
                    const brandColor = channel?.color || "grape";

                    return (
                      <Paper key={order.id} p="sm" radius="md" withBorder style={{ backgroundColor: "#ffffff" }}>
                        <Stack gap="xs">
                          {/* Order header */}
                          <Group justify="space-between" align="center">
                            <Group gap="xs">
                              <Badge color="teal" variant="filled" size="md">
                                #{order.orderNo}
                              </Badge>
                              <Text fw={700} size="sm">{customerName}</Text>
                              {channel ? (
                                <>
                                  <Badge color={channel.color} variant="filled" size="xs">
                                    {channel.name}
                                  </Badge>
                                  {channel.tag && (
                                    <Badge color={channel.color} variant="light" size="xs">
                                      {channel.tag}
                                    </Badge>
                                  )}
                                </>
                              ) : isThirdPartyManaged ? (
                                <Badge color="grape" variant="light" size="xs">
                                  via {providerLabel}
                                </Badge>
                              ) : null}
                            </Group>
                            <Badge
                              color={channel ? channel.color : isOut ? "orange" : isAssigned ? "blue" : "yellow"}
                              variant="light"
                              size="sm"
                              leftSection={channel ? <IconMotorbike size={12} /> : isOut ? <IconMotorbike size={12} /> : isAssigned ? <IconUser size={12} /> : <IconClock size={12} />}
                            >
                              {channel ? `Delivery by ${channel.name}` : isOut ? "Out for Delivery" : isAssigned ? "Rider Assigned" : "Unassigned"}
                            </Badge>
                          </Group>

                          {/* Customer Phone & Quick Contact */}
                          <Group justify="space-between" align="center">
                            <Group gap={4} align="center">
                              <IconPhoneCall size={13} color="var(--mantine-color-dimmed)" />
                              <Text size="xs" fw={600} c="dimmed">
                                {customerPhone}
                              </Text>
                            </Group>
                            <Group gap={6}>
                              {customerPhone && (
                                <>
                                  <Button
                                    component="a"
                                    href={`tel:${customerPhone}`}
                                    size="compact-xs"
                                    variant="light"
                                    color="gray"
                                    leftSection={<IconPhoneCall size={12} />}
                                  >
                                    Call
                                  </Button>
                                  <Button
                                    component="a"
                                    href={`https://wa.me/91${customerPhone.replace(/\D/g, "").slice(-10)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    size="compact-xs"
                                    variant="light"
                                    color="teal"
                                    leftSection={<IconBrandWhatsapp size={12} />}
                                  >
                                    WhatsApp
                                  </Button>
                                </>
                              )}
                            </Group>
                          </Group>

                          {/* Delivery Address */}
                          {fullAddr && (
                            <Paper p="xs" radius="sm" withBorder style={{ backgroundColor: "#f8f9fa" }}>
                              <Group gap={4} align="center">
                                <IconMapPin size={13} color="var(--mantine-color-dark-6)" />
                                <Text size="xs" fw={500} c="dark.6">
                                  {fullAddr}
                                </Text>
                              </Group>
                              {delivery?.deliveryNotes && (
                                <Group gap={4} align="center" mt={2}>
                                  <IconNotes size={12} color="var(--mantine-color-orange-8)" />
                                  <Text size="xs" c="orange.8">
                                    Note: {delivery.deliveryNotes}
                                  </Text>
                                </Group>
                              )}
                            </Paper>
                          )}

                          {/* Rider Info & OTP */}
                          <Group justify="space-between" align="center">
                            <div>
                              {isThirdPartyManaged ? (
                                <Text size="xs" fw={600} c={`${brandColor}.8`}>
                                  {providerLabel} Rider{delivery?.riderName ? `: ${delivery.riderName}` : ""} {delivery?.riderPhone ? `(${delivery.riderPhone})` : "— will be assigned by platform"}
                                </Text>
                              ) : delivery?.riderName ? (
                                <Text size="xs" fw={600} c="blue.8">
                                  Rider: {delivery.riderName} {delivery.riderPhone ? `(${delivery.riderPhone})` : ""}
                                </Text>
                              ) : (
                                <Text size="xs" c="dimmed">No rider assigned yet</Text>
                              )}
                            </div>
                            {!isThirdPartyManaged && !channel && delivery?.deliveryOtp && (
                              <Badge color="teal" variant="outline" size="sm">
                                PIN: {delivery.deliveryOtp}
                              </Badge>
                            )}
                          </Group>

                          {/* Order Items & Amount */}
                          <Divider variant="dashed" />
                          <Group justify="space-between" align="center">
                            <Text size="xs" c="dimmed">
                              {items?.length || 0} items · ₹{(order.subtotalPaise / 100).toFixed(0)}
                            </Text>
                            <Badge color={isPaid ? "green" : "orange"} variant="light" size="xs">
                              {isPaid ? "Paid Online" : "Cash on Delivery"}
                            </Badge>
                          </Group>

                          {/* Delivery Actions */}
                          <Group justify="space-between" align="center" mt={4} wrap="wrap" gap={6}>
                            <Button
                              size="xs"
                              variant="subtle"
                              color="gray"
                              onClick={() => {
                                printTicketSilent(buildBillPayload(entry, restaurant)).catch(() => {});
                                notifications.show({ title: "Printed", message: "Delivery slip printed", color: "teal" });
                              }}
                            >
                              Reprint Bill
                            </Button>

                            {isThirdPartyManaged ? (
                              <Text size="xs" c="dimmed" fs="italic">
                                Delivery managed by {providerLabel}
                              </Text>
                            ) : (
                              <Group gap={6}>
                                {isPending && (
                                  <Button
                                    size="xs"
                                    color="blue"
                                    onClick={() => {
                                      setAssigningOrder(entry);
                                      setAssignRiderId(null);
                                    }}
                                  >
                                    Assign Rider
                                  </Button>
                                )}

                                {isAssigned && (
                                  <>
                                    <Button
                                      size="xs"
                                      variant="light"
                                      color="blue"
                                      onClick={() => {
                                        setAssigningOrder(entry);
                                        setAssignRiderId(delivery?.riderId || null);
                                      }}
                                    >
                                      Change Rider
                                    </Button>
                                    <Button
                                      size="xs"
                                      color="orange"
                                      leftSection={<IconMotorbike size={14} />}
                                      onClick={() => handleMarkOutForDelivery(order.id, delivery?.riderId)}
                                    >
                                      Out for Delivery
                                    </Button>
                                  </>
                                )}

                                {isOut && (
                                  <Button
                                    size="xs"
                                    color="green"
                                    leftSection={<IconCheck size={14} />}
                                    onClick={() => {
                                      setOtpModalOrder(entry);
                                      setOtpInput("");
                                    }}
                                  >
                                    Mark Delivered
                                  </Button>
                                )}
                              </Group>
                            )}
                          </Group>
                        </Stack>
                      </Paper>
                    );
                  })}
                </Stack>
              )}
            </ScrollArea>
          ) : (
            /* Fleet Tab */
            <Stack gap="md" style={{ flex: 1 }}>
              <Group justify="space-between" align="center">
                <Text size="sm" fw={600} c="dimmed">
                  Riders in fleet: {riders.length}
                </Text>
                <Button
                  size="xs"
                  color="teal"
                  leftSection={<IconPlus size={14} />}
                  onClick={() => setAddRiderModalOpen(true)}
                >
                  Add Rider
                </Button>
              </Group>

              <ScrollArea style={{ flex: 1 }}>
                {riders.length === 0 ? (
                  <Center py={60}>
                    <Stack align="center" gap="xs">
                      <IconMotorbike size={40} color="#adb5bd" />
                      <Text fw={600} c="dimmed">No Riders Added</Text>
                      <Button size="xs" color="teal" onClick={() => setAddRiderModalOpen(true)}>
                        + Add First Fleet Rider
                      </Button>
                    </Stack>
                  </Center>
                ) : (
                  <Stack gap="xs">
                    {riders.map((r: any) => (
                      <Paper key={r.id} p="sm" radius="md" withBorder>
                        <Group justify="space-between" align="center">
                          <div>
                            <Group gap="xs">
                              <Text fw={700} size="sm">{r.name}</Text>
                              <Badge
                                size="xs"
                                color={r.status === "AVAILABLE" ? "green" : r.status === "ON_DELIVERY" ? "orange" : "gray"}
                                variant="light"
                                leftSection={r.status === "ON_DELIVERY" ? <IconMotorbike size={10} /> : <IconCircleFilled size={8} />}
                              >
                                {r.status === "AVAILABLE" ? "Available" : r.status === "ON_DELIVERY" ? "On Delivery" : "Offline"}
                              </Badge>
                            </Group>
                            <Group gap={4} align="center" mt={2}>
                              <IconPhoneCall size={12} color="var(--mantine-color-dimmed)" />
                              <Text size="xs" c="dimmed">
                                {r.phone} · {r.vehicleType || "Bike"} {r.vehicleNumber ? `(${r.vehicleNumber})` : ""}
                              </Text>
                            </Group>
                          </div>
                          {r.phone && (
                            <Button
                              component="a"
                              href={`tel:${r.phone}`}
                              size="compact-xs"
                              variant="light"
                              color="gray"
                            >
                              Call
                            </Button>
                          )}
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </ScrollArea>
            </Stack>
          )}
        </Stack>
      </Drawer>

      {/* Verify Delivery & OTP Modal */}
      <Modal
        opened={Boolean(otpModalOrder)}
        onClose={() => {
          setOtpModalOrder(null);
          setOtpInput("");
        }}
        title={<Text fw={700}>Complete Order #{otpModalOrder?.order?.orderNo} Delivery</Text>}
        size="sm"
        centered
        zIndex={1400}
      >
        {otpModalOrder && (
          <Stack gap="sm">
            <Paper p="xs" radius="sm" withBorder style={{ backgroundColor: "#f8f9fa" }}>
              <Text size="xs" fw={700}>
                {otpModalOrder.delivery?.customerName || "Customer"} · {otpModalOrder.delivery?.customerPhone}
              </Text>
              <Group gap={4} align="center">
                <IconMapPin size={12} color="var(--mantine-color-dimmed)" />
                <Text size="xs" c="dimmed">
                  {otpModalOrder.delivery?.addressLine1}
                </Text>
              </Group>
              <Divider my={4} />
              <Group justify="space-between">
                <Text size="xs" fw={700}>Total Amount:</Text>
                <Text size="sm" fw={800} c="dinePrimary">
                  ₹{(otpModalOrder.order?.subtotalPaise / 100).toFixed(0)} ({otpModalOrder.order?.status === "PAID" ? "Paid" : "Collect COD"})
                </Text>
              </Group>
            </Paper>

            <TextInput
              label="Delivery PIN / OTP"
              description={`Expected PIN: ${otpModalOrder.delivery?.deliveryOtp || "—"}`}
              placeholder="Enter 4-digit PIN"
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value)}
              size="md"
              type="tel"
              maxLength={6}
            />

            <Group grow mt="xs">
              <Button
                variant="light"
                color="gray"
                loading={verifyingOtp}
                onClick={() => handleConfirmDelivered(otpModalOrder.order.id)}
              >
                Bypass PIN & Settle
              </Button>
              <Button
                color="green"
                loading={verifyingOtp}
                disabled={!otpInput.trim()}
                onClick={() => handleConfirmDelivered(otpModalOrder.order.id, otpInput)}
              >
                Verify & Complete
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Assign Rider Modal */}
      <Modal
        opened={Boolean(assigningOrder)}
        onClose={() => {
          setAssigningOrder(null);
          setAssignRiderId(null);
        }}
        title={<Text fw={700}>Assign Rider for Order #{assigningOrder?.order?.orderNo}</Text>}
        size="sm"
        centered
        zIndex={1400}
      >
        {assigningOrder && (
          <Stack gap="sm">
            <Text size="xs" c="dimmed">
              Delivery to: <b>{assigningOrder.delivery?.customerName}</b> ({assigningOrder.delivery?.addressLine1})
            </Text>

            {riders.length === 0 ? (
              <Alert color="orange" title="No Riders Available">
                You have no riders in your fleet. Add a rider first.
              </Alert>
            ) : (
              <Select
                label="Select Rider"
                placeholder="Choose rider"
                data={riders.map((r: any) => ({
                  value: r.id,
                  label: `${r.name} (${r.status === "AVAILABLE" ? "Available" : "Busy"} · ${r.vehicleType || "Bike"})`,
                }))}
                value={assignRiderId}
                onChange={setAssignRiderId}
              />
            )}

            <Group justify="flex-end" mt="xs">
              <Button
                variant="subtle"
                color="gray"
                onClick={() => {
                  setAssigningOrder(null);
                  setAssignRiderId(null);
                }}
              >
                Cancel
              </Button>
              <Button
                color="teal"
                loading={assigningRider}
                disabled={!assignRiderId}
                onClick={() => assignRiderId && handleAssignRider(assigningOrder.order.id, assignRiderId)}
              >
                Confirm Rider
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Add Fleet Rider Modal */}
      <Modal
        opened={addRiderModalOpen}
        onClose={() => setAddRiderModalOpen(false)}
        title={<Text fw={700}>Add Fleet Delivery Rider</Text>}
        size="sm"
        centered
        zIndex={1400}
      >
        <Stack gap="sm">
          <TextInput
            label="Rider Name *"
            placeholder="e.g. Ramesh Kumar"
            value={newRiderName}
            onChange={(e) => setNewRiderName(e.target.value)}
            required
          />
          <TextInput
            label="Phone Number *"
            placeholder="10-digit mobile number"
            type="tel"
            value={newRiderPhone}
            onChange={(e) => setNewRiderPhone(e.target.value)}
            required
          />
          <Select
            label="Vehicle Type"
            value={newRiderVehicle}
            onChange={(val) => setNewRiderVehicle(val || "Bike")}
            data={[
              { value: "Bike", label: "Motorcycle" },
              { value: "Scooter", label: "Scooter" },
              { value: "Bicycle", label: "Bicycle" },
              { value: "Car", label: "Car" },
            ]}
          />
          <Group justify="flex-end" mt="sm">
            <Button variant="subtle" color="gray" onClick={() => setAddRiderModalOpen(false)}>
              Cancel
            </Button>
            <Button
              color="teal"
              loading={creatingRider}
              onClick={handleCreateRider}
            >
              Add Rider
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
