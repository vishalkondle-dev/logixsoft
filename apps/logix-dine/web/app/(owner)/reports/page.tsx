"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Center, Loader } from "@mantine/core";
import { ReportsManagement } from "./reports-management";

export { ReportsManagement };

export default function ReportsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/settings/reports");
  }, [router]);

  return (
    <Center py={100}>
      <Loader color="dinePrimary" />
    </Center>
  );
}
