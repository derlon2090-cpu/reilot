import AdminSallaCatalog from "../../../../src/components/admin/AdminSallaCatalog.jsx";
import { requireAdminPage } from "../../../../src/lib/admin/require-admin.js";

export const dynamic = "force-dynamic";

export default async function AdminSallaCatalogPage() {
  const admin = await requireAdminPage();
  return <AdminSallaCatalog admin={{ name: admin.name, email: admin.email, role: admin.adminRole }} />;
}
