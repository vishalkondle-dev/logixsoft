"use client";

import React from "react";
import {
  Box,
  Title,
  Text,
  Paper,
  Group,
  Badge,
  ThemeIcon,
  Stack,
  Button,
  SimpleGrid,
  Card,
  Divider,
} from "@mantine/core";
import {
  IconUser,
  IconPhone,
  IconShieldCheck,
  IconCookie,
  IconLogout,
  IconBrandWhatsapp,
  IconReceipt,
  IconArmchair,
} from "@tabler/icons-react";
import { useAuth } from "@/lib/auth-context";

export default function ProtectedDashboardPage() {
  const { user, signOut } = useAuth();

  return (
    <Box py="xl" px={{ base: "xs", sm: "md" }}>
      <Stack gap="xl">
        {/* Welcome Header */}
        <Group justify="space-between" align="flex-start">
          <div>
            <Group gap="xs" align="center">
              <Title order={1}>Welcome, {user?.name || "Guest"}</Title>
              <Badge color="green" variant="light" size="lg" leftSection={<IconShieldCheck size={14} />}>
                Verified via WhatsApp
              </Badge>
            </Group>
            <Text c="dimmed" size="sm" mt={4}>
              Logged in via secure mobile number and OTP cookie session.
            </Text>
          </div>

          <Button
            variant="light"
            color="red"
            leftSection={<IconLogout size={16} />}
            onClick={() => signOut()}
          >
            Sign Out
          </Button>
        </Group>

        {/* Overview Stats */}
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
          <Card padding="lg" radius="md">
            <Group justify="space-between">
              <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                Phone Number
              </Text>
              <ThemeIcon color="dinePrimary" variant="light" size="md">
                <IconPhone size={18} />
              </ThemeIcon>
            </Group>
            <Text fw={700} size="xl" mt="sm">
              {user?.phoneNumber}
            </Text>
            <Text size="xs" c="dimmed" mt={4}>
              Linked to WhatsApp
            </Text>
          </Card>

          <Card padding="lg" radius="md">
            <Group justify="space-between">
              <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                Account Role
              </Text>
              <ThemeIcon color="dinePrimary" variant="light" size="md">
                <IconUser size={18} />
              </ThemeIcon>
            </Group>
            <Text fw={700} size="xl" mt="sm">
              {user?.role || "CUSTOMER"}
            </Text>
            <Text size="xs" c="dimmed" mt={4}>
              Standard Dining Access
            </Text>
          </Card>

          <Card padding="lg" radius="md">
            <Group justify="space-between">
              <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                Session Storage
              </Text>
              <ThemeIcon color="green" variant="light" size="md">
                <IconCookie size={18} />
              </ThemeIcon>
            </Group>
            <Text fw={700} size="xl" mt="sm">
              HttpOnly Cookies
            </Text>
            <Text size="xs" c="teal" mt={4}>
              Zero localStorage tokens
            </Text>
          </Card>
        </SimpleGrid>

        {/* User Details & Security Card */}
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          <div>
            <Paper p="xl" radius="md" h="100%">
              <Title order={3} mb="md">
                Profile Information
              </Title>
              <Divider mb="md" />

              <Stack gap="md">
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Display Name
                  </Text>
                  <Text fw={600} size="sm">
                    {user?.name || "Not provided"}
                  </Text>
                </Group>

                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    User Identifier
                  </Text>
                  <Text fw={500} size="xs" ff="monospace">
                    {user?.id}
                  </Text>
                </Group>

                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Authentication Method
                  </Text>
                  <Badge color="green" variant="light">
                    WhatsApp OTP
                  </Badge>
                </Group>

                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Account Status
                  </Text>
                  <Badge color="blue" variant="light">
                    Active Session
                  </Badge>
                </Group>
              </Stack>
            </Paper>
          </div>

          <div>
            <Paper p="xl" radius="md" h="100%">
              <Title order={3} mb="md">
                Dining Quick Actions
              </Title>
              <Divider mb="md" />

              <SimpleGrid cols={2} spacing="md">
                <Card padding="md" radius="md" style={{ cursor: "pointer" }}>
                  <ThemeIcon color="dinePrimary" variant="light" size="lg" mb="xs">
                    <IconArmchair size={22} />
                  </ThemeIcon>
                  <Text fw={600} size="sm">
                    Table Reservations
                  </Text>
                  <Text size="xs" c="dimmed">
                    Reserve a dining table
                  </Text>
                </Card>

                <Card padding="md" radius="md" style={{ cursor: "pointer" }}>
                  <ThemeIcon color="dinePrimary" variant="light" size="lg" mb="xs">
                    <IconReceipt size={22} />
                  </ThemeIcon>
                  <Text fw={600} size="sm">
                    Order History
                  </Text>
                  <Text size="xs" c="dimmed">
                    View recent dining receipts
                  </Text>
                </Card>
              </SimpleGrid>
            </Paper>
          </div>
        </SimpleGrid>
      </Stack>
    </Box>
  );
}
