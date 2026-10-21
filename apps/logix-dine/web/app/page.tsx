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
  Grid,
  Card,
  ThemeIcon,
  Badge,
  Tabs,
  Paper,
  Divider,
  Center,
  MantineProvider,
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
  IconTruckDelivery,
  IconPackages,
  IconDownload,
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
    user?.role === "ADMIN"
      ? "/admin/overview"
      : user?.role === "CUSTOMER"
      ? "/home"
      : role === "WAITER" || role === "CAPTAIN"
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
      title: "Fast Keyboard POS Register & Table Billing",
      description:
        "Sub-second item search, quick numpad punch, split payments, automated GST/tax calculation, and cashier shift management. Built natively for desktop with zero browser lag.",
      bullets: [
        "Single-key settlement & keyboard-first counter checkout",
        "Interactive graphical table floor plan with live occupancy",
        "Instant settlement via Direct UPI QR, Cash, and Card",
      ],
      image: "/showcase/pos-terminal.png",
      deviceType: "desktop",
    },
    {
      id: "orders",
      label: "Live Floor & Orders",
      icon: IconReceipt,
      tag: "Real-time Order Stream",
      title: "Unified Kitchen & Delivery Live Order Stream",
      description:
        "Every dine-in table, takeaway counter, and online delivery order streams into a single real-time control room with zero delays.",
      bullets: [
        "Live status tracking: Ordered ➔ Preparing ➔ Ready ➔ Settled",
        "Multi-round table reorders with running bill summary",
        "Color-coded payment tags and fulfillment alerts",
      ],
      image: "/showcase/desktop-orders.png",
      deviceType: "desktop",
    },
    {
      id: "customer",
      label: "Customer QR Dine-In",
      icon: IconDeviceMobile,
      tag: "iOS & Android QR Portal",
      title: "Contactless QR Ordering & Tableside Bill Request",
      description:
        "Guests scan a table QR code to explore visual menus, order food, ring the waiter, request bills, and write verified reviews — with zero app download required.",
      bullets: [
        "1-Click waiter assistance for water, cutlery, or bills",
        "Live bill tracking and round-by-round order progress",
        "Verified customer reviews and food item star ratings",
      ],
      image: "/showcase/customer-app.png",
      deviceType: "mobile",
    },
    {
      id: "waiter",
      label: "Waiter & Kitchen KDS",
      icon: IconToolsKitchen2,
      tag: "Tablet POS & Bump Screens",
      title: "Digital Kitchen Display & Floor Staff Mobility",
      description:
        "Waiters take orders on mobile tablets tableside. Orders immediately fire to the chef's Kitchen Display System (KDS) with live timers and station filters.",
      bullets: [
        "Real-time tableside waiter calling & bill request alerts",
        "Cooking countdown timers and order rush prioritization",
        "Station bump buttons to mark dishes prepared or served",
      ],
      image: "/showcase/waiter-floor.png",
      deviceType: "desktop",
    },
    {
      id: "printer",
      label: "Thermal Printers",
      icon: IconPrinter,
      tag: "Direct Silent ESC/POS",
      title: "Direct 80mm & 58mm Thermal Printing",
      description:
        "No browser print dialogs. The Logix Dine desktop application connects directly to USB, LAN, and Serial receipt printers for instant silent KOT and receipt printing.",
      bullets: [
        "Silent thermal KOT dispatch to kitchen stations",
        "Custom receipts with outlet logo, GSTIN, and UPI QR",
        "Automated cash drawer kick (RJ11/RJ12)",
      ],
      image: "/showcase/thermal-hardware.png",
      deviceType: "desktop",
    },
    {
      id: "aggregators",
      label: "Swiggy & Zomato",
      icon: IconTruckDelivery,
      tag: "Omnichannel Relay Gateway",
      title: "Unified Swiggy, Zomato, Magicpin & ONDC Integration",
      description:
        "Stop operating 4 separate tablets at the front counter. All online platform orders ingest automatically into your central POS and Kitchen KDS with sub-300ms acknowledgment.",
      bullets: [
        "Auto-sync orders directly into kitchen KOT queues",
        "Central menu pricing markup and store pause controls",
        "Zero rider confusion with platform-specific packaging tags",
      ],
      image: "/showcase/desktop-orders.png",
      deviceType: "desktop",
    },
    {
      id: "analytics",
      label: "Reports & Audits",
      icon: IconChartBar,
      tag: "Sales Intelligence",
      title: "Actionable Revenue & GST Sales Reports",
      description:
        "Monitor daily gross sales, item popularity, peak hourly rushes, table turnover speed, and payment method splits in intuitive graphical dashboards.",
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
      label: "Reviews & Ratings",
      icon: IconStar,
      tag: "Reputation Management",
      title: "Private In-Dining Feedback & Dish Ratings",
      description:
        "Catch unhappy customers inside the restaurant with in-app dish ratings and an owner reply dashboard before negative public reviews hit Google or Zomato.",
      bullets: [
        "Dish-specific star ratings to pinpoint recipe issues",
        "Anonymous or verified customer feedback options",
        "Owner reply portal to turn critics into loyal regulars",
      ],
      image: "/showcase/customer-reviews.png",
      deviceType: "desktop",
    },
  ];

  const currentShowcase =
    deviceShowcases.find((s) => s.id === activeDeviceTab) || deviceShowcases[0];

  return (
    <MantineProvider forceColorScheme="dark">
      <Box
        style={{
          backgroundColor: "#0a0b0e",
          color: "#f8f9fa",
          colorScheme: "dark",
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
            background: "rgba(10, 11, 14, 0.9)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            padding: "12px 0",
          }}
        >
          <Container size="xl" px={{ base: "md", md: "lg" }}>
            <Group justify="space-between" align="center" wrap="nowrap">
              {/* Logo */}
              <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
                <Group gap={10} align="center" wrap="nowrap">
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
                      flexShrink: 0,
                    }}
                  >
                    <IconToolsKitchen2 size={20} color="white" />
                  </Box>
                  <Box>
                    <Text
                      fw={800}
                      size="lg"
                      c="white"
                      style={{
                        letterSpacing: "-0.5px",
                        lineHeight: 1.1,
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
                    <Text size="10px" c="#868e96" style={{ letterSpacing: "1px" }}>
                      RESTAURANT OS
                    </Text>
                  </Box>
                </Group>
              </Link>

              {/* Middle Nav Links */}
              <Group gap={28} visibleFrom="md">
                <Link
                  href="/home"
                  style={{
                    color: "#c084fc",
                    textDecoration: "none",
                    fontSize: 14,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    transition: "color 0.2s",
                  }}
                >
                  <IconBuildingStore size={17} />
                  Explore Dining
                </Link>
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
                <Link
                  href="/download"
                  style={{
                    color: "#ced4da",
                    textDecoration: "none",
                    fontSize: 14,
                    fontWeight: 500,
                    transition: "color 0.2s",
                  }}
                >
                  Download Apps
                </Link>
              </Group>

              {/* Right Action */}
              <Group gap="sm" wrap="nowrap">
                {isAuthenticated ? (
                  <Group gap="xs" wrap="nowrap">
                    <Badge
                      color="grape"
                      variant="light"
                      size="md"
                      radius="xl"
                      visibleFrom="sm"
                    >
                      {user?.role === "ADMIN"
                        ? "Platform Superadmin"
                        : `${restaurant?.name || "My Restaurant"} • ${role || "OWNER"}`}
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
                      {user?.role === "ADMIN" ? "Admin Portal" : "Open POS"}
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
                      whiteSpace: "nowrap",
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
            paddingTop: 60,
            paddingBottom: 50,
            backgroundImage:
              "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(121, 80, 242, 0.28), transparent)",
          }}
        >
          <Container size="lg" px={{ base: "md", md: "lg" }}>
            <Stack align="center" gap="lg" style={{ textAlign: "center" }}>
              {/* Top Tag Pill - Fully responsive */}
              <Badge
                variant="outline"
                size="md"
                radius="xl"
                style={{
                  borderColor: "rgba(121, 80, 242, 0.5)",
                  background: "rgba(121, 80, 242, 0.12)",
                  color: "#d0bfff",
                  padding: "8px 16px",
                  textTransform: "none",
                  fontWeight: 600,
                  fontSize: 12.5,
                  maxWidth: "100%",
                }}
                leftSection={<IconSparkles size={15} color="#d0bfff" />}
              >
                Direct UPI • Silent Thermal KOT • QR Dine-In • Swiggy & Zomato Relay
              </Badge>

              {/* Master Headline */}
              <Title
                order={1}
                c="white"
                style={{
                  fontSize: "clamp(2.1rem, 6vw, 4rem)",
                  fontWeight: 850,
                  lineHeight: 1.15,
                  maxWidth: 860,
                  letterSpacing: "-1px",
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
                c="#ced4da"
                style={{
                  maxWidth: 680,
                  fontSize: "clamp(0.95rem, 2.5vw, 1.2rem)",
                  lineHeight: 1.6,
                }}
              >
                Combine lightning-fast counter billing, contactless table QR ordering,
                waiter mobility, kitchen display bump screens, and unified Swiggy/Zomato
                delivery into one seamless cloud suite.
              </Text>

              {/* Hero CTAs */}
              <Group
                justify="center"
                gap="md"
                mt="xs"
                style={{ width: "100%", maxWidth: 640 }}
              >
                {isAuthenticated ? (
                  <Button
                    component={Link}
                    href={primaryDashboardHref}
                    size="lg"
                    radius="xl"
                    color="grape"
                    variant="gradient"
                    gradient={{ from: "#7950F2", to: "#4C6EF5", deg: 135 }}
                    rightSection={<IconArrowRight size={22} />}
                    style={{
                      boxShadow: "0 8px 30px rgba(121, 80, 242, 0.5)",
                      padding: "0 28px",
                      flex: "1 1 auto",
                    }}
                  >
                    {user?.role === "ADMIN" ? "Platform Admin Portal" : "Launch POS Terminal"}
                  </Button>
                ) : (
                  <Button
                    onClick={openLoginModal}
                    size="lg"
                    radius="xl"
                    color="grape"
                    variant="gradient"
                    gradient={{ from: "#7950F2", to: "#9775fa", deg: 135 }}
                    leftSection={<IconBrandWhatsapp size={22} />}
                    style={{
                      boxShadow: "0 8px 30px rgba(121, 80, 242, 0.5)",
                      padding: "0 28px",
                      flex: "1 1 auto",
                    }}
                  >
                    Start Free with WhatsApp
                  </Button>
                )}
                <Button
                  component={Link}
                  href="/home"
                  size="lg"
                  radius="xl"
                  variant="outline"
                  styles={{
                    root: {
                      backgroundColor: "rgba(147, 51, 234, 0.15)",
                      borderColor: "rgba(192, 132, 252, 0.45)",
                      color: "#ffffff",
                      padding: "0 24px",
                      flex: "1 1 auto",
                      transition: "all 0.2s ease",
                    },
                    label: {
                      color: "#ffffff",
                      fontWeight: 600,
                    },
                  }}
                  leftSection={<IconBuildingStore size={20} color="#c084fc" />}
                >
                  Explore Dining
                </Button>
                <Button
                  component="a"
                  href="#devices"
                  size="lg"
                  radius="xl"
                  variant="outline"
                  color="gray"
                  styles={{
                    root: {
                      backgroundColor: "rgba(255, 255, 255, 0.08)",
                      borderColor: "rgba(255, 255, 255, 0.25)",
                      color: "#ffffff",
                      padding: "0 24px",
                      flex: "1 1 auto",
                    },
                    label: {
                      color: "#ffffff",
                      fontWeight: 600,
                    },
                  }}
                  leftSection={<IconDeviceDesktop size={18} color="#ffffff" />}
                >
                  Explore Devices
                </Button>
              </Group>

              {/* Feature Micro-Badges */}
              <SimpleGrid
                cols={{ base: 2, sm: 4 }}
                spacing={{ base: "xs", sm: "md" }}
                mt={16}
                style={{ width: "100%", maxWidth: 800 }}
              >
                <Group gap={6} justify="center">
                  <IconCheck size={16} color="#20c997" />
                  <Text size="xs" c="#ced4da" fw={500}>
                    0% Dine-In Commission
                  </Text>
                </Group>
                <Group gap={6} justify="center">
                  <IconCheck size={16} color="#20c997" />
                  <Text size="xs" c="#ced4da" fw={500}>
                    Silent Thermal KOT
                  </Text>
                </Group>
                <Group gap={6} justify="center">
                  <IconCheck size={16} color="#20c997" />
                  <Text size="xs" c="#ced4da" fw={500}>
                    Direct UPI Settlement
                  </Text>
                </Group>
                <Group gap={6} justify="center">
                  <IconCheck size={16} color="#20c997" />
                  <Text size="xs" c="#ced4da" fw={500}>
                    Native Win/Mac/Linux
                  </Text>
                </Group>
              </SimpleGrid>
            </Stack>
          </Container>
        </Box>

        {/* ─── MULTI-DEVICE SHOWCASE TABS ─────────────────────────────────── */}
        <Box id="devices" style={{ padding: "60px 0 80px", background: "#0e0f14" }}>
          <Container size="xl" px={{ base: "md", md: "lg" }}>
            <Stack align="center" gap="xs" mb={32} style={{ textAlign: "center" }}>
              <Badge color="grape" variant="light" size="md">
                DEVICE ECOSYSTEM
              </Badge>
              <Title order={2} c="white" style={{ fontSize: "clamp(1.8rem, 4vw, 2.4rem)", fontWeight: 800 }}>
                Engineered for Every Screen in Your Restaurant
              </Title>
              <Text c="#adb5bd" size="md" maw={600}>
                From the counter billing terminal to tableside waiter tablets and guest
                smartphones — every screen stays synchronised in real time.
              </Text>
            </Stack>

            {/* Interactive Showcase Tabs - Mobile horizontally scrollable */}
            <Tabs
              value={activeDeviceTab}
              onChange={(val) => val && setActiveDeviceTab(val)}
              variant="pills"
              color="grape"
              radius="xl"
              styles={{
                root: { width: "100%" },
                list: {
                  justifyContent: "flex-start",
                  gap: 8,
                  marginBottom: 28,
                  flexWrap: "nowrap",
                  overflowX: "auto",
                  paddingBottom: 8,
                  scrollbarWidth: "none",
                  WebkitOverflowScrolling: "touch",
                },
                tab: {
                  color: "#ced4da",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "8px 14px",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
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

            {/* Showcase Display Card - Powered by Mantine Grid (zero overflow bugs) */}
            <Paper
              radius="24px"
              p={{ base: "md", md: 36 }}
              style={{
                background:
                  "linear-gradient(180deg, rgba(24, 25, 32, 0.98) 0%, rgba(14, 15, 20, 0.98) 100%)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                boxShadow: "0 24px 60px rgba(0, 0, 0, 0.6)",
                overflow: "hidden",
              }}
            >
              <Grid gap="xl" align="center">
                {/* Left Info Column */}
                <Grid.Col span={{ base: 12, md: 5 }}>
                  <Stack gap="md">
                    <Badge color="grape" variant="light" size="sm" radius="md">
                      {currentShowcase.tag}
                    </Badge>
                    <Title
                      order={3}
                      c="white"
                      style={{ fontSize: "clamp(1.4rem, 3vw, 1.85rem)", fontWeight: 700, lineHeight: 1.25 }}
                    >
                      {currentShowcase.title}
                    </Title>
                    <Text size="sm" c="#ced4da" style={{ lineHeight: 1.6 }}>
                      {currentShowcase.description}
                    </Text>

                    <Stack gap="xs" mt="xs">
                      {currentShowcase.bullets.map((bullet, idx) => (
                        <Group key={idx} align="flex-start" gap={10} wrap="nowrap">
                          <ThemeIcon size={20} radius="xl" color="grape" variant="light" mt={2} style={{ flexShrink: 0 }}>
                            <IconCheck size={12} stroke={3} />
                          </ThemeIcon>
                          <Text size="sm" c="#e9ecef" style={{ flex: 1, lineHeight: 1.45 }}>
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
                      mt="sm"
                      fullWidth={false}
                      rightSection={<IconArrowRight size={16} />}
                      styles={{
                        root: {
                          alignSelf: "flex-start",
                        },
                      }}
                    >
                      Try in Live POS
                    </Button>
                  </Stack>
                </Grid.Col>

                {/* Right Device Frame Column */}
                <Grid.Col span={{ base: 12, md: 7 }}>
                  {currentShowcase.deviceType === "mobile" ? (
                    /* Smartphone Frame for Mobile Portals */
                    <Center py="xs">
                      <Box
                        style={{
                          position: "relative",
                          width: "100%",
                          maxWidth: 290,
                          borderRadius: 36,
                          padding: "10px 8px 12px",
                          background: "linear-gradient(145deg, #2b2d35, #141519)",
                          border: "2px solid #495057",
                          boxShadow: "0 25px 60px rgba(0,0,0,0.8), 0 0 40px rgba(121, 80, 242, 0.2)",
                        }}
                      >
                        {/* Dynamic Island / Notch */}
                        <Box
                          style={{
                            width: 80,
                            height: 16,
                            borderRadius: 10,
                            background: "#08090b",
                            margin: "0 auto 8px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Box style={{ width: 6, height: 6, borderRadius: "50%", background: "#212529", marginRight: 6 }} />
                          <Box style={{ width: 32, height: 3, borderRadius: 2, background: "#212529" }} />
                        </Box>

                        {/* Screen Image Container */}
                        <Box
                          style={{
                            position: "relative",
                            width: "100%",
                            height: 480,
                            borderRadius: 22,
                            overflow: "hidden",
                            background: "#121318",
                          }}
                        >
                          <Image
                            src={currentShowcase.image}
                            alt={currentShowcase.title}
                            fill
                            style={{ objectFit: "contain", objectPosition: "top" }}
                            sizes="(max-width: 768px) 280px, 300px"
                            priority
                          />
                        </Box>
                      </Box>
                    </Center>
                  ) : (
                    /* Laptop Mockup Frame for Desktop Views */
                    <Box
                      style={{
                        position: "relative",
                        borderRadius: "16px",
                        overflow: "hidden",
                        border: "1px solid rgba(255, 255, 255, 0.14)",
                        background: "#08090b",
                        boxShadow:
                          "0 20px 50px rgba(0, 0, 0, 0.7), 0 0 40px rgba(121, 80, 242, 0.15)",
                      }}
                    >
                      {/* Top Window Bar */}
                      <Box
                        style={{
                          height: 30,
                          background: "#16171d",
                          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                          display: "flex",
                          alignItems: "center",
                          padding: "0 12px",
                          gap: 6,
                        }}
                      >
                        <Box style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f56" }} />
                        <Box style={{ width: 10, height: 10, borderRadius: "50%", background: "#ffbd2e" }} />
                        <Box style={{ width: 10, height: 10, borderRadius: "50%", background: "#27c93f" }} />
                        <Text size="11px" c="#adb5bd" style={{ marginLeft: 10, fontFamily: "monospace" }}>
                          logix-dine • {currentShowcase.label}
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
                          sizes="(max-width: 1200px) 100vw, 750px"
                          priority
                        />
                      </Box>
                    </Box>
                  )}
                </Grid.Col>
              </Grid>
            </Paper>
          </Container>
        </Box>

        {/* ─── 6 PILLARS FEATURE GRID ────────────────────────────────────── */}
        <Box id="features" style={{ padding: "80px 0", background: "#0a0b0e" }}>
          <Container size="xl" px={{ base: "md", md: "lg" }}>
            <Stack align="center" gap="xs" mb={50} style={{ textAlign: "center" }}>
              <Badge color="grape" variant="light" size="md">
                COMPREHENSIVE RESTAURANT SUITE
              </Badge>
              <Title order={2} c="white" style={{ fontSize: "clamp(1.8rem, 4vw, 2.4rem)", fontWeight: 800 }}>
                Everything Your Restaurant Needs Under One Roof
              </Title>
              <Text c="#adb5bd" size="md" maw={640}>
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
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
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
                <Text fw={700} size="lg" c="white" mb={8}>
                  Keyboard-First Counter POS
                </Text>
                <Text size="sm" c="#ced4da" style={{ lineHeight: 1.6 }}>
                  Rapid billing with keyboard shortcuts, item quick-search, dynamic
                  add-ons, automated GST calculations, and split payments (Cash, Card,
                  UPI).
                </Text>
              </Card>

              {/* Card 2 */}
              <Card
                padding="xl"
                radius="lg"
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
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
                <Text fw={700} size="lg" c="white" mb={8}>
                  Contactless QR Dine-In Portal
                </Text>
                <Text size="sm" c="#ced4da" style={{ lineHeight: 1.6 }}>
                  Guests order from high-res digital menus on their phones, re-order rounds,
                  ring staff for water or bills with 1 click, with zero app download required.
                </Text>
              </Card>

              {/* Card 3 */}
              <Card
                padding="xl"
                radius="lg"
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
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
                <Text fw={700} size="lg" c="white" mb={8}>
                  Silent Thermal KOT Printing
                </Text>
                <Text size="sm" c="#ced4da" style={{ lineHeight: 1.6 }}>
                  Native desktop integration triggers silent printing directly to 80mm &
                  58mm receipt printers on Windows, Mac, and Linux without dialog popups.
                </Text>
              </Card>

              {/* Card 4 */}
              <Card
                padding="xl"
                radius="lg"
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
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
                <Text fw={700} size="lg" c="white" mb={8}>
                  Kitchen Display System (KDS)
                </Text>
                <Text size="sm" c="#ced4da" style={{ lineHeight: 1.6 }}>
                  Live order routing to kitchen bump stations with prep countdown timers,
                  station filters, and audio chime alerts on incoming orders.
                </Text>
              </Card>

              {/* Card 5 */}
              <Card
                padding="xl"
                radius="lg"
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
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
                  <IconTruckDelivery size={26} />
                </ThemeIcon>
                <Text fw={700} size="lg" c="white" mb={8}>
                  Omnichannel Delivery Relay
                </Text>
                <Text size="sm" c="#ced4da" style={{ lineHeight: 1.6 }}>
                  Consolidate Swiggy, Zomato, Magicpin, and ONDC orders into a single kitchen
                  stream. Centralized menu pricing markups and pause controls.
                </Text>
              </Card>

              {/* Card 6 */}
              <Card
                padding="xl"
                radius="lg"
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
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
                <Text fw={700} size="lg" c="white" mb={8}>
                  Direct Dynamic UPI Settlement
                </Text>
                <Text size="sm" c="#ced4da" style={{ lineHeight: 1.6 }}>
                  Customer UPI payments go straight into your own bank account with 0%
                  gateway deductions. Zero middleman holding your daily revenue.
                </Text>
              </Card>
            </SimpleGrid>
          </Container>
        </Box>

        {/* ─── HARDWARE & DESKTOP CALLOUT ───────────────────────────────── */}
        <Box id="hardware" style={{ padding: "70px 0", background: "#0e0f14" }}>
          <Container size="lg" px={{ base: "md", md: "lg" }}>
            <Paper
              p={{ base: "lg", md: 48 }}
              radius="24px"
              style={{
                background:
                  "linear-gradient(135deg, rgba(121, 80, 242, 0.12) 0%, rgba(76, 110, 245, 0.08) 100%)",
                border: "1px solid rgba(121, 80, 242, 0.3)",
                boxShadow: "0 20px 60px rgba(0, 0, 0, 0.4)",
              }}
            >
              <Grid gap="xl" align="center">
                <Grid.Col span={{ base: 12, md: 7 }}>
                  <Stack gap="md">
                    <Badge color="grape" variant="filled" size="sm" radius="md">
                      HARDWARE COMPATIBILITY
                    </Badge>
                    <Title order={2} c="white" style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.2rem)", fontWeight: 800 }}>
                      Works with Any Computer & Thermal Printer
                    </Title>
                    <Text c="#ced4da" size="md" style={{ lineHeight: 1.6 }}>
                      No need to purchase expensive proprietary touch terminals. Download our
                      native app on your existing Windows PC, MacBook, or Linux cashier
                      station and connect any USB/LAN thermal printer in minutes.
                    </Text>

                    <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md" mt="sm">
                      <Box>
                        <Text fw={700} size="sm" c="white">
                          Supported Platforms
                        </Text>
                        <Text size="xs" c="#adb5bd">
                          Windows 10/11, macOS, Linux (.deb & AppImage)
                        </Text>
                      </Box>
                      <Box>
                        <Text fw={700} size="sm" c="white">
                          Receipt Sizes
                        </Text>
                        <Text size="xs" c="#adb5bd">
                          Standard 80mm and 58mm thermal rolls
                        </Text>
                      </Box>
                      <Box>
                        <Text fw={700} size="sm" c="white">
                          Cash Drawers
                        </Text>
                        <Text size="xs" c="#adb5bd">
                          RJ11 / RJ12 automated drawer kick
                        </Text>
                      </Box>
                      <Box>
                        <Text fw={700} size="sm" c="white">
                          Barcode & QR
                        </Text>
                        <Text size="xs" c="#adb5bd">
                          Camera QR scanner & handheld barcode guns
                        </Text>
                      </Box>
                    </SimpleGrid>

                    <Group mt="xs">
                      <Button
                        component={Link}
                        href="/download"
                        variant="gradient"
                        gradient={{ from: "#7950F2", to: "#4C6EF5", deg: 135 }}
                        radius="md"
                        size="md"
                        leftSection={<IconDownload size={18} />}
                      >
                        Download Apps for Windows, Mac, Linux & Android
                      </Button>
                    </Group>
                  </Stack>
                </Grid.Col>

                <Grid.Col span={{ base: 12, md: 5 }}>
                  <Box style={{ position: "relative", width: "100%", aspectRatio: "4/3" }}>
                    <Image
                      src="/showcase/thermal-hardware.png"
                      alt="Thermal Hardware Station"
                      fill
                      style={{ objectFit: "contain" }}
                      sizes="(max-width: 768px) 100vw, 450px"
                    />
                  </Box>
                </Grid.Col>
              </Grid>
            </Paper>
          </Container>
        </Box>

        {/* ─── PRICING TIERS SECTION ────────────────────────────────────── */}
        <Box id="pricing" style={{ padding: "80px 0", background: "#0a0b0e" }}>
          <Container size="xl" px={{ base: "md", md: "lg" }}>
            <Stack align="center" gap="xs" mb={40} style={{ textAlign: "center" }}>
              <Badge color="grape" variant="light" size="md">
                TRANSPARENT PRICING
              </Badge>
              <Title order={2} c="white" style={{ fontSize: "clamp(1.8rem, 4vw, 2.4rem)", fontWeight: 800 }}>
                Simple, Predictable Plans for Every Outlet
              </Title>
              <Text c="#adb5bd" size="md" maw={600}>
                No hidden fees, no per-order commissions on direct sales. Pick the plan that
                suits your restaurant.
              </Text>

              {/* Monthly / Yearly Toggle */}
              <Group
                gap="xs"
                mt="sm"
                style={{
                  background: "rgba(255, 255, 255, 0.06)",
                  padding: 4,
                  borderRadius: 30,
                }}
              >
                <Button
                  variant={billingCycle === "monthly" ? "filled" : "subtle"}
                  color="grape"
                  size="xs"
                  radius="xl"
                  onClick={() => setBillingCycle("monthly")}
                  styles={{
                    root: {
                      color: billingCycle === "monthly" ? "#ffffff" : "#ced4da",
                    },
                  }}
                >
                  Monthly Billing
                </Button>
                <Button
                  variant={billingCycle === "yearly" ? "filled" : "subtle"}
                  color="grape"
                  size="xs"
                  radius="xl"
                  onClick={() => setBillingCycle("yearly")}
                  styles={{
                    root: {
                      color: billingCycle === "yearly" ? "#ffffff" : "#ced4da",
                    },
                  }}
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
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Text fw={700} size="lg" c="white">
                  Starter POS
                </Text>
                <Text size="xs" c="#adb5bd" mb="md">
                  Ideal for Quick-Service Cafes, Bakeries & Cloud Kitchens
                </Text>
                <Group align="baseline" gap={4} mb="lg">
                  <Text style={{ fontSize: "2.4rem", fontWeight: 850, color: "#ffffff" }}>
                    {billingCycle === "yearly" ? "₹799" : "₹999"}
                  </Text>
                  <Text size="sm" c="#adb5bd">
                    / outlet / month
                  </Text>
                </Group>

                <Divider mb="lg" color="rgba(255,255,255,0.08)" />

                <Stack gap="xs" mb="xl" style={{ flex: 1 }}>
                  <Group gap={8}>
                    <IconCheck size={16} color="#20c997" />
                    <Text size="sm" c="#e9ecef">Fast Counter POS & Billing</Text>
                  </Group>
                  <Group gap={8}>
                    <IconCheck size={16} color="#20c997" />
                    <Text size="sm" c="#e9ecef">Desktop App (Windows/Mac/Linux)</Text>
                  </Group>
                  <Group gap={8}>
                    <IconCheck size={16} color="#20c997" />
                    <Text size="sm" c="#e9ecef">Silent Thermal KOT Printing</Text>
                  </Group>
                  <Group gap={8}>
                    <IconCheck size={16} color="#20c997" />
                    <Text size="sm" c="#e9ecef">Dynamic UPI QR Code Billing</Text>
                  </Group>
                  <Group gap={8}>
                    <IconCheck size={16} color="#20c997" />
                    <Text size="sm" c="#e9ecef">Daily Cashier Sales Reports</Text>
                  </Group>
                </Stack>

                <Button
                  onClick={openLoginModal}
                  variant="outline"
                  color="gray"
                  fullWidth
                  radius="md"
                  styles={{
                    root: {
                      backgroundColor: "rgba(255, 255, 255, 0.08)",
                      borderColor: "rgba(255, 255, 255, 0.25)",
                      color: "#ffffff",
                    },
                    label: {
                      color: "#ffffff",
                      fontWeight: 600,
                    },
                  }}
                >
                  Get Started Free
                </Button>
              </Card>

              {/* Pro Plan (Highlighted) */}
              <Card
                padding="xl"
                radius="lg"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(121, 80, 242, 0.18) 0%, rgba(20, 21, 28, 0.98) 100%)",
                  border: "2px solid #7950F2",
                  boxShadow: "0 12px 40px rgba(121, 80, 242, 0.3)",
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
                <Text size="xs" c="#adb5bd" mb="md">
                  Full-service Restaurants, Casual Dine, Bars & Breweries
                </Text>
                <Group align="baseline" gap={4} mb="lg">
                  <Text style={{ fontSize: "2.4rem", fontWeight: 850, color: "#ffffff" }}>
                    {billingCycle === "yearly" ? "₹1,499" : "₹1,799"}
                  </Text>
                  <Text size="sm" c="#adb5bd">
                    / outlet / month
                  </Text>
                </Group>

                <Divider mb="lg" color="rgba(255,255,255,0.08)" />

                <Stack gap="xs" mb="xl" style={{ flex: 1 }}>
                  <Group gap={8}>
                    <IconCheck size={16} color="#20c997" />
                    <Text size="sm" fw={600} c="white">Everything in Starter POS, plus:</Text>
                  </Group>
                  <Group gap={8}>
                    <IconCheck size={16} color="#20c997" />
                    <Text size="sm" c="#e9ecef">Interactive Table Floor Map</Text>
                  </Group>
                  <Group gap={8}>
                    <IconCheck size={16} color="#20c997" />
                    <Text size="sm" c="#e9ecef">Waiter Tablets & Kitchen KDS</Text>
                  </Group>
                  <Group gap={8}>
                    <IconCheck size={16} color="#20c997" />
                    <Text size="sm" c="#e9ecef">Customer QR Dine-In Ordering</Text>
                  </Group>
                  <Group gap={8}>
                    <IconCheck size={16} color="#20c997" />
                    <Text size="sm" c="#e9ecef">Live Waiter Calling & Bill Request</Text>
                  </Group>
                  <Group gap={8}>
                    <IconCheck size={16} color="#20c997" />
                    <Text size="sm" c="#e9ecef">Customer Reviews & Star Ratings</Text>
                  </Group>
                  <Group gap={8}>
                    <IconCheck size={16} color="#20c997" />
                    <Text size="sm" c="#e9ecef">WhatsApp Automated Alerts</Text>
                  </Group>
                </Stack>

                <Button
                  onClick={openLoginModal}
                  color="grape"
                  variant="gradient"
                  gradient={{ from: "#7950F2", to: "#9775fa", deg: 135 }}
                  fullWidth
                  radius="md"
                  styles={{
                    label: {
                      fontWeight: 700,
                    },
                  }}
                >
                  Get Started with Pro
                </Button>
              </Card>

              {/* Enterprise Plan */}
              <Card
                padding="xl"
                radius="lg"
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Text fw={700} size="lg" c="white">
                  Enterprise Chains
                </Text>
                <Text size="xs" c="#adb5bd" mb="md">
                  Multi-Outlet Brands, Franchises & Fine Dining
                </Text>
                <Group align="baseline" gap={4} mb="lg">
                  <Text style={{ fontSize: "2.4rem", fontWeight: 850, color: "#ffffff" }}>
                    {billingCycle === "yearly" ? "₹2,499" : "₹2,999"}
                  </Text>
                  <Text size="sm" c="#adb5bd">
                    / outlet / month
                  </Text>
                </Group>

                <Divider mb="lg" color="rgba(255,255,255,0.08)" />

                <Stack gap="xs" mb="xl" style={{ flex: 1 }}>
                  <Group gap={8}>
                    <IconCheck size={16} color="#20c997" />
                    <Text size="sm" fw={600} c="white">Everything in Pro Dine-In, plus:</Text>
                  </Group>
                  <Group gap={8}>
                    <IconCheck size={16} color="#20c997" />
                    <Text size="sm" c="#e9ecef">Swiggy & Zomato Aggregator Relay</Text>
                  </Group>
                  <Group gap={8}>
                    <IconCheck size={16} color="#20c997" />
                    <Text size="sm" c="#e9ecef">Inventory & Recipe BOM Tracking</Text>
                  </Group>
                  <Group gap={8}>
                    <IconCheck size={16} color="#20c997" />
                    <Text size="sm" c="#e9ecef">Multi-Outlet Central Dashboard</Text>
                  </Group>
                  <Group gap={8}>
                    <IconCheck size={16} color="#20c997" />
                    <Text size="sm" c="#e9ecef">Advanced Sales & Tax Audit Export</Text>
                  </Group>
                  <Group gap={8}>
                    <IconCheck size={16} color="#20c997" />
                    <Text size="sm" c="#e9ecef">Custom Role & Outlet Permissions</Text>
                  </Group>
                </Stack>

                <Button
                  component="a"
                  href="https://wa.me/919999999999?text=Hi%20Logix%20Dine,%20I'm%20interested%20in%20Logix%20Dine%20Enterprise"
                  target="_blank"
                  rel="noreferrer"
                  variant="outline"
                  color="gray"
                  fullWidth
                  radius="md"
                  styles={{
                    root: {
                      backgroundColor: "rgba(255, 255, 255, 0.08)",
                      borderColor: "rgba(255, 255, 255, 0.25)",
                      color: "#ffffff",
                    },
                    label: {
                      color: "#ffffff",
                      fontWeight: 600,
                    },
                  }}
                >
                  Chat with Sales
                </Button>
              </Card>
            </SimpleGrid>
          </Container>
        </Box>

        {/* ─── BOTTOM CTA BANNER ────────────────────────────────────────── */}
        <Box style={{ padding: "60px 0 80px", background: "#0e0f14" }}>
          <Container size="md" px={{ base: "md", md: "lg" }}>
            <Paper
              p={{ base: "xl", md: 48 }}
              radius="24px"
              style={{
                textAlign: "center",
                background:
                  "linear-gradient(135deg, #7950F2 0%, #4C6EF5 100%)",
                boxShadow: "0 20px 60px rgba(121, 80, 242, 0.4)",
              }}
            >
              <Title
                order={2}
                c="white"
                style={{ fontSize: "clamp(1.6rem, 4.5vw, 2.3rem)", fontWeight: 850 }}
              >
                Ready to Upgrade Your Restaurant Operations?
              </Title>
              <Text
                size="md"
                c="white"
                style={{ opacity: 0.95, maxWidth: 540, margin: "14px auto 24px", lineHeight: 1.6 }}
              >
                Sign in with your WhatsApp number. Experience keyboard-fast counter
                billing, QR table ordering, and silent thermal printing on your existing hardware.
              </Text>
              <Button
                onClick={openLoginModal}
                size="lg"
                radius="xl"
                color="dark"
                style={{
                  background: "#0a0b0e",
                  color: "#ffffff",
                  padding: "0 32px",
                }}
                leftSection={<IconBrandWhatsapp size={20} />}
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
            padding: "36px 0 48px",
            background: "#07070a",
          }}
        >
          <Container size="xl" px={{ base: "md", md: "lg" }}>
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
                <Text fw={700} size="md" c="white">
                  Logix Dine
                </Text>
                <Text size="xs" c="#adb5bd">
                  • Built with ❤️ by Logix Soft
                </Text>
              </Group>

              <Group gap="lg">
                <Link
                  href="/home"
                  style={{ color: "#c084fc", fontSize: 13, textDecoration: "none", fontWeight: 600 }}
                >
                  Explore Dining
                </Link>
                <Link
                  href="/download"
                  style={{ color: "#adb5bd", fontSize: 13, textDecoration: "none" }}
                >
                  Download Desktop & Mobile Apps
                </Link>
                <Text size="xs" c="#868e96">
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
    </MantineProvider>
  );
}
