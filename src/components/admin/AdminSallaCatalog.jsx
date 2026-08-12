"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { inspectCustomEmailHtml } from "../../lib/email/custom-email-html.js";
import { sallaPageCssVariables } from "../../data/sallaPageCss.js";
import {
  EMAIL_THEME_PALETTE,
  SALLA_EMAIL_DESIGN_IDS,
  SALLA_EMAIL_DESIGN_PRESETS,
  SALLA_TEMPLATE_PREVIEW_GUIDANCE,
  isSallaSecureLinkActive,
  sallaChannelReadiness
} from "../../data/sallaTemplateUi.js";
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
  return <span className="salla-email-store-logo is-empty"><DashboardIcon name="apps" /></span>;
}

function sallaEmailSampleCode(item) {
  const linkVariable = item.variables.find((variable) => /(?:url|link)$/.test(variable));
  return `<section style="padding:28px;background-color:#f4f9f8;border-radius:20px;text-align:right" dir="rtl">
  <h2 style="margin:0 0 14px;color:#062b28">تحديث جديد على طلبك</h2>
  <p style="margin:0 0 18px;line-height:1.9">مرحبًا {{customer_name}}، لدينا تحديث يخص ${item.variables.includes("order_number") ? "طلبك رقم {{order_number}}" : "طلبك"}.</p>${linkVariable ? `
  <a href="{{${linkVariable}}}" style="display:inline-block;padding:12px 22px;background-color:#0b3f3b;color:#ffffff;border-radius:10px;text-decoration:none">عرض التفاصيل</a>` : ""}
</section>`;
}

function EmailDesignBuilder({ item, draft, setDraft }) {
  const [validation, setValidation] = useState(null);
  const activePreset = SALLA_EMAIL_DESIGN_PRESETS.find((preset) => preset.id === draft.emailDesign) || SALLA_EMAIL_DESIGN_PRESETS[0];
  const usePreset = (design) => {
    setDraft((current) => ({ ...current, emailDesign: design, emailContentMode: "preset" }));
    setValidation(null);
  };
  const adoptHtml = () => {
    const inspection = inspectCustomEmailHtml(draft.emailHtmlContent || "");
    setValidation(inspection);
    if (inspection.ok) setDraft((current) => ({ ...current, emailHtmlContent: inspection.html, emailContentMode: "html" }));
  };
  const validationText = validation
    ? validation.ok
      ? validation.warnings[0] || "تم فحص الكود واعتماده كمصدر للمعاينة والإرسال."
      : validation.errors[0]
    : draft.emailContentMode === "html"
      ? "هذا الكود هو المصدر المعتمد للمعاينة والإرسال."
      : "الكود اختياري ولن يُستخدم حتى تضغط فحص واعتماد الكود.";

  return <section className="email-design-builder is-salla-catalog has-theme-control" data-email-design-builder>
    <input type="hidden" name="emailDesign" value={draft.emailDesign} readOnly />
    <input type="hidden" name="emailContentMode" value={draft.emailContentMode} readOnly />
    <div className="email-design-builder-head"><div><h3>قوالب بريد جاهزة</h3><p>اختر تصميمًا ثم اضغط اعتماد. لن يتغير المصدر النشط دون اعتمادك.</p></div><span className={`email-source-status ${draft.emailContentMode === "html" ? "is-code" : "is-preset"}`}>{draft.emailContentMode === "html" ? "الكود المعتمد" : `القالب المعتمد: ${activePreset.name}`}</span></div>
    <div className="email-design-workspace">
      <div className="email-design-presets">{SALLA_EMAIL_DESIGN_PRESETS.map((preset) => <article key={preset.id} className={`email-design-preset design-${preset.id} ${draft.emailContentMode === "preset" && preset.id === activePreset.id ? "is-active" : ""}`} data-email-design-card={preset.id}><div className="email-design-thumb"><i /><b /><span /><em /></div><strong>{preset.name}</strong><small>{preset.caption}</small><button className="btn btn-secondary" type="button" onClick={() => usePreset(preset.id)}>{draft.emailContentMode === "preset" && preset.id === activePreset.id ? "معتمد ✓" : "اعتماد القالب"}</button></article>)}</div>
      <div className="email-template-theme"><div><strong>تعديل لون القالب</strong><small>اختر لون الهوية أو استخدم منتقي اللون المخصص؛ يطبّق فورًا على العنوان والزر والتفاصيل البارزة.</small></div><div className="email-theme-palette">{EMAIL_THEME_PALETTE.map((color) => <button key={color} type="button" className={draft.emailThemeColor === color ? "active" : ""} style={{ "--email-palette": color }} aria-label={`اختيار لون القالب ${color}`} onClick={() => setDraft((current) => ({ ...current, emailThemeColor: color }))} />)}<label title="لون مخصص"><input type="color" name="emailThemeColor" value={draft.emailThemeColor} aria-label="لون قالب بريد مخصص" onChange={(event) => setDraft((current) => ({ ...current, emailThemeColor: event.target.value.toUpperCase() }))} /><span><DashboardIcon name="edit" /></span></label></div></div>
    </div>
    <details className="email-code-designer" open={draft.emailContentMode === "html"}><summary><span><DashboardIcon name="action" /> تصميم الرسالة بكود HTML <small>اختياري</small></span><b>فتح المحرر</b></summary><div className="email-code-designer-body"><label className="field"><span>كود محتوى البريد</span><textarea className="textarea email-html-editor" name="emailHtmlContent" dir="ltr" spellCheck={false} maxLength={30000} value={draft.emailHtmlContent} placeholder={sallaEmailSampleCode(item)} onChange={(event) => { setDraft((current) => ({ ...current, emailHtmlContent: event.target.value })); setValidation(null); }} /><small>محتوى HTML فقط. يتم فحص العناصر والروابط وCSS قبل الاعتماد والحفظ.</small></label><div className="email-code-actions"><button className="btn btn-primary" type="button" onClick={adoptHtml}>فحص واعتماد الكود</button><button className="btn btn-secondary" type="button" onClick={() => { setDraft((current) => ({ ...current, emailHtmlContent: sallaEmailSampleCode(item) })); setValidation(null); }}>إضافة نموذج احترافي</button></div><div className={`email-code-validation ${validation ? validation.ok ? "success" : "danger" : "neutral"}`}>{validationText}</div></div></details>
  </section>;
}

