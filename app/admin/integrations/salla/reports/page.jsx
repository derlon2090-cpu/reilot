import AdminSallaReportsPreview from "../../../../../src/components/admin/AdminSallaReportsPreview.jsx";
import AdminPortal from "../../../../../src/components/admin/AdminPortal.jsx";
import { requireAdminPage } from "../../../../../src/lib/admin/require-admin.js";

export const dynamic = "force-dynamic";

export default async function AdminSallaReportsPage() {
  const admin = await requireAdminPage();
  const initialAdmin = { name: admin.name, email: admin.email, role: admin.adminRole };
  return <AdminPortal initialAdmin={initialAdmin} initialPanel="integrations">
    <AdminSallaReportsPreview admin={initialAdmin} />
  </AdminPortal>;
}
