"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Box, Title, Text, Tabs, Table, Badge, Button, Loader, Center, Select,
  ScrollArea, Group, Stack, Card, SimpleGrid, TextInput, ActionIcon,
  Modal, Drawer, Menu, Alert, Divider, Textarea, Tooltip, Paper,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconBuildingStore, IconUsers, IconShieldLock, IconPlus, IconRefresh,
  IconEdit, IconTrash, IconLogin, IconCheck, IconAlertCircle, IconChartBar,
  IconReceipt, IconCurrencyRupee, IconSearch, IconDotsVertical, IconPower,
  IconDatabase, IconArrowRight, IconUserPlus, IconFileSpreadsheet,
} from "@tabler/icons-react";
import { useAuth } from "@/lib/auth-context";
import { useRestaurant } from "@/lib/restaurant-context";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://dine-api.logixsoft.in";

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { setActiveRestaurant } = useRestaurant();
  const router = useRouter();

  // ─── State ──────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [outlets, setOutlets] = useState<any[]>([]);

  // Filters
  const [restSearch, setRestSearch] = useState("");
  const [restStatusFilter, setRestStatusFilter] = useState("ALL");
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("ALL");
  const [outletRestFilter, setOutletRestFilter] = useState("ALL");

  // Modals & Drawers
  const [createRestOpened, setCreateRestOpened] = useState(false);
  const [editRestOpened, setEditRestOpened] = useState(false);
  const [selectedRest, setSelectedRest] = useState<any>(null);
  const [outletsDrawerOpened, setOutletsDrawerOpened] = useState(false);
  const [selectedRestForOutlets, setSelectedRestForOutlets] = useState<any>(null);
  const [createOutletOpened, setCreateOutletOpened] = useState(false);
  const [createUserOpened, setCreateUserOpened] = useState(false);
  const [editUserOpened, setEditUserOpened] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [purgeModalOpened, setPurgeModalOpened] = useState(false);
  const [purgeTargetRestId, setPurgeTargetRestId] = useState("");
  const [deleteRestModalOpened, setDeleteRestModalOpened] = useState(false);
  const [restToDelete, setRestToDelete] = useState<any>(null);

  // Forms
  const [createRestForm, setCreateRestForm] = useState({
    name: "",
    address: "",
    phone: "",
    currency: "INR",
    status: "ACTIVE",
    ownerPhone: "",
    ownerName: "",
    outletName: "Main Branch",
  });
  const [editRestForm, setEditRestForm] = useState({
    name: "",
    address: "",
    phone: "",
    currency: "INR",
    status: "ACTIVE",
    ownerPhone: "",
  });
  const [createOutletForm, setCreateOutletForm] = useState({
    name: "",
    address: "",
    phone: "",
    upiId: "",
  });
  const [createUserForm, setCreateUserForm] = useState({
    phoneNumber: "",
    name: "",
    email: "",
    role: "CUSTOMER",
  });
  const [editUserForm, setEditUserForm] = useState({
    name: "",
    phoneNumber: "",
    email: "",
    role: "CUSTOMER",
  });

  // SQL Runner State
  const [sqlQuery, setSqlQuery] = useState("SELECT id, name, \"phoneNumber\", role FROM \"user\" LIMIT 10;");
  const [sqlResult, setSqlResult] = useState<any>(null);
  const [sqlRunning, setSqlRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ─── Auth Guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && (user as any)?.role !== "ADMIN") {
      router.replace("/");
    }
  }, [authLoading, user, router]);

  // ─── Data Fetching ──────────────────────────────────────────────────────────
  const fetchAllData = async (isSilent = false) => {
    if ((user as any)?.role !== "ADMIN") return;
    if (!isSilent) setRefreshing(true);
    try {
      const [mRes, rRes, uRes, oRes] = await Promise.all([
        fetch(`${API_BASE}/admin/metrics`, { credentials: "include" }),
        fetch(`${API_BASE}/admin/restaurants`, { credentials: "include" }),
        fetch(`${API_BASE}/admin/users`, { credentials: "include" }),
        fetch(`${API_BASE}/admin/outlets`, { credentials: "include" }),
      ]);

      if (mRes.ok) setMetrics(await mRes.json());
      if (rRes.ok) setRestaurants(await rRes.json());
      if (uRes.ok) setUsers(await uRes.json());
      if (oRes.ok) setOutlets(await oRes.json());
    } catch (err: any) {
      notifications.show({ title: "Failed to load admin data", message: err.message, color: "red" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [user]);

  // ─── Filtered Data ──────────────────────────────────────────────────────────
  const filteredRestaurants = useMemo(() => {
    return restaurants.filter((r) => {
      const matchesSearch =
        r.name?.toLowerCase().includes(restSearch.toLowerCase()) ||
        r.address?.toLowerCase().includes(restSearch.toLowerCase()) ||
        r.ownerPhone?.toLowerCase().includes(restSearch.toLowerCase()) ||
        r.ownerName?.toLowerCase().includes(restSearch.toLowerCase()) ||
        r.id?.toLowerCase().includes(restSearch.toLowerCase());
      const matchesStatus = restStatusFilter === "ALL" || r.status === restStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [restaurants, restSearch, restStatusFilter]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.phoneNumber?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.id?.toLowerCase().includes(userSearch.toLowerCase());
      const matchesRole = userRoleFilter === "ALL" || u.role === userRoleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, userSearch, userRoleFilter]);

  const filteredOutlets = useMemo(() => {
    return outlets.filter((o) => {
      return outletRestFilter === "ALL" || o.restaurantId === outletRestFilter;
    });
  }, [outlets, outletRestFilter]);

  // ─── CRUD Handlers ──────────────────────────────────────────────────────────

  // Create Restaurant
  const handleCreateRestaurant = async () => {
    if (!createRestForm.name.trim() || !createRestForm.address.trim() || !createRestForm.ownerPhone.trim()) {
      notifications.show({ title: "Validation Error", message: "Store name, address, and owner phone are required.", color: "red" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/restaurants`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createRestForm),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to create restaurant");
      }
      notifications.show({ title: "Restaurant Created", message: `Successfully registered "${createRestForm.name}"`, color: "green" });
      setCreateRestOpened(false);
      setCreateRestForm({
        name: "",
        address: "",
        phone: "",
        currency: "INR",
        status: "ACTIVE",
        ownerPhone: "",
        ownerName: "",
        outletName: "Main Branch",
      });
      fetchAllData(true);
    } catch (err: any) {
      notifications.show({ title: "Create Failed", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Restaurant
  const openEditRestaurant = (r: any) => {
    setSelectedRest(r);
    setEditRestForm({
      name: r.name || "",
      address: r.address || "",
      phone: r.phone || "",
      currency: r.currency || "INR",
      status: r.status || "ACTIVE",
      ownerPhone: r.ownerPhone || "",
    });
    setEditRestOpened(true);
  };

  // Save Edit Restaurant
  const handleSaveEditRestaurant = async () => {
    if (!selectedRest) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/restaurants/${selectedRest.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editRestForm),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to update restaurant");
      }
      notifications.show({ title: "Store Updated", message: `Updated "${editRestForm.name}" successfully`, color: "green" });
      setEditRestOpened(false);
      fetchAllData(true);
    } catch (err: any) {
      notifications.show({ title: "Update Failed", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Restaurant Status (Active <-> Suspended)
  const toggleRestaurantStatus = async (r: any) => {
    const nextStatus = r.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    try {
      const res = await fetch(`${API_BASE}/admin/restaurants/${r.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error("Failed to change store status");
      notifications.show({
        title: "Status Changed",
        message: `${r.name} is now ${nextStatus}`,
        color: nextStatus === "ACTIVE" ? "green" : "orange",
      });
      fetchAllData(true);
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  // Delete Restaurant
  const handleDeleteRestaurant = async () => {
    if (!restToDelete) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/restaurants/${restToDelete.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete restaurant");
      notifications.show({ title: "Restaurant Deleted", message: `Deleted "${restToDelete.name}" permanently.`, color: "green" });
      setDeleteRestModalOpened(false);
      setRestToDelete(null);
      fetchAllData(true);
    } catch (err: any) {
      notifications.show({ title: "Delete Failed", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  // Impersonate / Enter Store as Owner
  const handleEnterStore = (r: any) => {
    document.cookie = `dine.restaurantId=${encodeURIComponent(r.id)};path=/;SameSite=Lax`;
    setActiveRestaurant(r.id);
    notifications.show({
      title: "Entering Store as Platform Admin",
      message: `Switched context to "${r.name}". You have full OWNER access.`,
      color: "indigo",
    });
    router.push("/pos");
  };

  // Open Outlets Drawer
  const openOutletsDrawer = (r: any) => {
    setSelectedRestForOutlets(r);
    setOutletsDrawerOpened(true);
  };

  // Create Outlet
  const handleCreateOutlet = async () => {
    if (!selectedRestForOutlets || !createOutletForm.name.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/restaurants/${selectedRestForOutlets.id}/outlets`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createOutletForm),
      });
      if (!res.ok) throw new Error("Failed to create outlet");
      notifications.show({ title: "Outlet Created", message: `Added "${createOutletForm.name}"`, color: "green" });
      setCreateOutletOpened(false);
      setCreateOutletForm({ name: "", address: "", phone: "", upiId: "" });
      fetchAllData(true);
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Outlet
  const handleDeleteOutlet = async (outletId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete outlet "${name}"?`)) return;
    try {
      const res = await fetch(`${API_BASE}/admin/outlets/${outletId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete outlet");
      notifications.show({ title: "Outlet Deleted", message: `Removed "${name}"`, color: "green" });
      fetchAllData(true);
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  // Change User Role
  const changeUserRole = async (userId: string, role: string) => {
    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}/role`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error("Failed to update role");
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
      notifications.show({ title: "User Role Updated", message: `Assigned role ${role}`, color: "green" });
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  // Create User
  const handleCreateUser = async () => {
    if (!createUserForm.phoneNumber.trim()) {
      notifications.show({ title: "Validation Error", message: "Phone number is required", color: "red" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/users`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createUserForm),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to create user");
      }
      notifications.show({ title: "User Created", message: `Added ${createUserForm.phoneNumber}`, color: "green" });
      setCreateUserOpened(false);
      setCreateUserForm({ phoneNumber: "", name: "", email: "", role: "CUSTOMER" });
      fetchAllData(true);
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit User
  const openEditUser = (u: any) => {
    setSelectedUser(u);
    setEditUserForm({
      name: u.name || "",
      phoneNumber: u.phoneNumber || "",
      email: u.email || "",
      role: u.role || "CUSTOMER",
    });
    setEditUserOpened(true);
  };

  // Save Edit User
  const handleSaveEditUser = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editUserForm),
      });
      if (!res.ok) throw new Error("Failed to update user");
      notifications.show({ title: "User Updated", message: "Profile saved successfully", color: "green" });
      setEditUserOpened(false);
      fetchAllData(true);
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  // Delete User
  const handleDeleteUser = async (u: any) => {
    if (u.id === (user as any)?.id) {
      notifications.show({ title: "Action Blocked", message: "You cannot delete your own admin account", color: "red" });
      return;
    }
    if (!confirm(`Are you sure you want to permanently delete user "${u.name || u.phoneNumber}"?`)) return;
    try {
      const res = await fetch(`${API_BASE}/admin/users/${u.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete user");
      notifications.show({ title: "User Deleted", message: "Account removed", color: "green" });
      fetchAllData(true);
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  // Purge Orders
  const handlePurgeOrders = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/purge-orders`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: purgeTargetRestId || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to purge orders");
      const data = await res.json();
      notifications.show({ title: "Orders Purged", message: data.message, color: "green" });
      setPurgeModalOpened(false);
      fetchAllData(true);
    } catch (err: any) {
      notifications.show({ title: "Purge Failed", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  // Run Raw SQL
  const handleExecuteSql = async () => {
    if (!sqlQuery.trim()) return;
    setSqlRunning(true);
    setSqlResult(null);
    try {
      const res = await fetch(`${API_BASE}/admin/execute-sql`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: sqlQuery }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "SQL Error");
      setSqlResult(data.result);
      notifications.show({ title: "Query Executed", message: "SQL executed successfully", color: "green" });
    } catch (err: any) {
      setSqlResult({ error: err.message });
      notifications.show({ title: "SQL Execution Failed", message: err.message, color: "red" });
    } finally {
      setSqlRunning(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  if (authLoading || loading) {
    return (
      <Center py={100}>
        <Stack align="center" gap="md">
          <Loader color="dinePrimary" size="lg" />
          <Text size="sm" c="dimmed">Initializing Platform Control Plane...</Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Box py="xl" px={{ base: "xs", sm: "md" }} style={{ maxWidth: 1400, margin: "0 auto" }}>
      {/* ─── Top Header & Controls ─────────────────────────────────────────── */}
      <Group justify="space-between" align="flex-start" mb="lg" wrap="wrap">
        <Box>
          <Group gap="xs" align="center">
            <Title order={2} style={{ letterSpacing: "-0.5px" }}>
              Platform Superadmin Control Plane
            </Title>
            <Badge color="dinePrimary" variant="filled" size="md">ADMIN</Badge>
          </Group>
          <Text size="sm" c="dimmed" mt={4}>
            Global SaaS governance, multi-tenant restaurant operations, and user access management
          </Text>
        </Box>

        <Group gap="xs">
          <Button
            variant="default"
            leftSection={<IconRefresh size={16} />}
            loading={refreshing}
            onClick={() => fetchAllData()}
          >
            Refresh
          </Button>
          <Button
            color="dinePrimary"
            leftSection={<IconPlus size={16} />}
            onClick={() => setCreateRestOpened(true)}
          >
            Add Restaurant
          </Button>
        </Group>
      </Group>

      {/* ─── Macro KPI Metrics Cards ────────────────────────────────────────── */}
      {metrics && (
        <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="md" mb="xl">
          <Card withBorder padding="md" radius="md">
            <Group justify="space-between" align="flex-start">
              <Box>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">Stores</Text>
                <Text size="xl" fw={700} mt={4}>{metrics.totalRestaurants}</Text>
              </Box>
              <ActionIcon variant="light" color="indigo" radius="md" size="lg">
                <IconBuildingStore size={20} />
              </ActionIcon>
            </Group>
            <Group gap={6} mt="xs">
              <Badge size="xs" color="green">{metrics.activeRestaurants} Active</Badge>
              {metrics.trialRestaurants > 0 && <Badge size="xs" color="blue">{metrics.trialRestaurants} Trial</Badge>}
              {metrics.suspendedRestaurants > 0 && <Badge size="xs" color="red">{metrics.suspendedRestaurants} Suspended</Badge>}
            </Group>
          </Card>

          <Card withBorder padding="md" radius="md">
            <Group justify="space-between" align="flex-start">
              <Box>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">Total Outlets</Text>
                <Text size="xl" fw={700} mt={4}>{metrics.totalOutlets}</Text>
              </Box>
              <ActionIcon variant="light" color="cyan" radius="md" size="lg">
                <IconBuildingStore size={20} />
              </ActionIcon>
            </Group>
            <Text size="xs" c="dimmed" mt="xs">Across all tenants</Text>
          </Card>

          <Card withBorder padding="md" radius="md">
            <Group justify="space-between" align="flex-start">
              <Box>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">Platform Users</Text>
                <Text size="xl" fw={700} mt={4}>{metrics.totalUsers}</Text>
              </Box>
              <ActionIcon variant="light" color="teal" radius="md" size="lg">
                <IconUsers size={20} />
              </ActionIcon>
            </Group>
            <Group gap={6} mt="xs">
              <Badge size="xs" color="indigo">{metrics.adminUsers} Admin</Badge>
              <Badge size="xs" color="violet">{metrics.ownerUsers} Owners</Badge>
              <Badge size="xs" color="gray">{metrics.customerUsers} Customers</Badge>
            </Group>
          </Card>

          <Card withBorder padding="md" radius="md">
            <Group justify="space-between" align="flex-start">
              <Box>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">Platform Orders</Text>
                <Text size="xl" fw={700} mt={4}>{metrics.totalOrders}</Text>
              </Box>
              <ActionIcon variant="light" color="orange" radius="md" size="lg">
                <IconReceipt size={20} />
              </ActionIcon>
            </Group>
            <Text size="xs" c="dimmed" mt="xs">Today: {metrics.todayOrders} orders</Text>
          </Card>

          <Card withBorder padding="md" radius="md">
            <Group justify="space-between" align="flex-start">
              <Box>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">Total Platform GMV</Text>
                <Text size="xl" fw={700} mt={4}>₹{metrics.totalGmv?.toLocaleString("en-IN")}</Text>
              </Box>
              <ActionIcon variant="light" color="green" radius="md" size="lg">
                <IconCurrencyRupee size={20} />
              </ActionIcon>
            </Group>
            <Text size="xs" c="dimmed" mt="xs">Today: ₹{metrics.todayGmv?.toLocaleString("en-IN")}</Text>
          </Card>
        </SimpleGrid>
      )}

      {/* ─── Main Content Tabs ──────────────────────────────────────────────── */}
      <Tabs defaultValue="restaurants" keepMounted={false}>
        <ScrollArea type="always" scrollbarSize={4} offsetScrollbars="x" scrollbars="x">
          <Tabs.List mb="lg" style={{ flexWrap: "nowrap", width: "max-content", minWidth: "100%" }}>
            <Tabs.Tab value="restaurants" leftSection={<IconBuildingStore size={16} />}>
              Restaurants ({restaurants.length})
            </Tabs.Tab>
            <Tabs.Tab value="users" leftSection={<IconUsers size={16} />}>
              Users Directory ({users.length})
            </Tabs.Tab>
            <Tabs.Tab value="outlets" leftSection={<IconBuildingStore size={16} />}>
              All Outlets ({outlets.length})
            </Tabs.Tab>
            <Tabs.Tab value="system" leftSection={<IconDatabase size={16} />}>
              Operations & Database
            </Tabs.Tab>
          </Tabs.List>
        </ScrollArea>

        {/* ─── TAB 1: RESTAURANTS MANAGEMENT ──────────────────────────────── */}
        <Tabs.Panel value="restaurants">
          <Card withBorder padding="md" radius="md" mb="md">
            <Group justify="space-between" wrap="wrap" gap="md">
              <Group gap="xs" style={{ flex: 1, minWidth: 260 }}>
                <TextInput
                  placeholder="Search store name, owner phone, address..."
                  leftSection={<IconSearch size={16} />}
                  value={restSearch}
                  onChange={(e) => setRestSearch(e.currentTarget.value)}
                  style={{ flex: 1 }}
                />
                <Select
                  value={restStatusFilter}
                  onChange={(v) => setRestStatusFilter(v || "ALL")}
                  data={[
                    { value: "ALL", label: "All Statuses" },
                    { value: "ACTIVE", label: "Active" },
                    { value: "TRIAL", label: "Trial" },
                    { value: "SUSPENDED", label: "Suspended" },
                  ]}
                  w={140}
                />
              </Group>
              <Text size="sm" c="dimmed">
                Showing {filteredRestaurants.length} of {restaurants.length} stores
              </Text>
            </Group>
          </Card>

          <Card withBorder padding={0} radius="md">
            <Table striped highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Restaurant</Table.Th>
                  <Table.Th>Owner</Table.Th>
                  <Table.Th>Outlets</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Orders & GMV</Table.Th>
                  <Table.Th>Created</Table.Th>
                  <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredRestaurants.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={7} style={{ textAlign: "center", padding: 40 }}>
                      <Text c="dimmed">No restaurants found matching filters.</Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  filteredRestaurants.map((r) => (
                    <Table.Tr key={r.id}>
                      <Table.Td>
                        <Group gap="xs" wrap="nowrap">
                          <ActionIcon variant="light" color="dinePrimary" size="md" radius="md">
                            <IconBuildingStore size={18} />
                          </ActionIcon>
                          <Box>
                            <Text size="sm" fw={600}>{r.name}</Text>
                            <Text size="xs" c="dimmed" lineClamp={1}>{r.address}</Text>
                          </Box>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" fw={600}>{r.ownerName || "Unnamed"}</Text>
                        <Text size="xs" c="dimmed">{r.ownerPhone || "—"}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Button
                          variant="subtle"
                          size="compact-xs"
                          color="indigo"
                          onClick={() => openOutletsDrawer(r)}
                        >
                          {r.outletsCount} {r.outletsCount === 1 ? "Outlet" : "Outlets"}
                        </Button>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          size="sm"
                          color={
                            r.status === "ACTIVE"
                              ? "green"
                              : r.status === "TRIAL"
                              ? "blue"
                              : "red"
                          }
                        >
                          {r.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" fw={600}>₹{r.totalGmv?.toLocaleString("en-IN") || 0}</Text>
                        <Text size="11px" c="dimmed">{r.ordersCount || 0} orders</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">{new Date(r.createdAt).toLocaleDateString("en-IN")}</Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: "right" }}>
                        <Group gap="xs" justify="flex-end" wrap="nowrap">
                          <Tooltip label="Enter Store as Owner">
                            <Button
                              size="xs"
                              variant="filled"
                              color="dinePrimary"
                              leftSection={<IconLogin size={14} />}
                              onClick={() => handleEnterStore(r)}
                            >
                              Enter Store
                            </Button>
                          </Tooltip>

                          <Menu position="bottom-end" shadow="md">
                            <Menu.Target>
                              <ActionIcon variant="subtle" color="gray">
                                <IconDotsVertical size={16} />
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Item
                                leftSection={<IconBuildingStore size={15} />}
                                onClick={() => openOutletsDrawer(r)}
                              >
                                Manage Outlets
                              </Menu.Item>
                              <Menu.Item
                                leftSection={<IconEdit size={15} />}
                                onClick={() => openEditRestaurant(r)}
                              >
                                Edit Details
                              </Menu.Item>
                              <Menu.Item
                                leftSection={<IconPower size={15} />}
                                onClick={() => toggleRestaurantStatus(r)}
                              >
                                {r.status === "ACTIVE" ? "Suspend Store" : "Activate Store"}
                              </Menu.Item>
                              <Menu.Divider />
                              <Menu.Item
                                color="red"
                                leftSection={<IconTrash size={15} />}
                                onClick={() => {
                                  setRestToDelete(r);
                                  setDeleteRestModalOpened(true);
                                }}
                              >
                                Delete Store
                              </Menu.Item>
                            </Menu.Dropdown>
                          </Menu>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>
          </Card>
        </Tabs.Panel>

        {/* ─── TAB 2: USERS DIRECTORY ─────────────────────────────────────── */}
        <Tabs.Panel value="users">
          <Card withBorder padding="md" radius="md" mb="md">
            <Group justify="space-between" wrap="wrap" gap="md">
              <Group gap="xs" style={{ flex: 1, minWidth: 260 }}>
                <TextInput
                  placeholder="Search user name, phone, email, ID..."
                  leftSection={<IconSearch size={16} />}
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.currentTarget.value)}
                  style={{ flex: 1 }}
                />
                <Select
                  value={userRoleFilter}
                  onChange={(v) => setUserRoleFilter(v || "ALL")}
                  data={[
                    { value: "ALL", label: "All Roles" },
                    { value: "ADMIN", label: "ADMIN" },
                    { value: "OWNER", label: "OWNER" },
                    { value: "CUSTOMER", label: "CUSTOMER" },
                  ]}
                  w={140}
                />
              </Group>
              <Button
                variant="light"
                color="dinePrimary"
                leftSection={<IconUserPlus size={16} />}
                onClick={() => setCreateUserOpened(true)}
              >
                Pre-register User
              </Button>
            </Group>
          </Card>

          <Card withBorder padding={0} radius="md">
            <Table striped highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>User</Table.Th>
                  <Table.Th>Phone & Email</Table.Th>
                  <Table.Th>Platform Role</Table.Th>
                  <Table.Th>Store Memberships</Table.Th>
                  <Table.Th>Joined Date</Table.Th>
                  <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredUsers.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={6} style={{ textAlign: "center", padding: 40 }}>
                      <Text c="dimmed">No users found matching query.</Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  filteredUsers.map((u) => (
                    <Table.Tr key={u.id}>
                      <Table.Td>
                        <Text size="sm" fw={600}>{u.name || "Unnamed User"}</Text>
                        <Text size="11px" c="dimmed">{u.id}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" fw={500}>{u.phoneNumber || "No phone"}</Text>
                        {u.email && <Text size="11px" c="dimmed">{u.email}</Text>}
                      </Table.Td>
                      <Table.Td>
                        <Select
                          size="xs"
                          value={u.role}
                          onChange={(v) => v && changeUserRole(u.id, v)}
                          data={["ADMIN", "OWNER", "CUSTOMER"]}
                          w={115}
                        />
                      </Table.Td>
                      <Table.Td>
                        {u.memberships && u.memberships.length > 0 ? (
                          <Group gap={4} wrap="wrap">
                            {u.memberships.map((m: any, idx: number) => (
                              <Badge key={idx} size="xs" variant="outline" color="violet">
                                {m.restaurantName} ({m.role.replace("role_", "")})
                              </Badge>
                            ))}
                          </Group>
                        ) : u.ownedCount > 0 ? (
                          <Badge size="xs" color="green">Owns {u.ownedCount} Store(s)</Badge>
                        ) : (
                          <Text size="xs" c="dimmed">No store access</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">{new Date(u.createdAt).toLocaleDateString("en-IN")}</Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: "right" }}>
                        <Group gap="xs" justify="flex-end">
                          <ActionIcon
                            variant="subtle"
                            color="blue"
                            onClick={() => openEditUser(u)}
                            aria-label="Edit User"
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => handleDeleteUser(u)}
                            aria-label="Delete User"
                            disabled={u.id === (user as any)?.id}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>
          </Card>
        </Tabs.Panel>

        {/* ─── TAB 3: ALL OUTLETS EXPLORER ─────────────────────────────────── */}
        <Tabs.Panel value="outlets">
          <Card withBorder padding="md" radius="md" mb="md">
            <Group justify="space-between" wrap="wrap" gap="md">
              <Group gap="xs">
                <Text size="sm" fw={600}>Filter by Restaurant:</Text>
                <Select
                  value={outletRestFilter}
                  onChange={(v) => setOutletRestFilter(v || "ALL")}
                  data={[
                    { value: "ALL", label: "All Restaurants" },
                    ...restaurants.map((r) => ({ value: r.id, label: r.name })),
                  ]}
                  w={240}
                />
              </Group>
              <Text size="sm" c="dimmed">
                Total {filteredOutlets.length} active outlets
              </Text>
            </Group>
          </Card>

          <Card withBorder padding={0} radius="md">
            <Table striped highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Outlet Name</Table.Th>
                  <Table.Th>Restaurant Tenant</Table.Th>
                  <Table.Th>UPI ID & Phone</Table.Th>
                  <Table.Th>Default</Table.Th>
                  <Table.Th>Created Date</Table.Th>
                  <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredOutlets.map((o) => (
                  <Table.Tr key={o.id}>
                    <Table.Td>
                      <Text size="sm" fw={600}>{o.name}</Text>
                      <Text size="11px" c="dimmed">{o.id}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="xs" variant="light" color="indigo">{o.restaurantName}</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">{o.upiId || "—"}</Text>
                      <Text size="11px" c="dimmed">{o.phone || "—"}</Text>
                    </Table.Td>
                    <Table.Td>
                      {o.isDefault ? (
                        <Badge size="xs" color="teal">Default Outlet</Badge>
                      ) : (
                        <Text size="xs" c="dimmed">Standard</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">{new Date(o.createdAt).toLocaleDateString("en-IN")}</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: "right" }}>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => handleDeleteOutlet(o.id, o.name)}
                        aria-label="Delete Outlet"
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>
        </Tabs.Panel>

        {/* ─── TAB 4: SYSTEM & DATABASE OPERATIONS ─────────────────────────── */}
        <Tabs.Panel value="system">
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
            {/* Danger Zone: Order Purge */}
            <Card withBorder padding="lg" radius="md">
              <Group gap="xs" mb="xs">
                <ActionIcon variant="light" color="red" size="lg" radius="md">
                  <IconAlertCircle size={20} />
                </ActionIcon>
                <Title order={4}>Order Purge Tool</Title>
              </Group>
              <Text size="xs" c="dimmed" mb="md">
                Safely wipe test orders, order items, and item audits from database before going live.
              </Text>

              <Alert color="red" icon={<IconAlertCircle size={16} />} mb="md">
                Purging removes orders and recalculates restaurant financials. This operation cannot be undone.
              </Alert>

              <Button
                color="red"
                variant="light"
                leftSection={<IconTrash size={16} />}
                onClick={() => setPurgeModalOpened(true)}
              >
                Open Purge Manager
              </Button>
            </Card>

            {/* Platform Health & Details */}
            <Card withBorder padding="lg" radius="md">
              <Group gap="xs" mb="xs">
                <ActionIcon variant="light" color="teal" size="lg" radius="md">
                  <IconDatabase size={20} />
                </ActionIcon>
                <Title order={4}>Infrastructure Status</Title>
              </Group>
              <Text size="xs" c="dimmed" mb="md">
                Cloudflare Workers edge API, PostgreSQL Hyperdrive and KV cache telemetry.
              </Text>

              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="xs" fw={600}>API Endpoint:</Text>
                  <Text size="xs" c="dimmed">{API_BASE}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="xs" fw={600}>Hyperdrive Connection:</Text>
                  <Badge size="xs" color="green">CONNECTED</Badge>
                </Group>
                <Group justify="space-between">
                  <Text size="xs" fw={600}>KV Cache Layer:</Text>
                  <Badge size="xs" color="teal">ACTIVE</Badge>
                </Group>
                <Group justify="space-between">
                  <Text size="xs" fw={600}>Tenancy Isolation:</Text>
                  <Badge size="xs" color="indigo">ENFORCED (RBAC)</Badge>
                </Group>
              </Stack>
            </Card>
          </SimpleGrid>

          {/* Raw SQL Query Runner */}
          <Card withBorder padding="lg" radius="md" mt="lg">
            <Group justify="space-between" mb="xs">
              <Group gap="xs">
                <ActionIcon variant="light" color="indigo" size="lg" radius="md">
                  <IconDatabase size={20} />
                </ActionIcon>
                <Title order={4}>Superadmin SQL Migration & Runner</Title>
              </Group>
              <Button
                size="xs"
                color="indigo"
                loading={sqlRunning}
                onClick={handleExecuteSql}
              >
                Execute SQL
              </Button>
            </Group>
            <Text size="xs" c="dimmed" mb="sm">
              Run raw PostgreSQL queries or DDL migrations directly against the Hyperdrive database.
            </Text>

            <Textarea
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.currentTarget.value)}
              minRows={3}
              maxRows={8}
              autosize
              style={{ fontFamily: "monospace" }}
              mb="md"
            />

            {sqlResult && (
              <Box>
                <Text size="xs" fw={600} mb={4}>Execution Result:</Text>
                <Paper withBorder p="sm" radius="md" bg="#1e1e1e">
                  <ScrollArea style={{ maxHeight: 250 }}>
                    <pre style={{ margin: 0, color: "#69db7c", fontSize: 12, fontFamily: "monospace" }}>
                      {JSON.stringify(sqlResult, null, 2)}
                    </pre>
                  </ScrollArea>
                </Paper>
              </Box>
            )}
          </Card>
        </Tabs.Panel>
      </Tabs>

      {/* ─── MODAL: CREATE RESTAURANT ───────────────────────────────────────── */}
      <Modal
        opened={createRestOpened}
        onClose={() => setCreateRestOpened(false)}
        title={<Text fw={700}>Add New Restaurant Tenant</Text>}
        size="lg"
      >
        <Stack gap="sm">
          <TextInput
            label="Restaurant Name"
            placeholder="e.g. Urban Diner & Bar"
            required
            value={createRestForm.name}
            onChange={(e) => setCreateRestForm((f) => ({ ...f, name: e.target.value }))}
          />
          <TextInput
            label="Address"
            placeholder="e.g. 100 Feet Road, Indiranagar, Bengaluru"
            required
            value={createRestForm.address}
            onChange={(e) => setCreateRestForm((f) => ({ ...f, address: e.target.value }))}
          />
          <Group grow>
            <TextInput
              label="Contact Phone"
              placeholder="e.g. 9876543210"
              value={createRestForm.phone}
              onChange={(e) => setCreateRestForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <Select
              label="Currency"
              value={createRestForm.currency}
              onChange={(v) => setCreateRestForm((f) => ({ ...f, currency: v || "INR" }))}
              data={["INR", "USD", "EUR", "AED", "GBP"]}
            />
          </Group>

          <Divider my="xs" label="Owner Account Provisioning" labelPosition="center" />

          <Group grow>
            <TextInput
              label="Owner Phone Number (Login Key)"
              placeholder="+91..."
              required
              value={createRestForm.ownerPhone}
              onChange={(e) => setCreateRestForm((f) => ({ ...f, ownerPhone: e.target.value }))}
            />
            <TextInput
              label="Owner Full Name"
              placeholder="e.g. Ramesh Kumar"
              value={createRestForm.ownerName}
              onChange={(e) => setCreateRestForm((f) => ({ ...f, ownerName: e.target.value }))}
            />
          </Group>

          <TextInput
            label="Initial Default Outlet Name"
            placeholder="Main Branch"
            value={createRestForm.outletName}
            onChange={(e) => setCreateRestForm((f) => ({ ...f, outletName: e.target.value }))}
          />

          <Select
            label="Initial Subscription Status"
            value={createRestForm.status}
            onChange={(v) => setCreateRestForm((f) => ({ ...f, status: v || "ACTIVE" }))}
            data={[
              { value: "ACTIVE", label: "ACTIVE (Paid / Live)" },
              { value: "TRIAL", label: "TRIAL (Free Trial Period)" },
              { value: "SUSPENDED", label: "SUSPENDED (Locked)" },
            ]}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setCreateRestOpened(false)}>Cancel</Button>
            <Button color="dinePrimary" loading={submitting} onClick={handleCreateRestaurant}>
              Create & Provision Store
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ─── MODAL: EDIT RESTAURANT ─────────────────────────────────────────── */}
      <Modal
        opened={editRestOpened}
        onClose={() => setEditRestOpened(false)}
        title={<Text fw={700}>Edit Restaurant Details</Text>}
        size="md"
      >
        <Stack gap="sm">
          <TextInput
            label="Restaurant Name"
            value={editRestForm.name}
            onChange={(e) => setEditRestForm((f) => ({ ...f, name: e.target.value }))}
          />
          <TextInput
            label="Address"
            value={editRestForm.address}
            onChange={(e) => setEditRestForm((f) => ({ ...f, address: e.target.value }))}
          />
          <Group grow>
            <TextInput
              label="Contact Phone"
              value={editRestForm.phone}
              onChange={(e) => setEditRestForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <Select
              label="Status"
              value={editRestForm.status}
              onChange={(v) => setEditRestForm((f) => ({ ...f, status: v || "ACTIVE" }))}
              data={["ACTIVE", "TRIAL", "SUSPENDED", "CHURNED"]}
            />
          </Group>
          <TextInput
            label="Reassign Owner (Phone Number)"
            description="Enter new owner's mobile number to transfer store ownership"
            value={editRestForm.ownerPhone}
            onChange={(e) => setEditRestForm((f) => ({ ...f, ownerPhone: e.target.value }))}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setEditRestOpened(false)}>Cancel</Button>
            <Button color="dinePrimary" loading={submitting} onClick={handleSaveEditRestaurant}>
              Save Changes
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ─── DRAWER: MANAGE OUTLETS ─────────────────────────────────────────── */}
      <Drawer
        opened={outletsDrawerOpened}
        onClose={() => setOutletsDrawerOpened(false)}
        title={
          <Group gap="xs">
            <IconBuildingStore size={20} color="#af73d7" />
            <Text fw={700}>Manage Outlets: {selectedRestForOutlets?.name}</Text>
          </Group>
        }
        position="right"
        size="md"
      >
        <Box mb="md">
          <Button
            size="xs"
            color="dinePrimary"
            leftSection={<IconPlus size={14} />}
            onClick={() => setCreateOutletOpened(true)}
            fullWidth
          >
            Add New Outlet
          </Button>
        </Box>

        <Stack gap="xs">
          {outlets
            .filter((o) => o.restaurantId === selectedRestForOutlets?.id)
            .map((out) => (
              <Card key={out.id} withBorder padding="sm" radius="md">
                <Group justify="space-between" align="flex-start">
                  <Box>
                    <Group gap="xs">
                      <Text size="sm" fw={600}>{out.name}</Text>
                      {out.isDefault && <Badge size="xs" color="teal">Default</Badge>}
                    </Group>
                    <Text size="xs" c="dimmed">{out.address || "No address"}</Text>
                    {out.upiId && <Text size="11px" c="dimmed">UPI: {out.upiId}</Text>}
                  </Box>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={() => handleDeleteOutlet(out.id, out.name)}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Group>
              </Card>
            ))}
        </Stack>
      </Drawer>

      {/* ─── MODAL: CREATE OUTLET ───────────────────────────────────────────── */}
      <Modal
        opened={createOutletOpened}
        onClose={() => setCreateOutletOpened(false)}
        title={<Text fw={700}>Add Outlet to {selectedRestForOutlets?.name}</Text>}
      >
        <Stack gap="sm">
          <TextInput
            label="Outlet Name"
            placeholder="e.g. HSR Layout Branch"
            required
            value={createOutletForm.name}
            onChange={(e) => setCreateOutletForm((f) => ({ ...f, name: e.target.value }))}
          />
          <TextInput
            label="Address"
            placeholder="e.g. Sector 2, HSR Layout"
            value={createOutletForm.address}
            onChange={(e) => setCreateOutletForm((f) => ({ ...f, address: e.target.value }))}
          />
          <TextInput
            label="Contact Phone"
            placeholder="e.g. 9876543210"
            value={createOutletForm.phone}
            onChange={(e) => setCreateOutletForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <TextInput
            label="UPI ID"
            placeholder="e.g. store@upi"
            value={createOutletForm.upiId}
            onChange={(e) => setCreateOutletForm((f) => ({ ...f, upiId: e.target.value }))}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setCreateOutletOpened(false)}>Cancel</Button>
            <Button color="dinePrimary" loading={submitting} onClick={handleCreateOutlet}>
              Save Outlet
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ─── MODAL: PRE-REGISTER USER ───────────────────────────────────────── */}
      <Modal
        opened={createUserOpened}
        onClose={() => setCreateUserOpened(false)}
        title={<Text fw={700}>Pre-register Platform User</Text>}
      >
        <Stack gap="sm">
          <TextInput
            label="Phone Number"
            placeholder="+91..."
            required
            value={createUserForm.phoneNumber}
            onChange={(e) => setCreateUserForm((f) => ({ ...f, phoneNumber: e.target.value }))}
          />
          <TextInput
            label="Full Name"
            placeholder="e.g. Amit Kumar"
            value={createUserForm.name}
            onChange={(e) => setCreateUserForm((f) => ({ ...f, name: e.target.value }))}
          />
          <TextInput
            label="Email Address"
            placeholder="e.g. amit@example.com"
            value={createUserForm.email}
            onChange={(e) => setCreateUserForm((f) => ({ ...f, email: e.target.value }))}
          />
          <Select
            label="Platform Role"
            value={createUserForm.role}
            onChange={(v) => setCreateUserForm((f) => ({ ...f, role: v || "CUSTOMER" }))}
            data={["CUSTOMER", "OWNER", "ADMIN"]}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setCreateUserOpened(false)}>Cancel</Button>
            <Button color="dinePrimary" loading={submitting} onClick={handleCreateUser}>
              Create User
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ─── MODAL: EDIT USER ───────────────────────────────────────────────── */}
      <Modal
        opened={editUserOpened}
        onClose={() => setEditUserOpened(false)}
        title={<Text fw={700}>Edit User Profile</Text>}
      >
        <Stack gap="sm">
          <TextInput
            label="Full Name"
            value={editUserForm.name}
            onChange={(e) => setEditUserForm((f) => ({ ...f, name: e.target.value }))}
          />
          <TextInput
            label="Phone Number"
            value={editUserForm.phoneNumber}
            onChange={(e) => setEditUserForm((f) => ({ ...f, phoneNumber: e.target.value }))}
          />
          <TextInput
            label="Email Address"
            value={editUserForm.email}
            onChange={(e) => setEditUserForm((f) => ({ ...f, email: e.target.value }))}
          />
          <Select
            label="Platform Role"
            value={editUserForm.role}
            onChange={(v) => setEditUserForm((f) => ({ ...f, role: v || "CUSTOMER" }))}
            data={["CUSTOMER", "OWNER", "ADMIN"]}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setEditUserOpened(false)}>Cancel</Button>
            <Button color="dinePrimary" loading={submitting} onClick={handleSaveEditUser}>
              Save Profile
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ─── MODAL: DELETE RESTAURANT CONFIRMATION ──────────────────────────── */}
      <Modal
        opened={deleteRestModalOpened}
        onClose={() => setDeleteRestModalOpened(false)}
        title={<Text fw={700} c="red">Delete Restaurant Confirmation</Text>}
      >
        <Stack gap="sm">
          <Alert color="red" icon={<IconAlertCircle size={16} />}>
            Are you sure you want to permanently delete <strong>{restToDelete?.name}</strong>?
            This will cascade delete all outlets, staff assignments, menus, and table data.
          </Alert>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setDeleteRestModalOpened(false)}>Cancel</Button>
            <Button color="red" loading={submitting} onClick={handleDeleteRestaurant}>
              Permanently Delete Store
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ─── MODAL: ORDER PURGE ─────────────────────────────────────────────── */}
      <Modal
        opened={purgeModalOpened}
        onClose={() => setPurgeModalOpened(false)}
        title={<Text fw={700} c="red">Purge Orders Confirmation</Text>}
      >
        <Stack gap="sm">
          <Text size="sm">
            Select whether you want to purge orders for a single restaurant or platform-wide:
          </Text>
          <Select
            label="Target Scope"
            value={purgeTargetRestId}
            onChange={(v) => setPurgeTargetRestId(v || "")}
            data={[
              { value: "", label: "ALL Restaurants (Platform-wide Purge)" },
              ...restaurants.map((r) => ({ value: r.id, label: r.name })),
            ]}
          />
          <Alert color="red" icon={<IconAlertCircle size={16} />}>
            This action will permanently delete orders, sale order items, and audit trails.
          </Alert>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setPurgeModalOpened(false)}>Cancel</Button>
            <Button color="red" loading={submitting} onClick={handlePurgeOrders}>
              Confirm Purge
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
