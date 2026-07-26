"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./AdminPortal.module.css";

const LABELS = {
  customer_name: "اسم العميل",
  customer_email: "البريد الإلكتروني",
  temporary_password: "كلمة المرور المؤقتة",
  login_url: "رابط تسجيل الدخول",
  plan_name: "الباقة",
  subscription_expiry: "تاريخ انتهاء الاشتراك",
  support_url: "رابط الدعم",
  store_name: "اسم المتجر",
  old_expiry: "تاريخ الانتهاء السابق",
  new_expiry: "تاريخ الانتهاء الجديد",
  disconnected_phone: "الرقم المفصول",
  disconnect_reason: "سبب الفصل",
  disconnected_at: "تاريخ الفصل",
  reconnect_url: "رابط إعادة الربط",
  store_domain: "نطاق المتجر",
  connected_at: "تاريخ الربط",
  dashboard_url: "رابط لوحة التحكم",
  integration_settings_url: "إعدادات التكامل"
};

function channelLabel(value) {
  return value === "email" ? "البريد الإلكتروني — Resend" : "واتساب — Evolution Admin";
}

function previewValues(variables = []) {
  return Object.fromEntries(variables.map((variable) => [
    variable,
    variable === "temporary_password" ? "••••••••••••" : `{{${variable}}}`
  ]));
}

function TemplatePreview({ template, rendered }) {
  const body = rendered?.body || template.body || "";
  if (template.channel === "email") {
    return <div className={styles.adminEmailPreview}>
      <img src="/assets/renewpilot-logo-horizontal.webp" width="1165" height="342" alt="Renvix" />
      <div className={styles.adminEmailLine} />
      <h3>{rendered?.subject || template.subject || template.name}</h3>
      <div className={styles.adminEmailBody}>{body}</div>
      <button type="button">فتح لوحة Renvix</button>
      <small>هذه معاينة آمنة. كلمة المرور المؤقتة لا تظهر كنص صريح.</small>
    </div>;
  }
  return <div className={styles.adminPhoneFrame}>
    <div className={styles.adminPhoneTop}><span>9:41</span><b>Renvix ✓</b><span>•••</span></div>
    <div className={styles.adminWhatsAppBody}><div className={styles.adminWhatsAppBubble}>{body}<small>11:21 ✓✓</small></div></div>
  </div>;
}

