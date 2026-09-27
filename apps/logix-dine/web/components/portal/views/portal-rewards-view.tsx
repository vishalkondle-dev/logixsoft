"use client";

import React, { useState } from "react";
import {
  Stack,
  Paper,
  Group,
  Text,
  Title,
  Badge,
  Progress,
  SimpleGrid,
  ThemeIcon,
  Button,
  Box,
  Divider,
  Switch,
} from "@mantine/core";
import {
  IconCrown,
  IconStar,
  IconHeart,
  IconSparkles,
  IconCheck,
  IconToolsKitchen2,
  IconFlame,
  IconGift,
  IconShieldLock,
  IconReceipt,
  IconSalad,
  IconMeat,
  IconClock,
} from "@tabler/icons-react";
import { VegNonVegIcon } from "@/components/common/veg-nonveg-icon";
import { notifications } from "@mantine/notifications";
import type { CustomerPortalData } from "@/lib/api-client";

interface PortalRewardsViewProps {
  data?: CustomerPortalData;
}

function formatINR(paise?: number | null): string {
  if (paise == null) return "₹0.00";
  return `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function PortalRewardsView({ data }: PortalRewardsViewProps) {
  const customer = data?.customer;
  const stats = data?.stats;

  // Kitchen Memory / Allergen Toggles (stored in local diner preferences)
  const [prefLessOil, setPrefLessOil] = useState(false);
  const [prefLessSpicy, setPrefLessSpicy] = useState(false);
  const [prefNoPeanuts, setPrefNoPeanuts] = useState(false);
  const [prefJain, setPrefJain] = useState(false);
  const [prefGlutenFree, setPrefGlutenFree] = useState(false);

  const totalOrders = stats?.totalOrdersCount || 0;
  const lifetimeSpend = stats?.lifetimeSpendPaise || 0;

  // Tier logic
  const isVip = totalOrders >= 6 || lifetimeSpend >= 500000;
  const isRegular = totalOrders >= 3 && !isVip;

  const currentTierName = isVip ? "VIP Patron" : isRegular ? "Regular Guest" : "Foodie Explorer";
  const progressToNext = isVip ? 100 : isRegular ? Math.min(100, Math.round((totalOrders / 6) * 100)) : Math.min(100, Math.round((totalOrders / 3) * 100));

  const totalFoodItems = (stats?.vegItemsCount || 0) + (stats?.nonVegItemsCount || 0);
  const vegPercent = totalFoodItems > 0 ? Math.round(((stats?.vegItemsCount || 0) / totalFoodItems) * 100) : 50;
  const nonVegPercent = 100 - vegPercent;

  const handleSavePreferences = () => {
    notifications.show({
      title: "Kitchen Preferences Saved",
      message: "Your dining memory is saved. Chefs and waiters will be notified on your future orders!",
      color: "teal",
      icon: <IconCheck size={16} />,
    });
  };

  return (
    <Stack gap="lg" pb={40}>
      {/* ─── 1. Metallic VIP Pass Card ─── */}
      <Paper
        p={{ base: "md", sm: "lg" }}
        radius="xl"
        style={{
          background: "linear-gradient(135deg, #2b1055 0%, #7597de 50%, #24243e 100%)",
          color: "#fff",
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 14px 28px rgba(43, 16, 85, 0.25), 0 10px 10px rgba(43, 16, 85, 0.22)",
          border: "1px solid rgba(255, 255, 255, 0.18)",
        }}
      >
        {/* Decorative backdrop shapes */}
        <Box
          style={{
            position: "absolute",
            top: -20,
            right: -20,
            width: 140,
            height: 140,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,215,0,0.18) 0%, rgba(255,255,255,0) 70%)",
            pointerEvents: "none",
          }}
        />

        <Stack justify="space-between" style={{ minHeight: 180 }}>
          {/* Card Top */}
          <Group justify="space-between" align="flex-start">
            <Group gap="xs">
              <Box
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "rgba(255, 255, 255, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backdropFilter: "blur(4px)",
                }}
              >
                <IconToolsKitchen2 size={18} color="#ffd43b" />
              </Box>
              <div>
                <Text size="11px" fw={700} style={{ letterSpacing: "1px", textTransform: "uppercase", color: "rgba(255,255,255,0.7)" }}>
                  Logix Dine VIP Pass
                </Text>
                <Text size="xs" fw={600} c="gray.3">
                  {data?.activeOrders?.[0]?.restaurantName
                    ? `${data.activeOrders[0].restaurantName}`
                    : data?.pastOrders?.[0]?.restaurantName
                    ? `Patron • ${data.pastOrders[0].restaurantName}`
                    : "All-Access Dining Privileges"}
                </Text>
              </div>
            </Group>

            <Badge
              size="sm"
              variant="gradient"
              gradient={{ from: "yellow", to: "orange", deg: 45 }}
              leftSection={<IconCrown size={12} />}
              style={{ fontWeight: 800, textTransform: "uppercase" }}
            >
              {currentTierName}
            </Badge>
          </Group>

          {/* Card Middle Chip */}
          <Box my="xs">
            <Text size="10px" c="gray.4" style={{ letterSpacing: "2px", textTransform: "uppercase" }}>
              Member ID
            </Text>
            <Text size="sm" fw={700} style={{ letterSpacing: "3px", fontFamily: "monospace" }}>
              LD-VIP-{(customer?.phone || "7276").slice(-4)}
            </Text>
          </Box>

          {/* Card Bottom */}
          <Group justify="space-between" align="flex-end">
            <div>
              <Text size="10px" c="gray.4" style={{ textTransform: "uppercase" }}>
                Cardholder Name
              </Text>
              <Text size="md" fw={800} style={{ letterSpacing: "0.5px" }}>
                {customer?.name || "Valued Diner"}
              </Text>
            </div>

            <Box style={{ textAlign: "right" }}>
              <Text size="10px" c="gray.4" style={{ textTransform: "uppercase" }}>
                Status
              </Text>
              <Text size="xs" fw={700} c="green.4">
                Active Member
              </Text>
            </Box>
          </Group>
        </Stack>
      </Paper>

      {/* ─── 2. Tier Progression & Milestones ─── */}
      <Paper p="md" radius="lg" withBorder style={{ background: "#fff" }}>
        <Group justify="space-between" align="center" mb="xs">
          <div>
            <Text fw={700} size="sm">
              Tier Milestone Progress
            </Text>
            <Text size="xs" c="dimmed">
              {isVip
                ? "You have achieved our top-tier VIP status!"
                : `Complete ${isRegular ? 6 - totalOrders : 3 - totalOrders} more visits to level up!`}
            </Text>
          </div>
          <Text size="xs" fw={800} c="dinePrimary">
            {progressToNext}% Complete
          </Text>
        </Group>

        <Progress value={progressToNext} color="dinePrimary" size="md" radius="xl" animated={progressToNext < 100} />

        <SimpleGrid cols={{ base: 3, sm: 3 }} spacing="xs" mt="md">
          <Paper p="xs" radius="md" withBorder style={{ background: "#fbfbfc", textAlign: "center" }}>
            <IconHeart size={18} color="#fa5252" style={{ margin: "0 auto" }} />
            <Text size="11px" fw={700} mt={4}>Explorer</Text>
            <Text size="10px" c="dimmed">1–2 Visits</Text>
          </Paper>

          <Paper p="xs" radius="md" withBorder style={{ background: isRegular || isVip ? "rgba(34, 139, 230, 0.08)" : "#fbfbfc", textAlign: "center" }}>
            <IconStar size={18} color="#228be6" style={{ margin: "0 auto" }} />
            <Text size="11px" fw={700} mt={4}>Regular</Text>
            <Text size="10px" c="dimmed">3–5 Visits</Text>
          </Paper>

          <Paper p="xs" radius="md" withBorder style={{ background: isVip ? "rgba(250, 176, 5, 0.12)" : "#fbfbfc", textAlign: "center" }}>
            <IconCrown size={18} color="#fab005" style={{ margin: "0 auto" }} />
            <Text size="11px" fw={700} mt={4}>VIP Connoisseur</Text>
            <Text size="10px" c="dimmed">6+ Visits</Text>
          </Paper>
        </SimpleGrid>
      </Paper>

      {/* ─── 3. Unlocked VIP Perks ─── */}
      <Paper p="md" radius="lg" withBorder style={{ background: "#fff" }}>
        <Text fw={700} size="sm" mb="sm" c="dimmed" style={{ textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Your Dining Privileges
        </Text>
        <Stack gap="xs">
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon size="md" radius="md" color="yellow" variant="light">
              <IconCrown size={16} />
            </ThemeIcon>
            <div>
              <Text size="xs" fw={700}>Priority Table Reservations</Text>
              <Text size="11px" c="dimmed">Preferred seating during peak weekend hours.</Text>
            </div>
          </Group>

          <Group gap="sm" wrap="nowrap">
            <ThemeIcon size="md" radius="md" color="teal" variant="light">
              <IconGift size={16} />
            </ThemeIcon>
            <div>
              <Text size="xs" fw={700}>Chef's Celebration Dessert</Text>
              <Text size="11px" c="dimmed">Complimentary artisanal dessert on birthdays and anniversaries.</Text>
            </div>
          </Group>

          <Group gap="sm" wrap="nowrap">
            <ThemeIcon size="md" radius="md" color="violet" variant="light">
              <IconSparkles size={16} />
            </ThemeIcon>
            <div>
              <Text size="xs" fw={700}>Direct Digital Waiter Hotline</Text>
              <Text size="11px" c="dimmed">One-tap waiter paging for immediate service.</Text>
            </div>
          </Group>
        </Stack>
      </Paper>

      {/* ─── 4. Dining DNA & Taste Profile ─── */}
      <Paper p="md" radius="lg" withBorder style={{ background: "#fff" }}>
        <Text fw={700} size="sm" mb="xs" c="dimmed" style={{ textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Your Dining DNA & Taste Profile
        </Text>

        <Stack gap="md">
          {/* Veg vs Non-Veg bar */}
          <Box>
            <Group justify="space-between" align="center" mb={4}>
              <Group gap={6}>
                <VegNonVegIcon isNonVeg={false} size={14} />
                <Text size="xs" fw={600}>Veg ({vegPercent}%)</Text>
              </Group>
              <Group gap={6}>
                <VegNonVegIcon isNonVeg={true} size={14} />
                <Text size="xs" fw={600}>Non-Veg ({nonVegPercent}%)</Text>
              </Group>
            </Group>
            <Progress.Root size="md" radius="xl">
              <Progress.Section value={vegPercent} color="green" />
              <Progress.Section value={nonVegPercent} color="red" />
            </Progress.Root>
          </Box>

          {/* Quick Metrics */}
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
            <Paper p="xs" radius="md" withBorder style={{ background: "#fafafa" }}>
              <Text size="11px" c="dimmed">Lifetime Spend</Text>
              <Text size="sm" fw={800} c="dinePrimary">{formatINR(lifetimeSpend)}</Text>
            </Paper>

            <Paper p="xs" radius="md" withBorder style={{ background: "#fafafa" }}>
              <Text size="11px" c="dimmed">Total Orders</Text>
              <Text size="sm" fw={800}>{totalOrders} visits</Text>
            </Paper>

            <Paper p="xs" radius="md" withBorder style={{ background: "#fafafa" }}>
              <Text size="11px" c="dimmed">Veg Items</Text>
              <Text size="sm" fw={800} c="green.9">{stats?.vegItemsCount || 0}</Text>
            </Paper>

            <Paper p="xs" radius="md" withBorder style={{ background: "#fafafa" }}>
              <Text size="11px" c="dimmed">Non-Veg Items</Text>
              <Text size="sm" fw={800} c="red.9">{stats?.nonVegItemsCount || 0}</Text>
            </Paper>
          </SimpleGrid>
        </Stack>
      </Paper>

      {/* ─── 5. Kitchen Memory & Allergen Settings ─── */}
      <Paper p="md" radius="lg" withBorder style={{ background: "#fff" }}>
        <Text fw={700} size="sm" mb={4}>
          Personal Kitchen Memory
        </Text>
        <Text size="xs" c="dimmed" mb="md">
          Save your dining preferences once. Our chefs will automatically respect them on every order you place!
        </Text>

        <Stack gap="sm">
          <Group justify="space-between" align="center">
            <div>
              <Text size="xs" fw={600}>Less Oil & Light Preparation</Text>
              <Text size="11px" c="dimmed">Cook with minimal butter and oil</Text>
            </div>
            <Switch checked={prefLessOil} onChange={(e) => setPrefLessOil(e.currentTarget.checked)} color="teal" />
          </Group>

          <Group justify="space-between" align="center">
            <div>
              <Text size="xs" fw={600}>Mild Spice Preference</Text>
              <Text size="11px" c="dimmed">Avoid excessive green chillies or garam masala</Text>
            </div>
            <Switch checked={prefLessSpicy} onChange={(e) => setPrefLessSpicy(e.currentTarget.checked)} color="teal" />
          </Group>

          <Group justify="space-between" align="center">
            <div>
              <Text size="xs" fw={600}>Peanut / Nut Allergy Alert</Text>
              <Text size="11px" c="dimmed">Strict no-nut kitchen cross-contamination check</Text>
            </div>
            <Switch checked={prefNoPeanuts} onChange={(e) => setPrefNoPeanuts(e.currentTarget.checked)} color="red" />
          </Group>

          <Group justify="space-between" align="center">
            <div>
              <Text size="xs" fw={600}>Jain Food Preparation</Text>
              <Text size="11px" c="dimmed">No onion, garlic, or root vegetables</Text>
            </div>
            <Switch checked={prefJain} onChange={(e) => setPrefJain(e.currentTarget.checked)} color="green" />
          </Group>
        </Stack>

        <Button
          size="xs"
          color="dinePrimary"
          variant="light"
          radius="md"
          mt="md"
          fullWidth
          onClick={handleSavePreferences}
        >
          Save Kitchen Preferences
        </Button>
      </Paper>
    </Stack>
  );
}
