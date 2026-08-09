"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { sallaPageCssVariables } from "../../data/sallaPageCss.js";
import styles from "./AdminPortal.module.css";

function DashboardIcon({ name }) {
  const paths = {
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
    template: <><path d="M6 2h9l4 4v16H6z" /><path d="M14 2v5h5M9 12h6M9 16h6" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
    save: <><path d="M5 3h12l2 2v16H5z" /><path d="M8 3v6h8V3M8 21v-7h8v7" /></>,
    send: <><path d="m3 11 18-8-8 18-2-8-8-2Z" /><path d="m11 13 5-5" /></>,
    apps: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    arrow: <><path d="M19 12H5M11 6l-6 6 6 6" /></>,
    action: <><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1-1" /></>
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name] || paths.template}</svg>;
}

function templateIconName(item) {
  const map = {
    cart: "apps",
    clock: "template",
    settings: "template",
    check: "save",
    plane: "send",
    truck: "send",
    package: "apps",
    return: "action",
    refund: "action",
    invoice: "template",
    download: "action",
    star: "eye",
    cancel: "action"
  };
  return map[item.icon] || "template";
}

function SallaLogo() {
  return <span className="salla-email-store-logo"><img src="/assets/salla-logo.svg" alt="سلة" /></span>;
}

function TemplatePreview({ item, channel, draft, logoUrl }) {
  const isEmail = channel === "email";
  const body = isEmail ? draft.emailTextContent : draft.whatsappContent;
  return <aside className="card salla-template-live-preview">
    <div className="section-head">
      <div><h2>{isEmail ? "معاينة البريد" : "معاينة واتساب"}</h2><p>معاينة موحدة وآمنة — لن يتم إرسال أي رسالة.</p></div>
      <DashboardIcon name={isEmail ? "template" : "eye"} />
    </div>
    <div className={isEmail ? `salla-email-preview design-${draft.emailDesign || "classic"}` : "salla-whatsapp-preview"}>
      {!isEmail ? <div className="salla-whatsapp-preview-canvas">
        <div className="salla-whatsapp-bubble">
          {draft.whatsappImageEnabled && draft.whatsappImageUrl ? <img className="salla-whatsapp-message-image" src={draft.whatsappImageUrl} alt="صورة رسالة واتساب" /> : null}
          <div className="salla-preview-message">{body || "اكتب محتوى الرسالة ليظهر هنا."}</div>
          {draft.buttonEnabled ? <button type="button" tabIndex={-1} className="salla-preview-cta"><DashboardIcon name="action" /><span>{draft.buttonLabel || item.previewAction || "عرض التفاصيل"}</span></button> : null}
          <small>11:30 ص ✓✓</small>
        </div>
      </div> : <div className="salla-email-preview-canvas">
        <div className="salla-email-preview-head">
          {logoUrl ? <span className="salla-email-store-logo"><img src={logoUrl} alt="شعار المتجر في المعاينة" /></span> : <SallaLogo />}
          <div><small>متجري</small><strong>{draft.emailSubject || "عنوان الرسالة"}</strong></div>
        </div>
        <div className="salla-email-hero"><DashboardIcon name="template" /><strong>{item.name}</strong></div>
        <div className="salla-preview-message">{body || "اكتب محتوى الرسالة ليظهر هنا."}</div>
        {draft.buttonEnabled ? <button type="button" tabIndex={-1} className="salla-preview-cta primary"><span>{draft.buttonLabel || item.previewAction || "عرض التفاصيل"}</span></button> : null}
        <footer>هذه رسالة آلية آمنة من متجرك</footer>
      </div>}
    </div>
    {item.templateKey === "digital_product_delivery" && draft.secureLinkEnabled ? <section className={`salla-digital-link-preview design-${draft.deliveryPageDesign || "classic"}`} style={{ "--salla-link-theme": draft.themeColor || "#0B3F3B", ...sallaPageCssVariables(draft.deliveryPageCustomCss) }}><div className="salla-digital-link-head">{logoUrl ? <img src={logoUrl} alt="شعار المتجر" /> : <DashboardIcon name="action" />}<div><small>الرابط الخاص بالطلب #10025</small><strong>{draft.linkPageTitle || "منتجاتك الرقمية جاهزة"}</strong></div></div><p>{draft.linkPageContent || "استخدم البيانات التالية للوصول إلى منتجك الرقمي بأمان."}</p><article><strong>المنتج الرقمي</strong><dl><div><dt>كود التفعيل</dt><dd>RVX-2026-DEMO</dd></div><div><dt>البريد</dt><dd>customer@example.com</dd></div><div><dt>كلمة المرور</dt><dd>••••••••••</dd></div></dl><a>فتح المنتج بأمان</a></article>{draft.showCountdown ? <div className="salla-digital-countdown">متاح لمدة <strong>23:59:59</strong></div> : null}<small>يُنشأ الرابط لكل طلب وتُرتب بيانات الاعتماد تلقائيًا.</small></section> : null}
  </aside>;
}

export default function AdminSallaCatalog({ admin }) {
  const [items, setItems] = useState([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [channel, setChannel] = useState("whatsapp");
  const [draft, setDraft] = useState({ emailSubject: "", emailTextContent: "", whatsappContent: "", buttonEnabled: true, buttonLabel: "", secureLinkEnabled: true, linkPageTitle: "", linkPageContent: "", showCountdown: true, themeColor: "#0B3F3B", whatsappImageEnabled: false, whatsappImageUrl: "", emailDesign: "classic", deliveryPageDesign: "classic", deliveryPageCustomCss: "", reviewTriggerStatus: "delivered", reviewDelayHours: 24, abandonedDelayHours: 1 });
  const [logoUrl, setLogoUrl] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/integrations/salla/templates", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error("تعذر تحميل قوالب سلة للأدمن.");
    setItems(payload.items || []);
  }, []);

  useEffect(() => { load().catch((loadError) => setError(loadError.message)); }, [load]);
  useEffect(() => () => { if (logoUrl.startsWith("blob:")) URL.revokeObjectURL(logoUrl); }, [logoUrl]);

  const selected = useMemo(() => items.find((item) => item.templateKey === selectedKey) || null, [items, selectedKey]);

  const openEditor = (item) => {
    setSelectedKey(item.templateKey);
    setChannel("whatsapp");
    setDraft({
      emailSubject: item.emailSubject || "",
      emailTextContent: item.emailTextContent || "",
      whatsappContent: item.whatsappContent || "",
      buttonEnabled: item.settings?.buttonEnabled !== false,
      buttonLabel: item.settings?.buttonLabel || item.previewAction || "عرض التفاصيل",
      secureLinkEnabled: item.settings?.secureLinkEnabled !== false,
      linkPageTitle: item.settings?.linkPageTitle || "منتجاتك الرقمية جاهزة",
      linkPageContent: item.settings?.linkPageContent || "استخدم البيانات التالية للوصول إلى منتجك الرقمي بأمان.",
      showCountdown: item.settings?.showCountdown !== false,
      themeColor: item.settings?.themeColor || item.settings?.branding?.themeColor || "#0B3F3B",
      whatsappImageEnabled: item.settings?.whatsappImageEnabled === true,
      whatsappImageUrl: item.settings?.whatsappImageUrl || "",
      emailDesign: item.settings?.emailDesign || "classic",
      deliveryPageDesign: item.settings?.deliveryPageDesign || "classic",
      deliveryPageCustomCss: item.settings?.deliveryPageCustomCss || "",
      reviewTriggerStatus: ["shipped", "delivered", "completed"].includes(item.settings?.reviewTriggerStatus) ? item.settings.reviewTriggerStatus : "delivered",
      reviewDelayHours: Math.min(48, Math.max(1, Math.round(Number(item.settings?.reviewDelayMinutes || 1440) / 60))),
      abandonedDelayHours: Math.min(48, Math.max(1, Math.round(Number(item.settings?.delaysMinutes?.[0] || 60) / 60)))
    });
    setLogoUrl("");
    setNotice("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
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
        body: JSON.stringify({
          templateKey: selected.templateKey,
          channel,
          subject: channel === "email" ? draft.emailSubject : null,
          body: channel === "email" ? draft.emailTextContent : draft.whatsappContent,
          settings: { buttonEnabled: draft.buttonEnabled, buttonLabel: draft.buttonLabel, secureLinkEnabled: draft.secureLinkEnabled, linkPageTitle: draft.linkPageTitle, linkPageContent: draft.linkPageContent, showCountdown: draft.showCountdown, themeColor: draft.themeColor, whatsappImageEnabled: draft.whatsappImageEnabled, whatsappImageUrl: draft.whatsappImageEnabled && /^https:\/\//i.test(draft.whatsappImageUrl) ? draft.whatsappImageUrl : "", emailDesign: draft.emailDesign, deliveryPageDesign: draft.deliveryPageDesign, deliveryPageCustomCss: draft.deliveryPageCustomCss, reviewTriggerStatus: draft.reviewTriggerStatus, reviewDelayMinutes: Math.min(48, Math.max(1, Number(draft.reviewDelayHours) || 24)) * 60, delaysMinutes: [Math.min(48, Math.max(1, Number(draft.abandonedDelayHours) || 1)) * 60] }
        })
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

  const addVariable = (variable) => {
    const field = channel === "email" ? "emailTextContent" : "whatsappContent";
    setDraft((current) => ({ ...current, [field]: `${current[field]}${current[field] ? " " : ""}{{${variable}}}` }));
  };

  const selectPreviewLogo = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 2 * 1024 * 1024) {
      setError("اختر صورة PNG أو JPG أو WebP بحجم لا يتجاوز 2 ميجابايت.");
      return;
    }
    setLogoUrl(URL.createObjectURL(file));
    setError("");
  };

  const uploadWhatsAppImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selected) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 2 * 1024 * 1024) {
      setError("اختر صورة PNG أو JPG أو WebP بحجم لا يتجاوز 2 ميجابايت.");
      return;
    }
    setImageBusy(true);
    setError("");
    setNotice("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/admin/integrations/salla/templates/${encodeURIComponent(selected.templateKey)}/image`, { method: "POST", body: formData });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.imageUrl) throw new Error(payload.message || "تعذر رفع صورة رسالة واتساب.");
      setDraft((current) => ({ ...current, whatsappImageUrl: payload.imageUrl }));
      setNotice("تم رفع صورة رسالة واتساب وظهرت في المعاينة. احفظ التغييرات لتثبيتها في القالب.");
    } catch (uploadError) {
      setError(uploadError.message || "تعذر رفع صورة رسالة واتساب.");
    } finally {
      setImageBusy(false);
    }
  };

  return <main className={`${styles.adminSallaWorkspace} dashboard-main`} dir="rtl">
    <div className="salla-template-editor-top">{selected ? <button className="btn btn-secondary" type="button" onClick={() => setSelectedKey("")}><DashboardIcon name="arrow" /> العودة إلى القوالب</button> : <a className="btn btn-secondary" href="/admin/integrations"><DashboardIcon name="arrow" /> العودة إلى التطبيقات</a>}</div>
    <div className="salla-templates-page-head">
      <div className="page-title">
        <div><h1>{selected ? selected.name : "قوالب سلة"}</h1><p className="muted">{selected ? selected.description : "إدارة قوالب رسائل الطلبات المرتبطة بمتجر سلة، بنفس الواجهة التي تظهر للمستخدم بعد الربط."}</p></div>
      </div>
      <span className="salla-chip">سلة</span>
    </div>

    <section className="inline-notice info salla-templates-notice"><DashboardIcon name="info" /><span><strong>وضع إدارة المنصة:</strong> الواجهة مطابقة لواجهة العميل، ومتاحة دون ربط متجر. المعاينة لا ترسل رسائل أو Webhooks، والحفظ يغيّر القيم الافتراضية للروابط الجديدة فقط.</span></section>
    <p className={styles.adminSallaAdminIdentity}>جلسة الأدمن: {admin.role}</p>
    {error ? <div className={styles.adminSallaError}>{error}</div> : null}
    {notice ? <div className={styles.adminSallaSuccess}>{notice}</div> : null}

    {!selected ? <>
      {!items.length && !error ? <div className={styles.adminSallaLoading}>جارٍ تحميل القوالب...</div> : <section className="salla-templates-grid">{items.map((item) => <article key={item.templateKey} className={`card salla-template-card ${item.templateKey === "completed" ? "featured" : ""}`}>
        <div className="salla-template-card-head">
          <span className="salla-template-card-icon"><DashboardIcon name={templateIconName(item)} /></span>
          <div><span className="salla-chip">سلة</span><h2>{item.name}</h2></div>
        </div>
        <p>{item.description}</p>
        {item.templateKey === "completed" ? <div className="salla-mode-chips"><span>واتساب</span><span>رابط صفحة آمنة</span></div> : null}
        <span className="status success">نشط <i /></span>
        <footer><small>آخر تحديث: {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString("ar-SA") : "—"}</small><div><button className="btn btn-secondary" type="button" onClick={() => openEditor(item)}><DashboardIcon name="eye" /> معاينة</button><button className="btn btn-secondary" type="button" onClick={() => openEditor(item)}><DashboardIcon name="template" /> تحرير</button></div></footer>
      </article>)}</section>}
    </> : <>
      <section className="message-activation-card card">
        <div className="message-activation-copy"><span className="message-activation-icon"><DashboardIcon name="send" /></span><span><strong>تفعيل رسالة {selected.name}</strong><small>هذه هي بطاقة التفعيل نفسها التي تظهر للمستخدم؛ التفعيل الفعلي يبقى خاصًا بكل متجر مرتبط.</small></span></div>
        <div className="message-activation-control"><label className="message-activation-switch"><input type="checkbox" checked readOnly aria-label={`تفعيل رسالة ${selected.name}`} /><span /></label><span className="message-activation-status"><i /><b className="message-activation-status-on">مفعل</b><b className="message-activation-status-off">متوقف</b></span></div>
      </section>

      <section className="salla-template-editor-layout">
        <form id="admin-salla-template-form" className="grid" onSubmit={save}>
          <article className="card salla-template-form-card">
            <div className="section-head"><div><h2>بيانات القالب</h2><p>كل قناة تحتفظ بمحتواها المستقل، وتظهر المعاينة المطابقة فورًا.</p></div><DashboardIcon name="template" /></div>
            <div className="form-grid two"><label className="field"><span>اسم القالب</span><input className="input" value={selected.name} disabled /></label><label className="field"><span>حدث التشغيل</span><input className="input" value={selected.templateKey} disabled dir="ltr" /></label></div>
            <fieldset className="salla-channel-choice"><legend>قناة الإرسال</legend>
              <label><input type="radio" name="channel" value="email" checked={channel === "email"} onChange={() => setChannel("email")} /><span><DashboardIcon name="template" /> بريد إلكتروني</span></label>
              <label><input type="radio" name="channel" value="whatsapp" checked={channel === "whatsapp"} onChange={() => setChannel("whatsapp")} /><span><DashboardIcon name="send" /> واتساب</span></label>
            </fieldset>

            {channel === "whatsapp" ? <section className="salla-channel-panel"><label className="field"><span>محتوى رسالة واتساب</span><textarea className="textarea salla-template-message-editor" value={draft.whatsappContent} onChange={(event) => setDraft((current) => ({ ...current, whatsappContent: event.target.value }))} maxLength={10000} required /></label><div className="variables-row"><strong>المتغيرات المتاحة</strong>{selected.variables.map((variable) => <button key={variable} type="button" className="chip" onClick={() => addVariable(variable)}>{`{{${variable}}}`}</button>)}</div><div className="salla-action-settings"><label className="setting-line"><span><strong>إضافة صورة كاملة مع رسالة واتساب</strong><small>تظهر في المعاينة وتُرسل مع النص عند توفر رابط صورة عام.</small></span><input type="checkbox" checked={draft.whatsappImageEnabled} onChange={(event) => setDraft((current) => ({ ...current, whatsappImageEnabled: event.target.checked }))} /></label><label className="setting-line"><span><strong>إظهار زر الإجراء</strong><small>يمكن إخفاؤه دون حذف النص.</small></span><input type="checkbox" checked={draft.buttonEnabled} onChange={(event) => setDraft((current) => ({ ...current, buttonEnabled: event.target.checked }))} /></label><label className="field"><span>نص الزر</span><input className="input" maxLength={80} value={draft.buttonLabel} onChange={(event) => setDraft((current) => ({ ...current, buttonLabel: event.target.value }))} /></label></div></section> : <section className="salla-channel-panel">
              <label className="field"><span>تصميم البريد</span><select className="select" value={draft.emailDesign} onChange={(event) => setDraft((current) => ({ ...current, emailDesign: event.target.value }))}><option value="classic">كلاسيكي أنيق</option><option value="modern">حديث ببطاقة مميزة</option><option value="minimal">بسيط وخفيف</option></select></label>
              <label className="field"><span>عنوان البريد</span><input className="input" value={draft.emailSubject} onChange={(event) => setDraft((current) => ({ ...current, emailSubject: event.target.value }))} maxLength={300} required /></label>
              <label className="field"><span>محتوى البريد</span><textarea className="textarea salla-template-message-editor" value={draft.emailTextContent} onChange={(event) => setDraft((current) => ({ ...current, emailTextContent: event.target.value }))} maxLength={10000} required /></label>
              <div className="variables-row"><strong>المتغيرات المتاحة</strong>{selected.variables.map((variable) => <button key={variable} type="button" className="chip" onClick={() => addVariable(variable)}>{`{{${variable}}}`}</button>)}</div>
              <div className="salla-email-logo-editor"><div className="salla-email-logo-preview">{logoUrl ? <img src={logoUrl} alt="شعار المتجر في المعاينة" /> : <DashboardIcon name="apps" />}</div><div><strong>صورة متجر موحدة للبريد</strong><p>نفس خيار العميل. الصورة المختارة هنا للمعاينة الإدارية فقط؛ كل متجر يحفظ شعاره الخاص عند الربط.</p><label className="btn btn-secondary">إضافة صورة المتجر<input type="file" accept="image/png,image/jpeg,image/webp" onChange={selectPreviewLogo} hidden /></label><small>PNG أو JPG أو WebP حقيقي، بحد أقصى 2 ميجابايت.</small></div></div>
            </section>}
            {channel === "whatsapp" && draft.whatsappImageEnabled ? <div className="salla-whatsapp-image-editor is-open" data-admin-salla-whatsapp-image-editor>
              <label className="btn btn-secondary">{imageBusy ? "جارٍ رفع الصورة..." : draft.whatsappImageUrl ? "استبدال صورة الرسالة" : "إضافة صورة الرسالة"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadWhatsAppImage} disabled={imageBusy} hidden /></label>
              <small>PNG أو JPG أو WebP، بحد أقصى 2 ميجابايت. تُحفظ الصورة لهذا القالب وتظهر أعلى النص في معاينة واتساب.</small>
            </div> : null}
            {selected.templateKey === "review_request" ? <section className="salla-special-settings"><div className="section-head"><div><h2>توقيت طلب التقييم</h2><p>تبدأ المهلة من وقت وصول الحالة المختارة من سلة.</p></div><DashboardIcon name="clock" /></div><div className="form-grid two salla-review-trigger-grid"><label className="field"><span>يتم إرسال رسالة طلب التقييم عند الحالة</span><select className="select" value={draft.reviewTriggerStatus} onChange={(event) => setDraft((current) => ({ ...current, reviewTriggerStatus: event.target.value }))}><option value="shipped">تم الشحن</option><option value="delivered">تم التوصيل</option><option value="completed">تم التنفيذ</option></select><small>اختر الحالة التي يبدأ عندها العد.</small></label><label className="field"><span>الإرسال بعد الحالة — بالساعات</span><input className="input" type="number" min="1" max="48" value={draft.reviewDelayHours} onChange={(event) => setDraft((current) => ({ ...current, reviewDelayHours: event.target.value }))} /><small>من ساعة واحدة حتى 48 ساعة.</small></label></div></section> : null}
            {selected.templateKey === "abandoned_cart" ? <section className="salla-special-settings"><label className="field"><span>الإرسال بعد ترك السلة — بالساعات</span><input className="input" type="number" min="1" max="48" value={draft.abandonedDelayHours} onChange={(event) => setDraft((current) => ({ ...current, abandonedDelayHours: event.target.value }))} /></label></section> : null}
            {selected.templateKey === "digital_product_delivery" ? <section className="salla-special-settings salla-digital-settings">
              <div className="section-head"><div><h2>صفحة تسليم المنتج الرقمي</h2><p>رابط آمن مستقل لكل طلب، مع ترتيب تلقائي للكود أو البريد وكلمة المرور.</p></div><DashboardIcon name="action" /></div>
              <label className="setting-line"><span><strong>إرفاق رابط التسليم الآمن</strong><small>عند إيقافه تظهر معاينة القناة فقط.</small></span><input type="checkbox" checked={draft.secureLinkEnabled} onChange={(event) => setDraft((current) => ({ ...current, secureLinkEnabled: event.target.checked }))} /></label>
              {draft.secureLinkEnabled ? <div className="salla-link-options" data-admin-salla-link-options>
                <div className="form-grid two"><label className="field"><span>عنوان صفحة الرابط</span><input className="input" maxLength={160} value={draft.linkPageTitle} onChange={(event) => setDraft((current) => ({ ...current, linkPageTitle: event.target.value }))} /></label><label className="field"><span>لون الصفحة</span><input className="input salla-theme-color" type="color" value={draft.themeColor} onChange={(event) => setDraft((current) => ({ ...current, themeColor: event.target.value }))} /></label></div>
                <label className="field"><span>محتوى صفحة الرابط</span><textarea className="textarea" maxLength={5000} value={draft.linkPageContent} onChange={(event) => setDraft((current) => ({ ...current, linkPageContent: event.target.value }))} /></label>
                <div className="salla-digital-branding"><div><strong>شعار صفحة الرابط</strong><small>للمعاينة الإدارية فقط؛ يحتفظ كل متجر بشعاره الخاص.</small></div><label className="btn btn-secondary">{logoUrl ? "تغيير شعار المعاينة" : "إضافة شعار للمعاينة"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={selectPreviewLogo} hidden /></label></div>
                <label className="field"><span>تصميم صفحة التسليم</span><select className="select" value={draft.deliveryPageDesign} onChange={(event) => setDraft((current) => ({ ...current, deliveryPageDesign: event.target.value }))}><option value="classic">كلاسيكي</option><option value="cards">بطاقات واضحة</option><option value="compact">مدمج وعملي</option></select></label>
                <label className="field salla-css-code-editor"><span>كود تصميم صفحة الرابط (CSS آمن) — اختياري</span><textarea className="textarea" dir="ltr" spellCheck={false} maxLength={4000} value={draft.deliveryPageCustomCss} onChange={(event) => setDraft((current) => ({ ...current, deliveryPageCustomCss: event.target.value }))} placeholder={"--salla-page-background: #f4fbf9;\n--salla-card-radius: 24px;\n--salla-button-radius: 12px;"} /><small>اختياري؛ اتركه فارغًا لاستخدام التصميم المحدد أعلاه. يمنع الروابط والأكواد التنفيذية تلقائيًا.</small></label>
                <label className="setting-line"><span><strong>إظهار العد التنازلي</strong><small>يظهر عند توفر مدة موثقة للمنتج.</small></span><input type="checkbox" checked={draft.showCountdown} onChange={(event) => setDraft((current) => ({ ...current, showCountdown: event.target.checked }))} /></label>
              </div> : null}
            </section> : null}
          </article>
          <div className="salla-editor-actions"><button className="btn btn-primary" type="submit" disabled={busy}><DashboardIcon name="save" /> {busy ? "جارٍ الحفظ..." : "حفظ التغييرات"}</button><button className="btn btn-secondary" type="button" onClick={() => setSelectedKey("")}><DashboardIcon name="arrow" /> العودة إلى القوالب</button></div>
        </form>
        <TemplatePreview item={selected} channel={channel} draft={draft} logoUrl={logoUrl} />
      </section>
    </>}
  </main>;
}
