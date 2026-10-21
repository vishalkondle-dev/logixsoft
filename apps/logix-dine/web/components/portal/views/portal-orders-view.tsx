"use client";

import React, { useState } from "react";
import {
  Stack,
  SegmentedControl,
  Paper,
  Text,
  Title,
  ThemeIcon,
  Button,
  Card,
  Box,
  Group,
  Badge,
  Rating,
  Collapse,
  Divider,
} from "@mantine/core";
import {
  IconToolsKitchen2,
  IconReceipt,
  IconHistory,
  IconFlame,
  IconStar,
  IconEdit,
  IconBrandWhatsapp,
  IconChevronDown,
  IconChevronUp,
  IconChevronRight,
  IconMotorbike,
  IconShoppingBag,
} from "@tabler/icons-react";
import { VegNonVegIcon } from "@/components/common/veg-nonveg-icon";
import type { CustomerPortalOrder } from "@/lib/api-client";
import { ActiveOrderCard } from "../active-order-card";
import type { PortalTab } from "../portal-bottom-nav";

interface PortalOrdersViewProps {
  activeOrders: CustomerPortalOrder[];
  pastOrders: CustomerPortalOrder[];
  lifetimeSpendPaise?: number;
  initialSubTab?: "active" | "past";
  onRefresh?: () => void;
  onOpenRateModal: (order: CustomerPortalOrder) => void;
  onNavigateTab: (tab: PortalTab) => void;
  onShareReceiptWhatsApp: (order: CustomerPortalOrder) => void;
}

