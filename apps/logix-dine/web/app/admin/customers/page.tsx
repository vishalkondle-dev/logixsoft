"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
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
import {
  IconUserCheck,
  IconUserPlus,
  IconSearch,
  IconEdit,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useUrlFilters } from "../use-url-filters";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://dine-api.logixsoft.in";

function CustomersContent() {
  const { getFilter, setFilter, clearFilters, hasActiveFilters } = useUrlFilters();

  const searchQuery = getFilter("search", "");
  const minOrdersFilter = getFilter("minOrders", "ALL");
  const sortBy = getFilter("sortBy", "spend");

  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modals
  const [createOpened, setCreateOpened] = useState(false);
  const [editOpened, setEditOpened] = useState(false);
  const [selectedCust, setSelectedCust] = useState<any>(null);

  // Forms
  const [createForm, setCreateForm] = useState({
    name: "",
    phoneNumber: "",
    email: "",
  });
  const [editForm, setEditForm] = useState({
    name: "",
    phoneNumber: "",
    email: "",
  });

  const loadData = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/customers`, { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        setCustomers(Array.isArray(d) ? d : d.customers || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async () => {
    if (!createForm.phoneNumber) {
      notifications.show({ title: "Validation Error", message: "Phone number required.", color: "orange" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create customer");
      notifications.show({ title: "Customer Added", message: `Provisioned customer ${createForm.phoneNumber}`, color: "teal" });
      setCreateOpened(false);
      setCreateForm({ name: "", phoneNumber: "", email: "" });
      loadData();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedCust) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/customers/${selectedCust.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error("Failed to update customer");
      notifications.show({ title: "Customer Updated", message: "Details saved.", color: "teal" });
      setEditOpened(false);
      loadData();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (cId: string) => {
    if (!confirm("Permanently delete this customer record?")) return;
    try {
      const res = await fetch(`${API_BASE}/admin/customers/${cId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
      notifications.show({ title: "Deleted", message: "Customer removed.", color: "teal" });
      loadData();
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    }
  };

  const filtered = useMemo(() => {
    let list = customers.filter((c) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        c.name?.toLowerCase().includes(q) ||
        c.phoneNumber?.includes(q) ||
        c.email?.toLowerCase().includes(q);

      const count = Number(c.ordersCount || 0);
      let matchesMinOrders = true;
      if (minOrdersFilter === "repeat") matchesMinOrders = count > 1;
      else if (minOrdersFilter === "first") matchesMinOrders = count === 1;
      else if (minOrdersFilter === "zero") matchesMinOrders = count === 0;

      return matchesSearch && matchesMinOrders;
    });

    if (sortBy === "spend") {
      list.sort((a, b) => Number(b.totalSpend || 0) - Number(a.totalSpend || 0));
    } else if (sortBy === "orders") {
      list.sort((a, b) => Number(b.ordersCount || 0) - Number(a.ordersCount || 0));
    } else if (sortBy === "name") {
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return list;
  }, [customers, searchQuery, minOrdersFilter, sortBy]);

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Text fw={800} size="xl">
            Customer Directory & CRM
          </Text>
          <Text size="sm" c="dimmed">
            Global directory of customer profiles, purchase history, and cross-brand customer spend.
          </Text>
        </div>
        <Button
          color="dinePrimary"
          leftSection={<IconUserPlus size={16} />}
          onClick={() => setCreateOpened(true)}
        >
          Add Customer
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
            w={{ base: "100%", sm: 280 }}
            size="xs"
          />
          <Select
            placeholder="Order History"
            data={[
              { value: "ALL", label: "All Customers" },
              { value: "repeat", label: "Repeat Diners (>1 Orders)" },
              { value: "first", label: "First-Time Diners (1 Order)" },
              { value: "zero", label: "Registered (0 Orders)" },
            ]}
            value={minOrdersFilter}
            onChange={(val) => setFilter("minOrders", val || "ALL")}
            w={{ base: "100%", sm: 200 }}
            size="xs"
          />
          <Select
            placeholder="Sort By"
            data={[
              { value: "spend", label: "Highest Spend" },
              { value: "orders", label: "Most Orders" },
              { value: "recent", label: "Newest First" },
              { value: "name", label: "Name (A-Z)" },
            ]}
            value={sortBy}
            onChange={(val) => setFilter("sortBy", val || "spend")}
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
            Showing {filtered.length} of {customers.length} Profiles
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
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Customer Profile</Table.Th>
                <Table.Th>Phone Number</Table.Th>
                <Table.Th>Orders Placed</Table.Th>
                <Table.Th>Total Spent</Table.Th>
                <Table.Th>Joined Date</Table.Th>
                <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={6} style={{ textAlign: "center", padding: 30 }}>
                    <Text c="dimmed">No customer profiles found matching criteria.</Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filtered.map((c) => (
                  <Table.Tr key={c.id}>
                    <Table.Td>
                      <Group gap="xs">
                        <IconUserCheck size={18} color="#7950f2" />
                        <div>
                          <Text fw={700} size="sm">
                            {c.name || "Customer " + c.phoneNumber}
                          </Text>
                          {c.email && (
                            <Text size="xs" c="dimmed">
                              {c.email}
                            </Text>
                          )}
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" fw={500}>
                        {c.phoneNumber}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="xs" color="indigo">
                        {c.ordersCount} Orders
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" fw={700}>
                        ₹{c.totalSpend?.toLocaleString("en-IN")}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">{new Date(c.createdAt).toLocaleDateString()}</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: "right" }}>
                      <Group gap="xs" justify="flex-end">
                        <ActionIcon
                          variant="subtle"
                          color="dinePrimary"
                          size="sm"
                          onClick={() => {
                            setSelectedCust(c);
                            setEditForm({
                              name: c.name || "",
                              phoneNumber: c.phoneNumber || "",
                              email: c.email || "",
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
                          onClick={() => handleDelete(c.id)}
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
        )}
      </Card>

      {/* Modal: Add Customer */}
      <Modal
        opened={createOpened}
        onClose={() => setCreateOpened(false)}
        title={<Text fw={700}>Add New Customer</Text>}
      >
        <Stack gap="sm">
          <TextInput
            label="Full Name"
            placeholder="e.g. Rahul Sharma"
            value={createForm.name}
            onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
          />
          <TextInput
            label="Phone Number"
            placeholder="+919876543210"
            required
            value={createForm.phoneNumber}
            onChange={(e) => setCreateForm((f) => ({ ...f, phoneNumber: e.target.value }))}
          />
          <TextInput
            label="Email Address"
            placeholder="rahul@example.com"
            value={createForm.email}
            onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setCreateOpened(false)}>
              Cancel
            </Button>
            <Button color="dinePrimary" loading={submitting} onClick={handleCreate}>
              Add Customer
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal: Edit Customer */}
      <Modal
        opened={editOpened}
        onClose={() => setEditOpened(false)}
        title={<Text fw={700}>Edit Customer Profile</Text>}
      >
        <Stack gap="sm">
          <TextInput
            label="Full Name"
            required
            value={editForm.name}
            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
          />
          <TextInput
            label="Phone Number"
            required
            value={editForm.phoneNumber}
            onChange={(e) => setEditForm((f) => ({ ...f, phoneNumber: e.target.value }))}
          />
          <TextInput
            label="Email Address"
            value={editForm.email}
            onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
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

export default function CustomersPage() {
  return (
    <Suspense
      fallback={
        <Center py={100}>
          <Loader color="dinePrimary" />
        </Center>
      }
    >
      <CustomersContent />
    </Suspense>
  );
}
