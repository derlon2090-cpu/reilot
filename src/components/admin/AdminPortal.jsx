"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./AdminPortal.module.css";

const ROLE_LABELS = {
  super_admin: "مدير النظام",
  admin: "مدير",
  support_admin: "مدير الدعم",
  billing_admin: "مدير الفوترة",
  security_admin: "مدير الأمان",
  viewer: "مشاهد"
};

function Brand() {
  return (
    <div className={styles.brand} aria-label="Renvix">
      <span className={styles.brandMark}>R</span>
      <span>Renvix</span>
    </div>
  );
}

function Login({ onAuthenticated }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          controlPath: window.location.pathname
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.reason === "rate_limited"
          ? "تم إيقاف المحاولات مؤقتًا. حاول لاحقًا."
          : data.reason === "mfa_required"
            ? "يتطلب هذا الحساب إكمال المصادقة الثنائية."
            : "بيانات الدخول غير صحيحة.");
        return;
      }
      onAuthenticated(data.admin);
    } catch {
      setError("تعذر الاتصال بخدمة تسجيل الدخول.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.loginPage} dir="rtl">
      <section className={styles.loginIntro}>
        <Brand />
        <div className={styles.introMark}>R</div>
        <h1>مركز التحكم الآمن</h1>
        <p>إدارة مركزية للمنصة، المستخدمين، القنوات، والحماية.</p>
        <div className={styles.securityPill}>جلسة مشفرة · صلاحيات دقيقة · سجل تدقيق</div>
      </section>
      <section className={styles.loginPanel}>
        <div className={styles.loginCard}>
          <span className={styles.controlBadge}>لوحة التحكم الخاصة</span>
          <div className={styles.loginIcon}>R</div>
          <h2>تسجيل دخول الأدمن</h2>
          <p>أدخل بيانات حساب الإدارة المصرح له.</p>
          <form onSubmit={submit}>
            <label>
              البريد الإلكتروني
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label>
              كلمة المرور
              <span className={styles.passwordField}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className={styles.eyeButton}
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                >
                  {showPassword ? "إخفاء" : "إظهار"}
                </button>
              </span>
            </label>
            {error ? <div className={styles.error} role="alert">{error}</div> : null}
            <button className={styles.primaryButton} type="submit" disabled={busy}>
              {busy ? "جارٍ التحقق..." : "تسجيل الدخول الآمن"}
            </button>
          </form>
          <a className={styles.backLink} href="/">العودة إلى الموقع الرئيسي</a>
        </div>
      </section>
    </main>
  );
}

function StatCard({ label, value, helper, tone = "blue" }) {
  return (
    <article className={styles.statCard}>
      <span className={`${styles.statIcon} ${styles[tone]}`}>{label.slice(0, 1)}</span>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </article>
  );
}

function Dashboard({ admin, onLogout }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/admin/overview", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) {
        onLogout();
        return;
      }
      if (!response.ok) throw new Error("overview_failed");
      setData(payload);
    } catch {
      setError("تعذر تحميل بيانات لوحة الأدمن حاليًا.");
    }
  }, [onLogout]);

  useEffect(() => {
    load();
  }, [load]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => null);
    onLogout();
  }

  const stats = data?.stats;
  return (
    <main className={styles.dashboard} dir="rtl">
      <aside className={styles.sidebar}>
        <Brand />
        <nav aria-label="قائمة الأدمن">
          <button className={styles.activeNav}>الرئيسية</button>
          <button disabled>إدارة الاشتراكات</button>
          <button disabled>إدارة المستخدمين</button>
          <button disabled>الأجهزة والقنوات</button>
          <button disabled>الحماية والامتثال</button>
          <button disabled>التقارير</button>
          <button disabled>الأدوار والصلاحيات</button>
        </nav>
        <div className={styles.sidebarNote}>
          <strong>وصول إداري محمي</strong>
          <span>كل إجراء حساس مسجل في سجل التدقيق.</span>
        </div>
      </aside>

      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <div>
            <strong>{admin.name || admin.email}</strong>
            <span>{ROLE_LABELS[admin.role] || admin.role}</span>
          </div>
          <button onClick={logout} className={styles.logoutButton}>تسجيل الخروج</button>
        </header>

        <div className={styles.content}>
          <div className={styles.pageHeading}>
            <div>
              <h1>لوحة الأدمن</h1>
              <p>بيانات تشغيلية فعلية من قاعدة بيانات Renvix.</p>
            </div>
            <button className={styles.refreshButton} onClick={load}>تحديث البيانات</button>
          </div>

          {error ? <div className={styles.error}>{error}</div> : null}
          {!stats ? (
            <div className={styles.loading}>جارٍ تحميل بيانات المنصة...</div>
          ) : (
            <>
              <section className={styles.statsGrid}>
                <StatCard label="إجمالي المستأجرين" value={stats.tenants} helper="من جدول tenants" />
                <StatCard label="إجمالي المستخدمين" value={stats.users} helper="من جدول users" tone="violet" />
                <StatCard label="القنوات المتصلة" value={stats.connectedChannels} helper="قنوات واتساب المتصلة" tone="cyan" />
                <StatCard
                  label="اشتراكات المنصة"
                  value={stats.platformSubscriptions.total}
                  helper={`${stats.platformSubscriptions.active} نشط · ${stats.platformSubscriptions.trial} تجريبي`}
                  tone="green"
                />
                <StatCard label="الرسائل المرسلة" value={stats.queue.sent} helper={`${stats.queue.pending} في الانتظار`} tone="cyan" />
                <StatCard label="معدل التسليم" value={`${stats.deliveryRate}%`} helper={`${stats.queue.failed} فشل`} tone="green" />
                <StatCard
                  label="مخاطر مرتفعة"
                  value={stats.risks.high + stats.risks.critical}
                  helper={`${stats.risks.critical} حرجة`}
                  tone="red"
                />
                <StatCard label="إشعارات غير مقروءة" value={stats.unreadNotifications} helper="إشعارات داخل المنصة" tone="violet" />
              </section>

              <section className={styles.auditCard}>
                <div className={styles.sectionHeading}>
                  <div>
                    <h2>أحدث النشاط الإداري</h2>
                    <p>آخر العمليات المسجلة في سجل التدقيق.</p>
                  </div>
                </div>
                {data.recentAudit.length === 0 ? (
                  <div className={styles.emptyState}>
                    <strong>لا توجد سجلات نشاط حتى الآن</strong>
                    <span>ستظهر هنا العمليات الإدارية بعد بدء استخدام اللوحة.</span>
                  </div>
                ) : (
                  <div className={styles.tableWrap}>
                    <table>
                      <thead>
                        <tr>
                          <th>المسؤول</th>
                          <th>الإجراء</th>
                          <th>المورد</th>
                          <th>الحالة</th>
                          <th>الوقت</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.recentAudit.map((item) => (
                          <tr key={item.id}>
                            <td>{item.name || item.email || "النظام"}</td>
                            <td>{item.action}</td>
                            <td>{item.resource || "—"}</td>
                            <td><span className={styles.status}>{item.status}</span></td>
                            <td>{new Intl.DateTimeFormat("ar-SA", {
                              dateStyle: "medium",
                              timeStyle: "short"
                            }).format(new Date(item.createdAt))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

export default function AdminPortal({ initialAdmin }) {
  const [admin, setAdmin] = useState(initialAdmin);
  return admin
    ? <Dashboard admin={admin} onLogout={() => setAdmin(null)} />
    : <Login onAuthenticated={setAdmin} />;
}
