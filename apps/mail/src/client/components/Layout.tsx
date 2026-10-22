import React from "react";
import {
  AppShell,
  Group,
  Text,
  Button,
  Stack,
  Badge,
  Avatar,
  Menu,
  ActionIcon,
  Tooltip,
  Divider,
  ScrollArea,
  NavLink,
  Box,
} from "@mantine/core";
import {
  IconMail,
  IconInbox,
  IconSend,
  IconStar,
  IconTrash,
  IconPlus,
  IconLogout,
  IconShieldLock,
  IconAt,
  IconCircleCheck,
  IconWifi,
  IconWifiOff,
} from "@tabler/icons-react";
import { User, Alias } from "../types";

interface LayoutProps {
  user: User | null;
  aliases: Alias[];
  activeFolder: string;
  onSelectFolder: (folder: string) => void;
  activeAlias: string;
  onSelectAlias: (alias: string) => void;
  onOpenCompose: () => void;
  onLogout: () => void;
  currentView: "mailbox" | "admin";
  onToggleView: (view: "mailbox" | "admin") => void;
  realtimeStatus: "connected" | "disconnected";
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({
  user,
  aliases,
  activeFolder,
  onSelectFolder,
  activeAlias,
  onSelectAlias,
  onOpenCompose,
  onLogout,
  currentView,
  onToggleView,
  realtimeStatus,
  children,
}) => {
  const isAdmin = user?.role === "admin" || user?.email === "admin@logixsoft.in";

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 260, breakpoint: "sm" }}
      padding={0}
      style={{ height: "100vh", overflow: "hidden" }}
    >
      {/* APP HEADER */}
      <AppShell.Header p="xs" px="md" style={{ backgroundColor: "#ffffff", borderBottom: "1px solid #e9ecef" }}>
        <Group justify="space-between" style={{ height: "100%" }}>
          {/* Logo & Brand */}
          <Group gap="xs">
            <ActionIcon variant="light" color="teal" size="lg" radius="md">
              <IconMail size={22} color="#0ca678" />
            </ActionIcon>
            <div>
              <Text fw={800} size="md" c="teal.9" style={{ letterSpacing: "-0.5px" }}>
                LogixMail
              </Text>
              <Text size="10px" c="dimmed" style={{ marginTop: -4 }}>
                Cloudflare Edge Email
              </Text>
            </div>
          </Group>

          {/* Center: Realtime Status & View Switcher */}
          <Group gap="sm">
            <Badge
              size="sm"
              variant="light"
              color={realtimeStatus === "connected" ? "teal" : "red"}
              leftSection={
                realtimeStatus === "connected" ? (
                  <IconWifi size={13} color="#0ca678" />
                ) : (
                  <IconWifiOff size={13} color="red" />
                )
              }
            >
              {realtimeStatus === "connected" ? "Live Realtime" : "Reconnecting"}
            </Badge>

            {isAdmin && (
              <Group gap={4} p={3} bg="gray.1" style={{ borderRadius: 8 }}>
                <Button
                  size="compact-xs"
                  variant={currentView === "mailbox" ? "white" : "subtle"}
                  color="teal"
                  onClick={() => onToggleView("mailbox")}
                  leftSection={<IconInbox size={14} />}
                >
                  Mailbox
                </Button>
                <Button
                  size="compact-xs"
                  variant={currentView === "admin" ? "white" : "subtle"}
                  color="teal"
                  onClick={() => onToggleView("admin")}
                  leftSection={<IconShieldLock size={14} />}
                >
                  Admin Console
                </Button>
              </Group>
            )}
          </Group>

          {/* User Profile & Actions */}
          <Group gap="xs">
            {user && (
              <Menu shadow="md" width={220} position="bottom-end">
                <Menu.Target>
                  <Group gap="xs" style={{ cursor: "pointer" }}>
                    <Avatar color="teal" radius="xl" size="sm">
                      {user.name.charAt(0).toUpperCase()}
                    </Avatar>
                    <div style={{ textAlign: "right" }}>
                      <Text size="xs" fw={700}>
                        {user.name}
                      </Text>
                      <Text size="10px" c="dimmed">
                        {user.email}
                      </Text>
                    </div>
                  </Group>
                </Menu.Target>

                <Menu.Dropdown>
                  <Menu.Label>Signed in as</Menu.Label>
                  <Menu.Item leftSection={<IconAt size={14} />}>
                    {user.email}
                  </Menu.Item>
                  <Menu.Item leftSection={<IconShieldLock size={14} />}>
                    Role: {user.role.toUpperCase()}
                  </Menu.Item>
                  <Divider />
                  <Menu.Item color="red" leftSection={<IconLogout size={14} />} onClick={onLogout}>
                    Sign Out
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            )}
          </Group>
        </Group>
      </AppShell.Header>

      {/* APP NAVBAR / SIDEBAR */}
      <AppShell.Navbar p="sm" style={{ backgroundColor: "#fafbfc", borderRight: "1px solid #e9ecef" }}>
        <Stack gap="xs" style={{ height: "100%" }}>
          {/* COMPOSE BUTTON */}
          <Button
            color="teal"
            size="md"
            fullWidth
            radius="md"
            leftSection={<IconPlus size={18} />}
            onClick={onOpenCompose}
            style={{ boxShadow: "0 2px 8px rgba(12, 166, 120, 0.25)" }}
          >
            Compose
          </Button>

          <Divider my={6} />

          {/* FOLDERS LIST */}
          <Text size="xs" fw={700} c="dimmed" px="xs">
            FOLDERS
          </Text>

          <Stack gap={2}>
            <NavLink
              label="Inbox"
              leftSection={<IconInbox size={18} />}
              active={activeFolder === "inbox"}
              onClick={() => onSelectFolder("inbox")}
              color="teal"
              style={{ borderRadius: 8, fontWeight: activeFolder === "inbox" ? 700 : 500 }}
            />
            <NavLink
              label="Sent"
              leftSection={<IconSend size={18} />}
              active={activeFolder === "sent"}
              onClick={() => onSelectFolder("sent")}
              color="teal"
              style={{ borderRadius: 8, fontWeight: activeFolder === "sent" ? 700 : 500 }}
            />
            <NavLink
              label="Starred"
              leftSection={<IconStar size={18} />}
              active={activeFolder === "starred"}
              onClick={() => onSelectFolder("starred")}
              color="teal"
              style={{ borderRadius: 8, fontWeight: activeFolder === "starred" ? 700 : 500 }}
            />
            <NavLink
              label="Trash"
              leftSection={<IconTrash size={18} />}
              active={activeFolder === "trash"}
              onClick={() => onSelectFolder("trash")}
              color="teal"
              style={{ borderRadius: 8, fontWeight: activeFolder === "trash" ? 700 : 500 }}
            />
          </Stack>

          <Divider my={6} />

          {/* CUSTOM ALIASES FILTER */}
          <Group justify="space-between" px="xs">
            <Text size="xs" fw={700} c="dimmed">
              CUSTOM ALIASES
            </Text>
            <Badge size="xs" color="teal" variant="light">
              Catch-All
            </Badge>
          </Group>

          <ScrollArea style={{ flex: 1 }}>
            <Stack gap={2}>
              <NavLink
                label="All Inboxes"
                active={activeAlias === "all"}
                onClick={() => onSelectAlias("all")}
                color="teal"
                style={{ borderRadius: 8, fontWeight: activeAlias === "all" ? 700 : 500 }}
              />
              {aliases.map((alias) => (
                <NavLink
                  key={alias.id}
                  label={alias.address}
                  description={alias.displayName}
                  active={activeAlias === alias.address}
                  onClick={() => onSelectAlias(alias.address)}
                  color="teal"
                  style={{ borderRadius: 8, fontSize: 13 }}
                />
              ))}
            </Stack>
          </ScrollArea>

          {/* FOOTER INFO */}
          <Box p="xs" bg="teal.0" style={{ borderRadius: 8 }}>
            <Group gap="xs">
              <IconCircleCheck size={16} color="#0ca678" />
              <div>
                <Text size="xs" fw={700} c="teal.9">
                  logixsoft.in
                </Text>
                <Text size="10px" c="teal.7">
                  Unlimited dynamically routed
                </Text>
              </div>
            </Group>
          </Box>
        </Stack>
      </AppShell.Navbar>

      {/* MAIN CONTENT AREA */}
      <AppShell.Main style={{ height: "calc(100vh - 60px)", overflow: "hidden" }}>
        {children}
      </AppShell.Main>
    </AppShell>
  );
};
