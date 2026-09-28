"use client";

import React, { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  AppShell, Group, Text, Button, ActionIcon, Avatar, Menu,
  Tooltip, Badge, Loader, Box, UnstyledButton, ScrollArea, Stack, Divider, Burger,
} from "@mantine/core";
import {
  IconLogin, IconLogout, IconShoppingCart, IconHome,
  IconBook, IconSettings, IconBuildingStore, IconReceipt,
  IconChartBar, IconTableAlias, IconChevronDown, IconCheck,
  IconFlame, IconHistory, IconUser, IconBellRinging, IconMotorbike,
  IconToolsKitchen2, IconClock, IconReceiptTax, IconUsers,
  IconPrinter, IconCreditCard, IconCoffee, IconQrcode,
  IconBrandWhatsapp, IconCalendarEvent, IconLayoutGrid, IconPackages, IconTruckDelivery,
  IconStar, IconShieldLock, IconArrowRight,
} from "@tabler/icons-react";
import { useAuth } from "@/lib/auth-context";
import { useRestaurant } from "@/lib/restaurant-context";
import { LoginModal } from "@/components/auth/login-modal";

// Staff navigation items (Settings removed from menu — now in left sidebar via top-left hamburger)
const STAFF_NAV_ITEMS = [
  { label: "Tables", href: "/tables", icon: IconTableAlias, roles: ["OWNER", "MANAGER", "CASHIER", "CAPTAIN", "WAITER"], permission: "tables:view" },
  { label: "POS", href: "/pos", icon: IconShoppingCart, roles: ["OWNER", "MANAGER", "CASHIER", "CAPTAIN", "WAITER"], permission: "pos:view" },
  { label: "Orders", href: "/orders", icon: IconReceipt, roles: ["OWNER", "MANAGER", "CASHIER", "CAPTAIN", "WAITER"], permission: "pos:view" },
  { label: "Kitchen", href: "/kitchen", icon: IconToolsKitchen2, roles: ["OWNER", "MANAGER", "CAPTAIN", "KITCHEN"], permission: "kitchen:view" },
  { label: "Waiter", href: "/waiter", icon: IconBellRinging, roles: ["OWNER", "MANAGER", "CAPTAIN", "WAITER"], permission: "waiter:view" },
  { label: "Rider", href: "/rider", icon: IconMotorbike, roles: ["OWNER", "MANAGER", "RIDER"], permission: "delivery:view" },
];

// Settings sidebar items (clean flat list without descriptions or category groupings)
const SETTINGS_SIDEBAR_ITEMS = [
  { id: "overview", label: "All Settings", href: "/settings", icon: IconLayoutGrid },
  { id: "restaurant", label: "Store & Outlets", href: "/settings/restaurant", icon: IconBuildingStore },
  { id: "menu", label: "Menu Catalog", href: "/settings/menu", icon: IconBook },
  { id: "inventory", label: "Inventory & Recipes", href: "/settings/inventory", icon: IconPackages },
  { id: "tables", label: "Table Management", href: "/settings/tables", icon: IconTableAlias },
  { id: "hours", label: "Store Hours", href: "/settings/hours", icon: IconClock },
  { id: "staff", label: "Staff & Team", href: "/settings/staff", icon: IconUsers, ownerOnly: true },
  { id: "roles", label: "Roles & Permissions", href: "/settings/roles", icon: IconShieldLock, ownerOnly: true },
  { id: "reports", label: "Analytics & Reports", href: "/settings/reports", icon: IconChartBar },
  { id: "feedback", label: "Customer Reviews & Ratings", href: "/settings/feedback", icon: IconStar },
  { id: "tax", label: "Invoice & Tax", href: "/settings/tax", icon: IconReceiptTax },
  { id: "dining", label: "Dining Options", href: "/settings/dining", icon: IconCoffee },
  { id: "aggregators", label: "Online Delivery (Swiggy/Zomato)", href: "/settings/aggregators", icon: IconTruckDelivery },
  { id: "printing", label: "Thermal Printers", href: "/settings/printing", icon: IconPrinter },
  { id: "qr-menu", label: "QR Menu Ordering", href: "/settings/qr-menu", icon: IconQrcode },
  { id: "whatsapp", label: "WhatsApp Alerts", href: "/settings/whatsapp", icon: IconBrandWhatsapp },
  { id: "reservations", label: "Table Reservations", href: "/settings/reservations", icon: IconCalendarEvent },
  { id: "riders", label: "Delivery & Riders", href: "/settings/riders", icon: IconMotorbike },
];

