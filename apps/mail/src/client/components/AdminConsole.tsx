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
  Box,
  ScrollArea,
} from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
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
  IconCode,
  IconBook,
  IconExternalLink,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { api } from "../api";

interface AdminConsoleProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export const AdminConsole: React.FC<AdminConsoleProps> = ({ activeTab = "users", onTabChange }) => {
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
  const isMobile = useMediaQuery("(max-width: 600px)");

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
    <Stack
      gap="md"
      p={{ base: "xs", sm: "md", md: "lg" }}
      style={{
        height: "100%",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 50px)",
      }}
    >
      {/* Top Header */}
      <Group justify="space-between" align="center" wrap="wrap" gap="xs">
        <div>
          <Group gap="xs" wrap="wrap">
            <IconShieldLock size={isMobile ? 22 : 26} color="#0ca678" />
            <Text fw={800} size={isMobile ? "md" : "xl"} c="teal.9">
              Admin Console
            </Text>
            <Badge size="xs" color="teal" variant="light">
              admin@logixsoft.in
            </Badge>
          </Group>
          <Text size="11px" c="dimmed">
            Manage users, unlimited custom email addresses, and domain routing for logixsoft.in
          </Text>
        </div>

        <Button
          variant="light"
          color="teal"
          size="xs"
          leftSection={<IconRefresh size={14} />}
          onClick={loadData}
        >
          Refresh Data
        </Button>
      </Group>

      {/* KPI Stats Cards */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
        <Card shadow="xs" padding="sm" radius="md" withBorder>
          <Group justify="space-between">
            <Text size="xs" fw={700} c="dimmed">
              TOTAL MESSAGES (D1)
            </Text>
            <IconMailFast size={18} color="#0ca678" />
          </Group>
          <Text fw={800} size={isMobile ? "1.5rem" : "1.8rem"} mt="xs">
            {stats?.totalMessages || 0}
          </Text>
          <Badge size="xs" color="teal" variant="light" mt={4}>
            Inbound & Outbound Logged
          </Badge>
        </Card>

        <Card shadow="xs" padding="sm" radius="md" withBorder>
          <Group justify="space-between">
            <Text size="xs" fw={700} c="dimmed">
              REGISTERED USERS
            </Text>
            <IconUsers size={18} color="#20c997" />
          </Group>
          <Text fw={800} size={isMobile ? "1.5rem" : "1.8rem"} mt="xs">
            {stats?.totalUsers || 0}
          </Text>
          <Badge size="xs" color="teal" variant="light" mt={4}>
            Role-Based Access
          </Badge>
        </Card>

        <Card shadow="xs" padding="sm" radius="md" withBorder>
          <Group justify="space-between">
            <Text size="xs" fw={700} c="dimmed">
              CUSTOM ALIASES & MAILBOXES
            </Text>
            <IconAt size={18} color="#099268" />
          </Group>
          <Text fw={800} size={isMobile ? "1.5rem" : "1.8rem"} mt="xs">
            {stats?.totalAliases || 0}
          </Text>
          <Badge size="xs" color="teal" variant="light" mt={4}>
            Unlimited Catch-All Active
          </Badge>
        </Card>
      </SimpleGrid>

      {/* Tabs Section - Fully Responsive Pills with Horizontal Touch Scroll */}
      <Tabs
        value={activeTab}
        onChange={(val) => onTabChange?.(val || "users")}
        color="teal"
        variant="pills"
        radius="md"
      >
        <Box
          style={{
            width: "100%",
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            paddingBottom: 4,
            borderBottom: "1px solid #e9ecef",
          }}
        >
          <Tabs.List
            style={{
              flexWrap: "nowrap",
              whiteSpace: "nowrap",
              display: "inline-flex",
              gap: 6,
              minWidth: isMobile ? "max-content" : "auto",
            }}
          >
            <Tabs.Tab
              value="users"
              leftSection={<IconUsers size={isMobile ? 15 : 16} />}
              style={{
                flexShrink: 0,
                fontSize: isMobile ? 12 : 13,
                padding: isMobile ? "6px 12px" : "8px 16px",
                fontWeight: 600,
              }}
            >
              {isMobile ? `Users (${users.length})` : `Users Management (${users.length})`}
            </Tabs.Tab>

            <Tabs.Tab
              value="aliases"
              leftSection={<IconAt size={isMobile ? 15 : 16} />}
              style={{
                flexShrink: 0,
                fontSize: isMobile ? 12 : 13,
                padding: isMobile ? "6px 12px" : "8px 16px",
                fontWeight: 600,
              }}
            >
              {isMobile
                ? `Aliases (${aliasesData?.mailboxes?.length || stats?.totalAliases || 0})`
                : "Custom Aliases & Mailboxes"}
            </Tabs.Tab>

            <Tabs.Tab
              value="system"
              leftSection={<IconServer size={isMobile ? 15 : 16} />}
              style={{
                flexShrink: 0,
                fontSize: isMobile ? 12 : 13,
                padding: isMobile ? "6px 12px" : "8px 16px",
                fontWeight: 600,
              }}
            >
              {isMobile ? "System Status" : "Domain & System Status"}
            </Tabs.Tab>

            <Tabs.Tab
              value="api"
              leftSection={<IconCode size={isMobile ? 15 : 16} />}
              style={{
                flexShrink: 0,
                fontSize: isMobile ? 12 : 13,
                padding: isMobile ? "6px 12px" : "8px 16px",
                fontWeight: 600,
              }}
            >
              {isMobile ? "OpenAPI" : "OpenAPI & Developer API"}
            </Tabs.Tab>
          </Tabs.List>
        </Box>

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

            <Table.ScrollContainer minWidth={550}>
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
            </Table.ScrollContainer>
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

            <Table.ScrollContainer minWidth={550}>
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
            </Table.ScrollContainer>
          </Paper>
        </Tabs.Panel>

        {/* SYSTEM STATUS TAB */}
        <Tabs.Panel value="system" pt="md">
          <Paper p="md" radius="md" withBorder>
            <Stack gap="md">
              <Text fw={700} size="md">
                Cloudflare Infrastructure Status
              </Text>

              <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
                <Paper p="sm" withBorder>
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

                <Paper p="sm" withBorder>
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

                <Paper p="sm" withBorder>
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

                <Paper p="sm" withBorder>
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
              </SimpleGrid>
            </Stack>
          </Paper>
        </Tabs.Panel>

        {/* OPENAPI DEVELOPER API TAB */}
        <Tabs.Panel value="api" pt="md">
          <Paper p="md" radius="md" withBorder>
            <Stack gap="md">
              <Group justify="space-between" align="center" wrap="wrap">
                <div>
                  <Group gap="xs">
                    <Text fw={700} size="md">
                      LogixMail Edge OpenAPI 3.1 & Developer API
                    </Text>
                    <Badge color="teal" variant="light">
                      @hono/zod-openapi
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed" mt={2}>
                    Auto-generated OpenAPI 3.1 schema, type-safe Zod validators, and interactive documentation.
                  </Text>
                </div>
                <Group gap="xs">
                  <Button
                    component="a"
                    href="/api/docs"
                    target="_blank"
                    color="teal"
                    size="xs"
                    leftSection={<IconCode size={14} />}
                    rightSection={<IconExternalLink size={12} />}
                  >
                    Open Scalar Docs
                  </Button>
                  <Button
                    component="a"
                    href="/api/swagger"
                    target="_blank"
                    variant="light"
                    color="teal"
                    size="xs"
                    leftSection={<IconBook size={14} />}
                    rightSection={<IconExternalLink size={12} />}
                  >
                    Open Swagger UI
                  </Button>
                  <Button
                    component="a"
                    href="/api/openapi.json"
                    target="_blank"
                    variant="default"
                    size="xs"
                    rightSection={<IconExternalLink size={12} />}
                  >
                    OpenAPI JSON
                  </Button>
                </Group>
              </Group>

              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                <Paper p="sm" withBorder radius="md">
                  <Text fw={700} size="sm" c="teal">Interactive Reference (Scalar)</Text>
                  <Text size="xs" c="dimmed" mt={4}>
                    Modern, reactive documentation at <code>/api/docs</code> with interactive API try-out, request snippets, and search.
                  </Text>
                </Paper>
                <Paper p="sm" withBorder radius="md">
                  <Text fw={700} size="sm" c="teal">Swagger UI</Text>
                  <Text size="xs" c="dimmed" mt={4}>
                    Standard OpenAPI interactive testing console at <code>/api/swagger</code> with curl command generation.
                  </Text>
                </Paper>
                <Paper p="sm" withBorder radius="md">
                  <Text fw={700} size="sm" c="teal">Zod Schema Validation</Text>
                  <Text size="xs" c="dimmed" mt={4}>
                    Runtime request/response type-safety, automatic header/cookie auth inspection, and schema generation.
                  </Text>
                </Paper>
              </SimpleGrid>
            </Stack>
          </Paper>
        </Tabs.Panel>
      </Tabs>

      {/* CREATE USER MODAL */}
      <Modal
        opened={userModalOpened}
        onClose={closeUserModal}
        fullScreen={isMobile}
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
        fullScreen={isMobile}
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
