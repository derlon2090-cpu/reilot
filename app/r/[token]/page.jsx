import crypto from "node:crypto";
import { query } from "../../../src/server/db.js";

export const dynamic = "force-dynamic";

export default async function RenewalTrackingPage({ params }) {
  const { token } = await params;
  const hash = crypto.createHash("sha256").update(String(token || "")).digest("hex");
  const result = await query(
    `UPDATE renewal_tracking_links rtl SET opened_at=COALESCE(opened_at,now())
      FROM customer_subscriptions cs, subscription_customers sc, subscription_plans sp
      WHERE rtl.token_hash=$1 AND rtl.expires_at>now() AND cs.id=rtl.subscription_id
        AND sc.id=cs.customer_id AND sp.id=cs.plan_id
      RETURNING rtl.id,cs.service_name AS "serviceName",cs.expires_at AS "expiresAt",
        sc.full_name AS "customerName",sp.name AS "planName"`,
    [hash]
  );
  const item = result.rows[0];
  return <main dir="rtl" style={{fontFamily:"IBM Plex Sans Arabic, sans-serif",maxWidth:680,margin:"70px auto",padding:24}}>
    <section style={{border:"1px solid #dbe5f4",borderRadius:24,padding:32,boxShadow:"0 18px 50px rgba(15,35,75,.08)"}}>
      <img src="/assets/brand/renvix-logo.svg" alt="Renvix" style={{width:190,maxWidth:"60%"}} />
      {item ? <>
        <h1>تجديد الاشتراك</h1>
        <p>مرحبًا {item.customerName}، يمكنك مراجعة اشتراكك ثم الانتقال إلى منتج التجديد الصحيح في سلة.</p>
        <dl><dt>الخدمة</dt><dd>{item.serviceName}</dd><dt>الباقة</dt><dd>{item.planName}</dd><dt>تاريخ الانتهاء</dt><dd>{new Date(item.expiresAt).toLocaleDateString("ar-SA")}</dd></dl>
        <a href={`/api/public/renewal/${encodeURIComponent(token)}/click`} style={{display:"block",textAlign:"center",padding:14,borderRadius:12,background:"linear-gradient(90deg,#0db6c7,#2850f5)",color:"white",textDecoration:"none",fontWeight:700}}>الانتقال إلى التجديد في سلة</a>
      </> : <><h1>الرابط غير صالح</h1><p>انتهت صلاحية رابط التجديد أو تم إيقافه. اطلب رابطًا جديدًا من المتجر.</p></>}
    </section>
  </main>;
}
