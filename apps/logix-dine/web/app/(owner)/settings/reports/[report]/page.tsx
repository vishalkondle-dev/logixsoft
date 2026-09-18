import { ReportDetailView } from "@/app/(owner)/reports/reports-management";
import { notFound } from "next/navigation";
import type { ReportType } from "@/lib/api-client";

export const VALID_REPORT_TYPES: ReportType[] = [
  "summary",
  "top-items",
  "orders-by-status",
  "payment-methods",
  "hourly",
  "daily-trend",
];

export function generateStaticParams() {
  return VALID_REPORT_TYPES.map((report) => ({ report }));
}

export default async function SettingsReportDetailPage({
  params,
}: {
  params: Promise<{ report: string }>;
}) {
  const { report } = await params;
  if (!VALID_REPORT_TYPES.includes(report as any)) {
    notFound();
  }
  return <ReportDetailView reportType={report as ReportType} />;
}
