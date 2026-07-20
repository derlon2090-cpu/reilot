import crypto from "node:crypto";
import { query } from "../../../../../../src/server/db.js";

export async function GET(req, { params }) {
  const { token } = await params;
  const hash = crypto.createHash("sha256").update(String(token || "")).digest("hex");
  const result = await query(
    `UPDATE renewal_tracking_links SET clicked_at=COALESCE(clicked_at,now())
      WHERE token_hash=$1 AND expires_at>now() RETURNING destination_url AS "destinationUrl"`,
    [hash]
  );
  const destination = result.rows[0]?.destinationUrl;
  if (!destination) return Response.redirect(new URL("/", req.url), 302);
  return Response.redirect(destination, 302);
}
