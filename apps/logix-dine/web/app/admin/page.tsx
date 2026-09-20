"use client";

import React, { useState, useEffect } from "react";
import { Container, Title, Tabs, Table, Text, Badge, Button, Loader, Center, Select, ScrollArea } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://dine-api.logixsoft.in";

export default function AdminPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && (user as any)?.role !== "ADMIN") {
      router.replace("/");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if ((user as any)?.role !== "ADMIN") return;
    Promise.all([
      fetch(`${API_BASE}/admin/restaurants`, { credentials: "include" }).then((r) => r.json()),
      fetch(`${API_BASE}/admin/users`, { credentials: "include" }).then((r) => r.json()),
    ]).then(([rests, usrs]) => { setRestaurants(rests); setUsers(usrs); }).finally(() => setLoading(false));
  }, [user]);

  const changeRole = async (userId: string, role: string) => {
    await fetch(`${API_BASE}/admin/users/${userId}/role`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setUsers((u) => u.map((x) => (x.id === userId ? { ...x, role } : x)));
    notifications.show({ title: "Role updated", message: "", color: "green" });
  };

  if (isLoading || loading) return <Center py={100}><Loader color="dinePrimary" /></Center>;

  return (
    <Container size="lg" py="xl" px={0}>
      <Title order={2} mb="lg">Platform Admin</Title>
      <Tabs defaultValue="restaurants">
        <ScrollArea type="always" scrollbarSize={4} offsetScrollbars="x" scrollbars="x">
          <Tabs.List mb="lg" style={{ flexWrap: "nowrap", width: "max-content", minWidth: "100%" }}>
            <Tabs.Tab value="restaurants" style={{ flexShrink: 0, whiteSpace: "nowrap" }}>Restaurants ({restaurants.length})</Tabs.Tab>
            <Tabs.Tab value="users" style={{ flexShrink: 0, whiteSpace: "nowrap" }}>Users ({users.length})</Tabs.Tab>
          </Tabs.List>
        </ScrollArea>

        <Tabs.Panel value="restaurants">
          <Table striped withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Address</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Created</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {restaurants.map((r) => (
                <Table.Tr key={r.id}>
                  <Table.Td>{r.name}</Table.Td>
                  <Table.Td><Text size="xs" c="dimmed">{r.address}</Text></Table.Td>
                  <Table.Td><Badge size="xs" color={r.status === "ACTIVE" ? "green" : "orange"}>{r.status}</Badge></Table.Td>
                  <Table.Td><Text size="xs">{new Date(r.createdAt).toLocaleDateString("en-IN")}</Text></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Tabs.Panel>

        <Tabs.Panel value="users">
          <Table striped withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Phone</Table.Th>
                <Table.Th>Role</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {users.map((u) => (
                <Table.Tr key={u.id}>
                  <Table.Td>{u.name}</Table.Td>
                  <Table.Td><Text size="xs">{u.phoneNumber}</Text></Table.Td>
                  <Table.Td>
                    <Select
                      size="xs"
                      value={u.role}
                      onChange={(v) => v && changeRole(u.id, v)}
                      data={["ADMIN", "OWNER", "CUSTOMER"]}
                      w={110}
                    />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
