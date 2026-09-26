"use client";

import dynamic from "next/dynamic";
import { Center, Loader } from "@mantine/core";
import type { ReportType } from "@/lib/api-client";

const ReportDetailView = dynamic(
  () => import("@/app/(owner)/reports/reports-management").then((m) => m.ReportDetailView),
  {
    ssr: false,
    loading: () => (
      <Center py={100}>
        <Loader color="dinePrimary" />
      </Center>
    ),
  }
);

export function ReportDetailClientWrapper({ reportType }: { reportType: ReportType }) {
  return <ReportDetailView reportType={reportType} />;
}
