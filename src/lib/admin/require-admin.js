import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminContext } from "../../server/admin-auth.js";
import { adminPageUrl } from "../../server/app-url.js";

export async function requireAdminPage() {
  const requestHeaders = await headers();
  const admin = await getAdminContext({ headers: requestHeaders }).catch(() => null);
  if (!admin) redirect(adminPageUrl("/advanced-pro-control"));
  return admin;
}
