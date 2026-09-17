"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Container, Paper, Title, Text, TextInput, Button, Stack,
  Group, ThemeIcon, Stepper, Loader, Alert,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconBuildingStore, IconCheck, IconAlertCircle } from "@tabler/icons-react";
import { createRestaurant } from "@/lib/api-client";
import { useRestaurant } from "@/lib/restaurant-context";

export default function OnboardingPage() {
  const router = useRouter();
  const { setActiveRestaurant } = useRestaurant();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", address: "", phone: "", outletName: "Main",
  });

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

  return (
    <Container size="sm" py={60}>
      <Paper withBorder p="xl" radius="lg" shadow="sm">
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
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
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
