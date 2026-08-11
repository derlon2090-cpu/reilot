import AdminSallaCatalog from "../../../../src/components/admin/AdminSallaCatalog.jsx";
import AdminPortal from "../../../../src/components/admin/AdminPortal.jsx";
import { requireAdminPage } from "../../../../src/lib/admin/require-admin.js";

export const dynamic = "force-dynamic";

export default async function AdminSallaCatalogPage() {
  const admin = await requireAdminPage();
  const initialAdmin = { name: admin.name, email: admin.email, role: admin.adminRole };
  return <AdminPortal initialAdmin={initialAdmin} initialPanel="integrations">
    <AdminSallaCatalog admin={initialAdmin} />
  </AdminPortal>;
}
