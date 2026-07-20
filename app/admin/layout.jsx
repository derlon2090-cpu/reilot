import { requireAdminPage } from "../../src/lib/admin/require-admin.js";

export const metadata = { title: "لوحة الأدمن | Renvix", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }) {
  await requireAdminPage();
  return children;
}

