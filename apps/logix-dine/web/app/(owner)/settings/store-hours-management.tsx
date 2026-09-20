"use client";

import React, { useState, useEffect } from "react";
import {
  Paper,
  Stack,
  Group,
  Text,
  Button,
  Switch,
  TextInput,
  Badge,
  Loader,
  Box,
  Divider,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconClock,
  IconCheck,
  IconPlus,
  IconTrash,
  IconBuildingStore,
} from "@tabler/icons-react";
import { useRestaurant } from "@/lib/restaurant-context";
import { useUpdateOutlet } from "@/lib/queries";

export interface TimeSlot {
  open: string;
  close: string;
}

export interface DaySchedule {
  isOpen: boolean;
  slots: TimeSlot[];
}

export interface StoreHoursConfig {
  timezone?: string;
  days: Record<string, DaySchedule>; // 'monday', 'tuesday', etc.
}

const DAYS_OF_WEEK = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];

const DEFAULT_SCHEDULE: StoreHoursConfig = {
  timezone: "Asia/Kolkata",
  days: {
    monday: { isOpen: true, slots: [{ open: "10:00", close: "23:00" }] },
    tuesday: { isOpen: true, slots: [{ open: "10:00", close: "23:00" }] },
    wednesday: { isOpen: true, slots: [{ open: "10:00", close: "23:00" }] },
    thursday: { isOpen: true, slots: [{ open: "10:00", close: "23:00" }] },
    friday: { isOpen: true, slots: [{ open: "10:00", close: "23:30" }] },
    saturday: { isOpen: true, slots: [{ open: "10:00", close: "23:30" }] },
    sunday: { isOpen: true, slots: [{ open: "10:00", close: "23:00" }] },
  },
};

