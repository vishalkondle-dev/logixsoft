import React from "react";
import {
  AppShell,
  Group,
  Text,
  Button,
  Stack,
  Avatar,
  Menu,
  ActionIcon,
  Tooltip,
  Divider,
  NavLink,
  Box,
  Burger,
  Select,
  Indicator,
  Modal,
  ThemeIcon,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
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
  IconDeviceMobileDown,
  IconBrandChrome,
  IconBrandApple,
  IconShare,
  IconDownload,
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
  const [opened, { toggle, close }] = useDisclosure(false);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const isSmallPhone = useMediaQuery("(max-width: 480px)");
  const isAdmin = user?.role === "admin" || user?.email === "admin@logixsoft.in";

  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null);
  const [isStandalone, setIsStandalone] = React.useState(false);
  const [pwaModalOpened, setPwaModalOpened] = React.useState(false);

  React.useEffect(() => {
    // Check if running in standalone PWA mode
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true
    ) {
      setIsStandalone(true);
    }

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handler);

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      notifications.show({
        title: "LogixMail Installed",
        message: "LogixMail is now installed on your device!",
        color: "teal",
      });
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult?.outcome === "accepted") {
          setDeferredPrompt(null);
        }
      } catch (err) {
        setPwaModalOpened(true);
      }
    } else {
      setPwaModalOpened(true);
    }
  };

  const handleSelectFolder = (folder: string) => {
    onSelectFolder(folder);
    if (currentView !== "mailbox") {
      onToggleView("mailbox");
    }
    close();
  };

  const handleSelectAlias = (alias: string) => {
    onSelectAlias(alias);
    if (currentView !== "mailbox") {
      onToggleView("mailbox");
    }
    close();
  };

  const handleCompose = () => {
    onOpenCompose();
    close();
  };

  const aliasSelectData = [
    { value: "all", label: "All Inboxes (Catch-All)" },
    ...aliases.map((a) => ({
      value: a.address,
      label: a.displayName && a.displayName !== a.address ? `${a.address} (${a.displayName})` : a.address,
    })),
  ];

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 260,
        breakpoint: "sm",
        collapsed: { mobile: !opened },
      }}
      padding={0}
      style={{ height: "100vh", overflow: "hidden" }}
    >
      {/* APP HEADER */}
      <AppShell.Header p="xs" px={{ base: "xs", sm: "md" }} style={{ backgroundColor: "#ffffff", borderBottom: "1px solid #e9ecef" }}>
        <Group justify="space-between" style={{ height: "100%", flexWrap: "nowrap" }}>
          {/* Left: Burger (on mobile) + Logo & Brand */}
          <Group gap="xs" style={{ flexShrink: 0 }}>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Toggle navigation" />
            <ActionIcon variant="light" color="teal" size="md" radius="md">
              <IconMail size={20} color="#0ca678" />
            </ActionIcon>
            <div>
              <Text fw={800} size="sm" c="teal.9" style={{ letterSpacing: "-0.5px", lineHeight: 1.1 }}>
                LogixMail
              </Text>
              {!isSmallPhone && (
                <Text size="10px" c="dimmed" style={{ marginTop: 0 }}>
                  Cloudflare Edge Email
                </Text>
              )}
            </div>
          </Group>

          {/* Right: PWA Install + User Profile & Actions with Realtime Indicator on Avatar */}
          <Group gap="xs" style={{ flexShrink: 0 }}>
            {!isStandalone && (
              <Tooltip label="Install LogixMail App" withArrow position="bottom-end">
                <ActionIcon
                  variant="light"
                  color="teal"
                  size="md"
                  radius="md"
                  onClick={handleInstallClick}
                  aria-label="Install LogixMail Progressive Web App"
                >
                  <IconDeviceMobileDown size={18} />
                </ActionIcon>
              </Tooltip>
            )}

            {user && (
              <Menu shadow="md" width={220} position="bottom-end">
                <Menu.Target>
                  <Group gap={6} style={{ cursor: "pointer" }}>
                    <Tooltip
                      label={realtimeStatus === "connected" ? "Realtime sync active" : "Reconnecting to edge..."}
                      withArrow
                      position="bottom-end"
                    >
                      <Indicator
                        inline
                        size={9}
                        offset={2}
                        position="top-end"
                        color={realtimeStatus === "connected" ? "teal" : "red"}
                        withBorder
                        processing={realtimeStatus === "connected"}
                      >
                        <Avatar color="teal" radius="xl" size="sm">
                          {user.name.charAt(0).toUpperCase()}
                        </Avatar>
                      </Indicator>
                    </Tooltip>
                    {!isMobile && (
                      <div style={{ textAlign: "right" }}>
                        <Text size="xs" fw={700} lineClamp={1}>
                          {user.name}
                        </Text>
                        <Text size="10px" c="dimmed" lineClamp={1}>
                          {user.email}
                        </Text>
                      </div>
                    )}
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
                  {isAdmin && (
                    <Menu.Item
                      leftSection={<IconShieldLock size={14} />}
                      onClick={() => onToggleView(currentView === "admin" ? "mailbox" : "admin")}
                    >
                      {currentView === "admin" ? "Switch to Mailbox" : "Admin Console"}
                    </Menu.Item>
                  )}
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
            onClick={handleCompose}
            style={{ boxShadow: "0 2px 8px rgba(12, 166, 120, 0.25)" }}
          >
            Compose
          </Button>

          <Divider my={4} />

          {/* MAILBOX SELECT BOX (Item 5: Filter by Mailbox / Alias) */}
          <Box px="xs">
            <Text size="xs" fw={700} c="dimmed" mb={4}>
              SELECT MAILBOX / ALIAS
            </Text>
            <Select
              size="xs"
              leftSection={<IconAt size={14} color="#0ca678" />}
              data={aliasSelectData}
              value={activeAlias}
              onChange={(val) => handleSelectAlias(val || "all")}
              allowDeselect={false}
              comboboxProps={{ shadow: "md", transitionProps: { transition: "pop-top-left", duration: 150 } }}
              styles={{
                input: {
                  backgroundColor: "#ffffff",
                  borderColor: "#dee2e6",
                  fontWeight: 600,
                  fontSize: 12,
                },
              }}
            />
          </Box>

          <Divider my={4} />

          {/* FOLDERS LIST */}
          <Text size="xs" fw={700} c="dimmed" px="xs">
            FOLDERS
          </Text>

          <Stack gap={2}>
            <NavLink
              label="Inbox"
              leftSection={<IconInbox size={18} />}
              active={currentView === "mailbox" && activeFolder === "inbox"}
              onClick={() => handleSelectFolder("inbox")}
              color="teal"
              style={{ borderRadius: 8, fontWeight: currentView === "mailbox" && activeFolder === "inbox" ? 700 : 500 }}
            />
            <NavLink
              label="Sent"
              leftSection={<IconSend size={18} />}
              active={currentView === "mailbox" && activeFolder === "sent"}
              onClick={() => handleSelectFolder("sent")}
              color="teal"
              style={{ borderRadius: 8, fontWeight: currentView === "mailbox" && activeFolder === "sent" ? 700 : 500 }}
            />
            <NavLink
              label="Starred"
              leftSection={<IconStar size={18} />}
              active={currentView === "mailbox" && activeFolder === "starred"}
              onClick={() => handleSelectFolder("starred")}
              color="teal"
              style={{ borderRadius: 8, fontWeight: currentView === "mailbox" && activeFolder === "starred" ? 700 : 500 }}
            />
            <NavLink
              label="Trash"
              leftSection={<IconTrash size={18} />}
              active={currentView === "mailbox" && activeFolder === "trash"}
              onClick={() => handleSelectFolder("trash")}
              color="teal"
              style={{ borderRadius: 8, fontWeight: currentView === "mailbox" && activeFolder === "trash" ? 700 : 500 }}
            />
          </Stack>

          {/* ADMIN SIDEBAR ITEM (Item 4: Admin in Sidebar) */}
          {isAdmin && (
            <>
              <Divider my={4} />
              <Text size="xs" fw={700} c="dimmed" px="xs">
                MANAGEMENT
              </Text>
              <NavLink
                label="Admin Console"
                description="Users, Aliases & Routing"
                leftSection={<IconShieldLock size={18} />}
                active={currentView === "admin"}
                onClick={() => {
                  onToggleView("admin");
                  close();
                }}
                color="teal"
                style={{ borderRadius: 8, fontWeight: currentView === "admin" ? 700 : 500 }}
              />
            </>
          )}

          {/* Spacer to push footer to bottom */}
          <Box style={{ flex: 1 }} />

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

      {/* PWA Install Guide Modal */}
      <Modal
        opened={pwaModalOpened}
        onClose={() => setPwaModalOpened(false)}
        title={
          <Group gap="xs">
            <Avatar src="/icons/icon-192.png" radius="md" size="sm" />
            <div>
              <Text fw={700} size="sm">Install LogixMail App</Text>
              <Text size="10px" c="dimmed">Progressive Web App</Text>
            </div>
          </Group>
        }
        centered
        radius="md"
        size="md"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Install LogixMail on your phone, tablet, or desktop for lightning-fast edge performance, standalone window mode, and offline caching.
          </Text>

          <Box p="xs" style={{ backgroundColor: "#f1fdf8", borderRadius: 8, border: "1px solid #bbf7d0" }}>
            <Group gap="xs" mb="xs">
              <ThemeIcon color="teal" size="sm" radius="xl">
                <IconBrandChrome size={14} />
              </ThemeIcon>
              <Text fw={600} size="xs" c="teal.9">Chrome, Edge & Android</Text>
            </Group>
            <Text size="xs" c="gray.7">
              Click the Install icon in the browser address bar, or tap the browser menu <Text span fw={700}>(⋮)</Text> and select <Text span fw={700}>"Install LogixMail"</Text> or <Text span fw={700}>"Add to Home screen"</Text>.
            </Text>
          </Box>

          <Box p="xs" style={{ backgroundColor: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
            <Group gap="xs" mb="xs">
              <ThemeIcon color="gray" size="sm" radius="xl">
                <IconBrandApple size={14} />
              </ThemeIcon>
              <Text fw={600} size="xs">iPhone & iPad (Safari)</Text>
            </Group>
            <Text size="xs" c="gray.7">
              Tap the <Text span fw={700}>Share button</Text> (the square with arrow pointing up <IconShare size={12} style={{ display: "inline", verticalAlign: "middle" }} /> at the bottom of Safari) and choose <Text span fw={700}>"Add to Home Screen"</Text>.
            </Text>
          </Box>

          {deferredPrompt && (
            <Button
              color="teal"
              leftSection={<IconDownload size={16} />}
              onClick={() => {
                deferredPrompt.prompt();
                setPwaModalOpened(false);
              }}
              fullWidth
            >
              Install LogixMail Now
            </Button>
          )}

          <Button variant="subtle" color="gray" size="xs" onClick={() => setPwaModalOpened(false)}>
            Close
          </Button>
        </Stack>
      </Modal>
    </AppShell>
  );
};
