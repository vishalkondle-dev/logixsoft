import { SettingsView } from "../settings-view";

export const VALID_SETTINGS_TABS = [
  "restaurant",
  "outlets",
  "menu",
  "tables",
  "reports",
  "staff",
  "printing",
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
  return <SettingsView currentTab={tab} />;
}
