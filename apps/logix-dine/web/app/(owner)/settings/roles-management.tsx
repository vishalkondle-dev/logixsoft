"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Paper,
  Stack,
  Text,
  Title,
  Group,
  Button,
  SimpleGrid,
  Card,
  ThemeIcon,
  Badge,
  Modal,
  TextInput,
  Textarea,
  Select,
  ActionIcon,
  Loader,
  Center,
  Alert,
  Switch,
  Tooltip,
  Divider,
  Box,
} from "@mantine/core";
import {
  IconShieldLock,
  IconPlus,
  IconCheck,
  IconTrash,
  IconEdit,
  IconRotateClockwise,
  IconSearch,
  IconAlertTriangle,
  IconInfoCircle,
  IconUsers,
  IconBuildingStore,
  IconShoppingCart,
  IconToolsKitchen2,
  IconBellRinging,
  IconTableAlias,
  IconBook,
  IconPackages,
  IconMotorbike,
  IconTruckDelivery,
  IconPrinter,
  IconChartBar,
  IconStar,
  IconSettings,
  IconFilter,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useRestaurant, useRestaurantRole } from "@/lib/restaurant-context";
import {
  useRoles,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  useResetRole,
} from "@/lib/queries";
import type { RoleItem, PermissionModuleInfo } from "@/lib/api-client";
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_MODULES,
  type Permission,
} from "@logixsoft/logix-dine/types/roles";

const MODULE_ICON_MAP: Record<string, any> = {
  pos: IconShoppingCart,
  kitchen: IconToolsKitchen2,
  waiter: IconBellRinging,
  tables: IconTableAlias,
  menu: IconBook,
  inventory: IconPackages,
  delivery: IconMotorbike,
  aggregators: IconTruckDelivery,
  printing: IconPrinter,
  reports: IconChartBar,
  feedback: IconStar,
  staff: IconUsers,
  settings: IconSettings,
};

const BADGE_COLOR_MAP: Record<string, string> = {
  "High Risk": "red",
  Financial: "orange",
  Operational: "blue",
  "Read Only": "gray",
};

