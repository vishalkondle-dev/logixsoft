"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Container, Paper, Title, Text, TextInput, Button, Stack,
  Group, ThemeIcon, Stepper, Loader, Alert, Center,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconBuildingStore, IconCheck, IconAlertCircle, IconLock, IconBrandWhatsapp } from "@tabler/icons-react";
import { createRestaurant } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useRestaurant } from "@/lib/restaurant-context";

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, openLoginModal } = useAuth();
  const { restaurant, isLoading: restLoading, setActiveRestaurant } = useRestaurant();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", address: "", phone: "", outletName: "Main",
  });

  useEffect(() => {
    if (authLoading || restLoading) return;
    if (restaurant) {
      router.replace("/pos");
    } else if (user?.role === "CUSTOMER") {
      router.replace("/portal");
    }
  }, [authLoading, restLoading, restaurant, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.address.trim()) {
      setError("Restaurant name and address are required.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await createRestaurant({
        name: form.name.trim(),
        address: form.address.trim(),
        phone: form.phone.trim() || undefined,
        outletName: form.outletName.trim() || "Main",
      });
      // Save restaurant id and redirect
      setActiveRestaurant(result.restaurant.id);
      notifications.show({
        title: "Restaurant created!",
        message: `Welcome to ${result.restaurant.name}`,
        color: "dinePrimary",
        icon: <IconCheck size={18} />,
      });
      router.push("/pos");
    } catch (err: any) {
      setError(err?.message || "Failed to create restaurant");
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || restLoading || restaurant) {
    return (
      <Center py={100}>
        <Loader size="lg" color="dinePrimary" />
      </Center>
    );
  }

  if (!isAuthenticated) {
    return (
      <Container size="sm" py={80}>
        <Paper p="xl" radius="lg" style={{ textAlign: "center" }}>
          <Stack align="center" gap="md">
            <ThemeIcon size={64} radius="xl" color="dinePrimary" variant="light">
              <IconLock size={32} />
            </ThemeIcon>
            <Title order={2}>Sign In Required</Title>
            <Text c="dimmed" size="sm" maw={400}>
              Please sign in with your mobile number to set up your restaurant.
            </Text>
            <Button
              size="md"
              color="dinePrimary"
              leftSection={<IconBrandWhatsapp size={18} />}
              onClick={openLoginModal}
            >
              Sign In with WhatsApp OTP
            </Button>
          </Stack>
        </Paper>
      </Container>
    );
  }

  return (
    <Container size="sm" py={60}>
      <Paper p="xl" radius="lg">
        <Stack gap="lg">
          <Group>
            <ThemeIcon size={48} radius="md" color="dinePrimary" variant="light">
              <IconBuildingStore size={26} />
            </ThemeIcon>
            <div>
              <Title order={2}>Set up your restaurant</Title>
              <Text c="dimmed" size="sm">You&apos;ll be ready to start billing in seconds</Text>
            </div>
          </Group>

          {error && (
            <Alert icon={<IconAlertCircle size={16} />} color="red" title="Error" withCloseButton onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              <TextInput
                label="Restaurant Name"
                placeholder="e.g. Vishal Diner"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                disabled={isLoading}
              />
              <TextInput
                label="Address"
                placeholder="e.g. Main Road, Karad"
                required
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                disabled={isLoading}
              />
              <TextInput
                label="Phone (optional)"
                placeholder="e.g. 9876543210"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={15}
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, "") }))}
                disabled={isLoading}
              />
              <TextInput
                label="First Outlet Name"
                placeholder="Main"
                description="You can add more outlets later from Settings"
                value={form.outletName}
                onChange={(e) => setForm((f) => ({ ...f, outletName: e.target.value }))}
                disabled={isLoading}
              />
              <Button type="submit" color="dinePrimary" fullWidth size="md" loading={isLoading} leftSection={<IconBuildingStore size={18} />}>
                Create Restaurant & Start Billing
              </Button>
            </Stack>
          </form>
        </Stack>
      </Paper>
    </Container>
  );
}
