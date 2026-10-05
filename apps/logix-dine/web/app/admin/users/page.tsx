"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useDebouncedValue } from "@mantine/hooks";
import {
  Stack,
  Group,
  Text,
  Card,
  Table,
  Badge,
  Button,
  ActionIcon,
  Modal,
  TextInput,
  Select,
  Center,
  Loader,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { modals } from "@mantine/modals";
import {
  IconUsers,
  IconUserPlus,
  IconSearch,
  IconEdit,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useUrlFilters } from "../use-url-filters";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://dine-api.logixsoft.in";

const ROLE_OPTIONS = [
  { value: "ALL", label: "All Platform Roles" },
  { value: "ADMIN", label: "Superadmin (ADMIN)" },
  { value: "OWNER", label: "Store Owner (OWNER)" },
  { value: "MANAGER", label: "Branch Manager (MANAGER)" },
  { value: "CASHIER", label: "POS Cashier (CASHIER)" },
  { value: "CAPTAIN", label: "Table Captain (CAPTAIN)" },
  { value: "WAITER", label: "Floor Waiter (WAITER)" },
  { value: "KITCHEN", label: "Kitchen Chef (KITCHEN)" },
  { value: "RIDER", label: "Fleet Rider (RIDER)" },
  { value: "CUSTOMER", label: "Customer (CUSTOMER)" },
];

function UsersContent() {
  const { getFilter, setFilter, clearFilters, hasActiveFilters } = useUrlFilters();

  const searchQuery = getFilter("search", "");
  const roleFilter = getFilter("role", "ALL");
  const sortBy = getFilter("sortBy", "newest");

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modals
  const [createOpened, setCreateOpened] = useState(false);
  const [editOpened, setEditOpened] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Forms
  const [createForm, setCreateForm] = useState({
    phoneNumber: "",
    name: "",
    email: "",
    role: "CUSTOMER",
  });
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    role: "CUSTOMER",
  });

  const [debouncedSearch] = useDebouncedValue(searchQuery, 300);

  // Server-side filtering
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (roleFilter && roleFilter !== "ALL") params.set("role", roleFilter);
      if (sortBy) params.set("sortBy", sortBy);

      const res = await fetch(`${API_BASE}/admin/users?${params.toString()}`, { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        setUsers(Array.isArray(d) ? d : d.users || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, roleFilter, sortBy]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async () => {
    if (!createForm.phoneNumber) {
      notifications.show({ title: "Validation Error", message: "Mobile number required.", color: "orange" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create user");
      notifications.show({ title: "User Added", message: `Provisioned ${createForm.phoneNumber}`, color: "teal" });
      setCreateOpened(false);
      setCreateForm({ phoneNumber: "", name: "", email: "", role: "CUSTOMER" });
      loadData();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error("Failed to update user");
      notifications.show({ title: "User Updated", message: "Role & profile saved.", color: "teal" });
      setEditOpened(false);
      loadData();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (userId: string) => {
    modals.openConfirmModal({
      title: "Remove User",
      centered: true,
      children: (
        <Text size="sm">
          Are you sure you want to remove this user from the platform?
        </Text>
      ),
      labels: { confirm: "Remove User", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
            method: "DELETE",
            credentials: "include",
          });
          if (!res.ok) throw new Error("Failed to delete user");
          notifications.show({ title: "User Removed", message: "User deleted from platform.", color: "teal" });
          loadData();
        } catch (err: any) {
          notifications.show({ title: "Error", message: err.message, color: "red" });
        }
      },
    });
  };

  const filtered = users;

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Text fw={800} size="xl">
            Users & Staff Directory
          </Text>
          <Text size="sm" c="dimmed">
            Global directory of all platform administrators, restaurant owners, staff, and customer accounts.
          </Text>
        </div>
        <Button
          color="dinePrimary"
          leftSection={<IconUserPlus size={16} />}
          onClick={() => setCreateOpened(true)}
        >
          Add Platform User
        </Button>
      </Group>

      {/* URL Filter Bar */}
      <Card withBorder padding="sm" radius="md">
        <Group gap="sm" wrap="wrap">
          <TextInput
            placeholder="Search by name, phone, or email..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => setFilter("search", e.target.value)}
            w={{ base: "100%", sm: 300 }}
            size="xs"
          />
          <Select
            placeholder="Filter by Role"
            data={ROLE_OPTIONS}
            value={roleFilter}
            onChange={(val) => setFilter("role", val || "ALL")}
            w={{ base: "100%", sm: 200 }}
            size="xs"
          />
          <Select
            placeholder="Sort By"
            data={[
              { value: "newest", label: "Newest Joined" },
              { value: "oldest", label: "Oldest Joined" },
              { value: "name", label: "Name (A-Z)" },
              { value: "owned_stores", label: "Stores Owned" },
            ]}
            value={sortBy}
            onChange={(val) => setFilter("sortBy", val || "newest")}
            w={{ base: "100%", sm: 160 }}
            size="xs"
          />
          {hasActiveFilters && (
            <Button
              variant="subtle"
              color="gray"
              size="xs"
              leftSection={<IconX size={14} />}
              onClick={clearFilters}
            >
              Clear Filters
            </Button>
          )}
          <Badge size="sm" variant="light" color="gray" ml="auto">
            Showing {filtered.length} of {users.length} Users
          </Badge>
        </Group>
      </Card>

      {/* Main Table */}
      <Card withBorder padding="0" radius="md">
        {loading ? (
          <Center py={60}>
            <Loader color="dinePrimary" />
          </Center>
        ) : (
          <Table.ScrollContainer minWidth={700}>
            <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>User Name</Table.Th>
                <Table.Th>Phone Number</Table.Th>
                <Table.Th>Email Address</Table.Th>
                <Table.Th>Role Badge</Table.Th>
                <Table.Th>Joined Date</Table.Th>
                <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={6} style={{ textAlign: "center", padding: 30 }}>
                    <Text c="dimmed">No users found matching criteria.</Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filtered.map((u) => (
                  <Table.Tr key={u.id}>
                    <Table.Td>
                      <Group gap="xs">
                        <IconUsers size={16} color="#7950f2" />
                        <Text fw={700} size="sm">
                          {u.name || "Unnamed User"}
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" fw={500}>
                        {u.phoneNumber || "—"}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {u.email || "—"}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        size="xs"
                        color={
                          u.role === "ADMIN"
                            ? "violet"
                            : u.role === "OWNER"
                            ? "indigo"
                            : u.role === "CUSTOMER"
                            ? "gray"
                            : "teal"
                        }
                      >
                        {u.role}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">{new Date(u.createdAt).toLocaleDateString()}</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: "right" }}>
                      <Group gap="xs" justify="flex-end">
                        <ActionIcon
                          variant="subtle"
                          color="dinePrimary"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(u);
                            setEditForm({
                              name: u.name || "",
                              email: u.email || "",
                              role: u.role || "CUSTOMER",
                            });
                            setEditOpened(true);
                          }}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          size="sm"
                          onClick={() => handleDelete(u.id)}
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
          </Table.ScrollContainer>
        )}
      </Card>

      {/* Modal: Create User */}
      <Modal
        opened={createOpened}
        onClose={() => setCreateOpened(false)}
        title={<Text fw={700}>Add Platform User</Text>}
        centered
        size="md"
      >
        <Stack gap="sm">
          <TextInput
            label="Mobile Number (E.164)"
            placeholder="+91..."
            required
            value={createForm.phoneNumber}
            onChange={(e) => setCreateForm((f) => ({ ...f, phoneNumber: e.target.value }))}
          />
          <TextInput
            label="Full Name"
            placeholder="e.g. Rahul Sharma"
            value={createForm.name}
            onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
          />
          <TextInput
            label="Email Address"
            placeholder="rahul@example.com"
            value={createForm.email}
            onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
          />
          <Select
            label="Platform Role"
            data={ROLE_OPTIONS.filter((r) => r.value !== "ALL")}
            value={createForm.role}
            onChange={(v) => setCreateForm((f) => ({ ...f, role: v || "CUSTOMER" }))}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setCreateOpened(false)}>
              Cancel
            </Button>
            <Button color="dinePrimary" loading={submitting} onClick={handleCreate}>
              Provision User
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal: Edit User */}
      <Modal
        opened={editOpened}
        onClose={() => setEditOpened(false)}
        title={<Text fw={700}>Edit User Profile & Role</Text>}
        centered
        size="md"
      >
        <Stack gap="sm">
          <TextInput
            label="Full Name"
            value={editForm.name}
            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
          />
          <TextInput
            label="Email Address"
            value={editForm.email}
            onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
          />
          <Select
            label="Platform Role"
            data={ROLE_OPTIONS.filter((r) => r.value !== "ALL")}
            value={editForm.role}
            onChange={(v) => setEditForm((f) => ({ ...f, role: v || "CUSTOMER" }))}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setEditOpened(false)}>
              Cancel
            </Button>
            <Button color="dinePrimary" loading={submitting} onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default function UsersPage() {
  return (
    <Suspense
      fallback={
        <Center py={100}>
          <Loader color="dinePrimary" />
        </Center>
      }
    >
      <UsersContent />
    </Suspense>
  );
}
