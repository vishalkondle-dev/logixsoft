'use client';

import { ReactNode, useEffect, useState } from 'react';
import {
  AppShell,
  Burger,
  Group,
  NavLink,
  Text,
  ThemeIcon,
  Badge,
  Avatar,
  Menu,
  ActionIcon,
  Box,
  Divider,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconQrcode,
  IconLayoutDashboard,
  IconArrowsExchange,
  IconLink,
  IconSettings,
  IconCode,
  IconLogout,
  IconChevronRight,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { LogoIcon } from '@/components/LogoIcon';

const NAV_ITEMS = [
  { label: 'Overview', href: '/dashboard', icon: IconLayoutDashboard },
  { label: 'Transactions', href: '/dashboard/transactions', icon: IconArrowsExchange },
  { label: 'Counter & Links', href: '/dashboard/payment-links', icon: IconLink },
  { label: 'Gateway Settings', href: '/dashboard/credentials', icon: IconSettings },
  { label: 'Developers & APIs', href: '/dashboard/developers', icon: IconCode },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [opened, { toggle, close }] = useDisclosure();
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isLoading, checkAuth, logout } = useAuth();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 250,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="md"
      styles={{
        main: { backgroundColor: '#f8fafc' },
      }}
    >
      <AppShell.Header px="md">
        <Group h="100%" justify="space-between">
          <Group gap="xs">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Link href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
              <LogoIcon size={28} />
              <Text fw={800} size="md" c="indigo.9">
                Logixsoft PG
              </Text>
            </Link>
            <Badge variant="light" color="teal" size="xs">
              Live
            </Badge>
          </Group>

          <Group gap="sm">
            <Menu shadow="md" width={200} position="bottom-end">
              <Menu.Target>
                <Group gap="xs" style={{ cursor: 'pointer' }}>
                  <Avatar
                    src={user?.image || undefined}
                    radius="xl"
                    size="sm"
                    color="indigo"
                  >
                    {user?.name ? user.name[0] : 'M'}
                  </Avatar>
                  <Box visibleFrom="xs">
                    <Text size="xs" fw={600}>
                      {user?.name || 'Merchant Admin'}
                    </Text>
                    <Text size="10px" c="dimmed">
                      {user?.email || 'admin@logixsoft.in'}
                    </Text>
                  </Box>
                </Group>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Label>Merchant Account</Menu.Label>
                <Menu.Item
                  color="red"
                  leftSection={<IconLogout size={14} />}
                  onClick={handleLogout}
                >
                  Sign Out
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        <Text size="xs" fw={700} c="dimmed" px="sm" py="xs" tt="uppercase" lts={1}>
          Merchant Console
        </Text>

        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <NavLink
              key={item.href}
              component={Link}
              href={item.href}
              label={item.label}
              leftSection={<item.icon size={18} />}
              active={isActive}
              onClick={close}
              style={{ borderRadius: 8, margin: '2px 0' }}
            />
          );
        })}

        <Box style={{ marginTop: 'auto' }} p="sm">
          <Divider mb="sm" />
          <Text size="11px" c="dimmed">
            Paytm UPI Gateway
          </Text>
          <Text size="10px" c="dimmed">
            v0.0.1 • Connected
          </Text>
        </Box>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}

