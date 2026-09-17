"use client";

import React, { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AppShell,
  Group,
  Text,
  Button,
  ActionIcon,
  Avatar,
  Menu,
  Tooltip,
  Container,
  Badge,
  Loader,
  Box,
  UnstyledButton,
} from "@mantine/core";
import {
  IconLogin,
  IconLogout,
  IconDashboard,
  IconHome,
  IconShieldCheck,
} from "@tabler/icons-react";
import { useAuth } from "@/lib/auth-context";
import { LoginModal } from "@/components/auth/login-modal";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number | string; stroke?: number; color?: string; className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/", icon: IconHome },
  { label: "Dashboard", href: "/dashboard", icon: IconDashboard },
];

export function AppShellLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, openLoginModal, signOut } = useAuth();

  return (
    <AppShell header={{ height: { base: 60, sm: 64 } }} padding="md">
      {/* ---------------- Top Header ---------------- */}
      <AppShell.Header>
        <Container size="lg" h="100%" px={{ base: "md", sm: "lg" }}>
          <Group justify="space-between" h="100%" wrap="nowrap">
            {/* Left: Brand Logo & Title */}
            <Link
              href="/"
              style={{
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              {/* Brand Favicon Logo */}
              <svg width="30" height="30" viewBox="233 245 520 520" fill="#af73d7">
                <path d="M458.916107,679.925476 C440.302368,697.983032 418.648834,710.183594 393.842865,715.957947 C363.234100,723.083069 333.034973,722.460449 304.350189,707.458862 C282.619965,696.094299 269.951050,677.670349 263.077148,654.716858 C258.133392,638.208618 258.866821,621.111816 257.995972,604.185791 C257.930756,602.918152 257.675476,601.451355 259.605621,600.629578 C262.183228,603.153564 263.429047,606.658569 265.321320,609.696472 C288.384094,646.722900 333.196655,664.125000 374.232178,651.466431 C395.932098,644.772522 413.194366,631.273315 427.205658,613.740051 C454.137024,580.039062 480.733917,546.070923 507.499542,512.237427 C541.915283,468.733673 576.370300,425.261017 610.783142,381.755035 C616.466248,374.570251 621.912781,367.196289 627.680725,360.081726 C630.442688,356.674927 629.875977,354.551819 626.082397,352.751343 C617.506409,348.681213 608.957703,344.553375 600.418701,340.406006 C598.526489,339.487000 596.335938,338.921783 594.762390,335.842865 C638.865173,318.744720 683.646667,304.219696 729.185120,287.455139 C722.751038,335.534332 716.538635,381.957367 710.326233,428.380402 C709.793701,428.517517 709.261230,428.654663 708.728699,428.791809 C704.234436,424.025604 699.729309,419.269531 695.249634,414.489624 C692.288635,411.330200 689.441223,408.060760 686.405273,404.976105 C682.009583,400.509918 681.459900,400.528564 677.601440,405.371521 C669.715515,415.269440 661.912598,425.233398 654.069153,435.165161 C622.172668,475.554565 590.180908,515.869324 558.404907,556.353271 C533.005676,588.712891 507.907867,621.308960 482.588196,653.731323 C475.407471,662.926453 467.574188,671.569702 458.916107,679.925476 z"/>
                <path d="M258.730927,450.999939 C258.739807,431.002869 258.732697,411.505768 258.769012,392.008759 C258.779938,386.161041 259.296234,385.717499 265.176453,386.434937 C302.110901,390.941437 325.268799,418.898224 325.993652,456.032471 C326.910583,503.007782 326.470520,550.015747 326.130310,597.006165 C326.007202,614.013367 330.528931,628.495911 343.904541,639.596924 C344.752869,640.301025 345.852325,640.989319 345.571594,642.811340 C340.736420,644.207520 335.870728,642.978943 331.126953,641.946655 C293.937073,633.854004 266.141846,603.616028 260.573975,565.860107 C259.229706,556.744568 258.691681,547.663208 258.709259,538.487061 C258.764801,509.491455 258.730865,480.495697 258.730927,450.999939 z"/>
                <path d="M552.337036,622.611633 C547.880798,616.352051 543.698914,610.338257 539.364502,604.436462 C537.567078,601.989014 537.105042,599.917969 539.188965,597.298279 C551.521729,581.794800 563.741394,566.201416 576.017883,550.653198 C576.824524,549.631592 577.592957,548.459656 579.778687,548.369751 C621.348633,604.844666 663.120300,661.593506 704.649902,718.013550 C703.262207,720.896606 701.367920,720.202271 699.844849,720.205139 C676.531311,720.248718 653.217285,720.157593 629.904602,720.302063 C626.109497,720.325623 623.704102,718.862488 621.571899,715.956665 C606.307190,695.153809 590.993896,674.386414 575.635437,653.652649 C568.006409,643.353638 560.249023,633.149597 552.337036,622.611633 z"/>
                <path d="M474.803284,517.167969 C443.152283,473.981445 411.732147,431.065674 380.469299,388.364716 C381.861633,386.233246 383.318359,386.722961 384.560852,386.714996 C408.870636,386.558838 433.180695,386.455597 457.490295,386.279724 C459.925720,386.262115 461.529266,387.274689 462.913055,389.169556 C482.842194,416.458832 502.779480,443.742279 522.801819,470.963104 C524.544250,473.332062 524.217834,475.000092 522.532898,477.132202 C510.357025,492.539612 498.273804,508.020264 486.133423,523.455811 C483.072479,527.347534 482.189636,527.251282 479.193634,523.054749 C477.840302,521.159119 476.422668,519.309326 474.803284,517.167969 z"/>
              </svg>
              <Text
                fw={800}
                size="lg"
                style={{
                  letterSpacing: "-0.5px",
                  lineHeight: 1,
                  userSelect: "none",
                }}
              >
                Logix{" "}
                <span style={{ color: "#af73d7" }}>Dine</span>
              </Text>
            </Link>

            {/* Right: Login Button or User Avatar Menu */}
            <Group gap="xs" wrap="nowrap">
              {isLoading ? (
                <Loader size="sm" color="dinePrimary" />
              ) : isAuthenticated && user ? (
                <Menu shadow="md" width={220} position="bottom-end">
                  <Menu.Target>
                    <UnstyledButton
                      style={{
                        padding: "4px 8px",
                        borderRadius: "8px",
                        transition: "background-color 0.15s ease",
                      }}
                    >
                      <Group gap="xs" wrap="nowrap">
                        <Avatar
                          color="dinePrimary"
                          radius="xl"
                          size="sm"
                          src={user.image}
                        >
                          {user.name ? user.name.slice(0, 2).toUpperCase() : "U"}
                        </Avatar>
                        <Box visibleFrom="xs" style={{ textAlign: "left" }}>
                          <Text size="sm" fw={600} lh={1.2} lineClamp={1}>
                            {user.name || "Guest User"}
                          </Text>
                          <Text size="xs" c="dimmed" lh={1}>
                            {user.phoneNumber}
                          </Text>
                        </Box>
                      </Group>
                    </UnstyledButton>
                  </Menu.Target>

                  <Menu.Dropdown>
                    <Menu.Label>
                      <Group justify="space-between">
                        <Text size="xs" fw={700}>
                          {user.name || "Account"}
                        </Text>
                        <Badge size="xs" color="dinePrimary" variant="light">
                          {user.role || "CUSTOMER"}
                        </Badge>
                      </Group>
                    </Menu.Label>

                    <Menu.Item
                      component={Link}
                      href="/dashboard"
                      leftSection={<IconDashboard size={16} />}
                    >
                      Protected Dashboard
                    </Menu.Item>

                    <Menu.Divider />

                    <Menu.Item
                      color="red"
                      leftSection={<IconLogout size={16} />}
                      onClick={() => signOut()}
                    >
                      Sign Out
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              ) : (
                <Tooltip label="Sign In with WhatsApp OTP" withArrow>
                  <Button
                    size="sm"
                    radius="md"
                    color="dinePrimary"
                    onClick={openLoginModal}
                    leftSection={<IconLogin size={16} />}
                  >
                    Sign In
                  </Button>
                </Tooltip>
              )}
            </Group>
          </Group>
        </Container>
      </AppShell.Header>

      {/* ---------------- Main Page Content ---------------- */}
      {/* Generous bottom padding (pb=100) so page content is never obscured by the floating dock */}
      <AppShell.Main pb={{ base: 100, sm: 110 }}>
        {children}
        <LoginModal />
      </AppShell.Main>

      {/* ---------------- Floating Glassmorphism Bottom Navigation Bar ---------------- */}
      <Box
        component="nav"
        aria-label="Bottom Navigation"
        style={{
          position: "fixed",
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1000,
          maxWidth: "calc(100vw - 32px)",
          // Glassmorphism styling
          background: "rgba(255, 255, 255, 0.75)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(175, 115, 215, 0.3)",
          borderRadius: "9999px",
          padding: "6px 8px",
          boxShadow:
            "0 12px 36px rgba(175, 115, 215, 0.18), 0 4px 12px rgba(0, 0, 0, 0.08)",
          transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <Group gap={6} wrap="nowrap">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <UnstyledButton
                key={item.href}
                component={Link}
                href={item.href}
                aria-label={item.label}
                px={{ base: isActive ? 14 : 10, sm: 16 }}
                py={8}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  borderRadius: "9999px",
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? "#af73d7" : "rgba(30, 30, 30, 0.8)",
                  backgroundColor: isActive
                    ? "rgba(175, 115, 215, 0.15)"
                    : "transparent",
                  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                  textDecoration: "none",
                  userSelect: "none",
                }}
              >
                <Icon
                  size={18}
                  stroke={isActive ? 2.2 : 1.8}
                  color={isActive ? "#af73d7" : "currentColor"}
                />
                {isActive ? (
                  <Text
                    size="sm"
                    fw={700}
                    c="dinePrimary"
                    style={{ letterSpacing: "-0.2px" }}
                  >
                    {item.label}
                  </Text>
                ) : (
                  <Text
                    size="sm"
                    fw={500}
                    c="inherit"
                    visibleFrom="sm"
                    style={{ letterSpacing: "-0.2px" }}
                  >
                    {item.label}
                  </Text>
                )}
              </UnstyledButton>
            );
          })}
        </Group>
      </Box>
    </AppShell>
  );
}
