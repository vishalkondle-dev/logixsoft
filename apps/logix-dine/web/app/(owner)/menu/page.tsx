"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Center, Loader } from "@mantine/core";
import { MenuManagement } from "./menu-management";

export { MenuManagement };

export default function MenuPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/settings/menu");
  }, [router]);

  return (
    <Center py={100}>
      <Loader color="dinePrimary" />
    </Center>
  );
}
