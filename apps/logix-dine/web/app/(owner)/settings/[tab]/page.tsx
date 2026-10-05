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
  "roles",
  "printing",
  "dining",
  "qr-menu",
  "whatsapp",
  "reservations",
  "riders",
  "aggregators",
  "feedback",
  "billing",
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
  if (tab === "subscription" || tab === "subscriptions") {
    redirect("/settings/billing");
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
  if (tab === "finance" || tab === "expenses") {
    redirect("/finance");
  }
  if (tab === "customers" || tab === "crm") {
    redirect("/customers");
  }
  if (tab === "campaigns" || tab === "broadcasts") {
    redirect("/campaigns");
  }
  return <SettingsView currentTab={tab} />;
}
