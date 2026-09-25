import { ReportDetailView } from "@/app/(owner)/reports/reports-management";
import { notFound } from "next/navigation";
import type { ReportType } from "@/lib/api-client";

export const VALID_REPORT_TYPES: ReportType[] = [
  "summary",
  "invoice-detail",
  "item-wise-invoice",
  "sales-report",
  "average-order-value",
  "gross-report",
  "top-items",
  "net-sales-report",
  "sales-by-hour",
  "hourly",
  "sales-by-day",
  "daily-trend",
  "sales-by-month",
  "sales-by-order-type",
  "orders-by-status",
  "sales-by-table",
  "payment-methods",
  "discount-report",
  "void-invoices",
  "cancelled-invoices",
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
