"use client";

import { useState } from "react";
import styles from "../admin/AdminPortal.module.css";

export default function AdminForgotPasswordForm() {
  const [step, setStep] = useState("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function requestCode(event) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.errors?.email?.[0] || data.message || "تعذر إرسال الرمز.");
      setMessage(data.message); setStep("reset");
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  async function reset(event) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, code, password, confirmPassword }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.errors?.confirmPassword?.[0] || (data.reason === "invalid_or_expired_code" ? "الرمز غير صحيح أو انتهت صلاحيته." : "تعذر تحديث كلمة المرور."));
      setStep("done");
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  return (
    <div className={styles.loginCard}>
      <span className={styles.controlBadge}>استعادة آمنة</span>
      <h2>{step === "done" ? "تم تحديث كلمة المرور" : "نسيت كلمة المرور؟"}</h2>
      {step === "request" ? <>
        <p>أدخل بريد حساب الأدمن لإرسال رمز صالح لمدة 10 دقائق.</p>
        <form onSubmit={requestCode}><label>البريد الإلكتروني<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>{error ? <div className={styles.error}>{error}</div> : null}<button className={styles.primaryButton} disabled={busy}>{busy ? "جارٍ الإرسال..." : "إرسال رمز التحقق"}</button></form>
      </> : step === "reset" ? <>
        <p>{message}</p>
        <form onSubmit={reset}><label>رمز التحقق<input className={styles.codeField} inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} required /></label><label>كلمة المرور الجديدة<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><label>تأكيد كلمة المرور<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>{error ? <div className={styles.error}>{error}</div> : null}<button className={styles.primaryButton} disabled={busy}>{busy ? "جارٍ الحفظ..." : "تحديث كلمة المرور"}</button></form>
      </> : <p>يمكنك الآن الدخول بكلمة المرور الجديدة.</p>}
      <a className={styles.backLink} href="/advanced-pro-control">العودة إلى دخول الأدمن</a>
    </div>
  );
}

