"use client";

import React, { useState, useMemo } from "react";
import {
  Box,
  Stack,
  Group,
  TextInput,
  SegmentedControl,
  Badge,
  Card,
  Title,
  Text,
  Button,
  SimpleGrid,
  ActionIcon,
  Paper,
  Divider,
  ScrollArea,
  Skeleton,
  ThemeIcon,
  Center,
} from "@mantine/core";
import {
  IconSearch,
  IconX,
  IconMapPin,
  IconFlame,
  IconCalendar,
  IconShoppingBag,
  IconStar,
  IconShieldCheck,
  IconCar,
  IconClock,
  IconChevronRight,
  IconCurrentLocation,
  IconToolsKitchen2,
  IconSparkles,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { VegNonVegIcon } from "@/components/common/veg-nonveg-icon";
import {
  getMarketplaceExplore,
  type MarketplaceOutletItem,
  type MarketplaceExploreResponse,
} from "@/lib/api-client";
import { OutletMenuDrawer } from "./outlet-menu-drawer";
import { WaitlistQuickJoinModal } from "./waitlist-quick-join-modal";
import { ReservationModal } from "@/components/portal/reservation-modal";
import { useAuth } from "@/lib/auth-context";

function formatINR(paise?: number | null): string {
  if (paise == null) return "₹0";
  return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
}

export function MarketplaceExplore() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCuisine, setSelectedCuisine] = useState("ALL");
  const [diningMode, setDiningMode] = useState<"ALL" | "DINE_IN" | "TAKEAWAY" | "DELIVERY">("ALL");
  const [vegOnly, setVegOnly] = useState(false);
  const [freeTablesOnly, setFreeTablesOnly] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState("Hyderabad (Jubilee & Banjara Hills)");

  // Drawer / Modal states
  const [activeOutletMenu, setActiveOutletMenu] = useState<{
    id: string;
    name: string;
    restaurantName: string;
  } | null>(null);

  const [activeWaitlistOutlet, setActiveWaitlistOutlet] = useState<{
    outletId: string;
    restaurantId: string;
    outletName: string;
    restaurantName: string;
    avgWaitMinutes: number;
    currentQueueCount: number;
  } | null>(null);

  const [activeReservationOutlet, setActiveReservationOutlet] = useState<{
    outletId: string;
    restaurantId: string;
  } | null>(null);

  const { data, isLoading } = useQuery<MarketplaceExploreResponse>({
    queryKey: [
      "marketplaceExplore",
      searchQuery,
      selectedCuisine,
      diningMode,
      vegOnly,
      freeTablesOnly,
    ],
    queryFn: () =>
      getMarketplaceExplore({
        q: searchQuery.trim() || undefined,
        cuisine: selectedCuisine !== "ALL" ? selectedCuisine : undefined,
        mode: diningMode,
        vegOnly: vegOnly || undefined,
        openOnly: freeTablesOnly || undefined,
      }),
    refetchInterval: 12000, // live radar updates every 12 seconds
  });

  const outlets = data?.outlets || [];
  const cuisines = data?.cuisines || [];
  const heroBanners = data?.heroBanners || [];

  return (
    <Box>
      <Stack gap="md">
        {/* ─── 1. Location Bar & Direct Guarantee ─── */}
        <Paper
          p="xs"
          radius="md"
          withBorder
          style={{
            background: "linear-gradient(135deg, #ffffff 0%, #fbfaff 100%)",
            borderColor: "rgba(121, 80, 242, 0.2)",
          }}
        >
          <Group justify="space-between" align="center" wrap="wrap" gap="xs">
            <Group gap={6} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
              <ThemeIcon size="sm" radius="xl" color="dinePrimary" variant="light" style={{ flexShrink: 0 }}>
                <IconMapPin size={13} />
              </ThemeIcon>
              <div style={{ minWidth: 0 }}>
                <Text size="10px" c="dimmed" fw={700} lh={1.1} style={{ letterSpacing: "0.5px" }}>
                  DINING IN
                </Text>
                <Text size="xs" fw={700} lineClamp={1}>
                  {selectedLocation}
                </Text>
              </div>
            </Group>
            <Badge size="xs" color="teal" variant="light" style={{ flexShrink: 0 }} leftSection={<IconShieldCheck size={11} />}>
              Direct Kitchen Rates
            </Badge>
          </Group>
        </Paper>

        {/* ─── 2. Search Input & Mode Filter ─── */}
        <Stack gap="xs">
          <TextInput
            placeholder="Search biryani, pizza, cold brew, or restaurants..."
            leftSection={<IconSearch size={16} color="#868e96" />}
            rightSection={
              searchQuery ? (
                <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => setSearchQuery("")}>
                  <IconX size={13} />
                </ActionIcon>
              ) : null
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            radius="md"
            size="md"
            styles={{
              input: {
                backgroundColor: "#ffffff",
                boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
              },
            }}
          />

          {/* Dining Modes Segmented Control */}
          <SegmentedControl
            fullWidth
            value={diningMode}
            onChange={(v) => setDiningMode(v as any)}
            data={[
              { label: "All", value: "ALL" },
              { label: "Dine-In", value: "DINE_IN" },
              { label: "Takeaway", value: "TAKEAWAY" },
              { label: "Delivery", value: "DELIVERY" },
            ]}
            color="dinePrimary"
            radius="md"
            size="xs"
          />

          {/* Quick Filter Badges */}
          <Group
            gap={6}
            wrap="nowrap"
            style={{
              overflowX: "auto",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              WebkitOverflowScrolling: "touch",
              paddingBottom: 4,
            }}
          >
            <Badge
              size="sm"
              variant={vegOnly ? "filled" : "outline"}
              color="green"
              style={{ cursor: "pointer", userSelect: "none", flexShrink: 0 }}
              onClick={() => setVegOnly(!vegOnly)}
            >
              🌱 Pure Veg Only
            </Badge>
            <Badge
              size="sm"
              variant={freeTablesOnly ? "filled" : "outline"}
              color="teal"
              style={{ cursor: "pointer", userSelect: "none", flexShrink: 0 }}
              onClick={() => setFreeTablesOnly(!freeTablesOnly)}
            >
              ⚡ Tables Free Now
            </Badge>
            {cuisines.map((c) => (
              <Badge
                key={c}
                size="sm"
                variant={selectedCuisine === c ? "filled" : "light"}
                color={selectedCuisine === c ? "dinePrimary" : "gray"}
                style={{ cursor: "pointer", whiteSpace: "nowrap", userSelect: "none", flexShrink: 0 }}
                onClick={() => setSelectedCuisine(selectedCuisine === c ? "ALL" : c)}
              >
                {c}
              </Badge>
            ))}
          </Group>
        </Stack>

        {/* ─── 3. Hero Promo Banner ─── */}
        {!searchQuery && (
          <Paper
            p={{ base: "sm", sm: "md" }}
            radius="lg"
            withBorder
            style={{
              background: "linear-gradient(135deg, #2b8a3e 0%, #099268 100%)",
              color: "#fff",
              boxShadow: "0 8px 24px rgba(43, 138, 62, 0.2)",
            }}
          >
            <Group justify="space-between" align="center" wrap="nowrap" gap="sm">
              <div style={{ minWidth: 0 }}>
                <Group gap={6} align="center" mb={4} wrap="wrap">
                  <Badge size="xs" color="yellow" variant="filled">
                    0% Commission
                  </Badge>
                  <Text size="11px" fw={600} style={{ opacity: 0.9 }}>
                    Real Kitchen Prices
                  </Text>
                </Group>
                <Title order={3} fw={800} style={{ color: "#fff", fontSize: "clamp(1.05rem, 4vw, 1.35rem)", lineHeight: 1.25 }}>
                  Dine Direct & Save 20–30%
                </Title>
                <Text size="xs" mt={4} style={{ opacity: 0.9, maxWidth: 360, lineHeight: 1.4 }}>
                  Skip aggregator markups, join live walk-in queues, and enjoy direct dining prices.
                </Text>
              </div>
              <ThemeIcon
                size={42}
                radius="xl"
                color="white"
                variant="white"
                c="green.8"
                style={{ flexShrink: 0 }}
                visibleFrom="xs"
              >
                <IconSparkles size={24} />
              </ThemeIcon>
            </Group>
          </Paper>
        )}

        {/* ─── 4. Live Outlets Grid ─── */}
        <div>
          <Group justify="space-between" align="center" mb="xs">
            <div>
              <Title order={4} size="h5" fw={800}>
                Live Kitchens Nearby
              </Title>
              <Text size="11px" c="dimmed">
                Real-time table radar, active queues, and direct menus
              </Text>
            </div>
            <Badge size="sm" variant="light" color="dinePrimary">
              {outlets.length} Outlets Live
            </Badge>
          </Group>

          {isLoading ? (
            <Stack gap="md">
              <Skeleton height={140} radius="lg" />
              <Skeleton height={140} radius="lg" />
            </Stack>
          ) : outlets.length === 0 ? (
            <Paper p="xl" radius="md" withBorder ta="center">
              <ThemeIcon size={48} radius="xl" color="gray" variant="light" mx="auto" mb="sm">
                <IconToolsKitchen2 size={24} />
              </ThemeIcon>
              <Title order={4} size="h5">
                No Outlets Match Filters
              </Title>
              <Text size="xs" c="dimmed" mt={4} mb="md">
                Try resetting your search query or dining mode filter.
              </Text>
              <Button
                variant="light"
                color="dinePrimary"
                size="xs"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCuisine("ALL");
                  setDiningMode("ALL");
                  setVegOnly(false);
                  setFreeTablesOnly(false);
                }}
              >
                Reset All Filters
              </Button>
            </Paper>
          ) : (
            <Stack gap="md">
              {outlets.map((outlet) => {
                const isTableFree = outlet.tables.free > 0;
                const hasQueue = outlet.waitlist.waitingCount > 0;

                return (
                  <Card
                    key={outlet.id}
                    p={{ base: "sm", sm: "md" }}
                    radius="lg"
                    withBorder
                    style={{
                      background: "#ffffff",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.03)",
                      transition: "transform 0.15s ease, box-shadow 0.15s ease",
                    }}
                  >
                    {/* Top Row: Names, Rating, and Live Badge */}
                    <Group justify="space-between" align="flex-start" wrap="nowrap" mb={6} gap="xs">
                      <Box style={{ flex: 1, minWidth: 0 }}>
                        <Group gap={6} align="center" wrap="wrap">
                          <Title order={4} size="h5" lineClamp={1}>
                            {outlet.restaurantName}
                          </Title>
                          <Badge size="xs" variant="light" color="violet">
                            {outlet.name}
                          </Badge>
                        </Group>
                        <Group gap={6} align="center" mt={2} wrap="nowrap">
                          <IconMapPin size={12} color="#868e96" style={{ flexShrink: 0 }} />
                          <Text size="xs" c="dimmed" lineClamp={1}>
                            {outlet.address}
                          </Text>
                        </Group>
                      </Box>

                      {/* Rating Badge */}
                      <Badge size="sm" variant="filled" color="teal" style={{ flexShrink: 0 }} leftSection={<IconStar size={11} />}>
                        {outlet.rating} ({outlet.reviewsCount})
                      </Badge>
                    </Group>

                    {/* Live Status Radar Pills */}
                    <Group gap="xs" mb="xs" wrap="wrap">
                      <Badge
                        size="sm"
                        variant="dot"
                        color={isTableFree ? "green" : hasQueue ? "orange" : "blue"}
                      >
                        {isTableFree
                          ? `${outlet.tables.free} Tables Free · Walk-In Ready`
                          : hasQueue
                          ? `Queue: ${outlet.waitlist.waitingCount} in line (~${outlet.waitlist.avgWaitMinutes}m)`
                          : "Full Capacity"}
                      </Badge>

                      <Badge size="sm" variant="light" color="teal">
                        Save ~{formatINR(outlet.estimatedSavingsPaise)} Direct
                      </Badge>

                      {outlet.modes.takeaway && (
                        <Badge size="sm" variant="outline" color="gray" leftSection={<IconCar size={11} />}>
                          Curbside Pickup
                        </Badge>
                      )}
                    </Group>

                    {/* Featured Dishes Chips Preview */}
                    {outlet.featuredDishes.length > 0 && (
                      <Box mb="sm" p="xs" style={{ background: "#f8f9fa", borderRadius: 8 }}>
                        <Text size="11px" fw={700} c="dimmed" mb={4}>
                          DIRECT KITCHEN SPECIALS
                        </Text>
                        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={6}>
                          {outlet.featuredDishes.map((dish) => (
                            <Group
                              key={dish.id}
                              justify="space-between"
                              align="center"
                              wrap="nowrap"
                              style={{
                                background: "#fff",
                                padding: "4px 8px",
                                borderRadius: 6,
                                border: "1px solid #edf2f7",
                              }}
                            >
                              <Group gap={6} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                                <VegNonVegIcon isNonVeg={dish.dietaryPreference === "NON_VEG"} size={12} />
                                <Text size="xs" fw={600} lineClamp={1}>
                                  {dish.name}
                                </Text>
                              </Group>
                              <Text size="xs" fw={700} c="dark.9" style={{ flexShrink: 0 }}>
                                {formatINR(dish.pricePaise)}
                              </Text>
                            </Group>
                          ))}
                        </SimpleGrid>
                      </Box>
                    )}

                    {/* Action Buttons */}
                    <Group gap="xs" justify="stretch" align="center" wrap="wrap" mt="xs">
                      {outlet.modes.reservation && (
                        <Button
                          size="xs"
                          variant="light"
                          color="blue"
                          style={{ flex: "1 1 calc(33.333% - 8px)", minWidth: 90 }}
                          leftSection={<IconCalendar size={13} />}
                          onClick={() =>
                            setActiveReservationOutlet({
                              outletId: outlet.id,
                              restaurantId: outlet.restaurantId,
                            })
                          }
                        >
                          Book Table
                        </Button>
                      )}

                      <Button
                        size="xs"
                        variant="light"
                        color="orange"
                        style={{ flex: "1 1 calc(33.333% - 8px)", minWidth: 95 }}
                        leftSection={<IconFlame size={13} />}
                        onClick={() =>
                          setActiveWaitlistOutlet({
                            outletId: outlet.id,
                            restaurantId: outlet.restaurantId,
                            outletName: outlet.name,
                            restaurantName: outlet.restaurantName,
                            avgWaitMinutes: outlet.waitlist.avgWaitMinutes,
                            currentQueueCount: outlet.waitlist.waitingCount,
                          })
                        }
                      >
                        Join Waitlist
                      </Button>

                      <Button
                        size="xs"
                        color="dinePrimary"
                        style={{ flex: "1 1 calc(33.333% - 8px)", minWidth: 105 }}
                        leftSection={<IconShoppingBag size={13} />}
                        onClick={() =>
                          setActiveOutletMenu({
                            id: outlet.id,
                            name: outlet.name,
                            restaurantName: outlet.restaurantName,
                          })
                        }
                      >
                        View Menu
                      </Button>
                    </Group>
                  </Card>
                );
              })}
            </Stack>
          )}
        </div>
      </Stack>

      {/* ─── Drawers & Modals ─── */}
      {/* 1. Menu & Ordering Drawer */}
      <OutletMenuDrawer
        opened={!!activeOutletMenu}
        onClose={() => setActiveOutletMenu(null)}
        outletId={activeOutletMenu?.id || null}
        outletName={activeOutletMenu?.name}
        restaurantName={activeOutletMenu?.restaurantName}
      />

      {/* 2. Waitlist Quick Join Modal */}
      <WaitlistQuickJoinModal
        opened={!!activeWaitlistOutlet}
        onClose={() => setActiveWaitlistOutlet(null)}
        outletId={activeWaitlistOutlet?.outletId || null}
        restaurantId={activeWaitlistOutlet?.restaurantId || null}
        outletName={activeWaitlistOutlet?.outletName}
        restaurantName={activeWaitlistOutlet?.restaurantName}
        avgWaitMinutes={activeWaitlistOutlet?.avgWaitMinutes}
        currentQueueCount={activeWaitlistOutlet?.currentQueueCount}
      />

      {/* 3. Table Reservation Modal */}
      <ReservationModal
        opened={!!activeReservationOutlet}
        onClose={() => setActiveReservationOutlet(null)}
        outletId={activeReservationOutlet?.outletId}
        restaurantId={activeReservationOutlet?.restaurantId}
        customerName={user?.name}
        customerPhone={user?.phoneNumber}
      />
    </Box>
  );
}
