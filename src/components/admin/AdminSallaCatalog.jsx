"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./AdminPortal.module.css";

const PREVIEW_VALUES = {
  customer_name: "اسم العميل",
  order_number: "#12345",
  store_name: "متجري",
  product_name: "المنتج الرقمي",
  activation_code: "••••-••••",
  delivery_date: "تاريخ التسليم",
  digital_content_url: "رابط آمن للمنتج",
  estimated_completion: "قريبًا",
  order_url: "رابط الطلب الآمن",
  delivered_at: "تاريخ التسليم",
  support_url: "رابط الدعم",
  review_url: "رابط التقييم",
  shipping_company: "شركة الشحن",
  tracking_number: "TRK-12345",
  tracking_url: "رابط تتبع الشحنة",
  delivery_note: "ملاحظة التوصيل",
  service_name: "الخدمة",
  completed_at: "تاريخ التنفيذ",
  rating_url: "رابط التقييم",
  cart_total: "199 ر.س",
  currency: "ر.س",
  items_count: "2",
  cart_items: "منتجات السلة",
  checkout_url: "رابط إكمال الطلب",
  cancellation_reason: "سبب الإلغاء",
  return_number: "RET-12345",
  return_status: "قيد المعالجة",
  return_url: "رابط الاسترجاع",
  refund_amount: "199 ر.س",
  refund_method: "وسيلة الدفع",
  refund_type: "استرجاع كامل",
  refund_summary: "تفاصيل المبلغ المرجع"
};

function renderPreview(content) {
  return String(content || "").replace(/{{\s*([a-z][a-z0-9_]*)\s*}}/gi, (_match, variable) => PREVIEW_VALUES[variable] || `{{${variable}}}`);
}

function SallaLogo() {
  return <span className={styles.adminSallaLogo}><img src="/assets/salla-logo.svg" alt="سلة" /></span>;
}

function TemplatePreview({ item, channel, form }) {
  const body = renderPreview(form.body);
  if (channel === "email") {
    return <article className={styles.adminSallaEmailPreview}>
      <header><SallaLogo /><div><strong>متجري</strong><span>رسالة آلية آمنة من المتجر</span></div></header>
      <div className={styles.adminSallaEmailHero}><span>✓</span><strong>{form.subject || item.name}</strong></div>
      <div className={styles.adminSallaPreviewBody}>{body}</div>
      <button type="button">{item.previewAction}</button>
      <footer>هذه معاينة إدارية فقط — لن تُرسل أي رسالة.</footer>
    </article>;
  }
  return <div className={styles.adminSallaWhatsappPreview}>
    <div className={styles.adminSallaWhatsappTop}><span>‹</span><SallaLogo /><div><strong>متجري</strong><small>حساب تجاري</small></div></div>
    <div className={styles.adminSallaWhatsappCanvas}>
      <article><div className={styles.adminSallaPreviewBody}>{body}</div><button type="button">{item.previewAction}</button><small>11:30 ✓✓</small></article>
    </div>
  </div>;
}