// Customer portal navigation items (Active Order, Past Orders, My Profile)
const CUSTOMER_NAV_ITEMS = [
  { label: "Active Orders", href: "/portal?tab=active", icon: IconFlame },
  { label: "Past Orders", href: "/portal?tab=past", icon: IconHistory },
  { label: "My Profile", href: "/portal?tab=profile", icon: IconUser },
];

function SearchParamsWatcher({ onTabChange }: { onTabChange: (tab: string) => void }) {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "active";
  React.useEffect(() => {
    onTabChange(tab);
  }, [tab, onTabChange]);
  return null;
}

export function AppShellLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [currentTab, setCurrentTab] = React.useState<string>("active");
  const { user, isAuthenticated, isLoading: authLoading, openLoginModal, signOut } = useAuth();
  const { restaurant, outlets, activeOutlet, setActiveOutlet, role, can, roleName } = useRestaurant();

  const isPortal = pathname === "/portal";
  const isLanding = pathname === "/";
  const ALL_STAFF_ROLES = ["OWNER", "MANAGER", "CASHIER", "CAPTAIN", "WAITER", "KITCHEN", "RIDER"];
  const effectiveRole = (user as any)?.role === "ADMIN" ? "OWNER" : role;
  const isStaffOrOwner = Boolean(
    effectiveRole && (ALL_STAFF_ROLES.includes(effectiveRole) || effectiveRole !== "CUSTOMER")
  );
  const canAccessSettings = Boolean(effectiveRole && ["OWNER", "MANAGER"].includes(effectiveRole)) && !isPortal;
  const isCustomer = isAuthenticated && !isStaffOrOwner;

  const isSettingsPath = Boolean(pathname?.startsWith("/settings"));
  const [desktopSidebarOpen, setDesktopSidebarOpen] = React.useState<boolean>(isSettingsPath);
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState<boolean>(false);

  React.useEffect(() => {
    setMobileSidebarOpen(false);
    setDesktopSidebarOpen(Boolean(pathname?.startsWith("/settings")));
  }, [pathname]);

  const activeSettingId = React.useMemo(() => {
    if (!pathname || !pathname.startsWith("/settings")) return "";
    if (pathname === "/settings") return "overview";
    const parts = pathname.split("/").filter(Boolean);
    const settingsIdx = parts.indexOf("settings");
    if (settingsIdx !== -1 && parts[settingsIdx + 1]) {
      const seg = parts[settingsIdx + 1];
      if (seg === "outlets") return "restaurant";
      if (seg === "dining-options") return "dining";
      if (seg === "delivery-agents") return "riders";
      if (seg === "delivery-partners") return "aggregators";
      return seg;
    }
    return "overview";
  }, [pathname]);

  // On /portal, the customer portal page already provides its own tabs for Active, Past, and Profile.
  // Suppress AppShell header and bottom nav on /portal to prevent duplicate navbars.
  const visibleNav = isPortal
    ? []
    : isStaffOrOwner
    ? STAFF_NAV_ITEMS.filter((n) => {
        if (effectiveRole && n.roles?.includes(effectiveRole)) return true;
        if (n.permission && can(n.permission)) return true;
        return false;
      })
    : isCustomer
    ? [{ label: "My Orders", href: "/portal", icon: IconReceipt }]
    : [];

  const staffHomeHref = React.useMemo(() => {
    const oId = activeOutlet?.id;
    const q = oId ? `?outletId=${oId}` : "";
    if (can("pos:view")) return `/pos${q}`;
    if (can("waiter:view")) return `/waiter${q}`;
    if (can("kitchen:view")) return `/kitchen${q}`;
    if (can("delivery:view")) return `/rider${q}`;
    if (can("tables:view")) return `/tables${q}`;
    if (effectiveRole === "WAITER") return `/waiter${q}`;
    if (effectiveRole === "CAPTAIN") return `/waiter${q}`;
    if (effectiveRole === "KITCHEN") return `/kitchen${q}`;
    if (effectiveRole === "RIDER") return `/rider${q}`;
    if (effectiveRole === "CASHIER") return `/pos${q}`;
    return `/pos${q}`;
  }, [effectiveRole, activeOutlet, can]);

  const staffRoleLabel = React.useMemo(() => {
    if (roleName && !["OWNER", "MANAGER", "CASHIER", "CAPTAIN", "WAITER", "KITCHEN", "RIDER"].includes(roleName)) {
      return roleName;
    }
    if (effectiveRole === "WAITER") return "Waiter Floor";
    if (effectiveRole === "CAPTAIN") return "Captain Floor";
    if (effectiveRole === "KITCHEN") return "Kitchen KDS";
    if (effectiveRole === "RIDER") return "Rider Deliveries";
    if (effectiveRole === "CASHIER") return "Cashier Counter";
    if (effectiveRole === "MANAGER") return "Manager Dashboard";
    if (effectiveRole === "OWNER") return "POS Billing";
    return roleName || "Staff Dashboard";
  }, [effectiveRole, roleName]);


  return (
    <AppShell
      header={isLanding ? undefined : { height: { base: 60, sm: 64 } }}
      navbar={
        canAccessSettings
          ? {
              width: 230,
              breakpoint: "md",
              collapsed: { mobile: !mobileSidebarOpen, desktop: !desktopSidebarOpen },
            }
          : undefined
      }
      padding={0}
    >
      <React.Suspense fallback={null}>
        <SearchParamsWatcher onTabChange={setCurrentTab} />
      </React.Suspense>
      {!isLanding && (
        <AppShell.Header withBorder={false}>
        <Box h="100%" px={{ base: "xs", sm: "md" }}>
          <Group justify="space-between" h="100%" wrap="nowrap">
            <Group gap="xs" wrap="nowrap" align="center">
              {canAccessSettings && (
                <>
                  <Burger
                    opened={desktopSidebarOpen}
                    onClick={() => setDesktopSidebarOpen((o) => !o)}
                    size="sm"
                    color="#495057"
                    visibleFrom="md"
                    aria-label="Toggle settings sidebar"
                  />
                  <Burger
                    opened={mobileSidebarOpen}
                    onClick={() => setMobileSidebarOpen((o) => !o)}
                    size="sm"
                    color="#495057"
                    hiddenFrom="md"
                    aria-label="Toggle mobile settings sidebar"
                  />
                </>
              )}
              <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
                <svg width="28" height="28" viewBox="233 245 520 520" fill="#af73d7">
                  <path d="M458.916107,679.925476 C440.302368,697.983032 418.648834,710.183594 393.842865,715.957947 C363.234100,723.083069 333.034973,722.460449 304.350189,707.458862 C282.619965,696.094299 269.951050,677.670349 263.077148,654.716858 C258.133392,638.208618 258.866821,621.111816 257.995972,604.185791 C257.930756,602.918152 257.675476,601.451355 259.605621,600.629578 C262.183228,603.153564 263.429047,606.658569 265.321320,609.696472 C288.384094,646.722900 333.196655,664.125000 374.232178,651.466431 C395.932098,644.772522 413.194366,631.273315 427.205658,613.740051 C454.137024,580.039062 480.733917,546.070923 507.499542,512.237427 C541.915283,468.733673 576.370300,425.261017 610.783142,381.755035 C616.466248,374.570251 621.912781,367.196289 627.680725,360.081726 C630.442688,356.674927 629.875977,354.551819 626.082397,352.751343 C617.506409,348.681213 608.957703,344.553375 600.418701,340.406006 C598.526489,339.487000 596.335938,338.921783 594.762390,335.842865 C638.865173,318.744720 683.646667,304.219696 729.185120,287.455139 C722.751038,335.534332 716.538635,381.957367 710.326233,428.380402 C709.793701,428.517517 709.261230,428.654663 708.728699,428.791809 C704.234436,424.025604 699.729309,419.269531 695.249634,414.489624 C692.288635,411.330200 689.441223,408.060760 686.405273,404.976105 C682.009583,400.509918 681.459900,400.528564 677.601440,405.371521 C669.715515,415.269440 661.912598,425.233398 654.069153,435.165161 C622.172668,475.554565 590.180908,515.869324 558.404907,556.353271 C533.005676,588.712891 507.907867,621.308960 482.588196,653.731323 C475.407471,662.926453 467.574188,671.569702 458.916107,679.925476 z"/>
                </svg>
                <Text fw={800} size="lg" style={{ letterSpacing: "-0.5px", lineHeight: 1, userSelect: "none" }}>
                  Logix <span style={{ color: "#af73d7" }}>Dine</span>
                </Text>
              </Link>
            </Group>

            {/* Middle: Header Navigation on Large Screens (where there is space) */}
            <Box
              component="nav"
              aria-label="Main Navigation"
              visibleFrom="md"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Group
                gap="xs"
                wrap="nowrap"
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 0,
                }}
              >
                {visibleNav.map((item) => {
                  const Icon = item.icon;
                  const isPortalItem = item.href.includes("?tab=");
                  const targetTab = isPortalItem ? item.href.split("?tab=")[1] : "";
                  const isActive = isPortalItem
                    ? pathname === "/portal" && currentTab === targetTab
                    : item.href === "/"
                      ? pathname === "/"
                      : item.href.startsWith("/settings")
                        ? pathname.startsWith("/settings")
                        : pathname.startsWith(item.href);
                  const itemHref = isPortalItem
                    ? item.href
                    : activeOutlet && item.href !== "/"
                      ? `${item.href}?outletId=${activeOutlet.id}`
                      : item.href;
                  return (
                    <UnstyledButton
                      key={item.href}
                      component={Link}
                      href={itemHref}
                      aria-label={item.label}
                      px={14}
                      py={6}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        borderRadius: "9999px",
                        fontWeight: isActive ? 600 : 500,
                        color: isActive ? "#af73d7" : "rgba(30, 30, 30, 0.75)",
                        backgroundColor: isActive ? "rgba(175, 115, 215, 0.15)" : "transparent",
                        textDecoration: "none",
                        userSelect: "none",
                        fontSize: 13,
                        transition: "all 0.15s ease",
                        whiteSpace: "nowrap",
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = "rgba(175, 115, 215, 0.08)";
                          e.currentTarget.style.color = "#af73d7";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = "transparent";
                          e.currentTarget.style.color = "rgba(30, 30, 30, 0.75)";
                        }
                      }}
                    >
                      <Icon size={16} stroke={isActive ? 2.2 : 1.8} color={isActive ? "#af73d7" : "currentColor"} />
                      <Text size="sm" fw={isActive ? 700 : 500} c={isActive ? "dinePrimary" : "inherit"}>
                        {item.label}
                      </Text>
                    </UnstyledButton>
                  );
                })}
              </Group>
            </Box>

            <Group gap="xs" wrap="nowrap" align="center">
              {isPortal && isStaffOrOwner && (
                <Button
                  component={Link}
                  href={staffHomeHref}
                  size="xs"
                  variant="filled"
                  color="dinePrimary"
                  radius="xl"
                  leftSection={
                    effectiveRole === "WAITER" || effectiveRole === "CAPTAIN" ? <IconBellRinging size={14} /> :
                    effectiveRole === "KITCHEN" ? <IconToolsKitchen2 size={14} /> :
                    effectiveRole === "RIDER" ? <IconMotorbike size={14} /> :
                    <IconShoppingCart size={14} />
                  }
                  style={{ fontWeight: 600, boxShadow: "0 2px 6px rgba(175, 115, 215, 0.25)" }}
                >
                  Go to {staffRoleLabel}
                </Button>
              )}

              {(user as any)?.role === "ADMIN" && (
                <Button
                  component={Link}
                  href="/admin"
                  size="xs"
                  variant={pathname === "/admin" ? "filled" : "light"}
                  color="indigo"
                  radius="xl"
                  leftSection={<IconShieldLock size={14} />}
                  style={{ fontWeight: 600 }}
                >
                  Admin Portal
                </Button>
              )}

              {outlets.length > 0 && (
                <Menu
                  position="bottom-end"
                  withArrow={false}
                  shadow="md"
                  radius="md"
                  withinPortal
                  disabled={outlets.length <= 1}
                  transitionProps={{ transition: "pop-top-right", duration: 150 }}
                >
                  <Menu.Target>
                    <UnstyledButton
                      aria-label={outlets.length > 1 ? "Switch outlet" : "Active outlet"}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "4px 10px 4px 6px",
                        borderRadius: "9999px",
                        backgroundColor: "rgba(175, 115, 215, 0.08)",
                        border: "1px solid rgba(175, 115, 215, 0.35)",
                        cursor: outlets.length > 1 ? "pointer" : "default",
                        transition: "all 0.15s ease",
                        maxWidth: 200,
                      }}
                      onMouseEnter={(e) => {
                        if (outlets.length > 1) {
                          e.currentTarget.style.backgroundColor = "rgba(175, 115, 215, 0.16)";
                          e.currentTarget.style.borderColor = "rgba(175, 115, 215, 0.6)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (outlets.length > 1) {
                          e.currentTarget.style.backgroundColor = "rgba(175, 115, 215, 0.08)";
                          e.currentTarget.style.borderColor = "rgba(175, 115, 215, 0.35)";
                        }
                      }}
                    >
                      <Box
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          backgroundColor: "rgba(175, 115, 215, 0.2)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <IconBuildingStore size={12} color="#af73d7" />
                      </Box>
                      <Text
                        size="xs"
                        fw={600}
                        lineClamp={1}
                        style={{ maxWidth: 110, lineHeight: 1.2 }}
                      >
                        {activeOutlet?.name || outlets[0]?.name || "Select Outlet"}
                      </Text>
                      {outlets.length > 1 && (
                        <IconChevronDown size={13} color="#af73d7" style={{ flexShrink: 0 }} />
                      )}
                    </UnstyledButton>
                  </Menu.Target>
                  <Menu.Dropdown style={{ minWidth: 200, padding: 6 }}>
                    <Menu.Label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Switch Outlet
                    </Menu.Label>
                    {outlets.map((outlet) => {
                      const isCurrent = outlet.id === (activeOutlet?.id ?? outlets[0]?.id);
                      return (
                        <Menu.Item
                          key={outlet.id}
                          onClick={() => setActiveOutlet(outlet.id)}
                          leftSection={<IconBuildingStore size={15} color={isCurrent ? "#af73d7" : "#868e96"} />}
                          rightSection={isCurrent ? <IconCheck size={14} color="#af73d7" /> : null}
                          style={{
                            fontWeight: isCurrent ? 700 : 500,
                            backgroundColor: isCurrent ? "rgba(175, 115, 215, 0.12)" : "transparent",
                            color: isCurrent ? "#af73d7" : "inherit",
                            borderRadius: 6,
                            marginBottom: 2,
                            padding: "8px 10px",
                          }}
                        >
                          {outlet.name}
                        </Menu.Item>
                      );
                    })}
                  </Menu.Dropdown>
                </Menu>
              )}

              {authLoading ? (
                <Loader size="sm" color="dinePrimary" />
              ) : isAuthenticated && user ? (
                <Menu width={240} position="bottom-end">
                  <Menu.Target>
                    <UnstyledButton style={{ padding: "4px 8px", borderRadius: "8px" }}>
                      <Group gap="xs" wrap="nowrap">
                        <Avatar color="dinePrimary" radius="xl" size="sm">
                          {user.name ? user.name.slice(0, 2).toUpperCase() : "U"}
                        </Avatar>
                        <Box visibleFrom="xs">
                          <Text size="sm" fw={600} lh={1.2} lineClamp={1}>{user.name || "User"}</Text>
                          <Text size="xs" c="dimmed" lh={1}>{effectiveRole || (user as any).role || "CUSTOMER"}</Text>
                        </Box>
                      </Group>
                    </UnstyledButton>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Label>
                      <Group justify="space-between">
                        <Text size="xs" fw={700} lineClamp={1}>{user.name || "Customer"}</Text>
                        <Badge size="xs" color="dinePrimary" variant="light">{effectiveRole || (user as any).role || "CUSTOMER"}</Badge>
                      </Group>
                      {restaurant && (
                        <Text size="10px" c="dimmed" mt={2} lineClamp={1}>
                          {restaurant.name}
                        </Text>
                      )}
                    </Menu.Label>

                    {(user as any)?.role === "ADMIN" && (
                      <Menu.Item
                        component={Link}
                        href="/admin"
                        leftSection={<IconShieldLock size={16} color="#4c6ef5" />}
                        style={{ fontWeight: 600, color: "#4c6ef5", backgroundColor: "rgba(76, 110, 245, 0.08)" }}
                      >
                        Platform Admin Portal
                      </Menu.Item>
                    )}

                    {isStaffOrOwner && (
                      <Menu.Item
                        component={Link}
                        href={staffHomeHref}
                        leftSection={
                          effectiveRole === "WAITER" || effectiveRole === "CAPTAIN" ? <IconBellRinging size={16} color="#af73d7" /> :
                          effectiveRole === "KITCHEN" ? <IconToolsKitchen2 size={16} color="#af73d7" /> :
                          effectiveRole === "RIDER" ? <IconMotorbike size={16} color="#af73d7" /> :
                          <IconShoppingCart size={16} color="#af73d7" />
                        }
                        style={{ fontWeight: 600, color: "#af73d7", backgroundColor: "rgba(175, 115, 215, 0.08)" }}
                      >
                        Switch to {staffRoleLabel}
                      </Menu.Item>
                    )}

                    {canAccessSettings && (
                      <>
                        <Menu.Item
                          component={Link}
                          href="/settings"
                          leftSection={<IconSettings size={16} color="#af73d7" />}
                        >
                          All Settings
                        </Menu.Item>
                        <Menu.Item
                          component={Link}
                          href="/settings/aggregators"
                          leftSection={<IconTruckDelivery size={16} color="#e8590c" />}
                        >
                          Online Delivery (Swiggy/Zomato)
                        </Menu.Item>
                      </>
                    )}

                    <Menu.Item
                      component={Link}
                      href="/portal"
                      leftSection={<IconUser size={16} color="#868e96" />}
                    >
                      Customer Portal (My Orders)
                    </Menu.Item>
                    <Menu.Divider />
                    <Menu.Item color="red" leftSection={<IconLogout size={16} />} onClick={() => signOut()}>Sign Out</Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              ) : (
                <Tooltip label="Sign In" withArrow>
                  <Button size="sm" radius="md" color="dinePrimary" onClick={openLoginModal} leftSection={<IconLogin size={16} />}>
                    Sign In
                  </Button>
                </Tooltip>
              )}
            </Group>
          </Group>
        </Box>
      </AppShell.Header>
      )}

      {canAccessSettings && (
        <AppShell.Navbar
          p="xs"
          withBorder
          style={{
            borderColor: "#e9ecef",
            backgroundColor: "#ffffff",
          }}
        >
          <ScrollArea style={{ height: "100%" }} scrollbarSize={4} type="hover">
            <Stack gap={2}>
              {SETTINGS_SIDEBAR_ITEMS.filter(
                (item) => !item.ownerOnly || effectiveRole === "OWNER"
              ).map((item, index) => {
                const Icon = item.icon;
                const isActive = activeSettingId === item.id;
                return (
                  <React.Fragment key={item.id}>
                    <UnstyledButton
                      component={Link}
                      href={item.href}
                      onClick={() => setMobileSidebarOpen(false)}
                      px={12}
                      py={8}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        borderRadius: 8,
                        fontWeight: isActive ? 600 : 500,
                        color: isActive ? "#af73d7" : "#343a40",
                        backgroundColor: isActive ? "rgba(175, 115, 215, 0.12)" : "transparent",
                        textDecoration: "none",
                        fontSize: 13.5,
                        transition: "all 0.12s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = "#f8f9fa";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }
                      }}
                    >
                      <Icon
                        size={18}
                        stroke={isActive ? 2.1 : 1.75}
                        color={isActive ? "#af73d7" : "#495057"}
                        style={{ flexShrink: 0 }}
                      />
                      <Text
                        size="sm"
                        fw={isActive ? 600 : 500}
                        c={isActive ? "dinePrimary" : "dark.8"}
                        truncate
                        style={{ fontSize: 13.5, lineHeight: 1.3 }}
                      >
                        {item.label}
                      </Text>
                    </UnstyledButton>
                    {index === 0 && <Divider my={4} color="#f1f3f5" />}
                  </React.Fragment>
                );
              })}
            </Stack>
          </ScrollArea>
        </AppShell.Navbar>
      )}

      <AppShell.Main>
        {!isLanding && (user as any)?.role === "ADMIN" && pathname !== "/admin" && (
          <Box
            bg="#fff3bf"
            px="md"
            py={7}
            style={{
              borderBottom: "1px solid #ffe066",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 12,
              fontWeight: 600,
              color: "#d9480f",
            }}
          >
            <Group gap="xs" wrap="nowrap">
              <IconShieldLock size={16} color="#d9480f" />
              <Text size="xs" fw={700} c="#d9480f">
                Platform Admin Mode: Viewing store &quot;{restaurant?.name || "Store"}&quot; with full Owner privileges
              </Text>
            </Group>
            <Button
              component={Link}
              href="/admin"
              size="compact-xs"
              variant="filled"
              color="orange"
              radius="xl"
              rightSection={<IconArrowRight size={12} />}
            >
              Return to Admin Portal
            </Button>
          </Box>
        )}
        {children}
        <LoginModal />
      </AppShell.Main>

      {visibleNav.length > 0 && !isPortal && !isLanding && (
        <Box
          component="nav"
          aria-label="Bottom Navigation"
          className="floating-bottom-nav"
          hiddenFrom="md"
          style={{
            position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
            zIndex: 100, maxWidth: "calc(100vw - 32px)",
            background: "rgba(255, 255, 255, 0.85)", backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(175, 115, 215, 0.3)",
            boxShadow: "0 12px 36px rgba(175, 115, 215, 0.18), 0 4px 12px rgba(0, 0, 0, 0.08)",
            borderRadius: "9999px", padding: "6px 8px",
            overflowX: "auto",
            scrollbarWidth: "none",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <Group gap={4} wrap="nowrap" style={{ flexWrap: "nowrap", minWidth: "max-content" }}>
            {visibleNav.map((item) => {
              const Icon = item.icon;
              const isPortalItem = item.href.includes("?tab=");
              const targetTab = isPortalItem ? item.href.split("?tab=")[1] : "";
              const isActive = isPortalItem
                ? pathname === "/portal" && currentTab === targetTab
                : item.href === "/"
                  ? pathname === "/"
                  : item.href.startsWith("/settings")
                    ? pathname.startsWith("/settings")
                    : pathname.startsWith(item.href);
              const itemHref = isPortalItem
                ? item.href
                : activeOutlet && item.href !== "/"
                  ? `${item.href}?outletId=${activeOutlet.id}`
                  : item.href;
              return (
                <UnstyledButton
                  key={item.href} component={Link} href={itemHref} aria-label={item.label}
                  px={{ base: isActive ? 14 : 10, sm: 16 }} py={8}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    borderRadius: "9999px", fontWeight: isActive ? 600 : 500,
                    color: isActive ? "#af73d7" : "rgba(30, 30, 30, 0.8)",
                    backgroundColor: isActive ? "rgba(175, 115, 215, 0.15)" : "transparent",
                    textDecoration: "none", userSelect: "none", fontSize: 13,
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                  }}
                >
                  <Icon size={18} stroke={isActive ? 2.2 : 1.8} color={isActive ? "#af73d7" : "currentColor"} />
                  {isActive ? (
                    <Text size="sm" fw={700} c="dinePrimary">{item.label}</Text>
                  ) : (
                    <Text size="sm" fw={500} c="inherit" visibleFrom="sm">{item.label}</Text>
                  )}
                </UnstyledButton>
              );
            })}
          </Group>
        </Box>
      )}
    </AppShell>
  );
}