export function RolesManagement({ embedded = false }: { embedded?: boolean } = {}) {
  const { restaurant, isLoading: isRestaurantLoading } = useRestaurant();
  const currentRole = useRestaurantRole();
  const restaurantId = restaurant?.id ?? "";
  const isOwner = currentRole === "OWNER" || currentRole === "ADMIN";

  const { data, isLoading, refetch } = useRoles(restaurantId, !!restaurantId && isOwner);
  const roles = data?.roles ?? [];
  const modules: PermissionModuleInfo[] = useMemo(() => {
    if (data?.modules && data.modules.length > 0) {
      return data.modules.map((m: any) => ({
        module: m.module || m.id,
        name: m.name || m.label,
        description: m.description,
        permissions: (m.permissions || []).map((p: any) => ({
          key: p.key,
          label: p.label,
          description: p.description,
          badge: p.badge,
        })),
      }));
    }
    // Fallback to static modules definition
    return PERMISSION_MODULES.map((m) => ({
      module: m.id,
      name: m.label,
      description: m.description,
      permissions: m.permissions.map((p) => ({
        key: p.key,
        label: p.label,
        description: p.description,
        badge: p.badge,
      })),
    }));
  }, [data]);

  const allPermissionKeys = useMemo(() => {
    const keys: string[] = [];
    modules.forEach((mod) => {
      mod.permissions.forEach((p) => keys.push(p.key));
    });
    return keys;
  }, [modules]);

  // Selected role state
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  // Active role being viewed/edited
  const selectedRole = useMemo(() => {
    if (!roles.length) return null;
    if (selectedRoleId) {
      const found = roles.find((r) => r.id === selectedRoleId);
      if (found) return found;
    }
    // Default to first non-owner role or first role
    return roles.find((r) => r.name !== "OWNER") || roles[0];
  }, [roles, selectedRoleId]);

  // Draft permissions for the selected role
  const [draftPermissions, setDraftPermissions] = useState<string[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  // Synchronize draft when selected role changes
  useEffect(() => {
    if (selectedRole) {
      setDraftPermissions(selectedRole.permissions || []);
      setIsDirty(false);
    }
  }, [selectedRole?.id, selectedRole?.permissions]);

  // Filter / Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);

  // Forms
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    template: "WAITER",
    allOutlets: false,
  });

  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    allOutlets: false,
  });

  // Mutations
  const createRoleMut = useCreateRole(restaurantId);
  const updateRoleMut = useUpdateRole(restaurantId);
  const deleteRoleMut = useDeleteRole(restaurantId);
  const resetRoleMut = useResetRole(restaurantId);

  // Save permissions
  const handleSavePermissions = async () => {
    if (!selectedRole) return;
    try {
      await updateRoleMut.mutateAsync({
        id: selectedRole.id,
        body: {
          permissions: draftPermissions,
        },
      });
      setIsDirty(false);
      notifications.show({
        title: "Permissions Saved",
        message: `Updated permissions for ${selectedRole.name}`,
        color: "green",
        icon: <IconCheck size={16} />,
      });
    } catch (err: any) {
      notifications.show({
        title: "Save Failed",
        message: err.message || "Failed to update permissions",
        color: "red",
      });
    }
  };

  // Toggle single permission
  const handleTogglePermission = (permKey: string, checked: boolean) => {
    if (selectedRole?.name === "OWNER") return;
    let next: string[];
    if (checked) {
      next = Array.from(new Set([...draftPermissions, permKey]));
    } else {
      next = draftPermissions.filter((p) => p !== permKey);
    }
    setDraftPermissions(next);
    setIsDirty(true);
  };

  // Toggle all permissions in a module
  const handleToggleModule = (moduleKeys: string[], grantAll: boolean) => {
    if (selectedRole?.name === "OWNER") return;
    let next: string[];
    if (grantAll) {
      next = Array.from(new Set([...draftPermissions, ...moduleKeys]));
    } else {
      const set = new Set(moduleKeys);
      next = draftPermissions.filter((p) => !set.has(p));
    }
    setDraftPermissions(next);
    setIsDirty(true);
  };

  // Grant All / Revoke All across entire matrix
  const handleGrantAll = () => {
    if (selectedRole?.name === "OWNER") return;
    setDraftPermissions([...allPermissionKeys]);
    setIsDirty(true);
  };

  const handleRevokeAll = () => {
    if (selectedRole?.name === "OWNER") return;
    setDraftPermissions([]);
    setIsDirty(true);
  };

  // Create Custom Role
  const handleCreateRole = async () => {
    if (!createForm.name.trim()) {
      notifications.show({
        title: "Validation Error",
        message: "Role name is required",
        color: "red",
      });
      return;
    }

    const templatePerms =
      (DEFAULT_ROLE_PERMISSIONS as Record<string, readonly string[]>)[
        createForm.template
      ] || [];

    try {
      const created = await createRoleMut.mutateAsync({
        name: createForm.name.trim(),
        description: createForm.description.trim() || undefined,
        permissions: [...templatePerms],
        allOutlets: createForm.allOutlets,
      });

      setSelectedRoleId(created.id);
      setCreateModalOpen(false);
      setCreateForm({
        name: "",
        description: "",
        template: "WAITER",
        allOutlets: false,
      });

      notifications.show({
        title: "Role Created",
        message: `Successfully created custom role "${created.name}"`,
        color: "green",
        icon: <IconCheck size={16} />,
      });
    } catch (err: any) {
      notifications.show({
        title: "Creation Failed",
        message: err.message || "Could not create role",
        color: "red",
      });
    }
  };

  // Open Edit Role modal
  const openEditModal = (role: RoleItem) => {
    setEditForm({
      name: role.name,
      description: role.description || "",
      allOutlets: role.allOutlets,
    });
    setEditModalOpen(true);
  };

  // Submit Edit Role
  const handleEditRole = async () => {
    if (!selectedRole) return;
    try {
      await updateRoleMut.mutateAsync({
        id: selectedRole.id,
        body: {
          name: editForm.name.trim(),
          description: editForm.description.trim() || undefined,
          allOutlets: editForm.allOutlets,
        },
      });
      setEditModalOpen(false);
      notifications.show({
        title: "Role Updated",
        message: "Role details updated successfully",
        color: "green",
      });
    } catch (err: any) {
      notifications.show({
        title: "Update Failed",
        message: err.message || "Failed to update role",
        color: "red",
      });
    }
  };

  // Delete Role
  const handleDeleteRole = async () => {
    if (!selectedRole) return;
    try {
      await deleteRoleMut.mutateAsync(selectedRole.id);
      setDeleteModalOpen(false);
      setSelectedRoleId(null);
      notifications.show({
        title: "Role Deleted",
        message: `Custom role "${selectedRole.name}" was deleted.`,
        color: "green",
      });
    } catch (err: any) {
      notifications.show({
        title: "Delete Failed",
        message: err.message || "Could not delete role",
        color: "red",
      });
    }
  };

  // Reset Role
  const handleResetRole = async () => {
    if (!selectedRole) return;
    try {
      const resetRole = await resetRoleMut.mutateAsync(selectedRole.id);
      setResetModalOpen(false);
      setDraftPermissions(resetRole.permissions || []);
      setIsDirty(false);
      notifications.show({
        title: "Permissions Reset",
        message: `Reverted ${selectedRole.name} to standard system defaults`,
        color: "green",
      });
    } catch (err: any) {
      notifications.show({
        title: "Reset Failed",
        message: err.message || "Failed to reset permissions",
        color: "red",
      });
    }
  };

  // Filter modules & permissions based on search query
  const filteredModules = useMemo(() => {
    if (!searchQuery.trim()) return modules;
    const q = searchQuery.toLowerCase().trim();

    return modules
      .map((mod) => {
        const modMatches =
          mod.name.toLowerCase().includes(q) ||
          mod.description.toLowerCase().includes(q);

        const matchingPermissions = mod.permissions.filter(
          (p) =>
            p.label.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            p.key.toLowerCase().includes(q)
        );

        if (modMatches) {
          return mod;
        }

        if (matchingPermissions.length > 0) {
          return {
            ...mod,
            permissions: matchingPermissions,
          };
        }

        return null;
      })
      .filter(Boolean) as PermissionModuleInfo[];
  }, [modules, searchQuery]);

  if (isRestaurantLoading || currentRole === null || (isLoading && !roles.length)) {
    return (
      <Center py={80}>
        <Loader size="lg" color="dinePrimary" />
      </Center>
    );
  }

  if (!isOwner) {
    const alertContent = (
      <Paper p="xl" radius="md" withBorder>
        <Alert
          icon={<IconAlertTriangle size={20} />}
          title="Owner Access Required"
          color="red"
          variant="light"
        >
          <Text size="sm">
            Only the <strong>Restaurant Owner</strong> can manage roles and
            configure the authorization permissions matrix. Please contact the
            restaurant owner to adjust team roles or privileges.
          </Text>
        </Alert>
      </Paper>
    );

    if (embedded) return alertContent;

    return (
      <Box pt="sm" pb={120} px={{ base: "xs", sm: "md" }}>
        {alertContent}
      </Box>
    );
  }

  const content = (
    <Stack gap="lg">
      {/* Header */}
      <Paper p="lg" radius="md" withBorder>
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
          <Group gap="md">
            <ThemeIcon size={44} radius="md" color="dinePrimary" variant="light">
              <IconShieldLock size={24} />
            </ThemeIcon>
            <div>
              <Group gap="xs">
                <Title order={3}>Roles & Permissions Matrix</Title>
                <Badge color="violet" variant="light" size="sm">
                  RBAC Engine
                </Badge>
              </Group>
              <Text size="sm" c="dimmed">
                Configure fine-grained sub-feature privileges, manage default &
                custom roles, and control outlet operational scope.
              </Text>
            </div>
          </Group>

          <Group gap="xs">
            <Button
              variant="default"
              size="sm"
              leftSection={<IconRotateClockwise size={16} />}
              onClick={() => refetch()}
            >
              Refresh
            </Button>
            <Button
              color="dinePrimary"
              size="sm"
              leftSection={<IconPlus size={16} />}
              onClick={() => setCreateModalOpen(true)}
            >
              Create Custom Role
            </Button>
          </Group>
        </Group>
      </Paper>

      {/* Role Selector Grid */}
      <div>
        <Text size="sm" fw={600} mb="xs" c="dimmed">
          SELECT ROLE TO CONFIGURE ({roles.length} ROLES)
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="sm">
          {roles.map((r) => {
            const isSelected = selectedRole?.id === r.id;
            const isOwnerRole = r.name === "OWNER";
            const permCount = isOwnerRole
              ? allPermissionKeys.length
              : (r.permissions || []).filter((k: string) => allPermissionKeys.includes(k)).length;

            return (
              <Card
                key={r.id}
                p="md"
                radius="md"
                withBorder
                onClick={() => setSelectedRoleId(r.id)}
                style={{
                  cursor: "pointer",
                  borderColor: isSelected ? "#af73d7" : undefined,
                  backgroundColor: isSelected ? "rgba(175, 115, 215, 0.04)" : undefined,
                  boxShadow: isSelected ? "0 0 0 2px rgba(175, 115, 215, 0.3)" : undefined,
                  transition: "all 0.15s ease",
                }}
              >
                <Group justify="space-between" align="flex-start" mb="xs">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <Group gap="xs" wrap="nowrap" align="center">
                      <Text fw={700} size="sm" truncate>
                        {r.name}
                      </Text>
                      {isSelected && (
                        <ThemeIcon size={18} radius="xl" color="dinePrimary" variant="filled" style={{ flexShrink: 0 }}>
                          <IconCheck size={11} />
                        </ThemeIcon>
                      )}
                      {r.isSystem ? (
                        <Badge size="xs" variant="outline" color="gray" style={{ flexShrink: 0 }}>
                          System
                        </Badge>
                      ) : (
                        <Badge size="xs" variant="filled" color="grape" style={{ flexShrink: 0 }}>
                          Custom
                        </Badge>
                      )}
                    </Group>
                    <Text size="xs" c="dimmed" lineClamp={1} mt={2}>
                      {r.description || (r.isSystem ? "Standard built-in role" : "Custom outlet role")}
                    </Text>
                  </div>
                </Group>

                <Divider my="xs" />

                <Group justify="space-between" align="center">
                  <Group gap={6}>
                    <Badge size="xs" variant="light" color={permCount > 0 ? "teal" : "gray"}>
                      {isOwnerRole ? "Full Access (*)" : `${permCount} perms`}
                    </Badge>
                    <Badge size="xs" variant="dot" color="blue">
                      {r.memberCount || 0} Staff
                    </Badge>
                  </Group>

                  {!r.isSystem && (
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color="gray"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRoleId(r.id);
                        openEditModal(r);
                      }}
                      title="Edit role info"
                    >
                      <IconEdit size={14} />
                    </ActionIcon>
                  )}
                </Group>
              </Card>
            );
          })}
        </SimpleGrid>
      </div>

      {/* Permissions Matrix Header & Toolbar */}
      {selectedRole && (
        <Paper p="md" radius="md" withBorder>
          <Stack gap="md">
            <Group justify="space-between" wrap="wrap" gap="md">
              <Group gap="sm">
                <div>
                  <Group gap="xs">
                    <Text fw={700} size="lg">
                      {selectedRole.name} Permissions Matrix
                    </Text>
                    {selectedRole.isSystem ? (
                      <Badge variant="outline" color="gray" size="sm">
                        System Built-in
                      </Badge>
                    ) : (
                      <Badge variant="filled" color="grape" size="sm">
                        Custom Role
                      </Badge>
                    )}
                    {selectedRole.allOutlets ? (
                      <Badge variant="light" color="cyan" size="sm">
                        All Outlets
                      </Badge>
                    ) : (
                      <Badge variant="light" color="blue" size="sm">
                        Assigned Outlets
                      </Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed">
                    {selectedRole.description ||
                      "Select granular permissions granted to members with this role."}
                  </Text>
                </div>
              </Group>

              {selectedRole.name !== "OWNER" && (
                <Group gap="xs">
                  {selectedRole.isSystem ? (
                    <Button
                      variant="light"
                      color="gray"
                      size="xs"
                      leftSection={<IconRotateClockwise size={14} />}
                      onClick={() => setResetModalOpen(true)}
                    >
                      Reset Defaults
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="light"
                        color="blue"
                        size="xs"
                        leftSection={<IconEdit size={14} />}
                        onClick={() => openEditModal(selectedRole)}
                      >
                        Edit Role
                      </Button>
                      <Button
                        variant="light"
                        color="red"
                        size="xs"
                        leftSection={<IconTrash size={14} />}
                        disabled={(selectedRole.memberCount || 0) > 0}
                        title={
                          (selectedRole.memberCount || 0) > 0
                            ? "Cannot delete role with active staff assigned"
                            : "Delete this custom role"
                        }
                        onClick={() => setDeleteModalOpen(true)}
                      >
                        Delete Role
                      </Button>
                    </>
                  )}

                  <Button
                    color="dinePrimary"
                    size="xs"
                    loading={updateRoleMut.isPending}
                    disabled={!isDirty}
                    onClick={handleSavePermissions}
                    leftSection={<IconCheck size={14} />}
                  >
                    Save Changes
                  </Button>
                </Group>
              )}
            </Group>

            {/* Matrix Filters and Batch Action Bar */}
            {selectedRole.name === "OWNER" ? (
              <Alert
                icon={<IconInfoCircle size={18} />}
                color="violet"
                variant="light"
                title="Super-Admin Access"
              >
                The Restaurant Owner role inherently possesses universal
                wildcard permissions (<code>*</code>). It cannot be restricted or
                modified to ensure owner store administration is never locked out.
              </Alert>
            ) : (
              <Group justify="space-between" align="center" wrap="wrap" gap="sm">
                <TextInput
                  placeholder="Filter permissions or features (e.g. bump, void, discount)..."
                  leftSection={<IconSearch size={14} />}
                  size="xs"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ minWidth: 280, flex: 1 }}
                />

                <Group gap="xs">
                  <Badge size="md" variant="light" color="violet">
                    {selectedRole?.name === "OWNER"
                      ? allPermissionKeys.length
                      : draftPermissions.filter((k) => allPermissionKeys.includes(k)).length}{" "}
                    of {allPermissionKeys.length} Granted
                  </Badge>
                  <Button
                    variant="subtle"
                    size="xs"
                    onClick={handleGrantAll}
                    color="teal"
                  >
                    Grant All
                  </Button>
                  <Button
                    variant="subtle"
                    size="xs"
                    onClick={handleRevokeAll}
                    color="red"
                  >
                    Revoke All
                  </Button>
                  {isDirty && (
                    <Badge color="orange" variant="filled" size="sm">
                      Unsaved Changes
                    </Badge>
                  )}
                </Group>
              </Group>
            )}
          </Stack>
        </Paper>
      )}

      {/* Permissions Matrix Modules */}
      {selectedRole && selectedRole.name !== "OWNER" && (
        <Stack gap="md">
          {filteredModules.map((mod) => {
            const Icon = MODULE_ICON_MAP[mod.module] || IconSettings;
            const moduleKeys = mod.permissions.map((p) => p.key);
            const grantedCount = moduleKeys.filter((k) =>
              draftPermissions.includes(k)
            ).length;
            const allGranted = grantedCount === moduleKeys.length && moduleKeys.length > 0;
            const someGranted = grantedCount > 0 && !allGranted;

            return (
              <Paper key={mod.module} p="md" radius="md" withBorder>
                {/* Module Header */}
                <Group justify="space-between" align="center" mb="sm" wrap="nowrap">
                  <Group gap="sm" wrap="nowrap">
                    <ThemeIcon size={34} radius="md" color="dinePrimary" variant="light">
                      <Icon size={18} />
                    </ThemeIcon>
                    <div>
                      <Group gap="xs">
                        <Text fw={700} size="sm">
                          {mod.name}
                        </Text>
                        <Badge
                          size="xs"
                          variant="light"
                          color={allGranted ? "green" : someGranted ? "orange" : "gray"}
                        >
                          {grantedCount} / {moduleKeys.length}
                        </Badge>
                      </Group>
                      <Text size="xs" c="dimmed">
                        {mod.description}
                      </Text>
                    </div>
                  </Group>

                  <Group gap="xs">
                    <Button
                      size="compact-xs"
                      variant="light"
                      color={allGranted ? "gray" : "teal"}
                      onClick={() => handleToggleModule(moduleKeys, !allGranted)}
                    >
                      {allGranted ? "Deselect Module" : "Select All in Module"}
                    </Button>
                  </Group>
                </Group>

                <Divider my="xs" />

                {/* Sub-feature permissions grid */}
                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xs">
                  {mod.permissions.map((perm) => {
                    const isChecked = draftPermissions.includes(perm.key);
                    const badgeColor =
                      perm.badge && BADGE_COLOR_MAP[perm.badge]
                        ? BADGE_COLOR_MAP[perm.badge]
                        : "gray";

                    return (
                      <Paper
                        key={perm.key}
                        p="xs"
                        radius="sm"
                        style={{
                          backgroundColor: isChecked
                            ? "rgba(175, 115, 215, 0.05)"
                            : "#fafafa",
                          border: isChecked
                            ? "1px solid rgba(175, 115, 215, 0.3)"
                            : "1px solid #e9ecef",
                          transition: "all 0.12s ease",
                        }}
                      >
                        <Group justify="space-between" align="flex-start" wrap="nowrap">
                          <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                            <Group gap={6} mb={2} wrap="nowrap">
                              <Text fw={600} size="xs" truncate>
                                {perm.label}
                              </Text>
                              {perm.badge && (
                                <Badge size="xs" variant="light" color={badgeColor}>
                                  {perm.badge}
                                </Badge>
                              )}
                            </Group>

                            <Text size="xs" c="dimmed" lineClamp={2} mb={4}>
                              {perm.description}
                            </Text>

                            <Text
                              size="10px"
                              c="dimmed"
                              style={{ fontFamily: "monospace" }}
                            >
                              {perm.key}
                            </Text>
                          </div>

                          <Switch
                            size="sm"
                            color="dinePrimary"
                            checked={isChecked}
                            onChange={(e) =>
                              handleTogglePermission(perm.key, e.currentTarget.checked)
                            }
                          />
                        </Group>
                      </Paper>
                    );
                  })}
                </SimpleGrid>
              </Paper>
            );
          })}
        </Stack>
      )}

      {/* Floating Save Bar when isDirty */}
      {isDirty && selectedRole && selectedRole.name !== "OWNER" && (
        <Paper
          p="sm"
          radius="md"
          withBorder
          style={{
            position: "sticky",
            bottom: 20,
            zIndex: 100,
            backgroundColor: "#ffffff",
            boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
            border: "1px solid #af73d7",
          }}
        >
          <Group justify="space-between" align="center">
            <Group gap="xs">
              <ThemeIcon color="orange" size={24} radius="xl">
                <IconAlertTriangle size={14} />
              </ThemeIcon>
              <Text size="sm" fw={600}>
                You have unsaved permission changes for {selectedRole.name}.
              </Text>
            </Group>

            <Group gap="xs">
              <Button
                variant="default"
                size="xs"
                onClick={() => {
                  setDraftPermissions(selectedRole.permissions || []);
                  setIsDirty(false);
                }}
              >
                Discard
              </Button>
              <Button
                color="dinePrimary"
                size="xs"
                loading={updateRoleMut.isPending}
                onClick={handleSavePermissions}
                leftSection={<IconCheck size={14} />}
              >
                Save Permissions
              </Button>
            </Group>
          </Group>
        </Paper>
      )}

      {/* Modal: Create Custom Role */}
      <Modal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Custom Role"
        radius="md"
      >
        <Stack gap="md">
          <TextInput
            label="Role Name"
            placeholder="e.g. Senior Captain, Shift Supervisor, Head Chef"
            required
            value={createForm.name}
            onChange={(e) =>
              setCreateForm((f) => ({ ...f, name: e.target.value }))
            }
          />

          <Textarea
            label="Description"
            placeholder="Describe duties and responsibilities for this role..."
            value={createForm.description}
            onChange={(e) =>
              setCreateForm((f) => ({ ...f, description: e.target.value }))
            }
          />

          <Select
            label="Base Permissions Template"
            description="Pre-populate initial permissions based on an existing role"
            data={[
              { value: "CASHIER", label: "Cashier — POS Billing & Receipts" },
              { value: "CAPTAIN", label: "Captain — Floor Orders & Calls" },
              { value: "WAITER", label: "Waiter — Take & Settle Orders" },
              { value: "KITCHEN", label: "Kitchen — KDS Display & Bump" },
              { value: "MANAGER", label: "Manager — Full Outlet Management" },
              { value: "RIDER", label: "Rider — Delivery Status & Dispatch" },
            ]}
            value={createForm.template}
            onChange={(v) => v && setCreateForm((f) => ({ ...f, template: v }))}
          />

          <Switch
            label="Universal Outlets Access"
            description="Allows members with this role to access all restaurant outlets automatically"
            checked={createForm.allOutlets}
            onChange={(e) =>
              setCreateForm((f) => ({ ...f, allOutlets: e.currentTarget.checked }))
            }
          />

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              color="dinePrimary"
              loading={createRoleMut.isPending}
              onClick={handleCreateRole}
            >
              Create Role
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal: Edit Custom Role Details */}
      <Modal
        opened={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Role Details"
        radius="md"
      >
        <Stack gap="md">
          <TextInput
            label="Role Name"
            required
            value={editForm.name}
            onChange={(e) =>
              setEditForm((f) => ({ ...f, name: e.target.value }))
            }
          />

          <Textarea
            label="Description"
            value={editForm.description}
            onChange={(e) =>
              setEditForm((f) => ({ ...f, description: e.target.value }))
            }
          />

          <Switch
            label="Universal Outlets Access"
            description="Allows members with this role to access all restaurant outlets automatically"
            checked={editForm.allOutlets}
            onChange={(e) =>
              setEditForm((f) => ({ ...f, allOutlets: e.currentTarget.checked }))
            }
          />

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button
              color="dinePrimary"
              loading={updateRoleMut.isPending}
              onClick={handleEditRole}
            >
              Update Role
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal: Delete Custom Role Confirmation */}
      <Modal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Role"
        radius="md"
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to permanently delete custom role{" "}
            <strong>{selectedRole?.name}</strong>?
          </Text>
          <Text size="xs" c="dimmed">
            This action cannot be undone. Any permissions defined for this role
            will be removed.
          </Text>

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              color="red"
              loading={deleteRoleMut.isPending}
              onClick={handleDeleteRole}
            >
              Confirm Delete
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal: Reset System Role Confirmation */}
      <Modal
        opened={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        title="Reset to Default Permissions"
        radius="md"
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to reset role{" "}
            <strong>{selectedRole?.name}</strong> back to standard built-in
            permissions?
          </Text>
          <Text size="xs" c="dimmed">
            Any custom grants or restrictions made to this system role will be
            reverted to factory defaults.
          </Text>

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setResetModalOpen(false)}>
              Cancel
            </Button>
            <Button
              color="orange"
              loading={resetRoleMut.isPending}
              onClick={handleResetRole}
            >
              Reset to Defaults
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );

  if (embedded) {
    return content;
  }

  return (
    <Box pt="sm" pb={120} px={{ base: "xs", sm: "md" }}>
      {content}
    </Box>
  );
}
