"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Center, Loader } from "@mantine/core";

function PortalRedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "live" || tab === "active") {
      router.replace("/live");
    } else if (tab === "orders" || tab === "past") {
      router.replace("/my-orders");
    } else if (tab === "profile") {
      router.replace("/profile");
    } else {
      router.replace("/home");
    }
  }, [router, searchParams]);

  return (
    <Center py={100} style={{ minHeight: "60vh" }}>
      <Loader size="lg" color="dinePrimary" />
    </Center>
  );
}

export default function PortalPage() {
  return (
    <Suspense
      fallback={
        <Center py={100} style={{ minHeight: "60vh" }}>
          <Loader size="lg" color="dinePrimary" />
        </Center>
      }
    >
      <PortalRedirectInner />
    </Suspense>
  );
}
