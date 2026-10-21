"use client";

import React, { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Container,
  Paper,
  Title,
  Text,
  Button,
  Stack,
  Loader,
  Center,
  ThemeIcon,
} from "@mantine/core";
import { IconBrandWhatsapp } from "@tabler/icons-react";
import { useAuth } from "@/lib/auth-context";
import { CustomerProvider, useCustomer } from "@/lib/customer-context";
import { PortalHeader } from "@/components/portal/portal-header";
import { PortalBottomNav, type PortalTab } from "@/components/portal/portal-bottom-nav";

function CustomerLayoutInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { customer, activeOrders, activeWaitlist, activeReservations, isRefetching, refetch } = useCustomer();

  const currentTab: PortalTab = React.useMemo(() => {
    if (pathname === "/live") return "live";
    if (pathname === "/my-orders") return "orders";
    if (pathname === "/profile") return "profile";
    return "home";
  }, [pathname]);

  const liveCount =
    (activeOrders?.length || 0) +
    (activeWaitlist?.length || 0) +
    (activeReservations?.length || 0);

  const handleTabChange = (tab: PortalTab) => {
    switch (tab) {
      case "home":
        router.push("/home");
        break;
      case "live":
        router.push("/live");
        break;
      case "orders":
        router.push("/my-orders");
        break;
      case "profile":
        router.push("/profile");
        break;
    }
  };

  const primaryActiveOrder = activeOrders?.[0];

  return (
    <BoxWrapper>
      {/* ─── Top Dining App-Bar Header ─── */}
      <PortalHeader
        customerName={customer?.name || user?.name}
        phoneNumber={customer?.phone || user?.phoneNumber}
        restaurantName={primaryActiveOrder?.restaurantName}
        outletName={primaryActiveOrder?.outletName}
        activeOrders={activeOrders}
        isRefetching={isRefetching}
        onRefresh={refetch}
        onSelectActiveOrder={() => router.push("/live")}
        onOpenProfile={() => router.push("/profile")}
      />

      {/* ─── Page View Content ─── */}
      <Container size="md" px={{ base: 12, sm: "md" }} py={{ base: "xs", sm: "md" }} pb={100}>
        {children}
      </Container>

      {/* ─── Bottom Navigation Floating Island ─── */}
      <PortalBottomNav
        activeTab={currentTab}
        onTabChange={handleTabChange}
        liveCount={liveCount}
        isLiveActive={liveCount > 0}
      />
    </BoxWrapper>
  );
}

function BoxWrapper({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8f9fa" }}>
      {children}
    </div>
  );
}

export default function CustomerLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authLoading, openLoginModal } = useAuth();

  if (authLoading) {
    return (
      <Center py={100} style={{ minHeight: "60vh" }}>
        <Loader size="lg" color="dinePrimary" />
      </Center>
    );
  }

  if (!isAuthenticated) {
    return (
      <Container size="xs" py={{ base: 60, sm: 100 }}>
        <Paper
          p={{ base: "lg", sm: "xl" }}
          radius="xl"
          withBorder
          shadow="md"
          style={{ textAlign: "center", background: "#fff" }}
        >
          <Stack align="center" gap="lg">
            <ThemeIcon size={72} radius="xl" color="dinePrimary" variant="light">
              <IconBrandWhatsapp size={38} />
            </ThemeIcon>

            <div>
              <Title order={2} style={{ fontSize: "1.75rem", fontWeight: 800 }}>
                Customer Dining Hub
              </Title>
              <Text c="dimmed" size="sm" mt={6} maw={420} mx="auto">
                Sign in with your mobile number to track live seated orders, kitchen preparation status, waitlist queue, and past receipts.
              </Text>
            </div>

            <Button
              size="lg"
              color="dinePrimary"
              leftSection={<IconBrandWhatsapp size={22} />}
              onClick={openLoginModal}
              radius="md"
              fullWidth
              maw={320}
            >
              Sign In with WhatsApp OTP
            </Button>
          </Stack>
        </Paper>
      </Container>
    );
  }

  return (
    <CustomerProvider>
      <CustomerLayoutInner>{children}</CustomerLayoutInner>
    </CustomerProvider>
  );
}
