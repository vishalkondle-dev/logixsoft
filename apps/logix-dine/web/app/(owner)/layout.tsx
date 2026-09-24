"use client";

import React, { ReactNode, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Center, Loader, Container, Paper, Stack, Title, Text, Button, ThemeIcon } from "@mantine/core";
import { IconLock, IconBrandWhatsapp } from "@tabler/icons-react";
import { useAuth } from "@/lib/auth-context";
import { useRestaurant } from "@/lib/restaurant-context";

export default function OwnerLayout({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading: authLoading, openLoginModal } = useAuth();
  const { restaurant, myRestaurants, activeOutlet, isLoading: restLoading, role } = useRestaurant();
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
    // KITCHEN role can only access /kitchen
    if (restaurant && role === "KITCHEN" && !redirected.current && pathname !== "/kitchen") {
      redirected.current = true;
      router.replace(activeOutlet ? `/kitchen?outletId=${activeOutlet.id}` : "/kitchen");
      return;
    }
    // WAITER role can access /waiter, /rider, /pos, /orders, /tables, /kitchen, and /customers
    if (
      restaurant &&
      role === "WAITER" &&
      !redirected.current &&
      !pathname.startsWith("/waiter") &&
      !pathname.startsWith("/rider") &&
      !pathname.startsWith("/pos") &&
      !pathname.startsWith("/orders") &&
      !pathname.startsWith("/tables") &&
      !pathname.startsWith("/kitchen") &&
      !pathname.startsWith("/customers")
    ) {
      redirected.current = true;
      router.replace(activeOutlet ? `/waiter?outletId=${activeOutlet.id}` : "/waiter");
      return;
    }
  }, [authLoading, restLoading, isAuthenticated, restaurant, myRestaurants, activeOutlet, role, pathname, router]);

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

  // Authenticated but no restaurant yet, or KITCHEN/WAITER restricted role being redirected — show loader
  const isRestrictedRole =
    (role === "KITCHEN" && pathname !== "/kitchen") ||
    (role === "WAITER" &&
      !pathname.startsWith("/waiter") &&
      !pathname.startsWith("/rider") &&
      !pathname.startsWith("/pos") &&
      !pathname.startsWith("/orders") &&
      !pathname.startsWith("/tables") &&
      !pathname.startsWith("/kitchen") &&
      !pathname.startsWith("/customers"));
  if (!restaurant || isRestrictedRole) {
    return (
      <Center py={100}>
        <Loader size="lg" color="dinePrimary" />
      </Center>
    );
  }

  return <>{children}</>;
}
