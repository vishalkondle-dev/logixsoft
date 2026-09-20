"use client";

import React, { ReactNode } from "react";
import {
  Container,
  Paper,
  Title,
  Text,
  Button,
  Stack,
  ThemeIcon,
  Center,
  Loader,
} from "@mantine/core";
import { IconLock, IconBrandWhatsapp } from "@tabler/icons-react";
import { useAuth } from "@/lib/auth-context";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, openLoginModal } = useAuth();

  if (isLoading) {
    return (
      <Center py={100}>
        <Stack align="center" gap="md">
          <Loader size="lg" color="dinePrimary" />
          <Text size="sm" c="dimmed">
            Checking authentication session...
          </Text>
        </Stack>
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

            <Title order={2}>Access Restricted</Title>

            <Text c="dimmed" size="sm" maw={400}>
              This is a protected area. You must be logged in with your mobile number and WhatsApp verification to access this page.
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

  return <>{children}</>;
}
