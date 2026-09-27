import { SettingsView } from "../settings-view";
import { redirect } from "next/navigation";

export const VALID_SETTINGS_TABS = [
  "restaurant",
  "menu",
  "inventory",
  "tables",
  "hours",
  "tax",
  "reports",
  "staff",
  "printing",
  "dining",
  "qr-menu",
  "whatsapp",
  "reservations",
  "riders",
  "aggregators",
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
  if (tab === "payment-types" || tab === "payments") {
    redirect("/settings");
  }
  if (tab === "dining-options") {
    redirect("/settings/dining");
  }
  if (tab === "delivery-agents") {
    redirect("/settings/riders");
  }
  if (tab === "delivery-partners") {
    redirect("/settings/aggregators");
  }
  return <SettingsView currentTab={tab} />;
}
