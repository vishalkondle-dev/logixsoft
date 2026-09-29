"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AppShell,
  Group,
  Text,
  Badge,
  ActionIcon,
  Avatar,
  Menu,
  Select,
  Tooltip,
  Button,
  Box,
  ScrollArea,
  Stack,
  Burger,
  NavLink,
  Center,
  Loader,
} from "@mantine/core";
import {
  IconShieldLock,
  IconBuildingStore,
  IconUsers,
  IconCreditCard,
  IconReceipt,
  IconBook,
  IconTableAlias,
  IconPackages,
  IconMotorbike,
  IconUserCheck,
  IconCalendarEvent,
  IconStar,
  IconDatabase,
  IconLayoutDashboard,
  IconRefresh,
  IconLogout,
  IconLogin,
} from "@tabler/icons-react";
import { useAuth } from "@/lib/auth-context";
import { AdminProvider, useAdmin } from "./admin-context";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number | string }>;
  badge?: string | null;
}

interface NavSection {
  group: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    group: "CONTROL PLANE",
    items: [
      { href: "/admin/overview", label: "Overview & Telemetry", icon: IconLayoutDashboard, badge: null },
    ],
  },
  {
    group: "TENANT GOVERNANCE",
    items: [
      { href: "/admin/restaurants", label: "Restaurants & Stores", icon: IconBuildingStore },
      { href: "/admin/outlets", label: "All Outlets", icon: IconBuildingStore },
      { href: "/admin/users", label: "Users & Staff Directory", icon: IconUsers },
      { href: "/admin/subscriptions", label: "Subscriptions & Plans", icon: IconCreditCard },
    ],
  },
  {
    group: "OPERATIONS & CATALOG",
    items: [
      { href: "/admin/orders", label: "Platform Orders", icon: IconReceipt },
      { href: "/admin/menu", label: "Menu Catalogs", icon: IconBook },
      { href: "/admin/tables", label: "Dining Tables", icon: IconTableAlias },
      { href: "/admin/inventory", label: "Inventory & BOM", icon: IconPackages },
      { href: "/admin/delivery", label: "Delivery Fleet", icon: IconMotorbike },
    ],
  },
  {
    group: "GUEST CRM & RELATIONS",
    items: [
      { href: "/admin/customers", label: "Customer Directory", icon: IconUserCheck },
      { href: "/admin/reservations", label: "Table Reservations", icon: IconCalendarEvent },
      { href: "/admin/feedback", label: "Reviews & Feedback", icon: IconStar },
    ],
  },
  {
    group: "SYSTEM INFRASTRUCTURE",
    items: [
      { href: "/admin/system", label: "Operations, DB & SQL", icon: IconDatabase, badge: "Edge" },
    ],
  },
];

