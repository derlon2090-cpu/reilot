import { notFound } from "next/navigation";
import AdminTemplateEditor from "../../../../src/components/admin/AdminTemplateEditor.jsx";
import { requireAdminPage } from "../../../../src/lib/admin/require-admin.js";
import { query } from "../../../../src/server/db.js";

const TEMPLATE_KEY_PATTERN = /^[a-z0-9_]{3,100}$/;

export const dynamic = "force-dynamic";

export default async function AdminTemplateEditorPage({ params }) {
  const { templateKey } = await params;
  if (!TEMPLATE_KEY_PATTERN.test(templateKey)) notFound();
  const admin = await requireAdminPage();
  const template = await query(
    `SELECT 1
       FROM admin_message_templates
      WHERE template_key=$1
        AND template_key NOT LIKE 'platform_salla_default_%'
      LIMIT 1`,
    [templateKey]
  );
  if (!template.rows[0]) notFound();
  return <AdminTemplateEditor templateKey={templateKey} admin={{ name: admin.name, email: admin.email, role: admin.adminRole }} />;
}
