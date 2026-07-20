import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminContext } from "../../server/admin-auth.js";

export async function requireAdminPage() {
  const requestHeaders = await headers();
  const admin = await getAdminContext({ headers: requestHeaders }).catch(() => null);
  if (!admin) redirect("/advanced-pro-control");
  return admin;
}

