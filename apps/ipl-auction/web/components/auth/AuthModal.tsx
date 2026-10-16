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
import { Shield, UserCheck, GoogleLogo } from "@phosphor-icons/react";
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
          leftSection={<GoogleLogo size={20} weight="bold" color="#ea4335" />}
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
                <Shield size={14} weight="bold" />
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
                <UserCheck size={14} weight="bold" />
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
