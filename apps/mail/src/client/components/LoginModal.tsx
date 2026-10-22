import React, { useState } from "react";
import {
  Modal,
  TextInput,
  PasswordInput,
  Button,
  Stack,
  Text,
  Group,
  Paper,
  Divider,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconMail, IconLock, IconShieldLock } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { api } from "../api";
import { User } from "../types";

interface LoginModalProps {
  opened: boolean;
  onSuccess: (user: User) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ opened, onSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const isMobile = useMediaQuery("(max-width: 480px)");

  const handleSubmit = async (targetEmail = email, targetPass = password) => {
    if (!targetEmail.trim() || !targetPass.trim()) {
      notifications.show({ title: "Validation Error", message: "Email and password required", color: "red" });
      return;
    }
    setLoading(true);
    try {
      const res = await api.login(targetEmail.trim(), targetPass.trim());
      notifications.show({
        title: "Welcome back",
        message: `Logged in as ${res.user.email} (${res.user.role})`,
        color: "teal",
      });
      onSuccess(res.user);
    } catch (err: any) {
      notifications.show({
        title: "Login Failed",
        message: err.message || "Invalid credentials",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdminQuickLogin = () => {
    setEmail("admin@logixsoft.in");
    setPassword("Vammavg@1605");
    handleSubmit("admin@logixsoft.in", "Vammavg@1605");
  };

  return (
    <Modal
      opened={opened}
      onClose={() => {}}
      withCloseButton={false}
      closeOnClickOutside={false}
      closeOnEscape={false}
      fullScreen={isMobile}
      title={
        <Group gap="xs">
          <IconShieldLock size={22} color="#0ca678" />
          <Text fw={800} size="lg" c="teal.9">
            LogixMail Edge Portal
          </Text>
        </Group>
      }
      radius="lg"
      size="md"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Sign in to access your mailboxes and unlimited custom email aliases on <strong>logixsoft.in</strong>
        </Text>

        <TextInput
          label="Email Address"
          placeholder="admin@logixsoft.in"
          leftSection={<IconMail size={16} />}
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
        />

        <PasswordInput
          label="Password"
          placeholder="Enter password"
          leftSection={<IconLock size={16} />}
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />

        <Button color="teal" fullWidth loading={loading} onClick={() => handleSubmit()}>
          Sign In
        </Button>

        <Divider label="Quick Access" labelPosition="center" />

        <Paper p="xs" bg="teal.0" radius="md" withBorder>
          <Group justify="space-between" align="center">
            <div>
              <Text size="xs" fw={700} c="teal.9">
                System Administrator
              </Text>
              <Text size="xs" c="dimmed">
                admin@logixsoft.in
              </Text>
            </div>
            <Button size="compact-xs" color="teal" variant="light" onClick={handleAdminQuickLogin}>
              1-Click Admin Sign-in
            </Button>
          </Group>
        </Paper>
      </Stack>
    </Modal>
  );
};
