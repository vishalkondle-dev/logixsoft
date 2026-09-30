"use client";

import dynamic from "next/dynamic";
import { Center, Loader, Stack, Text } from "@mantine/core";

const POSClient = dynamic(() => import("./pos-client"), {
  ssr: false,
  loading: () => (
    <Center py={140}>
      <Stack align="center" gap="sm">
        <Loader color="dinePrimary" size="xl" />
        <Text size="sm" c="dimmed">Loading POS Terminal...</Text>
      </Stack>
    </Center>
  ),
});

export default function POSPage() {
  return <POSClient />;
}
