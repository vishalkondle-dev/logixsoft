"use client";

import React from "react";
import Link from "next/link";
import {
  Container,
  Paper,
  Stack,
  Title,
  Text,
  Button,
  ThemeIcon,
  Badge,
  Group,
  Box,
  List,
  SimpleGrid,
} from "@mantine/core";
import {
  IconLock,
  IconSparkles,
  IconCheck,
  IconArrowRight,
  IconCreditCard,
  IconAlertTriangle,
  IconToolsKitchen2,
  IconBellRinging,
  IconPackages,
  IconMotorbike,
  IconTruckDelivery,
  IconBrandWhatsapp,
  IconCalendarEvent,
  IconShieldLock,
  IconShoppingCart,
} from "@tabler/icons-react";
import type { JsonRestaurantOutletRow } from "@logixsoft/logix-dine/types/pos-schema";
import {
  getRequiredModuleForRoute,
  isSubscriptionActive,
  type PlanModuleId,
} from "@logixsoft/logix-dine/types/plans";

interface PlanPaywallProps {
  outlet: JsonRestaurantOutletRow | null;
  pathname: string;
  isOwner: boolean;
  restaurantName?: string;
}

const MODULE_ICONS: Record<string, any> = {
  kitchen: IconToolsKitchen2,
  waiter: IconBellRinging,
  inventory: IconPackages,
  delivery: IconMotorbike,
  aggregators: IconTruckDelivery,
  whatsapp: IconBrandWhatsapp,
  reservations: IconCalendarEvent,
  roles: IconShieldLock,
};

