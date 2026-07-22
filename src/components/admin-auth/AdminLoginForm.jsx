"use client";

import { useEffect, useState } from "react";
import styles from "../admin/AdminPortal.module.css";

export default function AdminLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast || toast.persistent) return undefined;
    const timer = window.setTimeout(() => setToast(null), toast.type === "error" ? 6000 : toast.type === "warning" ? 5200 : 3800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function showToast(type, title, description, persistent = false) {
    setToast({ type, title, description, persistent });
  }

  async function submit(event) {
    event.preventDefault();
    setFieldErrors({});
    if (!email.trim() && !password) {
      setFieldErrors({ email: ["يرجى إدخال البريد الإلكتروني."], password: ["يرجى إدخال كلمة المرور."] });
      showToast("warning", "أكمل البيانات المطلوبة", "أدخل البريد الإلكتروني وكلمة المرور.");
      return;
    }
    if (!email.trim()) {
      setFieldErrors({ email: ["يرجى إدخال البريد الإلكتروني."] });
      showToast("warning", "يرجى إدخال البريد الإلكتروني", "أدخل بريد حساب الأدمن لإكمال الدخول.");
      return;
    }
    if (!password) {
      setFieldErrors({ password: ["يرجى إدخال كلمة المرور."] });
      showToast("warning", "يرجى إدخال كلمة المرور", "أدخل كلمة مرور حساب الأدمن لإكمال الدخول.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFieldErrors(data.errors || {});
        if (data.reason === "rate_limited") showToast("warning", "تم إيقاف محاولات الدخول مؤقتًا", "تم رصد محاولات دخول متكررة. حاول مجددًا بعد 15 دقيقة.");
        else if (data.reason === "admin_disabled") showToast("error", "الحساب غير متاح", "تم تعطيل هذا الحساب. تواصل مع المسؤول الأعلى.");
        else if (data.reason === "admin_expired") showToast("warning", "انتهت صلاحية حساب الأدمن", "اطلب إنشاء حساب مؤقت جديد من المسؤول الأعلى.");
        else if (data.reason === "mfa_required") showToast("info", "مطلوب رمز التحقق الثنائي", "أدخل الرمز من تطبيق المصادقة لإكمال تسجيل الدخول.");
        else showToast("error", "تعذر الوصول إلى لوحة الأدمن", "بيانات الدخول غير صحيحة أو لا تملك صلاحية الوصول.");
        return;
      }
      showToast("success", "تم تسجيل دخول الأدمن بنجاح", "تم التحقق من صلاحياتك، جاري فتح مركز التحكم.");
      window.setTimeout(() => window.location.assign(data.redirectUrl || "/admin"), 850);
    } catch {
      showToast("error", "تعذر الاتصال بالخادم", "تحقق من اتصالك بالإنترنت ثم حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.loginCard}>
      <form onSubmit={submit} noValidate>
        <label>
          البريد الإلكتروني
          <span className={styles.inputShell}>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" placeholder="أدخل بريدك الإلكتروني أو اسم المستخدم" aria-invalid={Boolean(fieldErrors.email)} />
            <span className={styles.fieldIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></svg></span>
          </span>
          {fieldErrors.email?.[0] ? <small className={styles.fieldError}>{fieldErrors.email[0]}</small> : null}
        </label>
        <label>
          كلمة المرور
          <span className={`${styles.passwordField} ${styles.inputShell}`}>
            <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="أدخل كلمة المرور" aria-invalid={Boolean(fieldErrors.password)} />
            <span className={styles.fieldIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg></span>
            <button type="button" className={styles.eyeButton} onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></svg></button>
          </span>
          {fieldErrors.password?.[0] ? <small className={styles.fieldError}>{fieldErrors.password[0]}</small> : null}
        </label>
        <div className={styles.loginOptions}>
          <label className={styles.rememberRow}><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} /> <span>تذكرني على هذا الجهاز</span></label>
          <a href="/advanced-pro-control/forgot-password">نسيت كلمة المرور؟</a>
        </div>
        <button className={styles.primaryButton} type="submit" disabled={busy}>{busy ? "جارٍ التحقق..." : "دخول إلى لوحة الأدمن"} <span aria-hidden="true">↲</span></button>
      </form>
      <div className={styles.adminOnlyNote}><span aria-hidden="true">⌾</span> هذه الصفحة مخصصة للمشرفين فقط</div>
      {toast ? <div className={`${styles.adminToast} ${styles[toast.type]}`} role={["error", "warning"].includes(toast.type) ? "alert" : "status"} aria-live={["error", "warning"].includes(toast.type) ? "assertive" : "polite"}>
        <span className={styles.adminToastIcon}>{toast.type === "success" ? "✓" : toast.type === "info" ? "i" : "!"}</span>
        <span><strong>{toast.title}</strong><small>{toast.description}</small></span>
        <button type="button" onClick={() => setToast(null)} aria-label="إغلاق التنبيه">×</button>
      </div> : null}
    </div>
  );
}
