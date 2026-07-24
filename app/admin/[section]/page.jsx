import { notFound } from "next/navigation";
import AdminPortal from "../../../src/components/admin/AdminPortal.jsx";
import { requireAdminPage } from "../../../src/lib/admin/require-admin.js";

const SECTIONS = new Set([
  "subscriptions", "customers", "stores", "templates", "campaigns", "contacts", "messages", "devices",
  "integrations", "security", "reports", "billing", "settings"
]);

export const dynamic = "force-dynamic";

export default async function AdminSectionPage({ params }) {
  const { section } = await params;
  if (!SECTIONS.has(section)) notFound();
  const admin = await requireAdminPage();
  return <AdminPortal
    initialPanel={section}
    initialAdmin={{ name: admin.name, email: admin.email, role: admin.adminRole }}
  />;
}
