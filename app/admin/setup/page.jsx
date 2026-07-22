import { Suspense } from "react";
import AdminSetupForm from "../../../src/components/admin-auth/AdminSetupForm.jsx";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "إعداد المسؤول | Renvix",
  robots: { index: false, follow: false },
  referrer: "no-referrer"
};

export default function AdminSetupPage() {
  return <Suspense fallback={null}><AdminSetupForm /></Suspense>;
}