function TemplatePreview({ item, channel, draft, logoUrl }) {
  const isEmail = channel === "email";
  const isDigitalDelivery = item.templateKey === "digital_product_delivery";
  const activeContent = isEmail ? draft.emailTextContent : draft.whatsappContent;
  const customInspection = isEmail && draft.emailContentMode === "html" ? inspectCustomEmailHtml(draft.emailHtmlContent || "") : null;
  const previewBody = customInspection?.ok
    ? <div className="salla-preview-message" dangerouslySetInnerHTML={{ __html: customInspection.html }} />
    : <div className="salla-preview-message">{activeContent || "اكتب محتوى الرسالة ليظهر هنا."}</div>;
  const imageUrl = draft.whatsappImageUrl || logoUrl;
  const guidance = SALLA_TEMPLATE_PREVIEW_GUIDANCE[item.templateKey] || "راجع حالة التشغيل ومحتوى الرسالة قبل تفعيل الإرسال التلقائي.";
  return <aside className={`card salla-template-live-preview ${isDigitalDelivery ? "is-digital-delivery" : "has-important-note"}`} data-admin-salla-bounded-preview>
    <div className="salla-template-preview-sticky">
      <div className="section-head"><div><h2 data-salla-preview-title>{isEmail ? "معاينة البريد" : "معاينة واتساب"}</h2><p>معاينة موحدة وآمنة — لن يتم إرسال أي رسالة.</p></div><DashboardIcon name={isEmail ? "template" : "eye"} /></div>
      <div className="salla-template-preview-stack">
        <div className={isEmail ? `salla-email-preview design-${draft.emailDesign} ${customInspection?.ok ? "uses-custom-html" : ""}` : "salla-whatsapp-preview"} data-salla-preview-frame style={{ "--email-theme": draft.emailThemeColor }}>
          <div className="salla-whatsapp-preview-canvas" data-salla-preview-head="whatsapp" hidden={isEmail}>
            <div className="salla-whatsapp-phone-header"><span className="salla-whatsapp-phone-avatar">{logoUrl ? <img src={logoUrl} alt="شعار Renvix" /> : <strong>R</strong>}</span><div><strong>Renvix</strong><small>حساب أعمال</small></div><span className="salla-whatsapp-phone-more" aria-hidden="true">•••</span></div>
            <span className="salla-whatsapp-phone-day">اليوم</span>
            <div className="salla-whatsapp-bubble">{draft.whatsappImageEnabled && imageUrl ? <img className="salla-whatsapp-message-image" data-salla-whatsapp-image src={imageUrl} alt="صورة رسالة واتساب" /> : null}{!isEmail ? previewBody : null}<button type="button" tabIndex={-1} className="salla-preview-cta" hidden={!draft.buttonEnabled}><DashboardIcon name="action" /><span>{draft.buttonLabel || item.previewAction || "عرض التفاصيل"}</span></button><small>11:30 ص ✓✓</small></div>
            <div className="salla-whatsapp-phone-composer"><span>اكتب رسالة</span><DashboardIcon name="send" /></div>
          </div>
          <div className="salla-email-preview-canvas" data-salla-preview-head="email" hidden={!isEmail}>
            <div className="salla-email-preview-head">{logoUrl ? <span className="salla-email-store-logo"><img src={logoUrl} alt="شعار المتجر في المعاينة" /></span> : <SallaLogo />}<div><small>متجري</small><strong data-salla-email-subject>{draft.emailSubject || "عنوان الرسالة"}</strong></div></div>
            <div className="salla-email-hero"><DashboardIcon name="template" /><strong>{item.name}</strong></div>
            {isEmail ? previewBody : null}
            <button type="button" tabIndex={-1} className="salla-preview-cta primary" hidden={!draft.buttonEnabled}><span>{draft.buttonLabel || item.previewAction || "عرض التفاصيل"}</span></button>
            <footer>هذه رسالة آلية آمنة من متجرك</footer>
          </div>
        </div>
        {isDigitalDelivery ? <section key={`${draft.deliveryPageDesign}-${draft.themeColor}`} className={`salla-digital-link-preview design-${draft.deliveryPageDesign}`} data-salla-link-preview data-admin-salla-link-preview hidden={!draft.secureLinkEnabled} style={{ "--salla-link-theme": draft.themeColor, ...sallaPageCssVariables(draft.deliveryPageCustomCss) }}><div className="salla-digital-link-head">{logoUrl ? <img src={logoUrl} alt="شعار المتجر" /> : <DashboardIcon name="action" />}<div><small>الرابط الخاص بالطلب #10025</small><strong data-salla-link-title>{draft.linkPageTitle || "منتجاتك الرقمية جاهزة"}</strong></div></div><p data-salla-link-content>{draft.linkPageContent || "استخدم البيانات التالية للوصول إلى منتجك الرقمي بأمان."}</p><article><strong>المنتج الرقمي</strong><dl><div><dt>كود التفعيل</dt><dd>RVX-2026-DEMO</dd></div><div><dt>البريد</dt><dd>customer@example.com</dd></div><div><dt>كلمة المرور</dt><dd>••••••••••</dd></div></dl><a>فتح المنتج بأمان</a></article><div className="salla-digital-countdown" data-salla-link-countdown hidden={!draft.showDuration}>مدة المنتج <strong>30 يومًا</strong></div><small>تُرتب بيانات الكود أو البريد وكلمة المرور تلقائيًا حسب الحقل المعتمد في طلب سلة.</small></section> : null}
      </div>
      {!isDigitalDelivery ? <section className="salla-preview-important-note" role="note"><DashboardIcon name="info" /><div><strong>ملاحظة مهمة</strong><p><span data-salla-preview-channel-readiness>{sallaChannelReadiness(channel)}</span> {guidance}</p></div></section> : null}
    </div>
  </aside>;
}

export default function AdminSallaCatalog({ admin }) {
  const [items, setItems] = useState([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [channel, setChannel] = useState("whatsapp");
  const [draft, setDraft] = useState({ isEnabled: true, emailSubject: "", emailTextContent: "", emailHtmlContent: "", emailContentMode: "preset", emailThemeColor: "#0B3F3B", whatsappContent: "", buttonEnabled: true, buttonLabel: "", secureLinkEnabled: false, linkPageTitle: "", linkPageContent: "", showDuration: false, themeColor: "#0B3F3B", whatsappImageEnabled: false, whatsappImageUrl: "", emailDesign: "editorial", deliveryPageDesign: "classic", deliveryPageCustomCss: "", reviewTriggerStatus: "delivered", reviewDelayHours: 24, abandonedDelayHours: 1, stopOnConversion: true, showSubscriptionDuration: true });
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
    setChannel(item.channel === "email" ? "email" : "whatsapp");
    setDraft({
      isEnabled: item.isEnabled !== false,
      emailSubject: item.emailSubject || "",
      emailTextContent: item.emailTextContent || "",
      emailHtmlContent: item.emailHtmlContent || item.settings?.emailHtmlContent || "",
      emailContentMode: item.settings?.emailContentMode === "html" ? "html" : "preset",
      emailThemeColor: /^#[0-9A-F]{6}$/i.test(item.settings?.emailThemeColor || "") ? item.settings.emailThemeColor.toUpperCase() : "#0B3F3B",
      whatsappContent: item.whatsappContent || "",
      buttonEnabled: item.settings?.buttonEnabled !== false,
      buttonLabel: item.settings?.buttonLabel || item.previewAction || "عرض التفاصيل",
      secureLinkEnabled: isSallaSecureLinkActive(item.settings),
      linkPageTitle: item.settings?.linkPageTitle || "منتجاتك الرقمية جاهزة",
      linkPageContent: item.settings?.linkPageContent || "استخدم البيانات التالية للوصول إلى منتجك الرقمي بأمان.",
      showDuration: item.settings?.showDuration === true,
      themeColor: item.settings?.themeColor || item.settings?.branding?.themeColor || "#0B3F3B",
      whatsappImageEnabled: item.settings?.whatsappImageEnabled === true,
      whatsappImageUrl: item.settings?.whatsappImageUrl || "",
      emailDesign: SALLA_EMAIL_DESIGN_IDS.includes(item.settings?.emailDesign) ? item.settings.emailDesign : "editorial",
      deliveryPageDesign: item.settings?.deliveryPageDesign || "classic",
      deliveryPageCustomCss: item.settings?.deliveryPageCustomCss || "",
      reviewTriggerStatus: ["shipped", "delivered", "completed"].includes(item.settings?.reviewTriggerStatus) ? item.settings.reviewTriggerStatus : "delivered",
      reviewDelayHours: Math.min(48, Math.max(1, Math.round(Number(item.settings?.reviewDelayMinutes || 1440) / 60))),
      abandonedDelayHours: Math.min(48, Math.max(1, Math.round(Number(item.settings?.delaysMinutes?.[0] || 60) / 60))),
      stopOnConversion: item.settings?.stopOnConversion !== false,
      showSubscriptionDuration: item.settings?.showSubscriptionDuration !== false
    });
    setLogoUrl("");
    setNotice("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const save = async (event) => {
    event.preventDefault();
    if (!selected) return;
    if (channel === "email" && draft.emailContentMode === "html") {
      const inspection = inspectCustomEmailHtml(draft.emailHtmlContent || "");
      if (!inspection.ok) {
        setError(inspection.errors[0] || "تعذر اعتماد كود البريد الإلكتروني.");
        return;
      }
    }
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
          isEnabled: draft.isEnabled,
          subject: channel === "email" ? draft.emailSubject : null,
          body: channel === "email" ? draft.emailTextContent : draft.whatsappContent,
          settings: { buttonEnabled: draft.buttonEnabled, buttonLabel: draft.buttonLabel, secureLinkEnabled: draft.secureLinkEnabled, secureLinkOptIn: draft.secureLinkEnabled, linkPageTitle: draft.linkPageTitle, linkPageContent: draft.linkPageContent, showDuration: draft.showDuration, themeColor: draft.themeColor, whatsappImageEnabled: draft.whatsappImageEnabled, whatsappImageUrl: draft.whatsappImageEnabled && /^https:\/\//i.test(draft.whatsappImageUrl) ? draft.whatsappImageUrl : "", emailDesign: draft.emailDesign, emailContentMode: draft.emailContentMode, emailThemeColor: draft.emailThemeColor, emailHtmlContent: draft.emailHtmlContent, deliveryPageDesign: draft.deliveryPageDesign, deliveryPageCustomCss: draft.deliveryPageCustomCss, reviewTriggerStatus: draft.reviewTriggerStatus, reviewDelayMinutes: Math.min(48, Math.max(1, Number(draft.reviewDelayHours) || 24)) * 60, delaysMinutes: [Math.min(48, Math.max(1, Number(draft.abandonedDelayHours) || 1)) * 60], stopOnConversion: draft.stopOnConversion, completedDeliveryMode: "secure_order_page", showSubscriptionDuration: draft.showSubscriptionDuration }
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

  return <div className={`${styles.adminSallaWorkspace} dashboard-main`} dir="rtl">
    <div className="salla-template-editor-top">{selected ? <button className="btn btn-secondary" type="button" onClick={() => setSelectedKey("")}><DashboardIcon name="arrow" /> العودة إلى القوالب</button> : <a className="btn btn-secondary" href="/admin/integrations"><DashboardIcon name="arrow" /> العودة إلى التطبيقات</a>}</div>
    <div className="salla-templates-page-head">
      <div className="page-title">
        <div><h1>{selected ? selected.name : "قوالب سلة"}</h1><p className="muted">{selected ? selected.description : "إدارة قوالب رسائل الطلبات المرتبطة بمتجر سلة، بنفس الواجهة التي تظهر للمستخدم بعد الربط."}</p></div>
      </div>
      <span className="salla-chip">سلة</span>
    </div>

    {selected ? <>
      <p className="salla-template-updated-at">آخر تحديث: <strong>{selected.updatedAt ? new Date(selected.updatedAt).toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" }) : "—"}</strong></p>
      <section className="inline-notice info salla-template-editor-notice"><DashboardIcon name="info" /><span>سيؤثر الحفظ على الرسائل المستقبلية فقط. لا يتم إرسال أي رسالة من المعاينة.</span></section>
    </> : <section className="inline-notice info salla-templates-notice"><DashboardIcon name="info" /><span>كل تغيير محفوظ هنا يُطبّق كإعداد افتراضي على قوالب المستخدم عند ربط متجر سلة جديد، دون استبدال تخصيصات المتاجر المرتبطة سابقًا.</span></section>}
    <p className={styles.adminSallaAdminIdentity}>جلسة الأدمن: {admin.role}</p>
    {error ? <div className={styles.adminSallaError}>{error}</div> : null}

    {!selected ? <>
      {!items.length && !error ? <div className={styles.adminSallaLoading}>جارٍ تحميل القوالب...</div> : <section className="salla-templates-grid">{items.map((item) => <article key={item.templateKey} className={`card salla-template-card ${item.templateKey === "completed" ? "featured" : ""}`}>
        <div className="salla-template-card-head">
          <span className="salla-template-card-icon"><DashboardIcon name={templateIconName(item)} /></span>
          <div><span className="salla-chip">سلة</span><h2>{item.name}</h2></div>
        </div>
        <p>{item.description}</p>
        <div className="salla-template-card-meta">
          <span className={`status ${item.isEnabled ? "success" : "danger"}`}>{item.isEnabled ? "مفعّل" : "غير مفعّل"} <i /></span>
          <span className={`salla-channel-badge ${item.channel === "email" ? "email" : "whatsapp"}`} title="قناة الإرسال المعتمدة"><DashboardIcon name={item.channel === "email" ? "template" : "send"} /><strong>{item.channel === "email" ? "بريد" : "واتساب"}</strong></span>
        </div>
        <footer><small>آخر تحديث: {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString("ar-SA") : "—"}</small><div><button className="btn btn-secondary" type="button" onClick={() => openEditor(item)}><DashboardIcon name="eye" /> معاينة</button><button className="btn btn-secondary" type="button" onClick={() => openEditor(item)}><DashboardIcon name="template" /> تحرير</button></div></footer>
      </article>)}</section>}
    </> : <>
      <section className="message-activation-card card">
        <div className="message-activation-copy"><span className="message-activation-icon"><DashboardIcon name="send" /></span><span><strong>تفعيل رسالة {selected.name}</strong><small>تُحفظ حالة القالب وتظهر مباشرة على بطاقته الخارجية.</small></span></div>
        <div className="message-activation-control"><label className="message-activation-switch"><input type="checkbox" checked={draft.isEnabled} onChange={(event) => setDraft((current) => ({ ...current, isEnabled: event.target.checked }))} aria-label={`تفعيل رسالة ${selected.name}`} /><span /></label><span className="message-activation-status"><i /><b className="message-activation-status-on">مفعّل</b><b className="message-activation-status-off">غير مفعّل</b></span></div>
      </section>

      <form id="admin-salla-template-form" className="salla-template-editor-form" data-admin-salla-mirrors-user-editor onSubmit={save}>
        <div className="salla-template-editor-layout" data-admin-salla-editor-layout>
          <article className="card salla-template-form-card">
            <div className="section-head"><div><h2>بيانات القالب</h2><p>كل قناة تحتفظ بمحتواها المستقل، وتظهر المعاينة المطابقة فورًا.</p></div><DashboardIcon name="template" /></div>
            <div className="form-grid two"><label className="field"><span>اسم القالب</span><input className="input" value={selected.name} disabled /></label>{selected.templateKey !== "review_request" ? <label className="field"><span>حدث التشغيل</span><input className="input" value={selected.templateKey} disabled dir="ltr" /></label> : null}</div>
            <fieldset className="salla-channel-choice"><legend>قناة الإرسال</legend>
              <label className="salla-channel-option whatsapp"><input type="radio" name="channel" value="whatsapp" checked={channel === "whatsapp"} onChange={() => setChannel("whatsapp")} /><span><DashboardIcon name="send" /> واتساب</span></label>
              <label className="salla-channel-option email"><input type="radio" name="channel" value="email" checked={channel === "email"} onChange={() => setChannel("email")} /><span><DashboardIcon name="template" /> بريد إلكتروني</span></label>
            </fieldset>

            {channel === "whatsapp" ? <section className="salla-channel-panel" data-channel-panel="whatsapp">
              <label className="field"><span>قالب Meta المعتمد</span><select className="select" disabled><option>يختاره كل متجر مرتبط من قوالبه المعتمدة</option></select><small>لا يُفعّل الإرسال الفعلي قبل اختيار قالب Meta معتمد داخل حساب المتجر.</small></label>
              <label className="field"><span>محتوى رسالة واتساب</span><textarea className="textarea salla-template-message-editor" value={draft.whatsappContent} onChange={(event) => setDraft((current) => ({ ...current, whatsappContent: event.target.value }))} maxLength={10000} required /></label>
              <div className="variables-row"><strong>المتغيرات المتاحة</strong>{selected.variables.map((variable) => <button key={variable} type="button" className="chip" onClick={() => addVariable(variable)}>{`{{${variable}}}`}</button>)}</div>
              <div className="salla-action-settings"><label className="setting-line"><span><strong>إضافة صورة كاملة مع رسالة واتساب</strong><small>تُرسل الصورة مع النص، وتظهر فورًا في المعاينة.</small></span><input type="checkbox" checked={draft.whatsappImageEnabled} onChange={(event) => setDraft((current) => ({ ...current, whatsappImageEnabled: event.target.checked }))} /></label>{draft.whatsappImageEnabled ? <div className="salla-whatsapp-image-editor" data-admin-salla-whatsapp-image-editor><label className="btn btn-secondary">{imageBusy ? "جارٍ رفع الصورة..." : draft.whatsappImageUrl || logoUrl ? "استبدال صورة الرسالة" : "إضافة صورة الرسالة"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadWhatsAppImage} disabled={imageBusy} hidden /></label><small>PNG أو JPG أو WebP، بحد أقصى 2 ميجابايت. تُحفظ الصورة مع هذا القالب وتظهر في معاينته.</small></div> : null}<label className="setting-line"><span><strong>تفعيل زر الإجراء</strong><small>أظهر زرًا واضحًا داخل الرسالة، ويمكن إيقافه دون حذف النص المحفوظ.</small></span><input type="checkbox" checked={draft.buttonEnabled} onChange={(event) => setDraft((current) => ({ ...current, buttonEnabled: event.target.checked }))} /></label><label className="field"><span>نص زر الإجراء</span><input className="input" maxLength={80} value={draft.buttonLabel} placeholder="مثال: عرض تفاصيل الطلب" onChange={(event) => setDraft((current) => ({ ...current, buttonLabel: event.target.value }))} /></label></div>
            </section> : <section className="salla-channel-panel salla-email-builder-panel" data-channel-panel="email">
              <div className="section-head"><div><h2>إعدادات البريد الإلكتروني</h2><p>خصص عنوان الرسالة وصورة المتجر، ثم اختر تصميم البريد أسفل الصورة.</p></div><DashboardIcon name="template" /></div>
              <label className="field"><span>عنوان البريد</span><input className="input" value={draft.emailSubject} onChange={(event) => setDraft((current) => ({ ...current, emailSubject: event.target.value }))} maxLength={300} placeholder="تحديث طلبك رقم {{order_number}}" required /></label>
              <div className="salla-email-logo-editor" data-admin-salla-email-image-section><div className="salla-email-logo-preview">{logoUrl ? <img src={logoUrl} alt="شعار المتجر الحالي" /> : <DashboardIcon name="apps" />}</div><div><strong>صورة متجر موحدة للبريد</strong><p>تظهر صورة متجرك داخل المعاينة الموحدة وتُستخدم بأمان في رسائل بريد قوالب سلة.</p><label className="btn btn-secondary">{logoUrl ? "استبدال الصورة" : "إضافة صورة المتجر"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={selectPreviewLogo} hidden /></label><small>PNG أو JPG أو WebP حقيقي، بحد أقصى 2 ميجابايت.</small></div></div>
              <section className="salla-email-design-section" data-admin-salla-email-design-section><div className="section-head"><div><h2>تصميم البريد</h2><p>اختر أحد التصاميم الاحترافية أو اعتمد كود HTML، ثم خصص لون القالب.</p></div><DashboardIcon name="template" /></div><EmailDesignBuilder item={selected} draft={draft} setDraft={setDraft} /></section>
              <div className="email-fallback-editor"><label className="field"><span>النسخة النصية البديلة</span><textarea className="textarea salla-template-message-editor" value={draft.emailTextContent} onChange={(event) => setDraft((current) => ({ ...current, emailTextContent: event.target.value }))} maxLength={10000} required /><small>تُستخدم عند تعذر عرض HTML وتضمن وصول محتوى الرسالة لكل برامج البريد.</small></label><div className="variables-row"><strong>المتغيرات المتاحة</strong>{selected.variables.map((variable) => <button key={variable} type="button" className="chip" onClick={() => addVariable(variable)}>{`{{${variable}}}`}</button>)}</div></div>
            </section>}
            {selected.templateKey === "review_request" ? <section className="salla-special-settings"><div className="section-head"><div><h2>توقيت طلب التقييم</h2><p>يُلغى الطلب المؤجل تلقائيًا إذا ألغي الطلب أو بدأ استرجاعه.</p></div><DashboardIcon name="clock" /></div><div className="form-grid two salla-review-trigger-grid"><label className="field"><span>يتم إرسال رسالة طلب التقييم عند الحالة</span><select className="select" value={draft.reviewTriggerStatus} onChange={(event) => setDraft((current) => ({ ...current, reviewTriggerStatus: event.target.value }))}><option value="shipped">تم الشحن</option><option value="delivered">تم التوصيل</option><option value="completed">تم التنفيذ</option></select><small>تبدأ المهلة عند وصول الحالة المختارة من سلة.</small></label><label className="field"><span>الإرسال بعد الحالة — بالساعات</span><input className="input" type="number" min="1" max="48" value={draft.reviewDelayHours} onChange={(event) => setDraft((current) => ({ ...current, reviewDelayHours: event.target.value }))} /><small>من ساعة واحدة حتى 48 ساعة.</small></label></div></section> : null}
            {selected.templateKey === "abandoned_cart" ? <section className="salla-special-settings"><div className="section-head"><div><h2>إعدادات التذكير</h2><p>يُلغى التذكير تلقائيًا فور إتمام الشراء.</p></div><DashboardIcon name="clock" /></div><label className="field"><span>الإرسال بعد ترك السلة — بالساعات</span><input className="input" type="number" min="1" max="48" value={draft.abandonedDelayHours} onChange={(event) => setDraft((current) => ({ ...current, abandonedDelayHours: event.target.value }))} /><small>من ساعة واحدة حتى 48 ساعة.</small></label><label className="setting-line"><span><strong>إيقاف التذكير عند إتمام الشراء</strong><small>يمنع إرسال أي رسالة مؤجلة بعد التحويل إلى طلب.</small></span><input type="checkbox" checked={draft.stopOnConversion} onChange={(event) => setDraft((current) => ({ ...current, stopOnConversion: event.target.checked }))} /></label></section> : null}
            {selected.templateKey === "completed" ? <section className="salla-special-settings"><div className="section-head"><div><h2>رابط معلومات الطلب</h2><p>يتم إنشاء رابط سري مستقل للطلب، وتظهر رسالة واتساب ومعها زر فتح الصفحة.</p></div><DashboardIcon name="action" /></div><label className="setting-line"><span><strong>إظهار مدة الاشتراك</strong><small>تُحسب لحظيًا من بيانات الاشتراك الحقيقية عند فتح الرابط.</small></span><input type="checkbox" checked={draft.showSubscriptionDuration} onChange={(event) => setDraft((current) => ({ ...current, showSubscriptionDuration: event.target.checked }))} /></label></section> : null}
            {selected.templateKey === "salla_invoice_ready" ? <section className="salla-special-settings"><div className="section-head"><div><h2>رابط الفاتورة الآمن</h2><p>محتوى الرسالة والمعاينة يعرضان رابطًا فقط؛ وتُقرأ بيانات الفاتورة الحقيقية من سلة داخل الصفحة الآمنة.</p></div><DashboardIcon name="action" /></div></section> : null}
            {selected.templateKey === "digital_product_delivery" ? <section className="salla-special-settings salla-digital-settings">
              <div className="section-head"><div><h2>صفحة تسليم المنتج الرقمي</h2><p>يُنشأ رابط سري مستقل لكل طلب من الحقل المعتمد في سلة، ولا تُرسل الأسرار داخل الرسالة.</p></div><DashboardIcon name="action" /></div>
              <label className="setting-line"><span><strong>إرفاق رابط التسليم الآمن</strong><small>عند إيقافه تظهر معاينة القناة فقط.</small></span><input type="checkbox" checked={draft.secureLinkEnabled} onChange={(event) => setDraft((current) => ({ ...current, secureLinkEnabled: event.target.checked }))} /></label>
              {draft.secureLinkEnabled ? <div className="salla-link-options" data-admin-salla-link-options>
                <div className="salla-link-options-title"><strong>خيارات الرابط</strong><small>خصص تصميم صفحة التسليم ومحتواها لهذا القالب فقط.</small></div>
                <div className="form-grid two"><label className="field"><span>عنوان صفحة الرابط</span><input className="input" maxLength={160} value={draft.linkPageTitle} onChange={(event) => setDraft((current) => ({ ...current, linkPageTitle: event.target.value }))} /></label><label className="field"><span>لون الصفحة</span><input className="input salla-theme-color" type="color" value={draft.themeColor} onChange={(event) => setDraft((current) => ({ ...current, themeColor: event.target.value }))} /></label></div>
                <label className="field"><span>محتوى صفحة الرابط</span><textarea className="textarea" maxLength={5000} value={draft.linkPageContent} onChange={(event) => setDraft((current) => ({ ...current, linkPageContent: event.target.value }))} /></label>
                <div className="salla-digital-branding"><div><strong>شعار صفحة الرابط</strong><small>يُستخدم شعار المتجر المحفوظ نفسه داخل البريد وصفحة التسليم الآمنة.</small></div><label className="btn btn-secondary">{logoUrl ? "تغيير الشعار" : "إضافة شعار المتجر"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={selectPreviewLogo} hidden /></label></div>
                <label className="field"><span>تصميم صفحة التسليم</span><select className="select" value={draft.deliveryPageDesign} onChange={(event) => setDraft((current) => ({ ...current, deliveryPageDesign: event.target.value }))}><option value="classic">كلاسيكي</option><option value="cards">بطاقات واضحة</option><option value="compact">مدمج وعملي</option></select></label>
                <label className="field salla-css-code-editor"><span>كود تصميم صفحة الرابط (CSS آمن) — اختياري</span><textarea className="textarea" dir="ltr" spellCheck={false} maxLength={4000} value={draft.deliveryPageCustomCss} onChange={(event) => setDraft((current) => ({ ...current, deliveryPageCustomCss: event.target.value }))} placeholder={"--salla-page-background: #f4fbf9;\n--salla-card-radius: 24px;\n--salla-button-radius: 12px;"} /><small>اختياري؛ اتركه فارغًا لاستخدام التصميم المحدد أعلاه. يسمح بمتغيرات التصميم المعتمدة فقط ويمنع الروابط والأكواد التنفيذية تلقائيًا.</small></label>
                <label className="setting-line"><span><strong>عرض مدة المنتج</strong><small>تظهر فقط عند وجود مدة صريحة وموثقة في بيانات المنتج أو حقل التسليم.</small></span><input type="checkbox" checked={draft.showDuration} onChange={(event) => setDraft((current) => ({ ...current, showDuration: event.target.checked }))} /></label>
              </div> : null}
            </section> : null}
          </article>
          <TemplatePreview item={selected} channel={channel} draft={draft} logoUrl={logoUrl} />
        </div>
        <div className="salla-editor-action-area"><div className="salla-editor-actions"><button className="btn btn-primary" type="submit" disabled={busy}><DashboardIcon name="save" /> {busy ? "جارٍ الحفظ..." : "حفظ التغييرات"}</button><button className="btn btn-secondary" type="button" onClick={() => setNotice("المعاينة محدثة لحظيًا بنفس بيانات النموذج.")}><DashboardIcon name="eye" /> تحديث المعاينة</button><button className="btn btn-secondary" type="button" onClick={() => setNotice("الإرسال الاختباري يتم من حساب متجر مرتبط؛ معاينة الأدمن لا ترسل رسائل.")}><DashboardIcon name="action" /> إرسال اختبار</button></div>{notice ? <div className="salla-editor-save-notice" role="status" aria-live="polite"><span aria-hidden="true">✓</span><strong>{notice}</strong></div> : null}</div>
      </form>
    </>}
  </div>;
}
