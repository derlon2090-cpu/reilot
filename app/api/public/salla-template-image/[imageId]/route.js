import { query } from "../../../../../src/server/db.js";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function GET(_request, { params }) {
  const { imageId } = await params;
  const id = String(imageId || "").trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)) {
    return new Response(null, { status: 404 });
  }

  const result = await query(
    `SELECT image_data AS "imageData",image_content_type AS "contentType"
       FROM tenant_salla_template_images WHERE id=$1 LIMIT 1`,
    [id]
  );
  const row = result.rows[0];
  if (!row?.imageData || !ALLOWED_TYPES.has(row.contentType)) return new Response(null, { status: 404 });

  const bytes = Buffer.isBuffer(row.imageData) ? row.imageData : Buffer.from(row.imageData);
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
