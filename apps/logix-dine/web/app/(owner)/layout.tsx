"use client";

import React, { ReactNode, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Center, Loader, Container, Paper, Stack, Title, Text, Button, ThemeIcon } from "@mantine/core";
import { IconLock, IconBrandWhatsapp } from "@tabler/icons-react";
import { useAuth } from "@/lib/auth-context";
import { useRestaurant } from "@/lib/restaurant-context";

export default function OwnerLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authLoading, openLoginModal } = useAuth();
  const { restaurant, isLoading: restLoading } = useRestaurant();
  const router = useRouter();
  const redirected = useRef(false);

  useEffect(() => {
    // Only redirect after BOTH auth and restaurant have fully loaded
    if (authLoading || restLoading) return;
    if (!isAuthenticated) return; // handled below in render
    // Authenticated but no restaurant → send to onboarding
    if (!restaurant && !redirected.current) {
      redirected.current = true;
      router.replace("/onboarding");
    }
  }, [authLoading, restLoading, isAuthenticated, restaurant, router]);

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
        <Paper withBorder p="xl" radius="lg" shadow="sm" style={{ textAlign: "center" }}>
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

  // Authenticated but no restaurant yet — show loader while redirect fires
  if (!restaurant) {
    return (
      <Center py={100}>
        <Loader size="lg" color="dinePrimary" />
      </Center>
    );
  }

  return <>{children}</>;
}
