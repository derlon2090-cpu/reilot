import AdminPortal from "../../src/components/admin/AdminPortal.jsx";
import { requireAdminPage } from "../../src/lib/admin/require-admin.js";

export default async function AdminPage() {
  const admin = await requireAdminPage();
  return <AdminPortal initialPanel="overview" initialAdmin={{ name: admin.name, email: admin.email, role: admin.adminRole }} />;
}
