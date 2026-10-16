"use client";

import React, { useEffect } from "react";
import { useAuthStore } from "../../stores/authStore";
import {
  Menu,
  Button,
  UnstyledButton,
  Group,
  Avatar,
  Text,
  Badge,
  Tooltip,
  Box,
} from "@mantine/core";
import {
  CaretDown,
  ShieldCheck,
  SignOut,
  GoogleLogo,
} from "@phosphor-icons/react";
import Link from "next/link";

export const UserMenu: React.FC<{ showAdminLink?: boolean }> = ({ showAdminLink = true }) => {
  const { user, isAuthenticated, isAdmin, openAuthModal, logout, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (!isAuthenticated || !user) {
    return (
      <Tooltip label="Sign In" withArrow position="bottom">
        <Button
          onClick={openAuthModal}
          variant="default"
          size="xs"
          radius="md"
          px={{ base: 8, sm: "xs" }}
          aria-label="Sign In"
        >
          <Group gap={6} wrap="nowrap">
            <GoogleLogo size={15} weight="bold" color="#ea4335" />
            <Box component="span" visibleFrom="lg">
              Sign In
            </Box>
          </Group>
        </Button>
      </Tooltip>
    );
  }

  return (
    <Menu shadow="md" width={220} position="bottom-end" radius="md">
      <Menu.Target>
        <UnstyledButton
          p="4px 8px"
          style={{
            borderRadius: 8,
            backgroundColor: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <Group gap={6}>
            <Avatar size={22} radius="xl" color="blue">
              {user.name.charAt(0).toUpperCase()}
            </Avatar>
            <Text size="xs" fw={600} visibleFrom="md" truncate style={{ maxWidth: 100 }}>
              {user.name}
            </Text>
            {user.role === "admin" ? (
              <Badge size="xs" color="yellow" variant="light" visibleFrom="md">
                ADMIN
              </Badge>
            ) : (
              <Badge size="xs" color="blue" variant="light" visibleFrom="md">
                USER
              </Badge>
            )}
            <CaretDown size={14} weight="bold" opacity={0.6} />
          </Group>
        </UnstyledButton>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>Signed in as</Menu.Label>
        <div style={{ padding: "0 10px 6px" }}>
          <Text size="xs" fw={700}>
            {user.name}
          </Text>
          <Text size="10px" c="dimmed" truncate>
            {user.email}
          </Text>
        </div>

        <Menu.Divider />

        {isAdmin && showAdminLink && (
          <Menu.Item
            component={Link}
            href="/admin/dashboard"
            leftSection={<ShieldCheck size={16} weight="bold" color="#f59f00" />}
          >
            Admin Control Panel
          </Menu.Item>
        )}

        <Menu.Item
          color="red"
          leftSection={<SignOut size={16} weight="bold" />}
          onClick={() => logout()}
        >
          Sign Out
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
};
