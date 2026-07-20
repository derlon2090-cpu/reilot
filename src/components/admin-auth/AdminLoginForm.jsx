"use client";

import { useState } from "react";
import styles from "../admin/AdminPortal.module.css";

export default function AdminLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setFieldErrors({});
    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFieldErrors(data.errors || {});
        setError(data.message || (data.reason === "rate_limited"
          ? "تم تجاوز عدد محاولات الدخول. حاول مرة أخرى لاحقًا."
          : "بيانات الدخول غير صحيحة أو لا تملك صلاحية الوصول إلى لوحة الأدمن."));
        return;
      }
      window.location.assign(data.redirectUrl || "/admin");
    } catch {
      setError("تعذر تسجيل الدخول حاليًا. حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.loginCard}>
      <span className={styles.controlBadge}>منطقة إدارة خاصة</span>
      <div className={styles.loginIcon}><img src="/assets/renvix-mark.png" alt="" /></div>
      <h2>دخول الأدمن</h2>
      <p>هذه الصفحة مخصصة لإدارة منصة Renvix فقط، ولا تظهر في واجهة العملاء.</p>
      <form onSubmit={submit} noValidate>
        <label>
          البريد الإلكتروني
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" aria-invalid={Boolean(fieldErrors.email)} />
          {fieldErrors.email?.[0] ? <small className={styles.fieldError}>{fieldErrors.email[0]}</small> : null}
        </label>
        <label>
          كلمة المرور
          <span className={styles.passwordField}>
            <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" aria-invalid={Boolean(fieldErrors.password)} />
            <button type="button" className={styles.eyeButton} onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}>{showPassword ? "إخفاء" : "إظهار"}</button>
          </span>
          {fieldErrors.password?.[0] ? <small className={styles.fieldError}>{fieldErrors.password[0]}</small> : null}
        </label>
        <div className={styles.loginOptions}>
          <label className={styles.rememberRow}><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} /> <span>تذكرني على هذا الجهاز</span></label>
          <a href="/advanced-pro-control/forgot-password">نسيت كلمة المرور؟</a>
        </div>
        {error ? <div className={styles.error} role="alert">{error}</div> : null}
        <button className={styles.primaryButton} type="submit" disabled={busy}>{busy ? "جارٍ التحقق..." : "دخول لوحة الأدمن"}</button>
      </form>
      <p className={styles.secureNote}>يتم تسجيل الدخول بشكل آمن ومشفّر.</p>
    </div>
  );
}