function formatINR(paise?: number | null): string {
  if (paise == null) return "₹0.00";
  return `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function PortalOrdersView({
  activeOrders,
  pastOrders,
  lifetimeSpendPaise = 0,
  initialSubTab = "active",
  onRefresh,
  onOpenRateModal,
  onNavigateTab,
  onShareReceiptWhatsApp,
}: PortalOrdersViewProps) {
  const [subTab, setSubTab] = useState<"active" | "past">(
    initialSubTab === "past" || activeOrders.length === 0 ? "past" : "active"
  );

  React.useEffect(() => {
    if (initialSubTab === "past") {
      setSubTab("past");
    } else if (activeOrders.length > 0) {
      setSubTab("active");
    } else {
      setSubTab("past");
    }
  }, [initialSubTab, activeOrders.length]);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  return (
    <Stack gap="md" pb={30}>
      {/* ─── Active Live Dining Banner ─── */}
      {activeOrders.length > 0 && (
        <Paper
          p="sm"
          radius="md"
          withBorder
          onClick={() => onNavigateTab("live")}
          style={{
            background: "linear-gradient(135deg, rgba(255, 107, 107, 0.1) 0%, rgba(255, 235, 235, 0.8) 100%)",
            borderColor: "rgba(255, 107, 107, 0.4)",
            cursor: "pointer",
            boxShadow: "0 4px 14px rgba(255, 107, 107, 0.1)",
          }}
        >
          <Group justify="space-between" align="center">
            <Group gap="xs">
              <ThemeIcon color="red" variant="filled" size="sm" radius="xl">
                <IconFlame size={14} />
              </ThemeIcon>
              <div>
                <Text size="xs" fw={700} c="red.9">
                  Live Dining Session Active ({activeOrders.length} order{activeOrders.length > 1 ? "s" : ""})
                </Text>
                <Text size="11px" c="dimmed">
                  Table {activeOrders[0]?.tableNo || "Dine-in"} • Kitchen prep status & waiter call
                </Text>
              </div>
            </Group>
            <Button size="compact-xs" color="red" variant="filled" radius="md" rightSection={<IconChevronRight size={12} />}>
              Open Live
            </Button>
          </Group>
        </Paper>
      )}

      {/* ─── Top Segmented Filter ─── */}
      <SegmentedControl
        fullWidth
        value={subTab}
        onChange={(val) => setSubTab(val as "active" | "past")}
        radius="xl"
        size="xs"
        color="dinePrimary"
        data={[
          {
            value: "active",
            label: (
              <Group gap={6} justify="center" wrap="nowrap">
                <IconFlame size={14} color={subTab === "active" ? "#fff" : "#e67700"} />
                <span>Active</span>
                {activeOrders.length > 0 && (
                  <Badge size="xs" circle color="orange">
                    {activeOrders.length}
                  </Badge>
                )}
              </Group>
            ),
          },
          {
            value: "past",
            label: (
              <Group gap={6} justify="center" wrap="nowrap">
                <IconHistory size={14} />
                <span>Past ({pastOrders.length})</span>
              </Group>
            ),
          },
        ]}
      />

      {/* ─── SUB-TAB 1: ACTIVE ORDERS ─── */}
      {subTab === "active" && (
        <Stack gap="md">
          {activeOrders.length === 0 ? (
            <Paper p="xl" radius="xl" withBorder style={{ textAlign: "center", background: "#fff" }}>
              <Stack align="center" gap="sm">
                <ThemeIcon size={60} radius="xl" color="orange" variant="light">
                  <IconToolsKitchen2 size={32} />
                </ThemeIcon>
                <Title order={3} style={{ fontSize: "1.2rem", fontWeight: 700 }}>
                  No Active Orders Right Now
                </Title>
                <Text c="dimmed" size="sm" maw={420} mx="auto">
                  You are not currently dining at any table. When you scan a table QR code or place a takeaway or delivery order, your live cooking updates and bill tracking appear here automatically.
                </Text>
                <Group gap="xs" mt="xs">
                  <Button
                    variant="light"
                    color="dinePrimary"
                    size="sm"
                    radius="md"
                    onClick={() => setSubTab("past")}
                    leftSection={<IconHistory size={16} />}
                  >
                    View Order History ({pastOrders.length} visits)
                  </Button>
                </Group>
              </Stack>
            </Paper>
          ) : (
            activeOrders.map((order) => (
              <ActiveOrderCard key={order.id} order={order} onRefresh={onRefresh} />
            ))
          )}
        </Stack>
      )}

      {/* ─── SUB-TAB 2: PAST VISITS & RECEIPTS ─── */}
      {subTab === "past" && (
        <Stack gap="sm">
          {/* Header Stats */}
          <Paper p="sm" radius="md" withBorder style={{ background: "#fdfbff" }}>
            <Group justify="space-between" align="center" wrap="wrap">
              <Group gap="xs">
                <ThemeIcon size="md" radius="xl" color="dinePrimary" variant="light">
                  <IconReceipt size={16} />
                </ThemeIcon>
                <div>
                  <Text size="xs" c="dimmed" fw={600}>
                    Completed Dining Visits
                  </Text>
                  <Text size="sm" fw={800}>
                    {pastOrders.length} {pastOrders.length === 1 ? "Visit" : "Visits"}
                  </Text>
                </div>
              </Group>
              <Box style={{ textAlign: "right" }}>
                <Text size="xs" c="dimmed" fw={600}>
                  Total Settled Spend
                </Text>
                <Text size="sm" fw={800} style={{ color: "#af73d7" }}>
                  {formatINR(lifetimeSpendPaise)}
                </Text>
              </Box>
            </Group>
          </Paper>

          {/* Past Orders List */}
          {pastOrders.length === 0 ? (
            <Paper p="xl" radius="xl" withBorder style={{ textAlign: "center", background: "#fff" }}>
              <Stack align="center" gap="sm">
                <ThemeIcon size={56} radius="xl" color="gray" variant="light">
                  <IconReceipt size={30} />
                </ThemeIcon>
                <Title order={3} style={{ fontSize: "1.2rem", fontWeight: 700 }}>
                  No Past Orders Found
                </Title>
                <Text c="dimmed" size="sm" maw={420} mx="auto">
                  When your dining bills are paid and settled, your full receipts, dish ratings, and restaurant replies will be preserved here.
                </Text>
              </Stack>
            </Paper>
          ) : (
            pastOrders.map((order) => {
              const isExpanded = !!expandedOrders[order.id];
              const totalPaid = order.paidPaise || order.subtotalPaise || 0;
              const restaurantName = order.restaurantName || order.outlet?.restaurantName || "Restaurant";
              const outletName = order.outletName || order.outlet?.name || "";
              const isDelivery =
                order.orderType === "DELIVERY" ||
                (order.tableNo || "").toLowerCase() === "delivery" ||
                Boolean(order.delivery);
              const isTakeaway =
                (order.tableNo || "").toLowerCase() === "takeaway" ||
                order.orderType === "TAKEAWAY";

              const itemsSubtotalPaise = order.items.reduce(
                (sum, it) => sum + (it.pricePaise || 0) * (it.qty || 1),
                0
              );
              const packagingChargePaise = order.packagingChargePaise || 0;
              const deliveryChargePaise = order.deliveryChargePaise || 0;
              const discountPaise = Math.max(
                0,
                itemsSubtotalPaise + packagingChargePaise + deliveryChargePaise - totalPaid
              );

              return (
                <Card
                  key={order.id}
                  radius="lg"
                  withBorder
                  p={0}
                  style={{
                    background: "#fff",
                    overflow: "hidden",
                    borderColor: isExpanded ? "#af73d7" : "rgba(0,0,0,0.08)",
                    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                    boxShadow: isExpanded ? "0 4px 16px rgba(175, 115, 215, 0.12)" : "none",
                  }}
                >
                  {/* Collapsed Header Bar */}
                  <Box
                    p="sm"
                    onClick={() => toggleOrderExpand(order.id)}
                    style={{
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    <Group justify="space-between" align="center" wrap="nowrap" gap="xs">
                      {/* Left Details */}
                      <Group gap="xs" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                        <Box style={{ minWidth: 0 }}>
                          <Group gap={6} align="center" wrap="wrap">
                            <Text fw={700} size="sm" lineClamp={1}>
                              {restaurantName}
                            </Text>
                            {outletName && (
                              <Badge size="xs" variant="light" color="gray">
                                {outletName}
                              </Badge>
                            )}
                          </Group>

                          <Group gap={6} mt={2} align="center" wrap="wrap">
                            <Text size="xs" c="dimmed">
                              {formatDate(order.settledAt || order.createdAt)}
                            </Text>
                            <Text size="xs" c="dimmed">•</Text>
                            <Badge color="violet" variant="light" size="xs">
                              Token #{order.tokenNo || order.orderNo || "—"}
                            </Badge>
                            <Text size="xs" c="dimmed">•</Text>
                            {isDelivery ? (
                              <Badge size="xs" color="teal" variant="light" leftSection={<IconMotorbike size={11} />}>
                                Delivery
                              </Badge>
                            ) : isTakeaway ? (
                              <Badge size="xs" color="teal" variant="light" leftSection={<IconShoppingBag size={11} />}>
                                Takeaway
                              </Badge>
                            ) : (
                              <Badge size="xs" color="gray" variant="outline" leftSection={<IconToolsKitchen2 size={11} />}>
                                Table {order.tableNo}
                              </Badge>
                            )}
                            <Badge size="xs" color="green" variant="light">
                              {order.method || "Paid"}
                            </Badge>

                            {/* Rating badge */}
                            {order.feedback ? (
                              <Badge
                                size="xs"
                                color="yellow"
                                variant="light"
                                leftSection={<IconStar size={10} fill="currentColor" />}
                                style={{ cursor: "pointer" }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenRateModal(order);
                                }}
                              >
                                {order.feedback.rating}.0 ★
                              </Badge>
                            ) : (
                              <Badge
                                size="xs"
                                color="yellow"
                                variant="outline"
                                style={{ cursor: "pointer" }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenRateModal(order);
                                }}
                              >
                                ★ Rate
                              </Badge>
                            )}
                          </Group>
                        </Box>
                      </Group>

                      {/* Right Amount + Chevron */}
                      <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
                        <Box style={{ textAlign: "right" }}>
                          <Text fw={800} size="sm" style={{ color: "#2f9e44" }}>
                            {formatINR(totalPaid)}
                          </Text>
                          <Text size="11px" c="dimmed">
                            {order.items?.length || 0} {order.items?.length === 1 ? "item" : "items"}
                          </Text>
                        </Box>
                        {isExpanded ? (
                          <IconChevronUp size={18} color="#868e96" />
                        ) : (
                          <IconChevronDown size={18} color="#868e96" />
                        )}
                      </Group>
                    </Group>
                  </Box>

                  {/* Expandable Receipt & Review Details */}
                  <Collapse expanded={isExpanded}>
                    <Divider color="gray.1" />
                    <Box p="sm" style={{ background: "#fdfdfd" }}>
                      <Stack gap="xs">
                        <Text size="11px" fw={700} c="dimmed" style={{ textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          Itemized Receipt
                        </Text>

                        {/* Items list */}
                        <Stack gap={6}>
                          {order.items.map((it) => (
                            <Group key={it.id} justify="space-between" align="center" wrap="nowrap">
                              <Group gap="xs" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                                <Badge size="xs" variant="light" color="gray">
                                  {it.qty} ×
                                </Badge>
                                <VegNonVegIcon isNonVeg={it.isNonVeg} size={13} />
                                <Box style={{ minWidth: 0 }}>
                                  <Text size="xs" fw={600} lineClamp={1}>
                                    {it.name}
                                  </Text>
                                  {it.variant && (
                                    <Text size="10px" c="dimmed">
                                      {typeof it.variant === "object" ? it.variant.name : it.variant}
                                    </Text>
                                  )}
                                </Box>
                              </Group>
                              <Text size="xs" fw={700}>
                                {formatINR((it.pricePaise || 0) * (it.qty || 1))}
                              </Text>
                            </Group>
                          ))}
                        </Stack>

                        <Divider my={4} />

                        {/* Totals Breakdown */}
                        <Stack gap={2}>
                          <Group justify="space-between" align="center">
                            <Text size="xs" c="dimmed">Items Subtotal ({order.items.length} items)</Text>
                            <Text size="xs">{formatINR(itemsSubtotalPaise)}</Text>
                          </Group>
                          {packagingChargePaise > 0 && (
                            <Group justify="space-between" align="center">
                              <Text size="xs" c="dimmed">Packaging Charge</Text>
                              <Text size="xs">{formatINR(packagingChargePaise)}</Text>
                            </Group>
                          )}
                          {deliveryChargePaise > 0 && (
                            <Group justify="space-between" align="center">
                              <Text size="xs" c="dimmed">Delivery Fee</Text>
                              <Text size="xs">{formatINR(deliveryChargePaise)}</Text>
                            </Group>
                          )}
                          {discountPaise > 0 && (
                            <Group justify="space-between" align="center">
                              <Text size="xs" c="green.7">Discount Applied</Text>
                              <Text size="xs" c="green.7">-{formatINR(discountPaise)}</Text>
                            </Group>
                          )}
                          <Group justify="space-between" align="center" mt={4}>
                            <Text size="xs" fw={800}>Total Paid via {order.method || "Payment"}</Text>
                            <Text size="xs" fw={800} style={{ color: "#2f9e44" }}>
                              {formatINR(totalPaid)}
                            </Text>
                          </Group>
                        </Stack>

                        {/* Customer Review Section */}
                        {order.feedback && (
                          <Paper p="xs" radius="sm" style={{ backgroundColor: "#fff9db", border: "1px solid #ffe066" }}>
                            <Group justify="space-between" align="center" mb={4}>
                              <Group gap={6}>
                                <Rating value={order.feedback.rating} readOnly size="xs" color="yellow" />
                                <Text size="xs" fw={700}>
                                  {order.feedback.rating}.0 ★ • {order.feedback.isAnonymous ? "Anonymous Review" : "Your Review"}
                                </Text>
                              </Group>
                              <Button
                                size="compact-xs"
                                variant="subtle"
                                color="dark"
                                leftSection={<IconEdit size={12} />}
                                onClick={() => onOpenRateModal(order)}
                              >
                                Edit
                              </Button>
                            </Group>
                            {Array.isArray(order.feedback.tags) && order.feedback.tags.length > 0 && (
                              <Group gap={4} mb={4} wrap="wrap">
                                {order.feedback.tags.map((t: string) => (
                                  <Badge key={t} size="xs" variant="outline" color="dark.4">
                                    {t}
                                  </Badge>
                                ))}
                              </Group>
                            )}
                            {order.feedback.comment && (
                              <Text size="xs" c="dark.5" style={{ fontStyle: "italic" }}>
                                "{order.feedback.comment}"
                              </Text>
                            )}
                            {order.feedback.ownerReply && (
                              <Box mt="xs" p="xs" style={{ background: "#e8f5e9", borderRadius: 4, borderLeft: "3px solid #2e7d32" }}>
                                <Text size="11px" fw={700} c="green.9">Restaurant Message:</Text>
                                <Text size="xs" c="dark.6">"{order.feedback.ownerReply}"</Text>
                              </Box>
                            )}
                          </Paper>
                        )}

                        {/* Card Footer Actions */}
                        <Group justify="space-between" align="center" mt="xs" wrap="wrap" gap="xs">
                          {order.feedback ? (
                            <Button
                              size="xs"
                              variant="light"
                              color="yellow"
                              leftSection={<IconEdit size={13} />}
                              onClick={() => onOpenRateModal(order)}
                            >
                              Edit Review
                            </Button>
                          ) : (
                            <Button
                              size="xs"
                              color="dinePrimary"
                              variant="filled"
                              leftSection={<IconStar size={14} />}
                              onClick={() => onOpenRateModal(order)}
                            >
                              Rate & Feedback
                            </Button>
                          )}

                          <Button
                            size="xs"
                            variant="light"
                            color="teal"
                            leftSection={<IconBrandWhatsapp size={14} />}
                            onClick={() => onShareReceiptWhatsApp(order)}
                          >
                            Share Receipt via WhatsApp
                          </Button>
                        </Group>
                      </Stack>
                    </Box>
                  </Collapse>
                </Card>
              );
            })
          )}
        </Stack>
      )}
    </Stack>
  );
}
