"use client";

import React, { useState } from "react";
import {
  Container,
  Title,
  Text,
  Button,
  Group,
  Stack,
  Paper,
  Divider,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { modals } from "@mantine/modals";
import { nprogress, NavigationProgress } from "@mantine/nprogress";
import { DatePickerInput } from "@mantine/dates";

export default function HomePage() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const handleShowNotification = () => {
    notifications.show({
      title: "Notification Test",
      message: "@mantine/notifications is successfully configured!",
      color: "violet",
    });
  };

  const handleOpenModal = () => {
    modals.openConfirmModal({
      title: "Confirm Modal Test",
      children: (
        <Text size="sm">
          @mantine/modals is active and working with the ModalsProvider!
        </Text>
      ),
      labels: { confirm: "Confirm", cancel: "Cancel" },
      onConfirm: () => {
        notifications.show({
          title: "Confirmed",
          message: "You confirmed the modal!",
          color: "teal",
        });
      },
    });
  };

  const handleTriggerProgress = () => {
    nprogress.start();
    setTimeout(() => {
      nprogress.set(50);
    }, 400);
    setTimeout(() => {
      nprogress.complete();
    }, 900);
  };

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <div>
          <Title order={2} c="violet">
            Logix Dine Web
          </Title>
          <Text c="dimmed" size="sm">
            Mantine packages verification dashboard
          </Text>
        </div>

        <Paper withBorder p="md" radius="md">
          <Stack gap="md">
            <Title order={4}>Notifications & Modals</Title>
            <Group>
              <Button color="violet" onClick={handleShowNotification}>
                Trigger Notification
              </Button>
              <Button variant="light" color="violet" onClick={handleOpenModal}>
                Open Confirm Modal
              </Button>
            </Group>

            <Divider my="xs" />

            <Title order={4}>Navigation Progress</Title>
            <Group>
              <Button variant="outline" color="violet" onClick={handleTriggerProgress}>
                Start Progress Bar
              </Button>
            </Group>

            <Divider my="xs" />

            <Title order={4}>Dates Picker</Title>
            <DatePickerInput
              label="Select reservation date"
              placeholder="Pick a date"
              value={selectedDate}
              onChange={setSelectedDate}
              clearable
            />
            {selectedDate && (
              <Text size="sm" c="dimmed">
                Selected date: {String(selectedDate)}
              </Text>
            )}
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