export function StoreHoursManagement() {
  const { restaurant, outlets, activeOutlet, refresh } = useRestaurant();
  const restaurantId = restaurant?.id ?? "";

  const currentOutlet = activeOutlet || outlets[0];

  const [hoursConfig, setHoursConfig] = useState<StoreHoursConfig>(DEFAULT_SCHEDULE);
  const [saving, setSaving] = useState(false);

  // Load openingHours from outlet record
  useEffect(() => {
    if (currentOutlet?.openingHours) {
      try {
        const parsed = typeof currentOutlet.openingHours === "string"
          ? JSON.parse(currentOutlet.openingHours)
          : currentOutlet.openingHours;
        
        if (parsed && parsed.days) {
          setHoursConfig(parsed);
          return;
        }
      } catch (e) {
        console.error("Failed to parse openingHours", e);
      }
    }
    // Default fallback
    setHoursConfig(DEFAULT_SCHEDULE);
  }, [currentOutlet]);

  const updateOutletMutation = useUpdateOutlet(restaurantId);

  const handleToggleDay = (dayKey: string, isOpen: boolean) => {
    setHoursConfig((prev) => {
      const currentDay = prev.days[dayKey] || { isOpen: false, slots: [{ open: "10:00", close: "23:00" }] };
      return {
        ...prev,
        days: {
          ...prev.days,
          [dayKey]: {
            ...currentDay,
            isOpen,
            slots: currentDay.slots.length > 0 ? currentDay.slots : [{ open: "10:00", close: "23:00" }],
          },
        },
      };
    });
  };

  const handleSlotChange = (
    dayKey: string,
    slotIndex: number,
    field: "open" | "close",
    value: string
  ) => {
    setHoursConfig((prev) => {
      const currentDay = prev.days[dayKey];
      if (!currentDay) return prev;
      const newSlots = [...currentDay.slots];
      newSlots[slotIndex] = {
        ...newSlots[slotIndex],
        [field]: value,
      };
      return {
        ...prev,
        days: {
          ...prev.days,
          [dayKey]: {
            ...currentDay,
            slots: newSlots,
          },
        },
      };
    });
  };

  const handleAddSlot = (dayKey: string) => {
    setHoursConfig((prev) => {
      const currentDay = prev.days[dayKey];
      if (!currentDay) return prev;
      return {
        ...prev,
        days: {
          ...prev.days,
          [dayKey]: {
            ...currentDay,
            slots: [...currentDay.slots, { open: "17:00", close: "23:00" }],
          },
        },
      };
    });
  };

  const handleRemoveSlot = (dayKey: string, slotIndex: number) => {
    setHoursConfig((prev) => {
      const currentDay = prev.days[dayKey];
      if (!currentDay) return prev;
      const newSlots = currentDay.slots.filter((_, idx) => idx !== slotIndex);
      return {
        ...prev,
        days: {
          ...prev.days,
          [dayKey]: {
            ...currentDay,
            slots: newSlots.length > 0 ? newSlots : [{ open: "10:00", close: "23:00" }],
            isOpen: newSlots.length > 0 ? currentDay.isOpen : false,
          },
        },
      };
    });
  };

  const handleApplyToAllDays = (sourceDayKey: string) => {
    const sourceSchedule = hoursConfig.days[sourceDayKey];
    if (!sourceSchedule) return;

    setHoursConfig((prev) => {
      const newDays: Record<string, DaySchedule> = {};
      DAYS_OF_WEEK.forEach((d) => {
        newDays[d.key] = {
          isOpen: sourceSchedule.isOpen,
          slots: sourceSchedule.slots.map((s) => ({ ...s })),
        };
      });
      return { ...prev, days: newDays };
    });

    notifications.show({
      title: "Applied to all days",
      message: `Hours from ${sourceDayKey.toUpperCase()} applied to the whole week.`,
      color: "teal",
    });
  };

  const handleSave = async () => {
    if (!currentOutlet?.id) return;
    setSaving(true);
    try {
      await updateOutletMutation.mutateAsync({
        id: currentOutlet.id,
        body: {
          openingHours: hoursConfig,
        },
      });
      await refresh();
      notifications.show({
        title: "Store Hours Saved",
        message: `Operating hours for ${currentOutlet.name} have been updated.`,
        color: "teal",
        icon: <IconCheck size={16} />,
      });
    } catch (err: any) {
      notifications.show({
        title: "Error saving hours",
        message: err.message || "Failed to update store hours",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!outlets.length) {
    return (
      <Paper p="xl" radius="md" ta="center">
        <IconClock size={36} color="var(--mantine-color-gray-4)" style={{ margin: "0 auto 8px" }} />
        <Text size="sm" c="dimmed">
          No outlets found. Please create an outlet first.
        </Text>
      </Paper>
    );
  }

  return (
    <Stack gap="lg">
      {/* Header card with Outlet Selector */}
      <Paper p="md" radius="md">
        <Group justify="space-between" align="center" wrap="wrap" gap="sm">
          <div>
            <Group gap="xs" align="center">
              <Text fw={600} size="md">
                Store Operating Hours
              </Text>
              {currentOutlet?.isDefault && (
                <Badge size="xs" variant="light" color="dinePrimary">
                  Default Outlet
                </Badge>
              )}
            </Group>
            <Text size="xs" c="dimmed" mt={2}>
              Set daily opening, closing, and break shifts. Orders will reflect these operating times.
            </Text>
          </div>
        </Group>
      </Paper>

      {/* Daily Schedule List */}
      <Paper p="md" radius="md">
        <Stack gap="md">
          {DAYS_OF_WEEK.map((day, dayIndex) => {
            const daySchedule = hoursConfig.days[day.key] || {
              isOpen: false,
              slots: [{ open: "10:00", close: "23:00" }],
            };

            return (
              <Box key={day.key}>
                <Group
                  justify="space-between"
                  align="flex-start"
                  wrap="wrap"
                  gap="sm"
                  py="xs"
                >
                  {/* Day Name & Toggle */}
                  <Group gap="md" style={{ minWidth: 140 }}>
                    <Switch
                      size="sm"
                      checked={daySchedule.isOpen}
                      onChange={(e) => handleToggleDay(day.key, e.currentTarget.checked)}
                      color="dinePrimary"
                    />
                    <div>
                      <Text fw={600} size="sm">
                        {day.label}
                      </Text>
                      <Text size="xs" c={daySchedule.isOpen ? "teal" : "dimmed"}>
                        {daySchedule.isOpen ? "Open" : "Closed"}
                      </Text>
                    </div>
                  </Group>

                  {/* Time Slots */}
                  {daySchedule.isOpen ? (
                    <Stack gap="xs" style={{ flex: 1, minWidth: 260 }}>
                      {daySchedule.slots.map((slot, slotIndex) => (
                        <Group key={slotIndex} gap="xs" align="center" wrap="nowrap">
                          <TextInput
                            size="xs"
                            type="time"
                            value={slot.open}
                            onChange={(e) =>
                              handleSlotChange(day.key, slotIndex, "open", e.target.value)
                            }
                            style={{ width: 110 }}
                          />
                          <Text size="xs" c="dimmed">
                            to
                          </Text>
                          <TextInput
                            size="xs"
                            type="time"
                            value={slot.close}
                            onChange={(e) =>
                              handleSlotChange(day.key, slotIndex, "close", e.target.value)
                            }
                            style={{ width: 110 }}
                          />

                          {daySchedule.slots.length > 1 && (
                            <Button
                              size="compact-xs"
                              variant="subtle"
                              color="red"
                              onClick={() => handleRemoveSlot(day.key, slotIndex)}
                              title="Remove shift"
                            >
                              <IconTrash size={14} />
                            </Button>
                          )}
                        </Group>
                      ))}

                      <Group gap="xs" mt={2}>
                        <Button
                          size="compact-xs"
                          variant="light"
                          color="dinePrimary"
                          leftSection={<IconPlus size={12} />}
                          onClick={() => handleAddSlot(day.key)}
                        >
                          Add Shift / Break
                        </Button>

                        {dayIndex === 0 && (
                          <Button
                            size="compact-xs"
                            variant="subtle"
                            color="gray"
                            onClick={() => handleApplyToAllDays(day.key)}
                          >
                            Apply to all days
                          </Button>
                        )}
                      </Group>
                    </Stack>
                  ) : (
                    <Box style={{ flex: 1, minWidth: 200 }}>
                      <Text size="xs" c="dimmed" fs="italic">
                        Store closed on this day
                      </Text>
                    </Box>
                  )}
                </Group>

                {dayIndex < DAYS_OF_WEEK.length - 1 && <Divider my="xs" />}
              </Box>
            );
          })}
        </Stack>

        <Group justify="flex-end" mt="xl">
          <Button
            color="dinePrimary"
            leftSection={<IconCheck size={16} />}
            onClick={handleSave}
            loading={saving}
          >
            Save Store Hours
          </Button>
        </Group>
      </Paper>
    </Stack>
  );
}
