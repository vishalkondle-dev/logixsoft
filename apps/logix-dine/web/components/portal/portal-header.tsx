"use client";

import React from "react";
import {
  Group,
  Text,
  Badge,
  ActionIcon,
  Avatar,
  Box,
  Tooltip,
  Paper,
  UnstyledButton,
} from "@mantine/core";
import {
  IconRefresh,
  IconToolsKitchen2,
  IconCrown,
  IconStar,
  IconHeart,
  IconMapPin,
  IconChevronRight,
  IconBellRinging,
  IconBuildingStore,
  IconMotorbike,
  IconArrowRight,
} from "@tabler/icons-react";
import Link from "next/link";
import type { CustomerPortalOrder } from "@/lib/api-client";

interface PortalHeaderProps {
  customerName?: string | null;
  phoneNumber?: string | null;
  restaurantName?: string;
  outletName?: string;
  activeOrders?: CustomerPortalOrder[];
  isRefetching?: boolean;
  onRefresh?: () => void;
  onSelectActiveOrder?: () => void;
  onOpenProfile?: () => void;
  staffRole?: string | null;
  activeOutletId?: string | null;
}

export function PortalHeader({
  customerName,
  restaurantName,
  outletName,
  activeOrders = [],
  isRefetching,
  onRefresh,
  onSelectActiveOrder,
  onOpenProfile,
  staffRole,
  activeOutletId,
}: PortalHeaderProps) {
  const primaryActiveOrder = activeOrders[0];
  const activeRestaurantName = primaryActiveOrder?.restaurantName || restaurantName;
  const activeOutletName = primaryActiveOrder?.outletName || outletName;
  const hasActiveRestaurant = Boolean(activeRestaurantName);
  const isDelivery =
    primaryActiveOrder?.orderType === "DELIVERY" ||
    (primaryActiveOrder?.tableNo || "").toLowerCase() === "delivery" ||
    Boolean(primaryActiveOrder?.delivery);
  const isTakeaway =
    (primaryActiveOrder?.tableNo || "").toLowerCase() === "takeaway" ||
    primaryActiveOrder?.orderType === "TAKEAWAY";

  return (
    <Box mb="md">
      {/* ─── Staff Role Quick-Switch Banner (only shown if user is staff) ─── */}
      {staffRole && ["WAITER", "KITCHEN", "RIDER", "OWNER", "MANAGER"].includes(staffRole) && (
        <Paper
          p="xs"
          mb="sm"
          radius="md"
          withBorder
          style={{
            background: "rgba(175, 115, 215, 0.08)",
            borderColor: "rgba(175, 115, 215, 0.35)",
          }}
        >
          <Group justify="space-between" align="center" wrap="wrap" gap="xs">
            <Group gap="xs">
              <Avatar size="sm" radius="md" color="dinePrimary" variant="light">
                {staffRole === "WAITER" ? <IconBellRinging size={15} /> :
                 staffRole === "KITCHEN" ? <IconToolsKitchen2 size={15} /> :
                 staffRole === "RIDER" ? <IconMotorbike size={15} /> :
                 <IconBuildingStore size={15} />}
              </Avatar>
              <div>
                <Text size="xs" fw={700} c="dark.9">
                  Staff Shift: {staffRole}
                </Text>
                <Text size="11px" c="dimmed">
                  Signed in with staff privileges.
                </Text>
              </div>
            </Group>
            <ActionIcon
              component={Link}
              href={
                staffRole === "WAITER" ? (activeOutletId ? `/waiter?outletId=${activeOutletId}` : "/waiter") :
                staffRole === "KITCHEN" ? (activeOutletId ? `/kitchen?outletId=${activeOutletId}` : "/kitchen") :
                staffRole === "RIDER" ? (activeOutletId ? `/rider?outletId=${activeOutletId}` : "/rider") :
                (activeOutletId ? `/pos?outletId=${activeOutletId}` : "/pos")
              }
              size="sm"
              color="dinePrimary"
              variant="light"
              radius="md"
              aria-label="Switch to staff mode"
            >
              <IconArrowRight size={14} />
            </ActionIcon>
          </Group>
        </Paper>
      )}

      {/* ─── Modern App Bar ─── */}
      <Paper
        p="sm"
        radius="lg"
        withBorder
        style={{
          background: "rgba(255, 255, 255, 0.85)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderColor: "rgba(0, 0, 0, 0.06)",
          boxShadow: "0 2px 12px rgba(0, 0, 0, 0.03)",
        }}
      >
        <Group justify="space-between" align="center" wrap="nowrap" gap="xs">
          {/* Restaurant & Outlet Indicator */}
          <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
            <Box
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: "linear-gradient(135deg, #7950f2 0%, #af73d7 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                flexShrink: 0,
                boxShadow: "0 4px 10px rgba(121, 80, 242, 0.25)",
              }}
            >
              <IconToolsKitchen2 size={20} />
            </Box>
            <Box style={{ minWidth: 0 }}>
              <Text fw={800} size="sm" lineClamp={1} style={{ letterSpacing: "-0.2px" }}>
                {hasActiveRestaurant ? activeRestaurantName : "Logix Dine"}
              </Text>
              <Group gap={4} wrap="nowrap" align="center">
                {hasActiveRestaurant ? (
                  <>
                    <IconMapPin size={11} color="#868e96" />
                    <Text size="11px" c="dimmed" lineClamp={1}>
                      {activeOutletName}
                    </Text>
                  </>
                ) : (
                  <Text size="11px" c="dimmed" lineClamp={1}>
                    Guest Dining Portal
                  </Text>
                )}
              </Group>
            </Box>
          </Group>

          {/* Right Section: Live Order Pill + Refresh + Avatar */}
          <Group gap={8} wrap="nowrap" align="center">
            {primaryActiveOrder && (
              <UnstyledButton
                onClick={onSelectActiveOrder}
                style={{
                  background: "rgba(43, 138, 62, 0.08)",
                  border: "1px solid rgba(43, 138, 62, 0.25)",
                  borderRadius: 9999,
                  padding: "4px 8px",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                }}
              >
                <Box
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#2f9e44",
                    boxShadow: "0 0 0 2px rgba(47, 158, 68, 0.2)",
                  }}
                />
                <Text size="11px" fw={700} c="green.9" visibleFrom="xs">
                  {isDelivery ? "Delivery Live" : isTakeaway ? "Takeaway Live" : `Table ${primaryActiveOrder.tableNo || "TG3"}`}
                </Text>
                <Text size="10px" fw={700} c="green.9" hiddenFrom="xs">
                  Live
                </Text>
                <IconChevronRight size={12} color="#2f9e44" />
              </UnstyledButton>
            )}

            <Tooltip label="Refresh dining updates">
              <ActionIcon
                variant="subtle"
                color="gray"
                size="md"
                radius="md"
                onClick={onRefresh}
                loading={isRefetching}
                aria-label="Refresh orders"
              >
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>

            {/* Profile Avatar */}
            <UnstyledButton onClick={onOpenProfile} style={{ cursor: "pointer" }}>
              <Avatar
                size="md"
                radius="xl"
                color="dinePrimary"
                style={{
                  border: "2px solid #7950f2",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                {customerName ? customerName.slice(0, 2).toUpperCase() : "G"}
              </Avatar>
            </UnstyledButton>
          </Group>
        </Group>
      </Paper>
    </Box>
  );
}
