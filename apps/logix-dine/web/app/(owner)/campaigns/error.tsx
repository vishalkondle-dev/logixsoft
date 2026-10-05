"use client";

import React, { useEffect } from "react";
import { Stack, Title, Text, Button, Paper, ThemeIcon, Center } from "@mantine/core";
import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";

export default function CampaignsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Campaigns page error:", error);
  }, [error]);

  return (
    <Center py={100} px="md">
      <Paper withBorder p="xl" radius="md" maw={500} w="100%">
        <Stack align="center" gap="md" ta="center">
          <ThemeIcon size={56} radius="xl" color="red" variant="light">
            <IconAlertTriangle size={32} />
          </ThemeIcon>
          <div>
            <Title order={3} fw={700}>
              Unable to load Campaigns
            </Title>
            <Text size="sm" c="dimmed" mt={4}>
              {error.message || "An unexpected error occurred while loading campaigns."}
            </Text>
          </div>
          <Button
            color="red"
            leftSection={<IconRefresh size={16} />}
            onClick={() => reset()}
          >
            Try Again
          </Button>
        </Stack>
      </Paper>
    </Center>
  );
}