function AdminHeaderStoreScope() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    restaurants,
    selectedRestFilter,
    setSelectedRestFilter,
    refreshing,
    fetchGlobalMetadata,
    handleEnterStore,
  } = useAdmin();

  const urlRestId = searchParams.get("restaurantId") || "";
  const currentScope = urlRestId || "ALL";

  // Keep selectedRestFilter in sync when URL query params change
  useEffect(() => {
    const target = urlRestId || "ALL";
    if (target !== selectedRestFilter) {
      setSelectedRestFilter(target);
    }
  }, [urlRestId, selectedRestFilter, setSelectedRestFilter]);

  const handleScopeChange = (newVal: string | null) => {
    const val = newVal || "ALL";
    setSelectedRestFilter(val);

    const currentSearch = typeof window !== "undefined" ? window.location.search : searchParams.toString();
    const params = new URLSearchParams(currentSearch);
    if (val && val !== "ALL") {
      params.set("restaurantId", val);
      params.delete("outletId"); // Reset outlet filter when changing restaurant
    } else {
      params.delete("restaurantId");
      params.delete("outletId");
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const activeStore = (currentScope !== "ALL"
    ? restaurants.find((r) => r.id === currentScope)
    : null) || restaurants[0];

  return (
    <Group gap="xs">
      <Select
        size="xs"
        placeholder="Scope: All Stores"
        data={[
          { value: "ALL", label: "🌐 All Platform Stores" },
          ...restaurants.map((r) => ({ value: r.id, label: `🏪 ${r.name}` })),
        ]}
        value={currentScope}
        onChange={handleScopeChange}
        w={{ base: 110, sm: 220 }}
      />

      <Tooltip label="Refresh Global Telemetry">
        <ActionIcon
          variant="light"
          color="dinePrimary"
          size="md"
          radius="md"
          loading={refreshing}
          onClick={() => fetchGlobalMetadata()}
        >
          <IconRefresh size={18} />
        </ActionIcon>
      </Tooltip>

      {restaurants.length > 0 && (
        <Button
          variant="light"
          color="indigo"
          size="xs"
          leftSection={<IconLogin size={14} />}
          visibleFrom="sm"
          onClick={() => {
            const storeToEnter = activeStore || restaurants[0];
            if (storeToEnter) handleEnterStore(storeToEnter);
          }}
          title={activeStore ? `Impersonate & Enter POS for ${activeStore.name}` : "Enter POS"}
        >
          {currentScope !== "ALL" && activeStore
            ? `Enter ${activeStore.name.length > 16 ? activeStore.name.slice(0, 14) + "…" : activeStore.name} POS`
            : "Enter POS"}
        </Button>
      )}
    </Group>
  );
}

function AdminShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading: authLoading, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Security guard: Ensure only platform ADMIN can access /admin
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        const nextUrl = `/?login=true&next=${encodeURIComponent(pathname)}`;
        router.replace(nextUrl);
      } else if (user.role !== "ADMIN") {
        router.replace("/pos");
      }
    }
  }, [user, authLoading, router, pathname]);

  if (authLoading || !user || user.role !== "ADMIN") {
    return (
      <Center py={140}>
        <Stack align="center" gap="sm">
          <Loader color="dinePrimary" size="xl" />
          <Text size="sm" c="dimmed">
            Authenticating Superadmin Access...
          </Text>
        </Stack>
      </Center>
    );
  }

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{
        width: 260,
        breakpoint: "md",
        collapsed: { mobile: !mobileOpen, desktop: !sidebarOpen },
      }}
      padding="md"
    >
      {/* ─── Dedicated Superadmin Header (ZERO owner/staff paths) ──────────── */}
      <AppShell.Header withBorder>
        <Group justify="space-between" h="100%" px={{ base: "xs", sm: "md" }} wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger
              opened={sidebarOpen}
              onClick={() => setSidebarOpen((o) => !o)}
              visibleFrom="md"
              size="sm"
            />
            <Burger
              opened={mobileOpen}
              onClick={() => setMobileOpen((o) => !o)}
              hiddenFrom="md"
              size="sm"
            />
            <Link href="/admin/overview" style={{ textDecoration: "none", color: "inherit" }}>
              <Group gap="xs" style={{ cursor: "pointer" }} wrap="nowrap">
                <Box
                  p={6}
                  style={{
                    background: "linear-gradient(135deg, #7950f2, #4c6ef5)",
                    borderRadius: 8,
                  }}
                >
                  <IconShieldLock size={20} color="white" />
                </Box>
                <Box>
                  <Group gap={6} align="center" wrap="nowrap">
                    <Text fw={800} size="md" style={{ letterSpacing: "-0.5px" }} lineClamp={1}>
                      Logix <span style={{ color: "#7950f2" }}>Superadmin</span>
                    </Text>
                    <Badge color="violet" variant="filled" size="xs" visibleFrom="xs">
                      PLATFORM
                    </Badge>
                  </Group>
                  <Text size="10px" c="dimmed" visibleFrom="sm">
                    Global Multi-Tenant Control Plane
                  </Text>
                </Box>
              </Group>
            </Link>
          </Group>

          {/* Right Header: Global Scope Filter & Profile */}
          <Group gap="xs">
            <Suspense fallback={<Loader size="xs" />}>
              <AdminHeaderStoreScope />
            </Suspense>

            <Menu position="bottom-end" shadow="md">
              <Menu.Target>
                <ActionIcon variant="subtle" size="lg" radius="xl">
                  <Avatar size={32} color="violet" radius="xl">
                    <IconShieldLock size={18} />
                  </Avatar>
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Superadmin Profile</Menu.Label>
                <Menu.Item leftSection={<IconUserCheck size={16} />}>
                  <div>
                    <Text size="xs" fw={700}>
                      {user?.name || "Superadmin"}
                    </Text>
                    <Text size="10px" c="dimmed">
                      {user?.phoneNumber || "Platform Root"}
                    </Text>
                  </div>
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item leftSection={<IconLogout size={16} />} color="red" onClick={() => signOut()}>
                  Sign Out
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      {/* ─── Dedicated Superadmin Sidebar ───────────────────────────────────── */}
      <AppShell.Navbar p="xs">
        <ScrollArea style={{ height: "calc(100vh - 80px)" }}>
          <Stack gap={14}>
            {NAV_SECTIONS.map((section) => (
              <Box key={section.group}>
                <Text size="10px" fw={700} c="dimmed" tt="uppercase" px="xs" mb={4}>
                  {section.group}
                </Text>
                <Stack gap={2}>
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                    return (
                      <NavLink
                        key={item.href}
                        component={Link}
                        href={item.href}
                        active={isActive}
                        label={item.label}
                        leftSection={<Icon size={18} />}
                        rightSection={
                          item.badge ? (
                            <Badge size="xs" color="teal" variant="light">
                              {item.badge}
                            </Badge>
                          ) : null
                        }
                        onClick={() => setMobileOpen(false)}
                        style={{
                          borderRadius: 6,
                          fontWeight: isActive ? 600 : 400,
                        }}
                      />
                    );
                  })}
                </Stack>
              </Box>
            ))}
          </Stack>
        </ScrollArea>
      </AppShell.Navbar>

      {/* ─── Page Content Area ───────────────────────────────────────────────── */}
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <AdminShellContent>{children}</AdminShellContent>
    </AdminProvider>
  );
}
