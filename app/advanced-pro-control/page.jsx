import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AdminLoginForm from "../../src/components/admin-auth/AdminLoginForm.jsx";
import AdminLoginLayout from "../../src/components/admin-auth/AdminLoginLayout.jsx";
import { getAdminContext } from "../../src/server/admin-auth.js";

export const metadata = { title: "دخول الأدمن | Renvix", robots: { index: false, follow: false } };

export default async function AdminLoginPage() {
  const admin = await getAdminContext({ headers: await headers() }).catch(() => null);
  if (admin) redirect("/admin");
  return <AdminLoginLayout><AdminLoginForm /></AdminLoginLayout>;
}

