"use client";

import React from "react";
import Link from "next/link";
import {
  Container, Title, Text, Button, Group, Stack, SimpleGrid, Card, ThemeIcon, Badge,
} from "@mantine/core";
import {
  IconBrandWhatsapp, IconShieldLock, IconCookie, IconArrowRight,
  IconShoppingCart, IconReceipt, IconBuildingStore,
} from "@tabler/icons-react";
import { useAuth } from "@/lib/auth-context";
import { useRestaurant } from "@/lib/restaurant-context";

export default function HomePage() {
  const { isAuthenticated, openLoginModal } = useAuth();
  const { restaurant } = useRestaurant();

  // Redirect owners directly to POS
  if (isAuthenticated && restaurant) {
    return (
      <Container size="xl" pt="md" pb={100} px="md">
        <Stack align="center" gap="md" style={{ textAlign: "center" }}>
          <Badge color="dinePrimary" variant="light" size="lg" radius="xl" px="md">
            {restaurant.name}
          </Badge>
          <Title order={1} style={{ fontSize: "2rem", fontWeight: 800 }}>
            Welcome back! Ready to start billing?
          </Title>
          <Group justify="center">
            <Button component={Link} href="/pos" size="lg" color="dinePrimary" leftSection={<IconShoppingCart size={20} />}>
              Go to POS
            </Button>
            <Button component={Link} href="/orders" size="lg" variant="default" leftSection={<IconReceipt size={20} />}>
              View Orders
            </Button>
          </Group>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="xl" pt="md" pb={100} px="md">
      <Stack align="center" gap="xl" style={{ textAlign: "center" }}>
        <Badge
          color="dinePrimary"
          variant="light"
          size="lg"
          radius="xl"
          px="md"
        >
          WhatsApp OTP Authentication
        </Badge>

        <Title
          order={1}
          style={{
            fontSize: "2.75rem",
            fontWeight: 800,
            lineHeight: 1.15,
            maxWidth: 750,
          }}
        >
          Modern Dining & Restaurant Management Powered by{" "}
          <span style={{ color: "#af73d7" }}>Logix Dine</span>
        </Title>

        <Text c="dimmed" size="lg" maw={600}>
          Seamless passwordless sign-in with your mobile number and WhatsApp OTP.
          Protected by HttpOnly cookies with zero tokens stored in localStorage.
        </Text>

        <Group justify="center" mt="md">
          {isAuthenticated ? (
            <Button
              component={Link}
              href="/dashboard"
              size="lg"
              color="dinePrimary"
              rightSection={<IconArrowRight size={18} />}
              leftSection={<IconShoppingCart size={18} />}
            >
              Go to Protected Dashboard
            </Button>
          ) : (
            <Button
              size="lg"
              color="dinePrimary"
              leftSection={<IconBrandWhatsapp size={20} />}
              onClick={openLoginModal}
            >
              Sign In with Mobile OTP
            </Button>
          )}

          <Button
            component={Link}
            href="/dashboard"
            size="lg"
            variant="default"
          >
            Explore Protected Area
          </Button>
        </Group>

        {/* Feature Highlights Grid */}
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xl" mt={40} style={{ width: "100%", textAlign: "left" }}>
          <Card withBorder padding="xl" radius="md">
            <ThemeIcon size={48} radius="md" color="dinePrimary" variant="light" mb="md">
              <IconBrandWhatsapp size={26} />
            </ThemeIcon>
            <Text fw={700} size="lg" mb={6}>
              WhatsApp OTP Delivery
            </Text>
            <Text size="sm" c="dimmed">
              Instant 6-digit one-time passcode delivered directly to your WhatsApp via our dedicated gateway.
            </Text>
          </Card>

          <Card withBorder padding="xl" radius="md">
            <ThemeIcon size={48} radius="md" color="dinePrimary" variant="light" mb="md">
              <IconCookie size={26} />
            </ThemeIcon>
            <Text fw={700} size="lg" mb={6}>
              Cookie-Only Security
            </Text>
            <Text size="sm" c="dimmed">
              Session tokens are strictly stored in HttpOnly, SameSite cookies. Zero exposure in localStorage.
            </Text>
          </Card>

          <Card withBorder padding="xl" radius="md">
            <ThemeIcon size={48} radius="md" color="dinePrimary" variant="light" mb="md">
              <IconShieldLock size={26} />
            </ThemeIcon>
            <Text fw={700} size="lg" mb={6}>
              Protected Pages
            </Text>
            <Text size="sm" c="dimmed">
              Authenticated route groups and layouts that require an active session to view private restaurant data.
            </Text>
          </Card>
        </SimpleGrid>
      </Stack>
    </Container>
  );
}
