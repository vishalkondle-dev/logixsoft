import { FinanceView } from "./finance-view";

export const metadata = {
  title: "Finance & Petty Cash Tracking | Logix Dine",
  description: "Monitor daily revenues, petty cash outflows, cash drawer float, and net profitability.",
};

export default function FinancePage() {
  return <FinanceView />;
}
