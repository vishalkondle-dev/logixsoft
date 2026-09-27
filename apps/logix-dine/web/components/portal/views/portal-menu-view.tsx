"use client";

import React, { useState, useMemo } from "react";
import {
  Stack,
  TextInput,
  Group,
  SegmentedControl,
  Chip,
  Paper,
  Text,
  Title,
  Card,
  Badge,
  Button,
  SimpleGrid,
  Loader,
  Center,
  Box,
  Divider,
} from "@mantine/core";
import {
  IconSearch,
  IconToolsKitchen2,
  IconPlus,
  IconStar,
  IconFlame,
  IconFilter,
  IconShoppingBag,
} from "@tabler/icons-react";
import { VegNonVegIcon } from "@/components/common/veg-nonveg-icon";
import { useCustomerOutletMenu } from "@/lib/queries";
import type { CustomerMenuItem, CustomerPortalOrder } from "@/lib/api-client";

interface PortalMenuViewProps {
  outletId?: string | null;
  restaurantName?: string;
  outletName?: string;
  activeOrder?: CustomerPortalOrder | null;
  pastOrders?: CustomerPortalOrder[];
  onOpenOrderMore?: (order: CustomerPortalOrder) => void;
}

function formatINR(paise?: number | null): string {
  if (paise == null) return "₹0.00";
  return `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function PortalMenuView({
  outletId,
  restaurantName,
  outletName,
  activeOrder,
  pastOrders = [],
  onOpenOrderMore,
}: PortalMenuViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [dietaryFilter, setDietaryFilter] = useState<"all" | "veg" | "nonveg">("all");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");

  const visitedOutlets = useMemo(() => {
    if (!pastOrders || pastOrders.length === 0) return [];
    const map = new Map<string, { id: string; name: string; restaurantName: string }>();
    for (const o of pastOrders) {
      if (o.outletId && !map.has(o.outletId)) {
        map.set(o.outletId, {
          id: o.outletId,
          name: o.outletName || "Outlet",
          restaurantName: o.restaurantName || "Restaurant",
        });
      }
    }
    return Array.from(map.values());
  }, [pastOrders]);

  const [selectedOutletIdState, setSelectedOutletIdState] = useState<string | null>(null);

  const effectiveOutletId =
    activeOrder?.outletId ||
    outletId ||
    selectedOutletIdState ||
    visitedOutlets[0]?.id ||
    null;

  const currentOutletMeta = useMemo(() => {
    if (activeOrder) {
      return {
        restaurantName: activeOrder.restaurantName || restaurantName,
        outletName: activeOrder.outletName || outletName,
      };
    }
    const found = visitedOutlets.find((vo) => vo.id === effectiveOutletId);
    if (found) {
      return {
        restaurantName: found.restaurantName,
        outletName: found.name,
      };
    }
    return {
      restaurantName: restaurantName || null,
      outletName: outletName || null,
    };
  }, [activeOrder, effectiveOutletId, visitedOutlets, restaurantName, outletName]);

  const { data: menuData, isLoading: menuLoading } = useCustomerOutletMenu(effectiveOutletId);

  const categories = menuData?.categories || [];
  const items = menuData?.items || [];

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Category filter
      if (selectedCategoryId !== "all" && item.categoryId !== selectedCategoryId) {
        return false;
      }
      // Dietary filter
      if (dietaryFilter === "veg" && item.isNonVeg) return false;
      if (dietaryFilter === "nonveg" && !item.isNonVeg) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesDesc = (item.description || "").toLowerCase().includes(q);
        if (!matchesName && !matchesDesc) return false;
      }
      return true;
    });
  }, [items, selectedCategoryId, dietaryFilter, searchQuery]);

  return (
    <Stack gap="md" pb={40}>
      {/* ─── Search & Dietary Filters ─── */}
      <Paper p="sm" radius="lg" withBorder style={{ background: "#fff" }}>
        <Stack gap="xs">
          <TextInput
            placeholder="Search curries, breads, desserts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            leftSection={<IconSearch size={16} color="#868e96" />}
            radius="xl"
            size="sm"
          />

          <Group justify="space-between" align="center" wrap="wrap" gap="xs">
            <SegmentedControl
              value={dietaryFilter}
              onChange={(val) => setDietaryFilter(val as "all" | "veg" | "nonveg")}
              radius="xl"
              size="xs"
              data={[
                { value: "all", label: "All Items" },
                {
                  value: "veg",
                  label: (
                    <Group gap={4} wrap="nowrap">
                      <VegNonVegIcon isNonVeg={false} size={11} />
                      <span>Pure Veg</span>
                    </Group>
                  ),
                },
                {
                  value: "nonveg",
                  label: (
                    <Group gap={4} wrap="nowrap">
                      <VegNonVegIcon isNonVeg={true} size={11} />
                      <span>Non-Veg</span>
                    </Group>
                  ),
                },
              ]}
            />

            <Text size="11px" c="dimmed">
              Showing {filteredItems.length} dishes
            </Text>
          </Group>
        </Stack>
      </Paper>

      {/* ─── Category Scrolling Chips ─── */}
      {categories.length > 0 && (
        <Box style={{ overflowX: "auto", whiteSpace: "nowrap", paddingBottom: 4 }}>
          <Group gap={6} wrap="nowrap">
            <Chip
              checked={selectedCategoryId === "all"}
              onChange={() => setSelectedCategoryId("all")}
              size="xs"
              radius="xl"
              variant="filled"
              color="dinePrimary"
            >
              All Categories
            </Chip>
            {categories.map((cat) => (
              <Chip
                key={cat.id}
                checked={selectedCategoryId === cat.id}
                onChange={() => setSelectedCategoryId(cat.id)}
                size="xs"
                radius="xl"
                variant="filled"
                color="dinePrimary"
              >
                {cat.name}
              </Chip>
            ))}
          </Group>
        </Box>
      )}

      {/* ─── Outlet Context or Switcher ─── */}
      {activeOrder ? (
        <Paper
          p="xs"
          radius="md"
          withBorder
          style={{
            background: "rgba(43, 138, 62, 0.08)",
            borderColor: "rgba(43, 138, 62, 0.3)",
          }}
        >
          <Group justify="space-between" align="center" wrap="wrap" gap="xs">
            <Group gap="xs">
              <VegNonVegIcon isNonVeg={false} size={14} />
              <Text size="xs" fw={700} c="green.9">
                Seated at Table {activeOrder.tableNo || "TG3"} • {activeOrder.restaurantName || "Restaurant"}
              </Text>
            </Group>
            {onOpenOrderMore && (
              <Button
                size="compact-xs"
                color="green"
                variant="filled"
                radius="xl"
                onClick={() => onOpenOrderMore(activeOrder)}
              >
                Open Order Drawer
              </Button>
            )}
          </Group>
        </Paper>
      ) : visitedOutlets.length > 0 ? (
        <Paper p="xs" radius="md" withBorder style={{ background: "#fdfbff" }}>
          <Group justify="space-between" align="center" wrap="wrap" gap="xs">
            <Group gap={6}>
              <IconToolsKitchen2 size={15} color="#7950f2" />
              <Text size="xs" fw={700}>
                Browsing Menu: {currentOutletMeta.restaurantName || "Restaurant"}
                {currentOutletMeta.outletName ? ` • ${currentOutletMeta.outletName}` : ""}
              </Text>
            </Group>
            {visitedOutlets.length > 1 && (
              <Group gap={4}>
                {visitedOutlets.map((vo) => (
                  <Button
                    key={vo.id}
                    size="compact-xs"
                    variant={effectiveOutletId === vo.id ? "filled" : "light"}
                    color="dinePrimary"
                    radius="xl"
                    onClick={() => setSelectedOutletIdState(vo.id)}
                  >
                    {vo.restaurantName}
                  </Button>
                ))}
              </Group>
            )}
          </Group>
        </Paper>
      ) : null}

      {/* ─── Items List ─── */}
      {menuLoading ? (
        <Center py={60}>
          <Loader size="md" color="dinePrimary" />
        </Center>
      ) : filteredItems.length === 0 ? (
        <Paper p="xl" radius="lg" withBorder style={{ textAlign: "center", background: "#fff" }}>
          <Text c="dimmed" size="sm">
            No dishes found matching your search. Try adjusting filters.
          </Text>
        </Paper>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {filteredItems.map((item) => {
            const hasRating = (item.ratingCount ?? 0) > 0;
            const price = item.pricePaise || 0;

            return (
              <Paper
                key={item.id}
                p="md"
                radius="lg"
                withBorder
                style={{
                  background: "#fff",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  transition: "border-color 0.2s ease",
                }}
              >
                <Box>
                  <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
                    <Group gap="xs" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                      <VegNonVegIcon isNonVeg={item.isNonVeg} size={15} />
                      <Box style={{ minWidth: 0 }}>
                        <Text fw={700} size="sm" lineClamp={1}>
                          {item.name}
                        </Text>
                        <Text size="11px" c="dimmed" lineClamp={2} mt={2}>
                          {item.description || "Freshly cooked to perfection with authentic herbs and spices."}
                        </Text>
                      </Box>
                    </Group>

                    {/* Dish Rating Badge */}
                    {hasRating ? (
                      <Badge
                        size="xs"
                        color="yellow"
                        variant="light"
                        leftSection={<IconStar size={10} fill="currentColor" />}
                        style={{ flexShrink: 0 }}
                      >
                        {Number(item.ratingAvg).toFixed(1)} ({item.ratingCount})
                      </Badge>
                    ) : (
                      <Badge size="xs" color="gray" variant="light" style={{ flexShrink: 0 }}>
                        New
                      </Badge>
                    )}
                  </Group>
                </Box>

                <Group justify="space-between" align="center" mt="md">
                  <Text fw={800} size="sm" c="dark.9">
                    {formatINR(price)}
                  </Text>

                  {activeOrder && onOpenOrderMore && (
                    <Button
                      size="compact-xs"
                      color="dinePrimary"
                      variant="light"
                      radius="xl"
                      leftSection={<IconPlus size={12} />}
                      onClick={() => onOpenOrderMore(activeOrder)}
                    >
                      Add to Table
                    </Button>
                  )}
                </Group>
              </Paper>
            );
          })}
        </SimpleGrid>
      )}
    </Stack>
  );
}
