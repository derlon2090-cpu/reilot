import AdminSallaReportsPreview from "../../../../../src/components/admin/AdminSallaReportsPreview.jsx";
import { requireAdminPage } from "../../../../../src/lib/admin/require-admin.js";

export const dynamic = "force-dynamic";

export default async function AdminSallaReportsPage() {
  const admin = await requireAdminPage();
  return <AdminSallaReportsPreview admin={{ name: admin.name, email: admin.email, role: admin.adminRole }} />;
}
