import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { query } from "../../../src/server/db.js";
import { safeRenewalUrl } from "../../../src/lib/renewal-links.js";
import { resolveRenewalRedirect } from "../../../src/server/product-renewal-options.js";

export const dynamic = "force-dynamic";

export default async function RenewalTrackingPage({ params }) {
  const { token } = await params;
  const resolved = await resolveRenewalRedirect(token);
  if (resolved.ok) redirect(resolved.url);

  // Keep previously sent renewal links working while the new dynamic links are rolled out.
  const hash = crypto.createHash("sha256").update(String(token || "")).digest("hex");
  const legacy = await query(`UPDATE renewal_tracking_links SET clicked_at=COALESCE(clicked_at,now())
    WHERE token_hash=$1 AND expires_at>now() RETURNING destination_url AS "destinationUrl"`, [hash]);
  const legacyUrl = safeRenewalUrl(legacy.rows[0]?.destinationUrl);
  if (legacyUrl) redirect(legacyUrl);

  return <main dir="rtl" style={{fontFamily:"IBM Plex Sans Arabic, sans-serif",maxWidth:680,margin:"70px auto",padding:24}}>
    <section style={{border:"1px solid #dbe5f4",borderRadius:24,padding:32,boxShadow:"0 18px 50px rgba(15,35,75,.08)"}}>
      <img src="/assets/brand/renvix-logo.svg" alt="Renvix" style={{width:190,maxWidth:"60%"}} />
      <h1>رابط التجديد غير متاح</h1>
      <p>انتهت صلاحية الرابط، أو تم إيقاف خيار التجديد، أو لم يعد المنتج متاحًا في المتجر. اطلب رابطًا جديدًا من المتجر.</p>
    </section>
  </main>;
}
