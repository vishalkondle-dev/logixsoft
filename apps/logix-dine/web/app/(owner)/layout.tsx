"use client";

import React, { ReactNode, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Center, Loader, Container, Paper, Stack, Title, Text, Button, ThemeIcon } from "@mantine/core";
import { IconLock, IconBrandWhatsapp } from "@tabler/icons-react";
import { useAuth } from "@/lib/auth-context";
import { useRestaurant } from "@/lib/restaurant-context";

function getRoleHomePath(role: string | null, outletId?: string | null, can?: (perm: string) => boolean): string {
  const q = outletId ? `?outletId=${outletId}` : "";
  if (can) {
    if (can("pos:view")) return `/pos${q}`;
    if (can("waiter:view")) return `/waiter${q}`;
    if (can("kitchen:view")) return `/kitchen${q}`;
    if (can("delivery:view")) return `/rider${q}`;
    if (can("tables:view")) return `/tables${q}`;
  }
  switch (role) {
    case "KITCHEN":
      return `/kitchen${q}`;
    case "RIDER":
      return `/rider${q}`;
    case "WAITER":
    case "CAPTAIN":
      return `/waiter${q}`;
    case "CASHIER":
      return `/pos${q}`;
    default:
      return `/pos${q}`;
  }
}

function isPathAllowedForRole(role: string | null, pathname: string, can?: (perm: string) => boolean): boolean {
  if (!role || role === "OWNER" || role === "MANAGER") return true;

  // Settings are never allowed for staff roles below MANAGER
  if (pathname.startsWith("/settings")) return false;

  switch (role) {
    case "KITCHEN":
      return pathname.startsWith("/kitchen");
    case "RIDER":
      return pathname.startsWith("/rider");
    case "WAITER":
      return (
        pathname.startsWith("/waiter") ||
        pathname.startsWith("/tables") ||
        pathname.startsWith("/pos") ||
        pathname.startsWith("/orders")
      );
    case "CAPTAIN":
      return (
        pathname.startsWith("/waiter") ||
        pathname.startsWith("/tables") ||
        pathname.startsWith("/pos") ||
        pathname.startsWith("/orders") ||
        pathname.startsWith("/kitchen")
      );
    case "CASHIER":
      return (
        pathname.startsWith("/pos") ||
        pathname.startsWith("/tables") ||
        pathname.startsWith("/orders")
      );
    default:
      // Custom role dynamic permission verification
      if (can) {
        if (pathname.startsWith("/kitchen") && can("kitchen:view")) return true;
        if (pathname.startsWith("/rider") && can("delivery:view")) return true;
        if (pathname.startsWith("/pos") && can("pos:view")) return true;
        if (pathname.startsWith("/waiter") && can("waiter:view")) return true;
        if (pathname.startsWith("/tables") && can("tables:view")) return true;
        if (
          pathname.startsWith("/orders") &&
          (can("pos:view") || can("waiter:view") || can("kitchen:view") || can("delivery:view"))
        ) {
          return true;
        }
        return false;
      }
      return true;
  }
}

export default function OwnerLayout({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading: authLoading, openLoginModal } = useAuth();
  const { restaurant, myRestaurants, activeOutlet, isLoading: restLoading, role, can } = useRestaurant();
  const router = useRouter();
  const pathname = usePathname();
  const redirected = useRef(false);

  useEffect(() => {
    redirected.current = false;
  }, [pathname]);

  useEffect(() => {
    // Only redirect after BOTH auth and restaurant have fully loaded
    if (authLoading || restLoading) return;
    if (!isAuthenticated) return; // handled below in render
    // Authenticated but no restaurant and no memberships → send to onboarding (or portal if customer)
    if (!restaurant && !myRestaurants.length && !redirected.current) {
      redirected.current = true;
      if (user?.role === "CUSTOMER") {
        router.replace("/portal");
      } else {
        router.replace("/onboarding");
      }
      return;
    }
    // Enforce role-based allowed routes for all staff roles
    if (restaurant && role && !isPathAllowedForRole(role, pathname, can) && !redirected.current) {
      redirected.current = true;
      router.replace(getRoleHomePath(role, activeOutlet?.id, can));
      return;
    }
  }, [authLoading, restLoading, isAuthenticated, restaurant, myRestaurants, activeOutlet, role, pathname, router, can]);

  // Still loading either auth or restaurant context
  if (authLoading || (isAuthenticated && restLoading)) {
    return (
      <Center py={100}>
        <Loader size="lg" color="dinePrimary" />
      </Center>
    );
  }

  // Not logged in
  if (!isAuthenticated) {
    return (
      <Container size="sm" py={80}>
        <Paper p="xl" radius="lg" style={{ textAlign: "center" }}>
          <Stack align="center" gap="md">
            <ThemeIcon size={64} radius="xl" color="dinePrimary" variant="light">
              <IconLock size={32} />
            </ThemeIcon>
            <Title order={2}>Sign In Required</Title>
            <Text c="dimmed" size="sm" maw={400}>Please sign in to access this page.</Text>
            <Button size="md" color="dinePrimary" leftSection={<IconBrandWhatsapp size={18} />} onClick={openLoginModal}>
              Sign In with WhatsApp OTP
            </Button>
          </Stack>
        </Paper>
      </Container>
    );
  }

  // Authenticated but no restaurant yet, or restricted role being redirected — show loader
  const isRestrictedRole = Boolean(role && !isPathAllowedForRole(role, pathname, can));
  if (!restaurant || isRestrictedRole) {
    return (
      <Center py={100}>
        <Loader size="lg" color="dinePrimary" />
      </Center>
    );
  }

  return <>{children}</>;
}
