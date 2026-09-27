"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Box,
  Container,
  Title,
  Text,
  Button,
  Group,
  Stack,
  SimpleGrid,
  Card,
  ThemeIcon,
  Badge,
  Tabs,
  Paper,
  Divider,
  ActionIcon,
  Center,
} from "@mantine/core";
import {
  IconDeviceDesktop,
  IconDeviceMobile,
  IconToolsKitchen2,
  IconReceipt,
  IconPrinter,
  IconChartBar,
  IconCheck,
  IconStar,
  IconArrowRight,
  IconBrandWhatsapp,
  IconShieldCheck,
  IconBolt,
  IconQrcode,
  IconBuildingStore,
  IconSparkles,
} from "@tabler/icons-react";
import { useAuth } from "@/lib/auth-context";
import { useRestaurant } from "@/lib/restaurant-context";

export default function HomePage() {
  const { user, isAuthenticated, openLoginModal } = useAuth();
  const { restaurant, activeOutlet, role } = useRestaurant();
  const [activeDeviceTab, setActiveDeviceTab] = useState<string>("pos");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");

  const outletQuery = activeOutlet?.id ? `?outletId=${activeOutlet.id}` : "";
  const primaryDashboardHref =
    role === "WAITER"
      ? `/waiter${outletQuery}`
      : role === "KITCHEN"
      ? `/kitchen${outletQuery}`
      : role === "RIDER"
      ? `/rider${outletQuery}`
      : `/pos${outletQuery}`;

  const deviceShowcases = [
    {
      id: "pos",
      label: "Desktop Counter POS",
      icon: IconDeviceDesktop,
      tag: "Windows • macOS • Linux",
      title: "Blazing Fast POS Register & Table Billing",
      description:
        "Sub-second item search, smart table splitting, automated tax/GST calculation, discounts, and split payments. Built natively for desktop with zero browser lag.",
      bullets: [
        "Interactive graphical table floor plan with live occupancy",
        "Instant settlement via UPI QR, Cash, and Card",
        "Counter Kiosk mode (F11) prevents staff tampering",
      ],
      image: "/showcase/pos-terminal.png",
      deviceType: "desktop",
    },
    {
      id: "orders",
      label: "Live Orders & Floor",
      icon: IconReceipt,
      tag: "Real-time Live Sync",
      title: "Unified Kitchen & Delivery Order Stream",
      description:
        "Every dine-in, takeaway, and delivery order streams into a single real-time control room powered by Cloudflare Durable Objects.",
      bullets: [
        "Live item progress: Ordered ➔ In Kitchen ➔ Served",
        "One-click multi-round reordering for dine-in guests",
        "Color-coded payment and fulfillment badges",
      ],
      image: "/showcase/desktop-orders.png",
      deviceType: "desktop",
    },
    {
      id: "customer",
      label: "Customer Mobile Portal",
      icon: IconDeviceMobile,
      tag: "iOS & Android Web / Native",
      title: "Contactless QR Ordering & Guest Delight",
      description:
        "Guests scan a table QR code to explore visual menus, order food, ring the waiter, request bills, and write verified reviews — with zero app download required.",
      bullets: [
        "Ring waiter for water, cutlery, or direct bill requests",
        "Live bill tracking and round-by-round order progress",
        "Verified customer reviews and food item star ratings",
      ],
      image: "/showcase/customer-app.png",
      deviceType: "mobile",
    },
    {
      id: "waiter",
      label: "Waiter Staff & Kitchen KDS",
      icon: IconToolsKitchen2,
      tag: "Mobile Tablets & Bump Screens",
      title: "Digital Kitchen Display & Floor Staff Mobility",
      description:
        "Waiters take orders on mobile tablets tableside. Orders immediately fire to the chef's Kitchen Display System (KDS) with live timers.",
      bullets: [
        "Real-time waiter call alerts with table notifications",
        "Cooking timers and order rush prioritization",
        "Kitchen item bump buttons to mark dishes ready",
      ],
      image: "/showcase/waiter-floor.png",
      deviceType: "desktop",
    },
    {
      id: "printer",
      label: "Hardware & Thermal Printing",
      icon: IconPrinter,
      tag: "ESC/POS Silent Print",
      title: "Direct 80mm & 58mm Thermal Printing",
      description:
        "No annoying browser print popups. The Logix Dine desktop application connects directly to USB, LAN, and Bluetooth receipt printers for instant silent KOT and bill output.",
      bullets: [
        "Silent thermal KOT dispatch to kitchen stations",
        "Customizable receipts with logo, GSTIN, and QR codes",
        "Built-in printer diagnostic and test station",
      ],
      image: "/showcase/thermal-hardware.png",
      deviceType: "desktop",
    },
    {
      id: "analytics",
      label: "Reports & Insights",
      icon: IconChartBar,
      tag: "Business Intelligence",
      title: "Actionable Revenue & Sales Intelligence",
      description:
        "Monitor gross sales, item popularity, peak hourly rushes, table turnover speed, and payment method splits in intuitive graphical dashboards.",
      bullets: [
        "Item-wise sales velocity and high-margin dishes",
        "Hourly rush heatmaps to optimize staff shifts",
        "One-click Excel/CSV tax and accounting export",
      ],
      image: "/showcase/analytics-reports.png",
      deviceType: "desktop",
    },
    {
      id: "reviews",
      label: "Feedback & Reputation",
      icon: IconStar,
      tag: "Guest Retention",
      title: "Private Feedback & Dish-Level Ratings",
      description:
        "Gather feedback right at the table before unhappy guests post on Google or Zomato. Respond directly to customers and protect your brand reputation.",
      bullets: [
        "Item-specific star ratings to identify underperforming recipes",
        "Anonymous or verified customer feedback options",
        "Owner reply portal to turn critics into loyal fans",
      ],
      image: "/showcase/customer-reviews.png",
      deviceType: "desktop",
    },
  ];

  const currentShowcase =
    deviceShowcases.find((s) => s.id === activeDeviceTab) || deviceShowcases[0];

  return (
    <Box
      style={{
        backgroundColor: "#0d0e12",
        color: "#f8f9fa",
        minHeight: "100vh",
        overflowX: "hidden",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      {/* ─── STICKY HEADER NAV ────────────────────────────────────────── */}
      <Box
        component="header"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "rgba(13, 14, 18, 0.85)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          padding: "14px 0",
        }}
      >
        <Container size="xl">
          <Group justify="space-between" align="center">
            {/* Logo */}
            <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
              <Group gap={10} align="center">
                <Box
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background:
                      "linear-gradient(135deg, #7950F2 0%, #D65DB1 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 4px 14px rgba(121, 80, 242, 0.45)",
                  }}
                >
                  <IconToolsKitchen2 size={20} color="white" />
                </Box>
                <Box>
                  <Text
                    fw={800}
                    size="lg"
                    style={{
                      letterSpacing: "-0.5px",
                      lineHeight: 1.1,
                      color: "#ffffff",
                    }}
                  >
                    Logix{" "}
                    <span
                      style={{
                        background:
                          "linear-gradient(135deg, #9775fa 0%, #d65db1 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                      }}
                    >
                      Dine
                    </span>
                  </Text>
                  <Text size="10px" c="dimmed" style={{ letterSpacing: "1px" }}>
                    RESTAURANT OS
                  </Text>
                </Box>
              </Group>
            </Link>

            {/* Middle Nav Links */}
            <Group gap={28} visibleFrom="md">
              <a
                href="#devices"
                style={{
                  color: "#ced4da",
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: 500,
                  transition: "color 0.2s",
                }}
              >
                Devices & Apps
              </a>
              <a
                href="#features"
                style={{
                  color: "#ced4da",
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: 500,
                  transition: "color 0.2s",
                }}
              >
                Features
              </a>
              <a
                href="#hardware"
                style={{
                  color: "#ced4da",
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: 500,
                  transition: "color 0.2s",
                }}
              >
                Thermal Hardware
              </a>
              <a
                href="#pricing"
                style={{
                  color: "#ced4da",
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: 500,
                  transition: "color 0.2s",
                }}
              >
                Pricing
              </a>
            </Group>

            {/* Right Action */}
            <Group gap="sm">
              {isAuthenticated ? (
                <Group gap="xs">
                  <Badge
                    color="grape"
                    variant="light"
                    size="lg"
                    radius="xl"
                    visibleFrom="sm"
                  >
                    {restaurant?.name || "My Restaurant"} • {role || "OWNER"}
                  </Badge>
                  <Button
                    component={Link}
                    href={primaryDashboardHref}
                    color="grape"
                    variant="gradient"
                    gradient={{ from: "#7950F2", to: "#4C6EF5", deg: 135 }}
                    radius="md"
                    size="sm"
                    rightSection={<IconArrowRight size={16} />}
                  >
                    Open POS
                  </Button>
                </Group>
              ) : (
                <Button
                  onClick={openLoginModal}
                  color="grape"
                  variant="gradient"
                  gradient={{ from: "#7950F2", to: "#9775fa", deg: 135 }}
                  radius="md"
                  size="sm"
                  leftSection={<IconBrandWhatsapp size={18} />}
                  style={{
                    boxShadow: "0 4px 14px rgba(121, 80, 242, 0.4)",
                  }}
                >
                  Sign In / Demo
                </Button>
              )}
            </Group>
          </Group>
        </Container>
      </Box>

      {/* ─── HERO SECTION ────────────────────────────────────────────── */}
      <Box
        style={{
          position: "relative",
          paddingTop: 80,
          paddingBottom: 60,
          backgroundImage:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(121, 80, 242, 0.25), transparent)",
        }}
      >
        <Container size="lg">
          <Stack align="center" gap="lg" style={{ textAlign: "center" }}>
            {/* Top Tag Pill */}
            <Badge
              variant="outline"
              size="lg"
              radius="xl"
              style={{
                borderColor: "rgba(121, 80, 242, 0.5)",
                background: "rgba(121, 80, 242, 0.1)",
                color: "#d0bfff",
                padding: "12px 18px",
                textTransform: "none",
                fontWeight: 600,
                fontSize: 13,
              }}
              leftSection={<IconSparkles size={16} color="#d0bfff" />}
            >
              Cloud POS • Silent Thermal KOT • Customer QR Dine-In • Mobile & Desktop
            </Badge>

            {/* Master Headline */}
            <Title
              order={1}
              style={{
                fontSize: "clamp(2.4rem, 5vw, 4.2rem)",
                fontWeight: 850,
                lineHeight: 1.12,
                maxWidth: 880,
                letterSpacing: "-1.5px",
              }}
            >
              The Operating System for Modern Restaurants, Cafes &{" "}
              <span
                style={{
                  background:
                    "linear-gradient(135deg, #b197fc 0%, #e599f7 50%, #748ffc 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Food Chains
              </span>
            </Title>

            {/* Subtitle */}
            <Text
              size="lg"
              c="#adb5bd"
              style={{
                maxWidth: 680,
                fontSize: "clamp(1rem, 2vw, 1.25rem)",
                lineHeight: 1.6,
              }}
            >
              Eliminate 25% aggregator cuts and slow legacy POS boxes. Logix Dine
              combines lightning-fast counter billing, contactless table QR ordering,
              waiter mobility, kitchen display bump screens, and direct silent thermal
              printing into one unified cloud suite.
            </Text>

            {/* Hero CTAs */}
            <Group justify="center" gap="md" mt="sm">
              <Button
                onClick={openLoginModal}
                size="xl"
                radius="xl"
                color="grape"
                variant="gradient"
                gradient={{ from: "#7950F2", to: "#9775fa", deg: 135 }}
                leftSection={<IconBrandWhatsapp size={22} />}
                style={{
                  boxShadow: "0 8px 30px rgba(121, 80, 242, 0.5)",
                  padding: "0 32px",
                }}
              >
                Start 14-Day Free Pilot
              </Button>
              <Button
                component="a"
                href="#devices"
                size="xl"
                radius="xl"
                variant="outline"
                color="gray"
                styles={{
                  root: {
                    backgroundColor: "rgba(255, 255, 255, 0.08)",
                    borderColor: "rgba(255, 255, 255, 0.25)",
                    color: "#ffffff",
                    padding: "0 28px",
                  },
                  label: {
                    color: "#ffffff",
                    fontWeight: 600,
                  },
                }}
                leftSection={<IconDeviceDesktop size={20} color="#ffffff" />}
              >
                View Devices Live
              </Button>
            </Group>

            {/* Feature Micro-Badges */}
            <Group justify="center" gap="lg" mt={24} style={{ color: "#868e96", fontSize: 13 }}>
              <Group gap={6}>
                <IconCheck size={16} color="#20c997" />
                <Text size="sm" c="#ced4da">0.4s Checkout Speed</Text>
              </Group>
              <Group gap={6}>
                <IconCheck size={16} color="#20c997" />
                <Text size="sm" c="#ced4da">Silent ESC/POS Thermal Print</Text>
              </Group>
              <Group gap={6}>
                <IconCheck size={16} color="#20c997" />
                <Text size="sm" c="#ced4da">Zero Commission on Direct Orders</Text>
              </Group>
              <Group gap={6}>
                <IconCheck size={16} color="#20c997" />
                <Text size="sm" c="#ced4da">Offline-Ready Desktop Shell</Text>
              </Group>
            </Group>
          </Stack>
        </Container>
      </Box>

      {/* ─── MULTI-DEVICE SHOWCASE TABS ─────────────────────────────────── */}
      <Box id="devices" style={{ padding: "80px 0 100px", background: "#111217" }}>
        <Container size="xl">
          <Stack align="center" gap="xs" mb={40} style={{ textAlign: "center" }}>
            <Badge color="grape" variant="light" size="md">
              DEVICE ECOSYSTEM
            </Badge>
            <Title order={2} style={{ fontSize: "2.4rem", fontWeight: 800 }}>
              Engineered for Every Screen in Your Restaurant
            </Title>
            <Text c="dimmed" size="md" maw={600}>
              From the counter billing terminal to tableside waiter tablets and guest
              smartphones — every screen stays synchronised in real time.
            </Text>
          </Stack>

          {/* Interactive Showcase Tabs */}
          <Tabs
            value={activeDeviceTab}
            onChange={(val) => val && setActiveDeviceTab(val)}
            variant="pills"
            color="grape"
            radius="xl"
            styles={{
              root: { width: "100%" },
              list: {
                justifyContent: "center",
                gap: 8,
                marginBottom: 36,
                flexWrap: "wrap",
              },
              tab: {
                color: "#adb5bd",
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                fontSize: 13,
                fontWeight: 600,
                padding: "8px 16px",
                "&[data-active]": {
                  background: "linear-gradient(135deg, #7950F2 0%, #4C6EF5 100%)",
                  color: "#ffffff",
                  borderColor: "transparent",
                  boxShadow: "0 4px 16px rgba(121, 80, 242, 0.4)",
                },
              },
            }}
          >
            <Tabs.List>
              {deviceShowcases.map((tab) => {
                const Icon = tab.icon;
                return (
                  <Tabs.Tab key={tab.id} value={tab.id} leftSection={<Icon size={16} />}>
                    {tab.label}
                  </Tabs.Tab>
                );
              })}
            </Tabs.List>
          </Tabs>

          {/* Showcase Display Card */}
          <Paper
            radius="24px"
            p={{ base: "md", md: "xl" }}
            style={{
              background:
                "linear-gradient(180deg, rgba(26, 27, 34, 0.95) 0%, rgba(18, 19, 24, 0.98) 100%)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.6)",
              overflow: "hidden",
            }}
          >
            <SimpleGrid cols={{ base: 1, md: 12 }} spacing="xl" style={{ alignItems: "center" }}>
              {/* Left Info Column */}
              <Box style={{ gridColumn: "span 4" }}>
                <Stack gap="md">
                  <Badge color="grape" variant="light" size="sm" radius="md">
                    {currentShowcase.tag}
                  </Badge>
                  <Title order={3} style={{ fontSize: "1.75rem", fontWeight: 700, lineHeight: 1.25 }}>
                    {currentShowcase.title}
                  </Title>
                  <Text size="sm" c="#adb5bd" style={{ lineHeight: 1.6 }}>
                    {currentShowcase.description}
                  </Text>

                  <Stack gap="xs" mt="xs">
                    {currentShowcase.bullets.map((bullet, idx) => (
                      <Group key={idx} align="flex-start" gap={10} wrap="nowrap">
                        <ThemeIcon size={20} radius="xl" color="grape" variant="light" mt={2}>
                          <IconCheck size={12} stroke={3} />
                        </ThemeIcon>
                        <Text size="sm" c="#ced4da" style={{ flex: 1 }}>
                          {bullet}
                        </Text>
                      </Group>
                    ))}
                  </Stack>

                  <Button
                    onClick={openLoginModal}
                    color="grape"
                    variant="light"
                    radius="md"
                    mt="md"
                    rightSection={<IconArrowRight size={16} />}
                  >
                    Experience Live in Demo
                  </Button>
                </Stack>
              </Box>

              {/* Right Device Frame Column */}
              <Box style={{ gridColumn: "span 8" }}>
                <Box
                  style={{
                    position: "relative",
                    borderRadius: "16px",
                    overflow: "hidden",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    background: "#08090b",
                    boxShadow:
                      "0 20px 50px rgba(0, 0, 0, 0.7), 0 0 40px rgba(121, 80, 242, 0.15)",
                  }}
                >
                  {/* Laptop Mockup Top Window Bar */}
                  <Box
                    style={{
                      height: 32,
                      background: "#16171d",
                      borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                      display: "flex",
                      alignItems: "center",
                      padding: "0 14px",
                      gap: 8,
                    }}
                  >
                    <Box style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f56" }} />
                    <Box style={{ width: 10, height: 10, borderRadius: "50%", background: "#ffbd2e" }} />
                    <Box style={{ width: 10, height: 10, borderRadius: "50%", background: "#27c93f" }} />
                    <Text size="11px" c="dimmed" style={{ marginLeft: 12, fontFamily: "monospace" }}>
                      logix-dine-desktop • {currentShowcase.label}
                    </Text>
                  </Box>

                  {/* Actual Screenshot */}
                  <Box
                    style={{
                      position: "relative",
                      width: "100%",
                      aspectRatio: "16 / 10",
                      background: "#000",
                    }}
                  >
                    <Image
                      src={currentShowcase.image}
                      alt={currentShowcase.title}
                      fill
                      style={{ objectFit: "contain", objectPosition: "top" }}
                      sizes="(max-width: 1200px) 100vw, 800px"
                      priority
                    />
                  </Box>
                </Box>
              </Box>
            </SimpleGrid>
          </Paper>
        </Container>
      </Box>

      {/* ─── 6 PILLARS FEATURE GRID ────────────────────────────────────── */}
      <Box id="features" style={{ padding: "100px 0", background: "#0d0e12" }}>
        <Container size="xl">
          <Stack align="center" gap="xs" mb={60} style={{ textAlign: "center" }}>
            <Badge color="grape" variant="light" size="md">
              COMPREHENSIVE RESTAURANT SUITE
            </Badge>
            <Title order={2} style={{ fontSize: "2.4rem", fontWeight: 800 }}>
              Everything Your Restaurant Needs Under One Roof
            </Title>
            <Text c="dimmed" size="md" maw={640}>
              Stop juggling 5 different subscriptions and confusing software. Logix
              Dine handles the entire guest cycle from table seating to payment.
            </Text>
          </Stack>

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="xl">
            {/* Card 1 */}
            <Card
              padding="xl"
              radius="lg"
              style={{
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                transition: "transform 0.2s ease, border-color 0.2s ease",
              }}
            >
              <ThemeIcon
                size={52}
                radius="md"
                color="grape"
                variant="gradient"
                gradient={{ from: "#7950F2", to: "#9775fa", deg: 135 }}
                mb="md"
              >
                <IconBolt size={26} />
              </ThemeIcon>
              <Text fw={700} size="lg" mb={6}>
                Sub-Second Counter POS
              </Text>
              <Text size="sm" c="#adb5bd" style={{ lineHeight: 1.6 }}>
                Lightning fast checkout with instant keyboard shortcuts, dynamic
                add-ons, automated GST calculations, and split payment modes (Cash, Card,
                UPI).
              </Text>
            </Card>

            {/* Card 2 */}
            <Card
              padding="xl"
              radius="lg"
              style={{
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
              }}
            >
              <ThemeIcon
                size={52}
                radius="md"
                color="indigo"
                variant="gradient"
                gradient={{ from: "#4C6EF5", to: "#748FFC", deg: 135 }}
                mb="md"
              >
                <IconQrcode size={26} />
              </ThemeIcon>
              <Text fw={700} size="lg" mb={6}>
                Contactless QR Dine-In Portal
              </Text>
              <Text size="sm" c="#adb5bd" style={{ lineHeight: 1.6 }}>
                Guests order from high-res digital menus on their phones, re-order rounds,
                ring staff with 1-click, and view running bills without waiting.
              </Text>
            </Card>

            {/* Card 3 */}
            <Card
              padding="xl"
              radius="lg"
              style={{
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
              }}
            >
              <ThemeIcon
                size={52}
                radius="md"
                color="teal"
                variant="gradient"
                gradient={{ from: "#20C997", to: "#38D9A9", deg: 135 }}
                mb="md"
              >
                <IconPrinter size={26} />
              </ThemeIcon>
              <Text fw={700} size="lg" mb={6}>
                Silent Thermal KOT Printing
              </Text>
              <Text size="sm" c="#adb5bd" style={{ lineHeight: 1.6 }}>
                Native desktop integration triggers silent printing directly to 80mm &
                58mm receipt printers on Windows, Mac, and Linux without dialog popups.
              </Text>
            </Card>

            {/* Card 4 */}
            <Card
              padding="xl"
              radius="lg"
              style={{
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
              }}
            >
              <ThemeIcon
                size={52}
                radius="md"
                color="orange"
                variant="gradient"
                gradient={{ from: "#FD7E14", to: "#FFA94D", deg: 135 }}
                mb="md"
              >
                <IconToolsKitchen2 size={26} />
              </ThemeIcon>
              <Text fw={700} size="lg" mb={6}>
                Kitchen Display System (KDS)
              </Text>
              <Text size="sm" c="#adb5bd" style={{ lineHeight: 1.6 }}>
                Live order routing to kitchen stations with prep countdown timers, audio
                order chimes, and instant dish readiness status updates.
              </Text>
            </Card>

            {/* Card 5 */}
            <Card
              padding="xl"
              radius="lg"
              style={{
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
              }}
            >
              <ThemeIcon
                size={52}
                radius="md"
                color="pink"
                variant="gradient"
                gradient={{ from: "#F783AC", to: "#FAA2C1", deg: 135 }}
                mb="md"
              >
                <IconStar size={26} />
              </ThemeIcon>
              <Text fw={700} size="lg" mb={6}>
                Private Ratings & Feedback
              </Text>
              <Text size="sm" c="#adb5bd" style={{ lineHeight: 1.6 }}>
                Catch unhappy customers inside the restaurant with in-app dish ratings,
                anonymous reviews, and an owner reply dashboard before negative public reviews.
              </Text>
            </Card>

            {/* Card 6 */}
            <Card
              padding="xl"
              radius="lg"
              style={{
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
              }}
            >
              <ThemeIcon
                size={52}
                radius="md"
                color="cyan"
                variant="gradient"
                gradient={{ from: "#15AABF", to: "#66D9E8", deg: 135 }}
                mb="md"
              >
                <IconShieldCheck size={26} />
              </ThemeIcon>
              <Text fw={700} size="lg" mb={6}>
                Integrated Payments & Gateway
              </Text>
              <Text size="sm" c="#adb5bd" style={{ lineHeight: 1.6 }}>
                Built-in dynamic UPI QR codes and payment gateway integration. Zero
                middleman lock-in with direct next-day bank account settlement.
              </Text>
            </Card>
          </SimpleGrid>
        </Container>
      </Box>

      {/* ─── HARDWARE & DESKTOP CALLOUT ───────────────────────────────── */}
      <Box id="hardware" style={{ padding: "80px 0", background: "#111217" }}>
        <Container size="lg">
          <Paper
            p={{ base: "xl", md: 50 }}
            radius="24px"
            style={{
              background:
                "linear-gradient(135deg, rgba(121, 80, 242, 0.12) 0%, rgba(76, 110, 245, 0.08) 100%)",
              border: "1px solid rgba(121, 80, 242, 0.3)",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.4)",
            }}
          >
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing={40} style={{ alignItems: "center" }}>
              <Stack gap="md">
                <Badge color="grape" variant="filled" size="sm" radius="md">
                  HARDWARE COMPATIBILITY
                </Badge>
                <Title order={2} style={{ fontSize: "2.2rem", fontWeight: 800 }}>
                  Works with Any Computer & Thermal Printer
                </Title>
                <Text c="#ced4da" size="md" style={{ lineHeight: 1.6 }}>
                  No need to purchase expensive proprietary touch terminals. Download our
                  native app on your existing Windows PC, MacBook, or Linux cashier
                  station and connect any USB/LAN thermal printer in minutes.
                </Text>

                <SimpleGrid cols={2} spacing="md" mt="sm">
                  <Box>
                    <Text fw={700} size="sm" c="white">
                      Supported Platforms
                    </Text>
                    <Text size="xs" c="dimmed">
                      Windows 10/11, macOS, Linux (.deb & AppImage)
                    </Text>
                  </Box>
                  <Box>
                    <Text fw={700} size="sm" c="white">
                      Receipt Sizes
                    </Text>
                    <Text size="xs" c="dimmed">
                      Standard 80mm and 58mm thermal rolls
                    </Text>
                  </Box>
                  <Box>
                    <Text fw={700} size="sm" c="white">
                      Cash Drawers
                    </Text>
                    <Text size="xs" c="dimmed">
                      RJ11 / RJ12 automated drawer kick
                    </Text>
                  </Box>
                  <Box>
                    <Text fw={700} size="sm" c="white">
                      Barcode & QR
                    </Text>
                    <Text size="xs" c="dimmed">
                      Camera QR scanner & handheld barcode guns
                    </Text>
                  </Box>
                </SimpleGrid>
              </Stack>

              <Box style={{ position: "relative", width: "100%", aspectRatio: "4/3" }}>
                <Image
                  src="/showcase/thermal-hardware.png"
                  alt="Thermal Hardware Station"
                  fill
                  style={{ objectFit: "contain" }}
                  sizes="(max-width: 768px) 100vw, 500px"
                />
              </Box>
            </SimpleGrid>
          </Paper>
        </Container>
      </Box>

      {/* ─── PRICING TIERS SECTION ────────────────────────────────────── */}
      <Box id="pricing" style={{ padding: "100px 0", background: "#0d0e12" }}>
        <Container size="xl">
          <Stack align="center" gap="xs" mb={40} style={{ textAlign: "center" }}>
            <Badge color="grape" variant="light" size="md">
              TRANSPARENT PRICING
            </Badge>
            <Title order={2} style={{ fontSize: "2.4rem", fontWeight: 800 }}>
              Simple, Predictable Plans for Every Outlet
            </Title>
            <Text c="dimmed" size="md" maw={600}>
              No hidden fees, no per-order commissions on direct sales. Pick the plan that
              suits your restaurant.
            </Text>

            {/* Monthly / Yearly Toggle */}
            <Group gap="xs" mt="md" style={{ background: "rgba(255, 255, 255, 0.05)", padding: 4, borderRadius: 30 }}>
              <Button
                variant={billingCycle === "monthly" ? "filled" : "subtle"}
                color="grape"
                size="xs"
                radius="xl"
                onClick={() => setBillingCycle("monthly")}
              >
                Monthly Billing
              </Button>
              <Button
                variant={billingCycle === "yearly" ? "filled" : "subtle"}
                color="grape"
                size="xs"
                radius="xl"
                onClick={() => setBillingCycle("yearly")}
              >
                Annual Billing (Save 20%)
              </Button>
            </Group>
          </Stack>

          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="xl">
            {/* Starter Plan */}
            <Card
              padding="xl"
              radius="lg"
              style={{
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Text fw={700} size="lg">
                Starter POS
              </Text>
              <Text size="xs" c="dimmed" mb="md">
                Ideal for Quick-Service Cafes, Bakeries & Cloud Kitchens
              </Text>
              <Group align="baseline" gap={4} mb="lg">
                <Text style={{ fontSize: "2.4rem", fontWeight: 850 }}>
                  {billingCycle === "yearly" ? "₹799" : "₹999"}
                </Text>
                <Text size="sm" c="dimmed">
                  / outlet / month
                </Text>
              </Group>

              <Divider mb="lg" color="rgba(255,255,255,0.06)" />

              <Stack gap="xs" mb="xl" style={{ flex: 1 }}>
                <Group gap={8}>
                  <IconCheck size={16} color="#20c997" />
                  <Text size="sm">Fast Counter POS & Billing</Text>
                </Group>
                <Group gap={8}>
                  <IconCheck size={16} color="#20c997" />
                  <Text size="sm">Desktop App (Windows/Mac/Linux)</Text>
                </Group>
                <Group gap={8}>
                  <IconCheck size={16} color="#20c997" />
                  <Text size="sm">Silent Thermal KOT Printing</Text>
                </Group>
                <Group gap={8}>
                  <IconCheck size={16} color="#20c997" />
                  <Text size="sm">Dynamic UPI QR Code Billing</Text>
                </Group>
                <Group gap={8}>
                  <IconCheck size={16} color="#20c997" />
                  <Text size="sm">Daily Cashier Sales Reports</Text>
                </Group>
              </Stack>

              <Button onClick={openLoginModal} variant="default" fullWidth radius="md">
                Get Started
              </Button>
            </Card>

            {/* Pro Plan (Highlighted) */}
            <Card
              padding="xl"
              radius="lg"
              style={{
                background:
                  "linear-gradient(180deg, rgba(121, 80, 242, 0.15) 0%, rgba(26, 27, 34, 0.95) 100%)",
                border: "2px solid #7950F2",
                boxShadow: "0 12px 40px rgba(121, 80, 242, 0.25)",
                display: "flex",
                flexDirection: "column",
                position: "relative",
              }}
            >
              <Badge
                color="grape"
                variant="filled"
                size="sm"
                radius="xl"
                style={{ position: "absolute", top: -12, right: 24 }}
              >
                MOST POPULAR
              </Badge>

              <Text fw={700} size="lg" c="#d0bfff">
                Pro Dine-In
              </Text>
              <Text size="xs" c="dimmed" mb="md">
                Full-service Restaurants, Casual Dine, Bars & Breweries
              </Text>
              <Group align="baseline" gap={4} mb="lg">
                <Text style={{ fontSize: "2.4rem", fontWeight: 850 }}>
                  {billingCycle === "yearly" ? "₹1,499" : "₹1,799"}
                </Text>
                <Text size="sm" c="dimmed">
                  / outlet / month
                </Text>
              </Group>

              <Divider mb="lg" color="rgba(255,255,255,0.06)" />

              <Stack gap="xs" mb="xl" style={{ flex: 1 }}>
                <Group gap={8}>
                  <IconCheck size={16} color="#20c997" />
                  <Text size="sm" fw={600}>Everything in Starter POS, plus:</Text>
                </Group>
                <Group gap={8}>
                  <IconCheck size={16} color="#20c997" />
                  <Text size="sm">Interactive Table Floor Map</Text>
                </Group>
                <Group gap={8}>
                  <IconCheck size={16} color="#20c997" />
                  <Text size="sm">Waiter Tablets & Kitchen KDS</Text>
                </Group>
                <Group gap={8}>
                  <IconCheck size={16} color="#20c997" />
                  <Text size="sm">Customer QR Dine-In Ordering</Text>
                </Group>
                <Group gap={8}>
                  <IconCheck size={16} color="#20c997" />
                  <Text size="sm">Live Waiter Calling & Bill Request</Text>
                </Group>
                <Group gap={8}>
                  <IconCheck size={16} color="#20c997" />
                  <Text size="sm">Customer Reviews & Star Ratings</Text>
                </Group>
                <Group gap={8}>
                  <IconCheck size={16} color="#20c997" />
                  <Text size="sm">WhatsApp Automated Alerts</Text>
                </Group>
              </Stack>

              <Button
                onClick={openLoginModal}
                color="grape"
                variant="gradient"
                gradient={{ from: "#7950F2", to: "#9775fa", deg: 135 }}
                fullWidth
                radius="md"
              >
                Start 14-Day Free Pilot
              </Button>
            </Card>

            {/* Enterprise Plan */}
            <Card
              padding="xl"
              radius="lg"
              style={{
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Text fw={700} size="lg">
                Enterprise Chains
              </Text>
              <Text size="xs" c="dimmed" mb="md">
                Multi-Outlet Brands, Franchises & Fine Dining
              </Text>
              <Group align="baseline" gap={4} mb="lg">
                <Text style={{ fontSize: "2.4rem", fontWeight: 850 }}>
                  {billingCycle === "yearly" ? "₹2,499" : "₹2,999"}
                </Text>
                <Text size="sm" c="dimmed">
                  / outlet / month
                </Text>
              </Group>

              <Divider mb="lg" color="rgba(255,255,255,0.06)" />

              <Stack gap="xs" mb="xl" style={{ flex: 1 }}>
                <Group gap={8}>
                  <IconCheck size={16} color="#20c997" />
                  <Text size="sm" fw={600}>Everything in Pro Dine-In, plus:</Text>
                </Group>
                <Group gap={8}>
                  <IconCheck size={16} color="#20c997" />
                  <Text size="sm">Inventory & Recipe BOM Tracking</Text>
                </Group>
                <Group gap={8}>
                  <IconCheck size={16} color="#20c997" />
                  <Text size="sm">Multi-Outlet Central Dashboard</Text>
                </Group>
                <Group gap={8}>
                  <IconCheck size={16} color="#20c997" />
                  <Text size="sm">Advanced Sales & Tax Audit Export</Text>
                </Group>
                <Group gap={8}>
                  <IconCheck size={16} color="#20c997" />
                  <Text size="sm">Custom Role & Outlet Permissions</Text>
                </Group>
                <Group gap={8}>
                  <IconCheck size={16} color="#20c997" />
                  <Text size="sm">Dedicated 24/7 Priority Support</Text>
                </Group>
              </Stack>

              <Button onClick={openLoginModal} variant="default" fullWidth radius="md">
                Contact Enterprise Sales
              </Button>
            </Card>
          </SimpleGrid>
        </Container>
      </Box>

      {/* ─── BOTTOM CTA BANNER ────────────────────────────────────────── */}
      <Box style={{ padding: "80px 0 100px", background: "#111217" }}>
        <Container size="md">
          <Paper
            p={{ base: "xl", md: 50 }}
            radius="24px"
            style={{
              textAlign: "center",
              background:
                "linear-gradient(135deg, #7950F2 0%, #4C6EF5 100%)",
              boxShadow: "0 20px 60px rgba(121, 80, 242, 0.4)",
            }}
          >
            <Title order={2} style={{ fontSize: "2.4rem", fontWeight: 850, color: "white" }}>
              Ready to Upgrade Your Restaurant Operations?
            </Title>
            <Text size="lg" style={{ color: "rgba(255,255,255,0.9)", maxWidth: 560, margin: "14px auto 28px" }}>
              Launch in under 15 minutes. Experience lightning-fast counter billing and
              QR dining on your existing hardware.
            </Text>
            <Button
              onClick={openLoginModal}
              size="xl"
              radius="xl"
              color="dark"
              style={{
                background: "#0d0e12",
                color: "#ffffff",
                padding: "0 36px",
              }}
              leftSection={<IconBrandWhatsapp size={22} />}
            >
              Sign In with WhatsApp OTP
            </Button>
          </Paper>
        </Container>
      </Box>

      {/* ─── FOOTER ──────────────────────────────────────────────────── */}
      <Box
        component="footer"
        style={{
          borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          padding: "40px 0 60px",
          background: "#08090b",
        }}
      >
        <Container size="xl">
          <Group justify="space-between" align="center" wrap="wrap" gap="md">
            <Group gap={10}>
              <Box
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background:
                    "linear-gradient(135deg, #7950F2 0%, #D65DB1 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <IconToolsKitchen2 size={16} color="white" />
              </Box>
              <Text fw={700} size="md">
                Logix Dine
              </Text>
              <Text size="xs" c="dimmed">
                • Built with ❤️ by Logix Soft
              </Text>
            </Group>

            <Group gap="lg">
              <Text size="xs" c="dimmed">
                © {new Date().getFullYear()} Logix Soft. All rights reserved.
              </Text>
              <a
                href="https://logixsoft.in"
                target="_blank"
                rel="noreferrer"
                style={{ color: "#868e96", fontSize: 12, textDecoration: "none" }}
              >
                logixsoft.in
              </a>
            </Group>
          </Group>
        </Container>
      </Box>
    </Box>
  );
}
