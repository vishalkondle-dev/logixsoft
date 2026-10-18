"use client";

import React, { useState } from "react";
import {
  Modal,
  TextInput,
  Button,
  Stack,
  Text,
  Title,
  ThemeIcon,
  Center,
  Divider,
} from "@mantine/core";
import { Gavel, User, Sparkle } from "@phosphor-icons/react";
import { useAuthStore } from "../../stores/authStore";

interface JoinNameModalProps {
  isOpen: boolean;
  onSetName: (name: string) => void;
}

export const JoinNameModal: React.FC<JoinNameModalProps> = ({ isOpen, onSetName }) => {
  const [nameInput, setNameInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { openAuthModal } = useAuthStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setError("Please enter your name to enter the auction");
      return;
    }
    if (trimmed.length < 2) {
      setError("Name must be at least 2 characters");
      return;
    }
    try {
      localStorage.setItem("ipl_auction_user_name", trimmed);
    } catch {}
    onSetName(trimmed);
  };

  return (
    <Modal
      opened={isOpen}
      onClose={() => {}}
      withCloseButton={false}
      centered
      radius="xl"
      padding="xl"
      overlayProps={{ backgroundOpacity: 0.8, blur: 8 }}
      styles={{
        content: {
          backgroundColor: "var(--ipl-modal-bg)",
          border: "1px solid var(--ipl-border)",
        },
      }}
    >
      <Stack gap="md" align="center" style={{ textAlign: "center" }}>
        <Center>
          <ThemeIcon
            size={60}
            radius="xl"
            variant="gradient"
            gradient={{ from: "orange.6", to: "red.7", deg: 45 }}
            style={{ boxShadow: "0 8px 24px rgba(234, 88, 12, 0.35)" }}
          >
            <Gavel size={32} weight="bold" />
          </ThemeIcon>
        </Center>

        <div>
          <Title order={3} c="var(--mantine-color-text)" fw={900}>
            Join the Auction
          </Title>
          <Text size="xs" c="dimmed" mt={4}>
            Enter your name to participate in live bidding and chat.
          </Text>
        </div>

        <form onSubmit={handleSubmit} style={{ width: "100%" }}>
          <Stack gap="sm">
            <TextInput
              leftSection={<User size={18} weight="bold" />}
              autoFocus
              required
              maxLength={40}
              value={nameInput}
              onChange={(e) => {
                setNameInput(e.currentTarget.value);
                if (error) setError(null);
              }}
              placeholder="e.g. Virat Sharma"
              error={error}
              size="md"
              radius="md"
              styles={{
                input: {
                  backgroundColor: "var(--ipl-bg-card-subtle)",
                  borderColor: "var(--ipl-border)",
                  color: "var(--mantine-color-text)",
                },
              }}
            />

            <Button
              type="submit"
              size="md"
              radius="md"
              fullWidth
              variant="gradient"
              gradient={{ from: "orange.6", to: "amber.5", deg: 90 }}
              style={{ fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}
            >
              Enter Auction Arena
            </Button>
          </Stack>
        </form>

        <Divider label="or sign in with your account" labelPosition="center" w="100%" color="var(--ipl-border)" />

        <Button
          type="button"
          onClick={() => openAuthModal()}
          variant="light"
          color="indigo"
          radius="md"
          fullWidth
          size="sm"
          leftSection={<Sparkle size={16} weight="fill" color="#f59f00" />}
        >
          Sign in with Google (Auto-names you)
        </Button>
      </Stack>
    </Modal>
  );
};
