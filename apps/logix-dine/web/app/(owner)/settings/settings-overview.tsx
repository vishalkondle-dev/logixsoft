"use client";

import React from "react";
import Link from "next/link";
import {
  Title,
  Text,
  SimpleGrid,
  Paper,
  Group,
  ThemeIcon,
  Badge,
  Box,
  Divider,
  Button,
} from "@mantine/core";
import {
  IconBuildingStore,
  IconClock,
  IconFileInvoice,
  IconUsers,
  IconToolsKitchen2,
  IconCreditCard,
  IconCoffee,
  IconTableAlias,
  IconQrcode,
  IconCalendarEvent,
  IconUserCheck,
  IconTruckDelivery,
  IconChefHat,
  IconPrinter,
  IconReceipt,
  IconReceiptTax,
  IconDeviceGamepad2,
  IconBrandWhatsapp,
  IconMotorbike,
  IconChevronRight,
  IconBook,
  IconChartBar,
  IconPackages,
  IconStar,
} from "@tabler/icons-react";
import { useRestaurant } from "@/lib/restaurant-context";

interface SettingItem {
  id: string;
  title: string;
  description: string;
  icon: any;
  color: string;
  href?: string;
  badge?: string;
  isAvailable?: boolean;
}

interface SettingCategory {
  category: string;
  items: SettingItem[];
}

