"use client";

import React, { useState } from "react";
import {
  Modal,
  Button,
  TextInput,
  Stack,
  Group,
  SimpleGrid,
  Text,
  Title,
  Badge,
  Paper,
  Divider,
  ThemeIcon,
  Box,
  UnstyledButton,
} from "@mantine/core";
import { IconShield, IconUserCheck, IconSparkles } from "@tabler/icons-react";
import { useAuthStore } from "../../stores/authStore";
import { initiateGoogleSignIn } from "../../lib/auth-client";

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, googleEnabled, loginAsDemo, loginWithGoogle } = useAuthStore();
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [customEmail, setCustomEmail] = useState("");
  const [showEmailInput, setShowEmailInput] = useState(false);

  const handleGoogleClick = async (emailOverride?: string) => {
    setLoadingGoogle(true);
    try {
      if (googleEnabled) {
        await initiateGoogleSignIn(emailOverride);
      } else {
        const email = emailOverride || customEmail.trim() || "vishalkondle.dev@gmail.com";
        const name =
          email === "vishalkondle.dev@gmail.com"
            ? "Vishal Kondle"
            : email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
        await loginWithGoogle(email, name);
        closeAuthModal();
      }
    } catch (err) {
      console.error("Google sign in error:", err);
    } finally {
      setLoadingGoogle(false);
    }
  };

  const handleDemoSignIn = async (role: "admin" | "user") => {
    setLoadingRole(role);
    try {
      await loginAsDemo(role);
      closeAuthModal();
    } finally {
      setLoadingRole(null);
    }
  };

  return (
    <Modal
      opened={isAuthModalOpen}
      onClose={closeAuthModal}
      centered
      radius="xl"
      padding="xl"
      overlayProps={{ backgroundOpacity: 0.75, blur: 6 }}
      title={
        <Group gap="xs">
          <ThemeIcon
            size={32}
            radius="md"
            variant="gradient"
            gradient={{ from: "orange.6", to: "red.7", deg: 45 }}
          >
            <span style={{ fontWeight: 900, fontSize: 11 }}>IPL</span>
          </ThemeIcon>
          <Title order={4} fw={900}>
            Sign In to IPL Auction Simulator
          </Title>
        </Group>
      }
    >
      <Stack gap="md">
        <Text size="xs" c="dimmed">
          Authenticate to manage franchises, preserve custom squad rosters, or access Administrator Controls.
        </Text>

        {/* Google OAuth Button */}
        <Button
          fullWidth
          size="md"
          variant="default"
          radius="md"
          loading={loadingGoogle}
          onClick={() => handleGoogleClick()}
          leftSection={
            <svg style={{ width: 18, height: 18 }} viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          }
        >
          Continue with Google
        </Button>

        {/* Account Info and switch */}
        {!googleEnabled && (
          <Paper withBorder p="xs" radius="md" bg="dark.7">
            <Group justify="space-between" wrap="nowrap">
              <Group gap={6} wrap="nowrap" style={{ overflow: "hidden" }}>
                <Box
                  w={8}
                  h={8}
                  style={{ borderRadius: "50%", backgroundColor: "#51cf66", flexShrink: 0 }}
                />
                <Text size="xs" truncate c="dimmed">
                  Account: <strong style={{ color: "#ffffff" }}>Vishal Kondle</strong> (
                  <span style={{ fontFamily: "monospace" }}>vishalkondle.dev@gmail.com</span>)
                </Text>
              </Group>
              <UnstyledButton
                onClick={() => setShowEmailInput(!showEmailInput)}
                style={{ fontSize: 11, fontWeight: 700, color: "#4c6ef5", flexShrink: 0 }}
              >
                {showEmailInput ? "Hide" : "Switch"}
              </UnstyledButton>
            </Group>

            {showEmailInput && (
              <Box
                component="form"
                mt="xs"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (customEmail.trim()) {
                    handleGoogleClick(customEmail.trim());
                  }
                }}
              >
                <Group gap="xs">
                  <TextInput
                    size="xs"
                    placeholder="e.g. name@gmail.com"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.currentTarget.value)}
                    style={{ flex: 1 }}
                  />
                  <Button
                    type="submit"
                    size="xs"
                    disabled={!customEmail.trim() || loadingGoogle}
                  >
                    Use
                  </Button>
                </Group>
              </Box>
            )}
          </Paper>
        )}

        <Divider label="Quick Role Sign-In" labelPosition="center" color="dark.5" />

        <SimpleGrid cols={2} spacing="sm">
          {/* Admin Sign-In */}
          <Paper
            withBorder
            p="sm"
            radius="md"
            component="button"
            onClick={() => handleDemoSignIn("admin")}
            disabled={loadingRole !== null}
            style={{
              cursor: "pointer",
              textAlign: "left",
              backgroundColor: "rgba(245, 159, 0, 0.05)",
              borderColor: "rgba(245, 159, 0, 0.3)",
              transition: "all 0.15s ease",
            }}
          >
            <Group justify="space-between" mb={4}>
              <ThemeIcon size="sm" radius="md" color="yellow" variant="light">
                <IconShield size={14} />
              </ThemeIcon>
              <Badge size="xs" color="yellow" variant="light">
                ADMIN
              </Badge>
            </Group>
            <Text size="xs" fw={700} c="white">
              IPL Commissioner
            </Text>
            <Text size="10px" c="dimmed">
              Unlocks Admin Security Tier
            </Text>
          </Paper>

          {/* User Sign-In */}
          <Paper
            withBorder
            p="sm"
            radius="md"
            component="button"
            onClick={() => handleDemoSignIn("user")}
            disabled={loadingRole !== null}
            style={{
              cursor: "pointer",
              textAlign: "left",
              backgroundColor: "rgba(76, 110, 245, 0.05)",
              borderColor: "rgba(76, 110, 245, 0.3)",
              transition: "all 0.15s ease",
            }}
          >
            <Group justify="space-between" mb={4}>
              <ThemeIcon size="sm" radius="md" color="blue" variant="light">
                <IconUserCheck size={14} />
              </ThemeIcon>
              <Badge size="xs" color="blue" variant="light">
                PLAYER
              </Badge>
            </Group>
            <Text size="xs" fw={700} c="white">
              Cricket Strategist
            </Text>
            <Text size="10px" c="dimmed">
              Standard bidder account
            </Text>
          </Paper>
        </SimpleGrid>
      </Stack>
    </Modal>
  );
};
