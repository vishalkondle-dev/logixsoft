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
  Badge,
  Loader,
  Alert,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { modals } from "@mantine/modals";
import { nprogress } from "@mantine/nprogress";
import { DatePickerInput } from "@mantine/dates";
import { useQuery } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";

interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  available: boolean;
}

const SAMPLE_MENU: MenuItem[] = [
  { id: "1", name: "Paneer Tikka Butter Masala", category: "Curry", price: 320, available: true },
  { id: "2", name: "Dal Makhani", category: "Curry", price: 280, available: true },
  { id: "3", name: "Butter Naan", category: "Breads", price: 60, available: true },
  { id: "4", name: "Jeera Rice", category: "Rice", price: 180, available: true },
  { id: "5", name: "Gulab Jamun (2 pcs)", category: "Dessert", price: 90, available: true },
  { id: "6", name: "Masala Dosa", category: "Breakfast", price: 150, available: false },
  { id: "7", name: "Filter Coffee", category: "Beverage", price: 50, available: true },
];

export default function HomePage() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // TanStack Query demonstration
  const { data: menuItems, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["menu-items"],
    queryFn: async () => {
      // Simulating an API call
      await new Promise((resolve) => setTimeout(resolve, 600));
      return SAMPLE_MENU;
    },
  });

  // TanStack Table columns definition with columnHelper
  const columnHelper = createColumnHelper<MenuItem>();

  const columns = [
    columnHelper.accessor("name", {
      header: "Item Name",
      cell: (info) => <Text fw={500}>{info.getValue()}</Text>,
    }),
    columnHelper.accessor("category", {
      header: "Category",
      cell: (info) => (
        <Badge variant="light" color="violet">
          {info.getValue()}
        </Badge>
      ),
    }),
    columnHelper.accessor("price", {
      header: "Price",
      cell: (info) => `₹${info.getValue()}`,
    }),
    columnHelper.accessor("available", {
      header: "Status",
      cell: (info) => (
        <Badge color={info.getValue() ? "teal" : "gray"}>
          {info.getValue() ? "In Stock" : "Unavailable"}
        </Badge>
      ),
    }),
  ];

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
    <Container size="md" py="xl">
      <Stack gap="xl">
        <div>
          <Title order={2} c="violet">
            Logix Dine Web
          </Title>
          <Text c="dimmed" size="sm">
            Stack verification: Mantine + TanStack Query & Table
          </Text>
        </div>

        {/* TanStack Query & Table Section */}
        <Paper withBorder p="md" radius="md">
          <Stack gap="md">
            <Group justify="space-between" align="center">
              <div>
                <Title order={4}>TanStack Table & Query (Menu Items)</Title>
                <Text size="xs" c="dimmed">
                  Data fetched via TanStack Query and rendered via TanStack Table
                </Text>
              </div>
              <Button
                variant="light"
                color="violet"
                size="xs"
                loading={isFetching}
                onClick={() => refetch()}
              >
                Refetch Data
              </Button>
            </Group>

            {isLoading ? (
              <Group justify="center" py="xl">
                <Loader color="violet" size="md" />
                <Text size="sm">Loading menu items...</Text>
              </Group>
            ) : (
              <DataTable data={menuItems || []} columns={columns} pageSize={4} />
            )}
          </Stack>
        </Paper>

        {/* Mantine Features Section */}
        <Paper withBorder p="md" radius="md">
          <Stack gap="md">
            <Title order={4}>Mantine Notifications, Modals & Progress</Title>
            <Group>
              <Button color="violet" onClick={handleShowNotification}>
                Trigger Notification
              </Button>
              <Button variant="light" color="violet" onClick={handleOpenModal}>
                Open Confirm Modal
              </Button>
              <Button variant="outline" color="violet" onClick={handleTriggerProgress}>
                Start Progress Bar
              </Button>
            </Group>

            <Divider my="xs" />

            <Title order={4}>Mantine Dates</Title>
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