export default function AdminSallaCatalog({ admin }) {
  const [items, setItems] = useState([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [channel, setChannel] = useState("whatsapp");
  const [form, setForm] = useState({ subject: "", body: "" });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/integrations/salla/templates", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error("تعذر تحميل قوالب سلة للأدمن.");
    setItems(payload.items || []);
  }, []);

  useEffect(() => { load().catch((loadError) => setError(loadError.message)); }, [load]);

  const selected = useMemo(() => items.find((item) => item.templateKey === selectedKey) || null, [items, selectedKey]);

  const openEditor = (item) => {
    setSelectedKey(item.templateKey);
    setChannel("whatsapp");
    setForm({ subject: item.emailSubject || "", body: item.whatsappContent || "" });
    setNotice("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const changeChannel = (nextChannel) => {
    if (!selected) return;
    setChannel(nextChannel);
    setForm({
      subject: selected.emailSubject || "",
      body: nextChannel === "email" ? selected.emailTextContent : selected.whatsappContent
    });
    setNotice("");
  };

  const save = async (event) => {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/admin/integrations/salla/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateKey: selected.templateKey, channel, subject: form.subject || null, body: form.body })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.reason === "email_subject_required" ? "عنوان البريد مطلوب." : "تعذر حفظ القالب.");
      setItems(payload.items || []);
      setNotice(payload.message || "تم حفظ القالب.");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  };

  return <main className={styles.adminSallaWorkspace} dir="rtl">
    <header className={styles.adminSallaPageHeader}>
      <div><div className={styles.adminSallaBreadcrumb}><a href="/admin/integrations">تطبيقات المنصة</a><span>‹</span><span>سلة</span></div><div className={styles.adminSallaTitle}><SallaLogo /><div><h1>{selected ? selected.name : "قوالب سلة"}</h1><p>{selected ? selected.description : "معاينة وتحرير الواجهة الافتراضية التي تظهر للمستخدم بعد ربط متجر سلة."}</p></div></div></div>
      <a className={styles.adminSallaBack} href="/admin/integrations">العودة إلى التطبيقات</a>
    </header>
    <section className={styles.adminSallaSafetyNotice}><span>i</span><p><strong>وضع إدارة المنصة</strong>هذه المعاينة متاحة للأدمن دون ربط متجر. لا تُعرض رموز وصول ولا تُرسل رسائل أو Webhooks.</p><small>{admin.role}</small></section>
    {error ? <div className={styles.adminSallaError}>{error}</div> : null}
    {notice ? <div className={styles.adminSallaSuccess}>{notice}</div> : null}
    {!selected ? <>
      <section className={styles.adminSallaCatalogIntro}><div><h2>واجهة قوالب سلة للمستخدم</h2><p>تظهر هذه القوالب للمستخدم بعد اكتمال الربط. تعديل الأدمن يغيّر القيمة الافتراضية للقناة المحددة للروابط الجديدة فقط، ولا يستبدل تخصيصات المتاجر الحالية.</p></div><span>{items.length || 12} قالبًا</span></section>
      {!items.length && !error ? <div className={styles.adminSallaLoading}>جارٍ تحميل القوالب...</div> : <section className={styles.adminSallaTemplateGrid}>{items.map((item, index) => <article key={item.templateKey} className={styles.adminSallaTemplateCard}>
        <div className={styles.adminSallaTemplateCardHead}><span className={styles.adminSallaTemplateIcon}>{index + 1}</span><span className={styles.adminSallaBadge}>سلة</span></div>
        <h3>{item.name}</h3><p>{item.description}</p><span className={styles.adminSallaChannels}><i>واتساب</i><i>بريد إلكتروني</i></span>
        <footer><small>{item.updatedAt ? `آخر تعديل ${new Date(item.updatedAt).toLocaleDateString("ar-SA")}` : "الإعداد الافتراضي"}</small><button type="button" onClick={() => openEditor(item)}>معاينة وتحرير</button></footer>
      </article>)}</section>}
    </> : <section className={styles.adminSallaEditorLayout}>
      <form className={styles.adminSallaEditorForm} onSubmit={save}>
        <div className={styles.adminSallaEditorHead}><div><h2>بيانات القالب</h2><p>تحرير افتراضي آمن للقناة المحددة.</p></div><button type="button" onClick={() => setSelectedKey("")}>كل القوالب</button></div>
        <fieldset className={styles.adminSallaChannelChoice}><legend>قناة الإرسال</legend><button type="button" className={channel === "whatsapp" ? styles.adminSallaChannelActive : ""} onClick={() => changeChannel("whatsapp")}><span>◉</span> واتساب</button><button type="button" className={channel === "email" ? styles.adminSallaChannelActive : ""} onClick={() => changeChannel("email")}><span>✉</span> بريد إلكتروني</button></fieldset>
        {channel === "email" ? <label className={styles.adminSallaField}><span>عنوان البريد</span><input value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} maxLength={300} required /></label> : null}
        <label className={styles.adminSallaField}><span>محتوى الرسالة</span><textarea value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} maxLength={10000} required /></label>
        <div className={styles.adminSallaVariables}><strong>المتغيرات المتاحة</strong><div>{selected.variables.map((variable) => <button key={variable} type="button" onClick={() => setForm((current) => ({ ...current, body: `${current.body}${current.body ? " " : ""}{{${variable}}}` }))}>{`{{${variable}}}`}</button>)}</div></div>
        <div className={styles.adminSallaEditorActions}><button type="submit" disabled={busy}>{busy ? "جارٍ الحفظ..." : "حفظ الإعداد الافتراضي"}</button><button type="button" onClick={() => setSelectedKey("")}>إلغاء</button></div>
      </form>
      <aside className={styles.adminSallaPreviewColumn}><div><h2>{channel === "email" ? "معاينة البريد" : "معاينة واتساب"}</h2><p>تتغير المعاينة مباشرة حسب القناة والمحتوى.</p></div><TemplatePreview item={selected} channel={channel} form={form} /></aside>
    </section>}
  </main>;
}
