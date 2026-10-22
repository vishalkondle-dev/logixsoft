import React, { useState, useEffect } from "react";
import {
  Stack,
  Paper,
  Text,
  Group,
  Badge,
  Button,
  Table,
  Modal,
  TextInput,
  Select,
  PasswordInput,
  ActionIcon,
  Tooltip,
  SimpleGrid,
  Tabs,
  Card,
  Loader,
  Center,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconUsers,
  IconAt,
  IconServer,
  IconPlus,
  IconShieldLock,
  IconCheck,
  IconX,
  IconRefresh,
  IconMailFast,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { api } from "../api";

export const AdminConsole: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [aliasesData, setAliasesData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // User creation modal
  const [userModalOpened, { open: openUserModal, close: closeUserModal }] = useDisclosure(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("user");
  const [creatingUser, setCreatingUser] = useState(false);

  // Alias creation modal
  const [aliasModalOpened, { open: openAliasModal, close: closeAliasModal }] = useDisclosure(false);
  const [newAliasPrefix, setNewAliasPrefix] = useState("");
  const [newAliasDisplayName, setNewAliasDisplayName] = useState("");
  const [newAliasUserId, setNewAliasUserId] = useState("");
  const [creatingAlias, setCreatingAlias] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, aliasesRes] = await Promise.all([
        api.getAdminStats(),
        api.getAdminUsers(),
        api.getAdminAliases(),
      ]);
      setStats(statsRes);
      setUsers(usersRes.users || []);
      setAliasesData(aliasesRes);
    } catch (err: any) {
      notifications.show({ title: "Admin Load Error", message: err.message, color: "red" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateUser = async () => {
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      notifications.show({ title: "Validation Error", message: "All fields are required", color: "red" });
      return;
    }
    setCreatingUser(true);
    try {
      await api.createAdminUser({
        name: newUserName.trim(),
        email: newUserEmail.trim(),
        password: newUserPassword.trim(),
        role: newUserRole,
      });
      notifications.show({ title: "User Created", message: `Account created for ${newUserEmail}`, color: "teal" });
      closeUserModal();
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      loadData();
    } catch (err: any) {
      notifications.show({ title: "Create User Failed", message: err.message, color: "red" });
    } finally {
      setCreatingUser(false);
    }
  };

  const handleToggleUserDisabled = async (user: any) => {
    try {
      await api.updateAdminUser(user.id, { disabled: !user.disabled });
      notifications.show({
        title: "User Updated",
        message: `${user.email} is now ${user.disabled ? "Active" : "Disabled"}`,
        color: "teal",
      });
      loadData();
    } catch (err: any) {
      notifications.show({ title: "Update Failed", message: err.message, color: "red" });
    }
  };

  const handleCreateAlias = async () => {
    if (!newAliasPrefix.trim()) {
      notifications.show({ title: "Validation Error", message: "Alias prefix is required", color: "red" });
      return;
    }
    setCreatingAlias(true);
    try {
      await api.createAdminAlias({
        localPart: newAliasPrefix.trim(),
        displayName: newAliasDisplayName.trim() || newAliasPrefix.trim(),
        userId: newAliasUserId || undefined,
      });
      notifications.show({
        title: "Custom Alias Created",
        message: `${newAliasPrefix}@${aliasesData?.domain} is now active and receiving mail!`,
        color: "teal",
      });
      closeAliasModal();
      setNewAliasPrefix("");
      setNewAliasDisplayName("");
      loadData();
    } catch (err: any) {
      notifications.show({ title: "Create Alias Failed", message: err.message, color: "red" });
    } finally {
      setCreatingAlias(false);
    }
  };

  if (loading) {
    return (
      <Center style={{ height: "100%" }}>
        <Loader color="teal" />
      </Center>
    );
  }

  return (
    <Stack gap="lg" p="lg" style={{ height: "100%", overflowY: "auto" }}>
      {/* Top Header */}
      <Group justify="space-between">
        <div>
          <Group gap="xs">
            <IconShieldLock size={26} color="#0ca678" />
            <Text fw={800} size="xl" c="teal.9">
              Admin Console — admin@logixsoft.in
            </Text>
          </Group>
          <Text size="xs" c="dimmed">
            Manage users, unlimited custom email addresses, and domain routing for logixsoft.in
          </Text>
        </div>

        <Button
          variant="light"
          color="teal"
          size="sm"
          leftSection={<IconRefresh size={16} />}
          onClick={loadData}
        >
          Refresh Data
        </Button>
      </Group>

      {/* KPI Stats Cards */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <Card shadow="xs" padding="md" radius="md" withBorder>
          <Group justify="space-between">
            <Text size="xs" fw={700} c="dimmed">
              TOTAL MESSAGES (D1)
            </Text>
            <IconMailFast size={20} color="#0ca678" />
          </Group>
          <Text fw={800} size="2rem" mt="xs">
            {stats?.totalMessages || 0}
          </Text>
          <Badge size="xs" color="teal" variant="light" mt={4}>
            Inbound & Outbound Logged
          </Badge>
        </Card>

        <Card shadow="xs" padding="md" radius="md" withBorder>
          <Group justify="space-between">
            <Text size="xs" fw={700} c="dimmed">
              REGISTERED USERS
            </Text>
            <IconUsers size={20} color="#20c997" />
          </Group>
          <Text fw={800} size="2rem" mt="xs">
            {stats?.totalUsers || 0}
          </Text>
          <Badge size="xs" color="teal" variant="light" mt={4}>
            Role-Based Access
          </Badge>
        </Card>

        <Card shadow="xs" padding="md" radius="md" withBorder>
          <Group justify="space-between">
            <Text size="xs" fw={700} c="dimmed">
              CUSTOM ALIASES & MAILBOXES
            </Text>
            <IconAt size={20} color="#099268" />
          </Group>
          <Text fw={800} size="2rem" mt="xs">
            {stats?.totalAliases || 0}
          </Text>
          <Badge size="xs" color="teal" variant="light" mt={4}>
            Unlimited Catch-All Active
          </Badge>
        </Card>
      </SimpleGrid>

      {/* Tabs Section */}
      <Tabs defaultValue="users" color="teal">
        <Tabs.List>
          <Tabs.Tab value="users" leftSection={<IconUsers size={16} />}>
            Users Management ({users.length})
          </Tabs.Tab>
          <Tabs.Tab value="aliases" leftSection={<IconAt size={16} />}>
            Custom Aliases & Mailboxes
          </Tabs.Tab>
          <Tabs.Tab value="system" leftSection={<IconServer size={16} />}>
            Domain & System Status
          </Tabs.Tab>
        </Tabs.List>

        {/* USERS TAB */}
        <Tabs.Panel value="users" pt="md">
          <Paper p="md" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <Text fw={700} size="md">
                All System Users
              </Text>
              <Button
                color="teal"
                size="sm"
                leftSection={<IconPlus size={16} />}
                onClick={openUserModal}
              >
                Create New User
              </Button>
            </Group>

            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Email Address</Table.Th>
                  <Table.Th>Role</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {users.map((u) => (
                  <Table.Tr key={u.id}>
                    <Table.Td fw={600}>{u.name}</Table.Td>
                    <Table.Td>{u.email}</Table.Td>
                    <Table.Td>
                      <Badge color={u.role === "admin" ? "teal" : "gray"}>
                        {u.role.toUpperCase()}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={u.disabled ? "red" : "green"} variant="light">
                        {u.disabled ? "Disabled" : "Active"}
                      </Badge>
                    </Table.Td>
                    <Table.Td style={{ textAlign: "right" }}>
                      {u.email !== "admin@logixsoft.in" && (
                        <Button
                          variant="subtle"
                          size="xs"
                          color={u.disabled ? "teal" : "red"}
                          onClick={() => handleToggleUserDisabled(u)}
                        >
                          {u.disabled ? "Enable" : "Disable"}
                        </Button>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        </Tabs.Panel>

        {/* ALIASES TAB */}
        <Tabs.Panel value="aliases" pt="md">
          <Paper p="md" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <div>
                <Text fw={700} size="md">
                  Configured Custom Email Addresses
                </Text>
                <Text size="xs" c="dimmed">
                  Any email sent to any address on @{aliasesData?.domain || "logixsoft.in"} is captured by the catch-all worker!
                </Text>
              </div>

              <Button
                color="teal"
                size="sm"
                leftSection={<IconPlus size={16} />}
                onClick={openAliasModal}
              >
                Create Custom Alias
              </Button>
            </Group>

            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Address</Table.Th>
                  <Table.Th>Display Label</Table.Th>
                  <Table.Th>Assigned User</Table.Th>
                  <Table.Th>Type</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(aliasesData?.mailboxes || []).map((m: any) => (
                  <Table.Tr key={m.id}>
                    <Table.Td fw={700} c="teal.9">
                      {m.address}
                    </Table.Td>
                    <Table.Td>{m.displayName}</Table.Td>
                    <Table.Td>{m.userEmail}</Table.Td>
                    <Table.Td>
                      <Badge color="teal" size="sm">
                        Primary Mailbox
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        </Tabs.Panel>

        {/* SYSTEM STATUS TAB */}
        <Tabs.Panel value="system" pt="md">
          <Paper p="md" radius="md" withBorder>
            <Stack gap="md">
              <Text fw={700} size="md">
                Cloudflare Infrastructure Status
              </Text>

              <Group gap="md">
                <Paper p="sm" withBorder style={{ flex: 1 }}>
                  <Text size="xs" c="dimmed" fw={700}>
                    DOMAIN
                  </Text>
                  <Text fw={700} size="md" c="teal.9">
                    logixsoft.in
                  </Text>
                  <Badge color="green" mt={4} leftSection={<IconCheck size={12} />}>
                    Active on Cloudflare
                  </Badge>
                </Paper>

                <Paper p="sm" withBorder style={{ flex: 1 }}>
                  <Text size="xs" c="dimmed" fw={700}>
                    EMAIL ROUTING
                  </Text>
                  <Text fw={700} size="md" c="teal.9">
                    Catch-All Enabled
                  </Text>
                  <Badge color="green" mt={4} leftSection={<IconCheck size={12} />}>
                    Routing to worker:mailflare
                  </Badge>
                </Paper>

                <Paper p="sm" withBorder style={{ flex: 1 }}>
                  <Text size="xs" c="dimmed" fw={700}>
                    EMAIL SENDING
                  </Text>
                  <Text fw={700} size="md" c="teal.9">
                    SPF & DKIM Verified
                  </Text>
                  <Badge color="green" mt={4} leftSection={<IconCheck size={12} />}>
                    Unrestricted Sending
                  </Badge>
                </Paper>

                <Paper p="sm" withBorder style={{ flex: 1 }}>
                  <Text size="xs" c="dimmed" fw={700}>
                    CLOUDFLARE TUNNEL
                  </Text>
                  <Text fw={700} size="md" c="teal.9">
                    email.logixsoft.in
                  </Text>
                  <Badge color="teal" mt={4} leftSection={<IconCheck size={12} />}>
                    Live on Port 3080
                  </Badge>
                </Paper>
              </Group>
            </Stack>
          </Paper>
        </Tabs.Panel>
      </Tabs>

      {/* CREATE USER MODAL */}
      <Modal
        opened={userModalOpened}
        onClose={closeUserModal}
        title={
          <Group gap="xs">
            <IconUsers size={20} color="#0ca678" />
            <Text fw={700}>Create New User</Text>
          </Group>
        }
        radius="lg"
      >
        <Stack gap="sm">
          <TextInput
            label="Full Name"
            placeholder="John Doe"
            value={newUserName}
            onChange={(e) => setNewUserName(e.currentTarget.value)}
          />
          <TextInput
            label="Email Address"
            placeholder="john@logixsoft.in"
            value={newUserEmail}
            onChange={(e) => setNewUserEmail(e.currentTarget.value)}
          />
          <PasswordInput
            label="Password"
            placeholder="Create password"
            value={newUserPassword}
            onChange={(e) => setNewUserPassword(e.currentTarget.value)}
          />
          <Select
            label="Role"
            data={[
              { value: "user", label: "Standard User" },
              { value: "admin", label: "Administrator" },
            ]}
            value={newUserRole}
            onChange={(v) => setNewUserRole(v || "user")}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={closeUserModal}>
              Cancel
            </Button>
            <Button color="teal" loading={creatingUser} onClick={handleCreateUser}>
              Create User
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* CREATE CUSTOM ALIAS MODAL */}
      <Modal
        opened={aliasModalOpened}
        onClose={closeAliasModal}
        title={
          <Group gap="xs">
            <IconAt size={20} color="#0ca678" />
            <Text fw={700}>Create Custom Email Alias</Text>
          </Group>
        }
        radius="lg"
      >
        <Stack gap="sm">
          <TextInput
            label="Email Prefix"
            description={`Will be created as <prefix>@${aliasesData?.domain || "logixsoft.in"}`}
            placeholder="e.g. support, billing, orders, team"
            rightSection={<Text size="xs" c="dimmed">@{aliasesData?.domain || "logixsoft.in"}</Text>}
            rightSectionWidth={120}
            value={newAliasPrefix}
            onChange={(e) => setNewAliasPrefix(e.currentTarget.value)}
          />
          <TextInput
            label="Display Label"
            placeholder="e.g. Customer Support"
            value={newAliasDisplayName}
            onChange={(e) => setNewAliasDisplayName(e.currentTarget.value)}
          />
          <Select
            label="Assign to User"
            placeholder="Select user (optional)"
            data={users.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }))}
            value={newAliasUserId}
            onChange={(v) => setNewAliasUserId(v || "")}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={closeAliasModal}>
              Cancel
            </Button>
            <Button color="teal" loading={creatingAlias} onClick={handleCreateAlias}>
              Create Alias
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};