export function PlanPaywall({
  outlet,
  pathname,
  isOwner,
  restaurantName,
}: PlanPaywallProps) {
  const moduleInfo = getRequiredModuleForRoute(pathname);
  const isInactive = outlet ? !isSubscriptionActive(outlet as any) : false;

  const IconComponent =
    (moduleInfo?.id && MODULE_ICONS[moduleInfo.id]) ||
    (isInactive ? IconAlertTriangle : IconLock);

  if (isInactive) {
    return (
      <Container size="sm" py={80}>
        <Paper
          p="xl"
          radius="lg"
          withBorder
          style={{
            textAlign: "center",
            borderColor: "#ffc9c9",
            backgroundColor: "#fff5f5",
          }}
        >
          <Stack align="center" gap="md">
            <ThemeIcon size={68} radius="xl" color="red" variant="light">
              <IconAlertTriangle size={36} stroke={2} />
            </ThemeIcon>

            <Badge color="red" size="md" variant="filled">
              Subscription Inactive ({outlet?.status || "EXPIRED"})
            </Badge>

            <Title order={2} style={{ letterSpacing: "-0.5px" }}>
              {outlet?.name ? `${outlet.name} Subscription Expired` : "Subscription Inactive"}
            </Title>

            <Text c="dimmed" size="sm" maw={480}>
              This branch&apos;s subscription has ended or is currently suspended. To restore
              access to billing, order taking, kitchen displays, and floor management,
              the restaurant subscription must be renewed.
            </Text>

            {isOwner ? (
              <Group gap="sm" mt="sm">
                <Button
                  component={Link}
                  href={`/settings/billing${outlet ? `?outletId=${outlet.id}` : ""}`}
                  size="md"
                  color="red"
                  leftSection={<IconCreditCard size={18} />}
                >
                  Renew Subscription in Billing
                </Button>
                <Button
                  component={Link}
                  href="/settings/restaurant"
                  size="md"
                  variant="default"
                >
                  Store Settings
                </Button>
              </Group>
            ) : (
              <Paper p="sm" radius="md" bg="#ffffff" withBorder maw={420} mt="xs">
                <Text size="xs" c="dimmed">
                  Please notify the restaurant administrator or owner
                  {restaurantName ? ` of ${restaurantName}` : ""} to renew this branch&apos;s
                  subscription license.
                </Text>
              </Paper>
            )}
          </Stack>
        </Paper>
      </Container>
    );
  }

  const moduleName = moduleInfo?.name || "Premium Module";
  const minPlanLabel = moduleInfo?.minPlanLabel || "Pro Plan";
  const minPrice = moduleInfo?.minPlanPrice || 1499;
  const currentPlan = outlet?.planTier || "BASIC";

  return (
    <Container size="md" py={60}>
      <Paper
        p={{ base: "lg", sm: "xl" }}
        radius="lg"
        withBorder
        style={{
          boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
          borderColor: "#e9ecef",
        }}
      >
        <Stack gap="lg">
          {/* Header Row */}
          <Group justify="space-between" align="flex-start" wrap="wrap">
            <Group gap="md">
              <ThemeIcon
                size={58}
                radius="md"
                color="dinePrimary"
                variant="light"
              >
                <IconComponent size={32} stroke={1.8} />
              </ThemeIcon>
              <div>
                <Group gap="xs" align="center">
                  <Title order={2} style={{ letterSpacing: "-0.5px" }}>
                    {moduleName}
                  </Title>
                  <Badge color="violet" variant="filled" size="sm" leftSection={<IconSparkles size={12} />}>
                    {minPlanLabel}
                  </Badge>
                </Group>
                <Text size="sm" c="dimmed" mt={2}>
                  {moduleInfo?.description || "This feature requires an active subscription tier upgrade for this branch."}
                </Text>
              </div>
            </Group>

            {/* Current vs Target Plan Badges */}
            <Group gap="xs">
              <Badge variant="outline" color="gray" size="md">
                Current: {currentPlan} PLAN
              </Badge>
              <Badge variant="light" color="dinePrimary" size="md">
                Requires: {minPlanLabel.toUpperCase()}
              </Badge>
            </Group>
          </Group>

          {/* Branch Context Alert */}
          <Paper
            p="md"
            radius="md"
            style={{
              backgroundColor: "rgba(175, 115, 215, 0.06)",
              border: "1px solid rgba(175, 115, 215, 0.2)",
            }}
          >
            <Group justify="space-between" align="center" wrap="wrap" gap="xs">
              <div>
                <Text size="xs" fw={700} c="dark.7" tt="uppercase" style={{ letterSpacing: "0.5px" }}>
                  Active Branch: {outlet?.name || "Current Outlet"}
                </Text>
                <Text size="xs" c="dimmed" mt={2}>
                  {outlet?.name || "This branch"} is assigned to the{" "}
                  <strong>{currentPlan} Plan</strong> (₹999/mo). Each branch has independent
                  subscription plans, allowing you to pay only for what each outlet needs.
                </Text>
              </div>
              <Badge size="lg" color="dinePrimary" variant="filled">
                ₹{minPrice}/mo
              </Badge>
            </Group>
          </Paper>

          {/* Feature Highlights Grid */}
          {moduleInfo?.highlights && moduleInfo.highlights.length > 0 && (
            <Box>
              <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb="xs" style={{ letterSpacing: "0.5px" }}>
                Included with {minPlanLabel}:
              </Text>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                {moduleInfo.highlights.map((h, i) => (
                  <Group key={i} gap="xs" wrap="nowrap" align="center">
                    <ThemeIcon size={20} radius="xl" color="teal" variant="light">
                      <IconCheck size={12} stroke={2.5} />
                    </ThemeIcon>
                    <Text size="sm" c="dark.8">
                      {h}
                    </Text>
                  </Group>
                ))}
              </SimpleGrid>
            </Box>
          )}

          {/* Action CTAs */}
          <Box pt="xs" style={{ borderTop: "1px solid #f1f3f5" }}>
            {isOwner ? (
              <Group justify="space-between" align="center" wrap="wrap" gap="sm">
                <Button
                  component={Link}
                  href={`/settings/billing${outlet ? `?outletId=${outlet.id}` : ""}`}
                  size="md"
                  color="dinePrimary"
                  rightSection={<IconArrowRight size={16} />}
                >
                  Upgrade {outlet?.name || "Branch"} to {minPlanLabel} (₹{minPrice}/mo)
                </Button>
                <Group gap="xs">
                  <Button
                    component={Link}
                    href={outlet ? `/pos?outletId=${outlet.id}` : "/pos"}
                    size="md"
                    variant="subtle"
                    color="gray"
                    leftSection={<IconShoppingCart size={16} />}
                  >
                    Go to POS Counter
                  </Button>
                  <Button
                    component={Link}
                    href={`/settings/billing${outlet ? `?outletId=${outlet.id}` : ""}`}
                    size="md"
                    variant="light"
                    color="gray"
                  >
                    View All Plans & Invoices
                  </Button>
                </Group>
              </Group>
            ) : (
              <Group justify="space-between" align="center" wrap="wrap" gap="sm">
                <Text size="xs" c="dimmed" maw={460}>
                  This module is locked because <strong>{outlet?.name || "this branch"}</strong> is on the Starter Plan.
                  Contact your restaurant administrator or owner to upgrade this branch.
                </Text>
                <Button
                  component={Link}
                  href={outlet ? `/pos?outletId=${outlet.id}` : "/pos"}
                  size="sm"
                  color="dinePrimary"
                  variant="light"
                >
                  Back to POS Counter
                </Button>
              </Group>
            )}
          </Box>
        </Stack>
      </Paper>
    </Container>
  );
}
