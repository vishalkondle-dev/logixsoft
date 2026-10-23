import React, { useState } from "react";
import {
  Modal,
  Stack,
  Group,
  Text,
  TextInput,
  ColorPicker,
  Button,
  Badge,
  ActionIcon,
  Paper,
  Box,
  Divider,
  ColorSwatch,
  ScrollArea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconTag, IconPlus, IconTrash, IconCheck } from "@tabler/icons-react";
import { Label } from "../types";
import { api } from "../api";
import { playPopSound } from "../utils/sound";

interface LabelsManagerModalProps {
  opened: boolean;
  onClose: () => void;
  labels: Label[];
  onLabelsUpdated: () => void;
}

const PRESET_COLORS = [
  "#228be6", // blue
  "#0ca678", // teal
  "#40c057", // green
  "#fab005", // yellow
  "#fd7e14", // orange
  "#fa5252", // red
  "#be4bdb", // grape
  "#7950f2", // violet
  "#e64980", // pink
  "#495057", // gray
];

export const LabelsManagerModal: React.FC<LabelsManagerModalProps> = ({
  opened,
  onClose,
  labels,
  onLabelsUpdated,
}) => {
  const [newLabelName, setNewLabelName] = useState("");
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) {
      notifications.show({ title: "Name Required", message: "Please enter a label name", color: "red" });
      return;
    }

    setCreating(true);
    try {
      await api.createLabel(newLabelName.trim(), selectedColor);
      playPopSound();
      notifications.show({ title: "Label Created", message: `Label "${newLabelName}" added`, color: "teal" });
      setNewLabelName("");
      onLabelsUpdated();
    } catch (err: any) {
      notifications.show({ title: "Creation Failed", message: err.message, color: "red" });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteLabel = async (id: string, name: string) => {
    setDeletingId(id);
    try {
      await api.deleteLabel(id);
      playPopSound();
      notifications.show({ title: "Label Deleted", message: `Label "${name}" removed`, color: "teal" });
      onLabelsUpdated();
    } catch (err: any) {
      notifications.show({ title: "Delete Failed", message: err.message, color: "red" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconTag size={20} color="#0ca678" />
          <Text fw={700} size="md">
            Manage Email Labels
          </Text>
        </Group>
      }
      size="md"
      radius="md"
    >
      <Stack gap="md">
        {/* CREATE NEW LABEL FORM */}
        <Paper p="sm" bg="gray.0" radius="md">
          <Text size="xs" fw={700} c="dimmed" mb="xs">
            CREATE NEW LABEL
          </Text>
          <Stack gap="xs">
            <TextInput
              placeholder="e.g. VIP Clients, Q4 Project, Taxes"
              value={newLabelName}
              onChange={(e) => setNewLabelName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateLabel();
              }}
              size="sm"
            />

            <div>
              <Text size="11px" c="dimmed" mb={4}>
                Pick Color:
              </Text>
              <Group gap={6}>
                {PRESET_COLORS.map((c) => (
                  <ColorSwatch
                    key={c}
                    color={c}
                    size={22}
                    style={{ cursor: "pointer", border: selectedColor === c ? "2px solid #000" : "none" }}
                    onClick={() => setSelectedColor(c)}
                  >
                    {selectedColor === c && <IconCheck size={12} color="#fff" />}
                  </ColorSwatch>
                ))}
              </Group>
            </div>

            <Button
              color="teal"
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={handleCreateLabel}
              loading={creating}
              mt={4}
            >
              Add Label
            </Button>
          </Stack>
        </Paper>

        <Divider label="Existing Labels" labelPosition="center" />

        {/* LABELS LIST */}
        <ScrollArea.Autosize mah={260} offsetScrollbars>
          <Stack gap={6}>
            {labels.length === 0 ? (
              <Text size="xs" c="dimmed" ta="center" py="md">
                No labels created yet. Add one above!
              </Text>
            ) : (
              labels.map((lbl) => (
                <Paper key={lbl.id} p="xs" radius="sm" withBorder>
                  <Group justify="space-between">
                    <Group gap="xs">
                      <ColorSwatch color={lbl.color} size={16} />
                      <Text size="sm" fw={600}>
                        {lbl.name}
                      </Text>
                      {lbl.message_count !== undefined && (
                        <Badge size="xs" variant="light" color="gray">
                          {lbl.message_count} {lbl.message_count === 1 ? "email" : "emails"}
                        </Badge>
                      )}
                    </Group>

                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      loading={deletingId === lbl.id}
                      onClick={() => handleDeleteLabel(lbl.id, lbl.name)}
                      title="Delete Label"
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Group>
                </Paper>
              ))
            )}
          </Stack>
        </ScrollArea.Autosize>

        <Group justify="flex-end" mt="xs">
          <Button variant="subtle" color="gray" size="xs" onClick={onClose}>
            Done
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
