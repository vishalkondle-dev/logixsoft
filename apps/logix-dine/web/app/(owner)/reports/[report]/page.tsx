import { redirect } from "next/navigation";

export default async function ReportRedirectPage({
  params,
}: {
  params: Promise<{ report: string }>;
}) {
  const { report } = await params;
  redirect(`/settings/reports/${report}`);
}
