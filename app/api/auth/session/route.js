import { getSession } from "../../../../src/server/session.js";

export async function GET(req) {
  const session = await getSession(req).catch(() => null);
  return session
    ? Response.json({ ok: true, user: session })
    : Response.json({ ok: false, message: "Authentication required" }, { status: 401 });
}