export function SettingsOverview() {
  const { restaurant, activeOutlet, role } = useRestaurant();
  const isOwner = role === "OWNER";

  const settingsGroups: SettingCategory[] = [
    {
      category: "Store & Operations",
      items: [
        {
          id: "store-settings",
          title: "Store Settings",
          description: "Configure store details, contact, and address",
          icon: IconBuildingStore,
          color: "violet",
          href: "/settings/restaurant",
          isAvailable: true,
        },
        {
          id: "menu-items",
          title: "Menu Catalog",
          description: "Add, categorize, and edit menu items & add-ons",
          icon: IconBook,
          color: "teal",
          href: "/settings/menu",
          isAvailable: true,
        },
        {
          id: "inventory",
          title: "Inventory & Recipes",
          description: "Raw material stock, recipe food cost (BOM), and supplier deliveries",
          icon: IconPackages,
          color: "teal",
          href: "/settings/inventory",
          isAvailable: true,
        },
        {
          id: "tables",
          title: "Table Management",
          description: "Manage dining tables, sections, and seating",
          icon: IconTableAlias,
          color: "blue",
          href: "/settings/tables",
          isAvailable: true,
        },
        {
          id: "store-hours",
          title: "Store Hours",
          description: "Configure daily opening, closing, and break timings",
          icon: IconClock,
          color: "orange",
          href: "/settings/hours",
          isAvailable: true,
        },
      ],
    },
    {
      category: "Online Delivery & Integrations (Relay)",
      items: [
        {
          id: "aggregators",
          title: "Online Delivery Partners",
          description: "Connect Swiggy, Zomato, Magicpin & ONDC. Manage store IDs, API keys, auto-accept & webhooks",
          icon: IconTruckDelivery,
          color: "orange",
          href: "/settings/aggregators",
          badge: "Swiggy • Zomato • ONDC",
          isAvailable: true,
        },
        {
          id: "delivery-agents",
          title: "In-House Delivery & Riders",
          description: "Manage delivery riders, external couriers (Shadowfax, Dunzo, Porter), and dispatch",
          icon: IconMotorbike,
          color: "red",
          href: "/settings/riders",
          isAvailable: true,
        },
      ],
    },
    {
      category: "Team & Permissions",
      items: [
        {
          id: "users",
          title: "Staff & Team",
          description: "Manage team members, roles, and outlet access",
          icon: IconUsers,
          color: "indigo",
          href: isOwner ? "/settings/staff" : undefined,
          isAvailable: isOwner,
          badge: isOwner ? undefined : "Owner only",
        },
        {
          id: "kitchen-locations",
          title: "Kitchen & KOT",
          description: "Route orders to kitchen displays & preparation stations",
          icon: IconChefHat,
          color: "cyan",
          href: "/kitchen",
          isAvailable: true,
        },
        {
          id: "analytics",
          title: "Analytics & Reports",
          description: "View sales summaries, item sales, and tax reports",
          icon: IconChartBar,
          color: "grape",
          href: "/settings/reports",
          isAvailable: true,
        },
        {
          id: "feedback",
          title: "Customer Reviews & Ratings",
          description: "Real-time guest ratings, dish feedback, praise tags & official responses",
          icon: IconStar,
          color: "yellow",
          href: "/settings/feedback",
          isAvailable: true,
        },
      ],
    },
    {
      category: "Hardware & Billing",
      items: [
        {
          id: "printers",
          title: "Thermal Printers",
          description: "Configure Bluetooth & network thermal printers for bills & KOTs",
          icon: IconPrinter,
          color: "dark",
          href: "/settings/printing",
          isAvailable: true,
        },
        {
          id: "invoice-settings",
          title: "Invoice & Tax",
          description: "GST slabs, inclusive/exclusive pricing, invoice series & charges",
          icon: IconFileInvoice,
          color: "green",
          href: "/settings/tax",
          isAvailable: true,
        },
        {
          id: "dining-options",
          title: "Dining Options",
          description: "Toggle dine-in, takeaway, and delivery modes",
          icon: IconCoffee,
          color: "yellow",
          href: "/settings/dining",
          isAvailable: true,
        },
      ],
    },
    {
      category: "Guest Experience & Digital",
      items: [
        {
          id: "qr-menu",
          title: "QR Menu Ordering",
          description: "Customise table QR code ordering & self-checkout",
          icon: IconQrcode,
          color: "lime",
          href: "/settings/qr-menu",
          isAvailable: true,
        },
        {
          id: "whatsapp",
          title: "WhatsApp Alerts",
          description: "Send instant e-bills and order updates via WhatsApp",
          icon: IconBrandWhatsapp,
          color: "green",
          href: "/settings/whatsapp",
          isAvailable: true,
        },
        {
          id: "reservations",
          title: "Table Reservations",
          description: "Manage guest reservations, time slots, and party sizes",
          icon: IconCalendarEvent,
          color: "pink",
          href: "/settings/reservations",
          isAvailable: true,
        },
      ],
    },
  ];

  return (
    <Box pt="sm" pb={120} px={{ base: "xs", sm: "md" }}>
      {/* Header */}
      <Box mb="md">
        <Group justify="space-between" align="flex-end" wrap="wrap" gap="xs">
          <div>
            <Title order={2} style={{ letterSpacing: "-0.5px" }}>Settings</Title>
            <Text size="sm" c="dimmed" mt={3}>
              Manage your outlet configuration, team, menu, billing, and integrations.
            </Text>
          </div>
        </Group>
      </Box>

      {/* Prominent Quick-Access Banner: Online Delivery Aggregators */}
      <Paper
        p="md"
        radius="md"
        mb="xl"
        style={{
          background: "linear-gradient(135deg, #fff4e6 0%, #ffe8cc 100%)",
          border: "1px solid #ffd8a8",
        }}
      >
        <Group justify="space-between" align="center" wrap="wrap" gap="sm">
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon size={44} radius="md" color="orange" variant="filled">
              <IconTruckDelivery size={24} />
            </ThemeIcon>
            <div>
              <Group gap="xs">
                <Text fw={700} size="sm" c="dark.9">
                  Online Food Delivery Partners (Swiggy • Zomato • ONDC • Magicpin)
                </Text>
                <Badge color="orange" variant="filled" size="xs">
                  New Relay Gateway
                </Badge>
              </Group>
              <Text size="xs" c="dark.6" mt={2}>
                Configure outlet store IDs, partner API keys, auto-accept rules, markup pricing, and webhooks in one place.
              </Text>
            </div>
          </Group>
          <Button
            component={Link}
            href="/settings/aggregators"
            color="orange"
            size="sm"
            rightSection={<IconChevronRight size={14} />}
          >
            Configure Online Partners
          </Button>
        </Group>
      </Paper>

      {/* Categories & Cards Grid */}
      <Box style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        {settingsGroups.map((group) => (
          <Box key={group.category}>
            <Text
              size="xs"
              fw={700}
              c="dimmed"
              tt="uppercase"
              style={{ letterSpacing: "0.6px", marginBottom: 12 }}
            >
              {group.category}
            </Text>

            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
              {group.items.map((item) => {
                const IconComponent = item.icon;
                const isClickable = Boolean(item.isAvailable && item.href);

                const cardContent = (
                  <Paper
                    p="md"
                    radius="md"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      height: "100%",
                      minHeight: 110,
                      position: "relative",
                      transition: "transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease",
                      border: "1px solid #e9ecef",
                      backgroundColor: "#ffffff",
                      cursor: isClickable ? "pointer" : "default",
                      opacity: item.isAvailable ? 1 : 0.65,
                    }}
                    className={isClickable ? "settings-hub-card" : undefined}
                  >
                    <div>
                      <Group justify="space-between" align="flex-start" mb="xs" wrap="nowrap">
                        <ThemeIcon
                          size={42}
                          radius="md"
                          variant="light"
                          color={item.color || "dinePrimary"}
                        >
                          <IconComponent size={22} stroke={1.75} />
                        </ThemeIcon>

                        <Group gap={6} align="center">
                          {item.badge ? (
                            <Badge size="xs" variant="light" color="gray">
                              {item.badge}
                            </Badge>
                          ) : !item.isAvailable ? (
                            <Badge size="xs" variant="subtle" color="gray">
                              Coming soon
                            </Badge>
                          ) : null}
                          {isClickable && (
                            <IconChevronRight
                              size={16}
                              color="var(--mantine-color-gray-5)"
                              className="settings-card-chevron"
                            />
                          )}
                        </Group>
                      </Group>

                      <Text size="sm" fw={600} c="dark.9" lh={1.3}>
                        {item.title}
                      </Text>

                      <Text size="xs" c="dimmed" mt={4} lh={1.4} lineClamp={2}>
                        {item.description}
                      </Text>
                    </div>
                  </Paper>
                );

                if (isClickable && item.href) {
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      style={{ textDecoration: "none", color: "inherit", display: "block" }}
                    >
                      {cardContent}
                    </Link>
                  );
                }

                return <div key={item.id}>{cardContent}</div>;
              })}
            </SimpleGrid>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
