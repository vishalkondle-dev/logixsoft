import { RolesManagement } from "../roles-management";

export const metadata = {
  title: "Roles & Permissions Matrix | LogixDine",
  description: "Configure granular permissions and custom team roles for your restaurant.",
};

export default function RolesSettingsPage() {
  return <RolesManagement />;
}