export default function AdminTemplateEditor({ templateKey, admin }) {
  const [template, setTemplate] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", subject: "", body: "", isActive: true });
  const [rendered, setRendered] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [previewMode, setPreviewMode] = useState("variables");
  const [samples, setSamples] = useState([]);
  const [sampleId, setSampleId] = useState("");
  const [testRecipient, setTestRecipient] = useState("");
  const [testOpen, setTestOpen] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/templates", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    const row = payload.templates?.find((item) => item.templateKey === templateKey);
    if (!response.ok || !row) throw new Error("تعذر تحميل القالب.");
    setTemplate(row);
    setForm({ name: row.name, description: row.description || "", subject: row.subject || "", body: row.body, isActive: row.isActive });
    const sampleResponse = await fetch(`/api/admin/templates/${templateKey}/samples`, { cache: "no-store" });
    const samplePayload = await sampleResponse.json().catch(() => ({}));
    if (sampleResponse.ok) {
      setSamples(samplePayload.samples || []);
      setSampleId(samplePayload.samples?.[0]?.id || "");
    }
  }, [templateKey]);

  useEffect(() => {
    load().catch((loadError) => setError(loadError.message));
  }, [load]);

  const values = useMemo(() => {
    if (previewMode === "real") return samples.find((sample) => sample.id === sampleId)?.values || {};
    return previewValues(template?.allowedVariables || []);
  }, [template, previewMode, samples, sampleId]);

  const preview = useCallback(async () => {
    if (!template) return;
    setError("");
    const response = await fetch(`/api/admin/templates/${templateKey}/preview`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values, subject: form.subject || null, body: form.body })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.variables?.length ? `تحقق من المتغيرات: ${payload.variables.join("، ")}` : "تعذر إنشاء المعاينة.");
    setRendered(payload.rendered);
  }, [template, templateKey, values, form.subject, form.body]);

  useEffect(() => {
    if (!template) return;
    const timer = setTimeout(() => preview().catch((previewError) => setError(previewError.message)), 350);
    return () => clearTimeout(timer);
  }, [template, form.body, form.subject, preview]);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setTemplate((current) => current ? { ...current, [key]: value } : current);
  }

  function insertVariable(variable) {
    update("body", `${form.body}${form.body.endsWith("\n") || !form.body ? "" : " "}{{${variable}}}`);
  }

  async function save() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/templates/${templateKey}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.variables?.length ? `راجع المتغيرات: ${payload.variables.join("، ")}` : "تعذر حفظ القالب.");
      setTemplate(payload.template);
      setForm({ name: payload.template.name, description: payload.template.description || "", subject: payload.template.subject || "", body: payload.template.body, isActive: payload.template.isActive });
      setNotice(payload.message || "تم حفظ التعديلات.");
      await preview();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    if (!testRecipient.trim()) {
      setError(template.channel === "email" ? "أدخل بريد الاختبار." : "أدخل رقم الاختبار بالصيغة الدولية.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/templates/${templateKey}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: testRecipient.trim(), values })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (payload.reason === "invalid_email") throw new Error("بريد الاختبار غير صالح.");
        if (payload.reason === "invalid_phone") throw new Error("رقم الاختبار غير صالح. استخدم الصيغة الدولية مثل +9665XXXXXXXX.");
        if (payload.reason === "ADMIN_EVOLUTION_CHANNEL_MISSING") throw new Error("قناة Evolution Admin غير متصلة.");
        if (payload.reason === "ADMIN_TEMPLATE_DISABLED") throw new Error("فعّل القالب قبل إرسال اختبار.");
        throw new Error(payload.variables?.length ? `تحقق من القيم: ${payload.variables.join("، ")}` : "تعذر إرسال رسالة الاختبار.");
      }
      setNotice(payload.message || "تم قبول رسالة الاختبار.");
      setTestOpen(false);
    } catch (testError) {
      setError(testError.message);
    } finally {
      setBusy(false);
    }
  }

  if (!template) return <main className={styles.adminTemplateEditorPage} dir="rtl"><div className={styles.loading}>{error || "جارٍ تحميل القالب..."}</div></main>;

  return <main className={styles.adminTemplateEditorPage} dir="rtl">
    <header className={styles.adminEditorTopbar}>
      <a href="/admin/templates"><img src="/assets/renewpilot-logo-horizontal.webp" width="1165" height="342" alt="Renvix" /></a>
      <div><span>{admin.name || admin.email}</span><a href="/admin/templates">العودة إلى القوالب ←</a></div>
    </header>
    <section className={styles.adminEditorHeading}>
      <div><span>{channelLabel(template.channel)}</span><h1>{template.name}</h1><p>{template.description}</p></div>
      <div><b>{template.isSystemTemplate ? "قالب نظام ثابت" : "قالب مخصص"}</b><small>الإصدار {template.version}</small></div>
    </section>
    {notice ? <div className={styles.adminSuccessMessage}>{notice}</div> : null}
    {error ? <div className={styles.adminErrorMessage}>{error}</div> : null}
    <section className={styles.adminTemplateEditorGrid}>
      <article className={styles.adminTemplateEditCard}>
        <div className={styles.adminTemplateMetaGrid}>
          <label><span>اسم القالب</span><input value={form.name} onChange={(event) => update("name", event.target.value)} /></label>
          <label><span>قناة الإرسال</span><input value={channelLabel(template.channel)} readOnly /></label>
          <label><span>الحالة</span><button type="button" className={`${styles.adminToggle} ${form.isActive ? styles.adminToggleActive : ""}`} onClick={() => update("isActive", !form.isActive)}><i />{form.isActive ? "نشط" : "معطل"}</button></label>
        </div>
        <label className={styles.adminEditorField}><span>وصف القالب</span><input value={form.description} onChange={(event) => update("description", event.target.value)} /></label>
        {template.channel === "email" ? <label className={styles.adminEditorField}><span>عنوان البريد</span><input value={form.subject} onChange={(event) => update("subject", event.target.value)} /></label> : null}
        <div className={styles.adminRichToolbar}><button type="button">↶</button><button type="button">↷</button><b>B</b><i>I</i><u>U</u><span>☷</span><span>≡</span><span>🔗</span><span>متغيرات {"{}"}</span></div>
        <label className={styles.adminEditorField}><span>محتوى الرسالة</span><textarea value={form.body} onChange={(event) => update("body", event.target.value)} /></label>
        <div className={styles.adminVariablePanel}><div><strong>المتغيرات المتاحة</strong><small>انقر لإضافة المتغير إلى المحتوى. لا يمكن استخدام متغير غير معتمد.</small></div><div>{template.allowedVariables.map((variable) => <button key={variable} type="button" onClick={() => insertVariable(variable)}><b>{`{{${variable}}}`}</b><span>{LABELS[variable] || variable}</span></button>)}</div></div>
        <div className={styles.adminTemplateSecurityNote}>تُستخدم القناة الإدارية فقط لهذا القالب. لا تُعرض مفاتيح المزود، ولا تُسجل كلمة المرور المؤقتة في السجلات أو المعاينة.</div>
        <div className={styles.adminEditorActions}><button disabled={busy} className={styles.adminPrimaryButton} onClick={save}>حفظ التعديلات</button><button disabled={busy} className={styles.adminOutlineButton} onClick={() => preview().catch((previewError) => setError(previewError.message))}>معاينة</button></div>
      </article>
      <aside className={styles.adminTemplatePreviewCard}>
        <div><h2>معاينة الرسالة</h2><span>{channelLabel(template.channel)}</span></div>
        <div className={styles.adminPreviewModes}>
          <button type="button" className={previewMode === "variables" ? styles.adminPreviewModeActive : ""} onClick={() => setPreviewMode("variables")}>معاينة المتغيرات</button>
          <button type="button" className={previewMode === "real" ? styles.adminPreviewModeActive : ""} onClick={() => setPreviewMode("real")} disabled={!samples.length}>معاينة بيانات حقيقية</button>
        </div>
        {previewMode === "real" ? (
          samples.length ? <label className={styles.adminPreviewSample}>
            <span>اختر سجلًا حقيقيًا</span>
            <select value={sampleId} onChange={(event) => setSampleId(event.target.value)}>
              {samples.map((sample) => <option key={sample.id} value={sample.id}>{sample.label}</option>)}
            </select>
          </label> : <p className={styles.adminPreviewEmpty}>لا توجد سجلات حقيقية مناسبة للمعاينة حتى الآن.</p>
        ) : null}
        <TemplatePreview template={{ ...template, ...form }} rendered={rendered} />
        <button
          type="button"
          className={styles.adminOpenTestButton}
          disabled={busy || !form.isActive}
          onClick={() => setTestOpen(true)}
        >
          إرسال رسالة اختبار
        </button>
        <p>المعاينة تستخدم محرّك العرض نفسه المستخدم عند الإرسال. تظهر القيم كمتغيرات، وتُحجب البيانات الحساسة.</p>
      </aside>
    </section>
    {testOpen ? <div className={styles.adminTestModalBackdrop} role="presentation" onMouseDown={() => !busy && setTestOpen(false)}>
      <section className={styles.adminTestModal} role="dialog" aria-modal="true" aria-labelledby="admin-test-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><h2 id="admin-test-title">إرسال رسالة اختبار</h2><p>لن تُربط هذه الرسالة بحدث عميل، وستظهر في السجل بشارة «اختبار».</p></div>
          <button type="button" aria-label="إغلاق" disabled={busy} onClick={() => setTestOpen(false)}>×</button>
        </header>
        <dl>
          <div><dt>القناة</dt><dd>{channelLabel(template.channel)}</dd></div>
          <div><dt>بيانات المعاينة</dt><dd>{previewMode === "real" ? samples.find((sample) => sample.id === sampleId)?.label || "لا يوجد سجل" : "المتغيرات دون بيانات وهمية"}</dd></div>
        </dl>
        <label>
          <span>{template.channel === "email" ? "بريد الاختبار" : "رقم الاختبار بالصيغة الدولية"}</span>
          <input
            autoFocus
            value={testRecipient}
            onChange={(event) => setTestRecipient(event.target.value)}
            type={template.channel === "email" ? "email" : "tel"}
            dir="ltr"
            placeholder={template.channel === "email" ? "name@example.com" : "+9665XXXXXXXX"}
          />
        </label>
        <div className={styles.adminTestFinalPreview}>
          <strong>المحتوى النهائي</strong>
          {rendered?.subject ? <b>{rendered.subject}</b> : null}
          <pre>{rendered?.body || form.body}</pre>
        </div>
        <footer>
          <button type="button" className={styles.adminPrimaryButton} disabled={busy} onClick={sendTest}>{busy ? "جارٍ الإرسال..." : "تأكيد وإرسال الاختبار"}</button>
          <button type="button" className={styles.adminOutlineButton} disabled={busy} onClick={() => setTestOpen(false)}>إلغاء</button>
        </footer>
      </section>
    </div> : null}
  </main>;
}
