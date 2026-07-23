"use client";

import { useEffect, useState } from "react";
import styles from "./AdminSetupForm.module.css";

const initialFields = { name: "", email: "", password: "", confirmPassword: "" };

function stateMessage(phase, message) {
  if (phase === "configured") return { title: "تم إعداد حساب المسؤول مسبقًا", text: "تم تعطيل رابط الإعداد، ولا يمكن إنشاء أدمن إضافي من هذه الصفحة.", tone: "success" };
  if (phase === "database_error") return { title: "تعذر الاتصال بقاعدة البيانات", text: "تعذر الاتصال بقاعدة البيانات، تحقق من إعداد DATABASE_URL", tone: "error" };
  if (phase === "invalid") return { title: "رابط الإعداد غير صالح", text: "افتح رابط الإعداد الكامل الذي يحتوي على مفتاح ADMIN_SETUP_TOKEN الصحيح.", tone: "error" };
  if (phase === "rate_limited") return { title: "محاولات كثيرة", text: message || "انتظر قليلًا ثم حاول فتح رابط الإعداد مجددًا.", tone: "warning" };
  return null;
}

export default function AdminSetupForm() {
  const [phase, setPhase] = useState("checking");
  const [setupToken, setSetupToken] = useState("");
  const [csrfToken, setCsrfToken] = useState("");
  const [fields, setFields] = useState(initialFields);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token") || "";
    let active = true;
    const statusUrl = token ? `/api/admin/setup/status?token=${encodeURIComponent(token)}` : "/api/admin/setup/status";
    fetch(statusUrl, { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => ({ response, data: await response.json().catch(() => ({})) }))
      .then(({ response, data }) => {
        if (!active) return;
        if (token) window.history.replaceState({}, "", "/admin/setup");
        if (response.status === 409 || data.state === "configured") setPhase("configured");
        else if (response.status === 503 || data.reason === "database_unavailable") setPhase("database_error");
        else if (response.status === 429) { setMessage(data.retryAfterSeconds ? `أعد المحاولة بعد ${data.retryAfterSeconds} ثانية.` : ""); setPhase("rate_limited"); }
        else if (!response.ok || data.state !== "ready" || !data.csrfToken) setPhase("invalid");
        else { setSetupToken(token); setCsrfToken(data.csrfToken); setPhase("ready"); }
      })
      .catch(() => active && setPhase("database_error"));
    return () => { active = false; };
  }, []);

  function updateField(event) {
    const { name, value } = event.target;
    setFields((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  }

  async function submit(event) {
    event.preventDefault();
    if (phase !== "ready") return;
    setErrors({});
    setMessage("");
    setPhase("submitting");
    try {
      const response = await fetch("/api/admin/setup/create", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Setup-Token": setupToken,
          "X-CSRF-Token": csrfToken
        },
        body: JSON.stringify(fields)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErrors(data.errors || {});
        setMessage(data.message || "تعذر إنشاء حساب المسؤول.");
        if (data.reason === "already_configured") setPhase("configured");
        else if (data.reason === "database_unavailable") setPhase("database_error");
        else if (data.reason === "invalid_setup_link" || data.reason === "csrf_failed") setPhase("invalid");
        else if (data.reason === "rate_limited") setPhase("rate_limited");
        else setPhase("ready");
        return;
      }
      setMessage("تم إنشاء حساب المسؤول بنجاح");
      setPhase("success");
      window.setTimeout(() => window.location.assign(data.redirectUrl || "/admin"), 900);
    } catch {
      setPhase("database_error");
    }
  }

  const status = stateMessage(phase, message);
  return (
    <main className={styles.page} dir="rtl">
      <span className={`${styles.decor} ${styles.decorTop}`} aria-hidden="true" />
      <span className={`${styles.decor} ${styles.decorBottom}`} aria-hidden="true" />
      <section className={styles.shell}>
        <div className={styles.brand}><img src="/assets/renewpilot-logo-horizontal.png" alt="Renvix" /></div>
        <span className={styles.badge}>إعداد آمن لمرة واحدة</span>
        <h1>إنشاء أول حساب مسؤول</h1>
        <p className={styles.lead}>أنشئ الحساب الإداري الأول للمنصة. يُغلق هذا الرابط تلقائيًا بعد نجاح العملية.</p>

        {phase === "checking" ? <section className={styles.card}><div className={styles.loader} /><strong>جارٍ التحقق من حالة الإعداد وقاعدة البيانات…</strong></section> : null}
        {status ? <section className={`${styles.card} ${styles[status.tone]}`} role={status.tone === "error" ? "alert" : "status"}><span className={styles.stateIcon}>{status.tone === "success" ? "✓" : status.tone === "warning" ? "!" : "×"}</span><h2>{status.title}</h2><p>{status.text}</p>{phase === "configured" ? <a href="/advanced-pro-control">الانتقال إلى تسجيل دخول الأدمن</a> : null}</section> : null}

        {["ready", "submitting", "success"].includes(phase) ? <form className={styles.card} onSubmit={submit} noValidate>
          {phase === "success" ? <div className={styles.successBanner} role="status">✓ {message}</div> : null}
          {message && phase === "ready" ? <div className={styles.formError} role="alert">{message}</div> : null}
          <div className={styles.fieldGrid}>
            <label><span>الاسم</span><input name="name" value={fields.name} onChange={updateField} autoComplete="name" placeholder="اسم المسؤول" disabled={phase !== "ready"} />{errors.name ? <small>{errors.name}</small> : null}</label>
            <label><span>البريد الإلكتروني</span><input name="email" type="email" value={fields.email} onChange={updateField} autoComplete="email" placeholder="admin@example.com" disabled={phase !== "ready"} />{errors.email ? <small>{errors.email}</small> : null}</label>
            <label><span>كلمة المرور</span><span className={styles.passwordField}><input name="password" type={showPassword ? "text" : "password"} value={fields.password} onChange={updateField} autoComplete="new-password" placeholder="12 خانة على الأقل" disabled={phase !== "ready"} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}>◉</button></span>{errors.password ? <small>{errors.password}</small> : null}</label>
            <label><span>تأكيد كلمة المرور</span><input name="confirmPassword" type={showPassword ? "text" : "password"} value={fields.confirmPassword} onChange={updateField} autoComplete="new-password" placeholder="أعد كتابة كلمة المرور" disabled={phase !== "ready"} />{errors.confirmPassword ? <small>{errors.confirmPassword}</small> : null}</label>
          </div>
          <div className={styles.passwordRules}><span>12 خانة على الأقل</span><span>حرف كبير وصغير</span><span>رقم ورمز خاص</span><span>دون كلمات متوقعة</span></div>
          <button className={styles.submit} type="submit" disabled={phase !== "ready"}>{phase === "submitting" ? "جارٍ إنشاء الحساب…" : phase === "success" ? "تم إنشاء الحساب" : "إنشاء حساب المسؤول"}</button>
          <p className={styles.securityNote}>لن تُحفظ كلمة المرور كنص صريح، ولن يظهر مفتاح الإعداد في الواجهة أو السجلات.</p>
        </form> : null}
      </section>
    </main>
  );
}
