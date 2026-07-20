import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AdminForgotPasswordForm from "../../../src/components/admin-auth/AdminForgotPasswordForm.jsx";
import AdminLoginLayout from "../../../src/components/admin-auth/AdminLoginLayout.jsx";
import { getAdminContext } from "../../../src/server/admin-auth.js";

export const metadata = { title: "استعادة دخول الأدمن | Renvix", robots: { index: false, follow: false } };

export default async function AdminForgotPasswordPage() {
  const admin = await getAdminContext({ headers: await headers() }).catch(() => null);
  if (admin) redirect("/admin");
  return <AdminLoginLayout title="استعادة وصول الأدمن" description="رمز تحقق حقيقي ومؤقت لحماية حساب الإدارة."><AdminForgotPasswordForm /></AdminLoginLayout>;
}

