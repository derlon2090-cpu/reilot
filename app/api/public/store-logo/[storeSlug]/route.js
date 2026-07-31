import { query } from "../../../../../src/server/db.js";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function GET(_request, { params }) {
  const { storeSlug } = await params;
  const slug = String(storeSlug || "").trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
    return new Response(null, { status: 404 });
  }

  const result = await query(
    `SELECT logo_data AS "logoData",logo_content_type AS "contentType",logo_updated_at AS "updatedAt"
       FROM order_link_profiles
      WHERE lower(slug)=lower($1) AND is_active=true
      LIMIT 1`,
    [slug]
  );
  const row = result.rows[0];
  if (!row?.logoData || !ALLOWED_TYPES.has(row.contentType)) {
    return new Response(null, { status: 404 });
  }

  const bytes = Buffer.isBuffer(row.logoData) ? row.logoData : Buffer.from(row.logoData);
  return new Response(bytes, {
    headers: {
      "Content-Type": row.contentType,
      "Content-Length": String(bytes.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
