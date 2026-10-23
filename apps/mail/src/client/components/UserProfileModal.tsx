import React, { useState, useRef } from "react";
import {
  Modal,
  Stack,
  Group,
  Avatar,
  TextInput,
  Textarea,
  Button,
  Text,
  Switch,
  Badge,
  ActionIcon,
  Paper,
  Box,
  Divider,
  FileInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconUser,
  IconCamera,
  IconVolume,
  IconCheck,
  IconShield,
  IconSignature,
  IconSparkles,
  IconMoodSmile,
} from "@tabler/icons-react";
import { User } from "../types";
import { api } from "../api";
import { playNotificationSound, playSentSound, isSoundEnabled, setSoundEnabled } from "../utils/sound";

interface UserProfileModalProps {
  opened: boolean;
  onClose: () => void;
  user: User | null;
  onUserUpdated: (user: User) => void;
}

const STATUS_PRESETS = [
  "🟢 Available",
  "💻 Deep Work",
  "☕ In a meeting",
  "✈️ Out of office",
  "⚡ High Focus",
];

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  opened,
  onClose,
  user,
  onUserUpdated,
}) => {
  const [name, setName] = useState(user?.name || "");
  const [statusMessage, setStatusMessage] = useState(user?.status_message || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [signature, setSignature] = useState(user?.signature || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || "");
  const [soundActive, setSoundActive] = useState<boolean>(isSoundEnabled(user?.sound_enabled));
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state when user prop changes
  React.useEffect(() => {
    if (user) {
      setName(user.name || "");
      setStatusMessage(user.status_message || "");
      setBio(user.bio || "");
      setSignature(user.signature || "");
      setAvatarUrl(user.avatar_url || "");
      setSoundActive(isSoundEnabled(user.sound_enabled));
    }
  }, [user]);

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      notifications.show({ title: "Image Too Large", message: "Please choose an image under 2MB", color: "red" });
      return;
    }

    setUploadingAvatar(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const res = await api.uploadUserAvatar({ imageBase64: base64, mimeType: file.type });
        setAvatarUrl(res.avatar_url);
        notifications.show({ title: "Avatar Updated", message: "New profile photo saved to R2 storage", color: "teal" });
        setUploadingAvatar(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      notifications.show({ title: "Upload Failed", message: err.message, color: "red" });
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      setSoundEnabled(soundActive);
      const res = await api.updateUserProfile({
        name,
        status_message: statusMessage,
        bio,
        signature,
        avatar_url: avatarUrl,
        sound_enabled: soundActive ? 1 : 0,
      });

      onUserUpdated(res.user);
      notifications.show({
        title: "Profile Saved",
        message: "Your profile information and preferences were updated",
        color: "teal",
      });
      onClose();
    } catch (err: any) {
      notifications.show({ title: "Save Error", message: err.message, color: "red" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconUser size={20} color="#0ca678" />
          <Text fw={700} size="md">
            My Profile & Settings
          </Text>
        </Group>
      }
      size="md"
      radius="md"
    >
      <Stack gap="md">
        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          accept="image/png, image/jpeg, image/webp"
          onChange={handleAvatarFile}
        />

        {/* AVATAR + BASIC INFO HEADER */}
        <Paper p="sm" bg="gray.0" radius="md">
          <Group align="center" gap="md">
            <Box style={{ position: "relative" }}>
              <Avatar
                src={avatarUrl || undefined}
                size={70}
                radius="xl"
                color="teal"
                style={{ border: "2px solid #0ca678", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
              >
                {(name || user?.email || "U").charAt(0).toUpperCase()}
              </Avatar>
              <ActionIcon
                variant="filled"
                color="teal"
                size="sm"
                radius="xl"
                loading={uploadingAvatar}
                onClick={() => fileInputRef.current?.click()}
                style={{ position: "absolute", bottom: 0, right: 0 }}
                title="Upload Profile Picture"
              >
                <IconCamera size={14} />
              </ActionIcon>
            </Box>

            <Stack gap={2} style={{ flex: 1 }}>
              <Group gap="xs">
                <Text fw={700} size="sm">
                  {name || "User"}
                </Text>
                <Badge size="xs" color={user?.role === "admin" ? "teal" : "gray"}>
                  {user?.role?.toUpperCase() || "USER"}
                </Badge>
              </Group>
              <Text size="xs" c="dimmed">
                {user?.email}
              </Text>
              {statusMessage && (
                <Text size="xs" c="teal.8" fw={500} mt={2}>
                  {statusMessage}
                </Text>
              )}
            </Stack>
          </Group>
        </Paper>

        {/* DISPLAY NAME & AVATAR URL */}
        <TextInput
          label="Display Name"
          placeholder="Your full name"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          size="sm"
        />

        <TextInput
          label="Custom Avatar URL"
          placeholder="https://example.com/avatar.jpg"
          description="Or click the camera icon above to upload directly to R2"
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.currentTarget.value)}
          size="sm"
        />

        {/* STATUS MESSAGE & PRESETS */}
        <div>
          <TextInput
            label="Status Message"
            placeholder="e.g. 💻 Deep Work, ☕ In a meeting"
            value={statusMessage}
            onChange={(e) => setStatusMessage(e.currentTarget.value)}
            size="sm"
          />
          <Group gap={6} mt={6} wrap="wrap">
            {STATUS_PRESETS.map((preset) => (
              <Badge
                key={preset}
                variant="light"
                color="gray"
                size="xs"
                style={{ cursor: "pointer" }}
                onClick={() => setStatusMessage(preset)}
              >
                {preset}
              </Badge>
            ))}
          </Group>
        </div>

        {/* BIO */}
        <Textarea
          label="Bio / Title"
          placeholder="Brief description about your role or department"
          value={bio}
          onChange={(e) => setBio(e.currentTarget.value)}
          minRows={2}
          size="sm"
        />

        <Divider label="Email Configuration" labelPosition="center" />

        {/* EMAIL SIGNATURE */}
        <Textarea
          label="Default Email Signature"
          description="Automatically appended when composing or replying to emails"
          placeholder="Best regards,&#10;John Doe | LogixSoft Solutions"
          value={signature}
          onChange={(e) => setSignature(e.currentTarget.value)}
          minRows={3}
          size="sm"
        />

        <Divider label="Notifications & Sound" labelPosition="center" />

        {/* SOUND NOTIFICATIONS */}
        <Paper p="xs" bg="gray.0" radius="md">
          <Group justify="space-between">
            <Group gap="xs">
              <IconVolume size={18} color={soundActive ? "#0ca678" : "#868e96"} />
              <div>
                <Text size="xs" fw={600}>
                  Sound on Notifications
                </Text>
                <Text size="10px" c="dimmed">
                  Synthesized chimes for incoming messages and email delivery
                </Text>
              </div>
            </Group>
            <Group gap="xs">
              <Button
                variant="subtle"
                size="compact-xs"
                color="teal"
                onClick={() => {
                  playNotificationSound();
                  setTimeout(() => playSentSound(), 500);
                }}
              >
                Test Sound
              </Button>
              <Switch
                checked={soundActive}
                onChange={(e) => setSoundActive(e.currentTarget.checked)}
                color="teal"
                size="sm"
              />
            </Group>
          </Group>
        </Paper>

        {/* ACTIONS */}
        <Group justify="flex-end" gap="xs" mt="sm">
          <Button variant="subtle" color="gray" onClick={onClose} size="sm">
            Cancel
          </Button>
          <Button color="teal" onClick={handleSave} loading={saving} size="sm" leftSection={<IconCheck size={16} />}>
            Save Changes
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
