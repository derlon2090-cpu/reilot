import { notFound } from "next/navigation";
import AdminTemplateEditor from "../../../../src/components/admin/AdminTemplateEditor.jsx";
import { requireAdminPage } from "../../../../src/lib/admin/require-admin.js";

const TEMPLATE_KEYS = new Set([
  "admin_account_created",
  "admin_subscription_renewed",
  "admin_number_disconnected",
  "admin_salla_installed"
]);

export const dynamic = "force-dynamic";

export default async function AdminTemplateEditorPage({ params }) {
  const { templateKey } = await params;
  if (!TEMPLATE_KEYS.has(templateKey)) notFound();
  const admin = await requireAdminPage();
  return <AdminTemplateEditor templateKey={templateKey} admin={{ name: admin.name, email: admin.email, role: admin.adminRole }} />;
}
