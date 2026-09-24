import { SettingsView } from "../settings-view";
import { redirect } from "next/navigation";

export const VALID_SETTINGS_TABS = [
  "restaurant",
  "menu",
  "tables",
  "hours",
  "tax",
  "reports",
  "staff",
  "printing",
  "payments",
  "dining",
  "qr-menu",
  "whatsapp",
  "reservations",
  "riders",
] as const;

export function generateStaticParams() {
  return VALID_SETTINGS_TABS.map((tab) => ({ tab }));
}

export default async function SettingsTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  const { tab } = await params;
  if (tab === "outlets") {
    redirect("/settings/restaurant");
  }
  if (tab === "payment-types") {
    redirect("/settings/payments");
  }
  if (tab === "dining-options") {
    redirect("/settings/dining");
  }
  if (tab === "delivery-agents") {
    redirect("/settings/riders");
  }
  return <SettingsView currentTab={tab} />;
}
