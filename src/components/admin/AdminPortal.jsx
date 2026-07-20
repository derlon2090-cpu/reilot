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

const ADMIN_NAV = [
  ["overview", "الرئيسية"],
  ["subscriptions", "الاشتراكات"],
  ["users", "المستخدمون"],
  ["devices", "الأجهزة والقنوات"],
  ["security", "الحماية والامتثال"],
  ["reports", "التقارير"],
  ["roles", "الأدوار والصلاحيات"]
];

const PANEL_COPY = {
  overview: ["لوحة الأدمن", "نظرة تشغيلية مباشرة على منصة Renvix."],
  subscriptions: ["الاشتراكات", "متابعة اشتراكات المنصة وحالاتها الحالية."],
  users: ["المستخدمون", "ملخص حسابات المنصة ومساحات العمل المسجلة."],
  devices: ["الأجهزة والقنوات", "متابعة القنوات المتصلة وحالتها التشغيلية."],
  security: ["الحماية والامتثال", "متابعة المخاطر والتنبيهات وسجل التدقيق الإداري."],
  reports: ["التقارير", "مؤشرات الإرسال والتسليم والعمليات المسجلة."],
  roles: ["الأدوار والصلاحيات", "مرجع واضح لنطاق الوصول الممنوح لحساب الإدارة الحالي."]
};

const ROLE_SCOPES = {
  super_admin: ["جميع وحدات المنصة", "إدارة الاشتراكات", "إدارة المستخدمين والعملاء", "إدارة الأجهزة والقنوات", "الحماية", "التقارير", "سجل التدقيق"],
  admin: ["عرض المؤشرات", "إدارة الاشتراكات", "إدارة المستخدمين والعملاء", "إدارة الأجهزة والقنوات", "عرض الحماية", "التقارير", "سجل التدقيق"],
  support_admin: ["عرض المؤشرات", "عرض المستخدمين والعملاء", "إدارة الأجهزة والقنوات", "سجل التدقيق"],
  billing_admin: ["عرض المؤشرات", "إدارة الاشتراكات", "التقارير"],
  security_admin: ["عرض المؤشرات", "إدارة الأجهزة والقنوات", "الحماية", "سجل التدقيق"],
  viewer: ["عرض المؤشرات", "عرض الاشتراكات", "عرض المستخدمين والعملاء", "عرض الأجهزة والقنوات", "عرض الحماية", "عرض التقارير", "سجل التدقيق"]
};

function Brand() {
  return (
    <div className={styles.brand} aria-label="Renvix">
      <img className={styles.brandLogo} src="/assets/renewpilot-logo-horizontal.png" alt="Renvix" />
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
        <div className={styles.introMark}><img src="/assets/renvix-mark.png" alt="" /></div>
        <h1>مركز التحكم الآمن</h1>
        <p>إدارة مركزية للمنصة، المستخدمين، القنوات، والحماية.</p>
        <div className={styles.securityPill}>جلسة مشفرة · صلاحيات دقيقة · سجل تدقيق</div>
      </section>
      <section className={styles.loginPanel}>
        <div className={styles.loginCard}>
          <span className={styles.controlBadge}>لوحة التحكم الخاصة</span>
          <div className={styles.loginIcon}><img src="/assets/renvix-mark.png" alt="" /></div>
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
  const [activePanel, setActivePanel] = useState("overview");

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
  const panelCopy = PANEL_COPY[activePanel] || PANEL_COPY.overview;
  const panelCards = stats ? {
    overview: [
      ["إجمالي المستأجرين", stats.tenants, "مساحة عمل", "blue"],
      ["إجمالي المستخدمين", stats.users, "حساب مسجل", "violet"],
      ["القنوات المتصلة", stats.connectedChannels, "قناة واتساب", "cyan"],
      ["اشتراكات المنصة", stats.platformSubscriptions.total, `${stats.platformSubscriptions.active} نشط · ${stats.platformSubscriptions.trial} تجريبي`, "green"],
      ["الرسائل المرسلة", stats.queue.sent, `${stats.queue.pending} في الانتظار`, "cyan"],
      ["معدل التسليم", `${stats.deliveryRate}%`, `${stats.queue.failed} فشل`, "green"],
      ["مخاطر مرتفعة", stats.risks.high + stats.risks.critical, `${stats.risks.critical} حرجة`, "red"],
      ["إشعارات غير مقروءة", stats.unreadNotifications, "إشعارات داخل المنصة", "violet"]
    ],
    subscriptions: [
      ["إجمالي الاشتراكات", stats.platformSubscriptions.total, "جميع الحالات", "blue"],
      ["الاشتراكات النشطة", stats.platformSubscriptions.active, "حساب نشط", "green"],
      ["الفترات التجريبية", stats.platformSubscriptions.trial, "حساب تجريبي", "violet"],
      ["مساحات العمل", stats.tenants, "مرتبطة بالاشتراكات", "cyan"]
    ],
    users: [
      ["إجمالي المستخدمين", stats.users, "حساب مسجل", "violet"],
      ["مساحات العمل", stats.tenants, "مستأجر", "blue"],
      ["متوسط المستخدمين", stats.tenants ? (stats.users / stats.tenants).toFixed(1) : 0, "لكل مساحة عمل", "cyan"],
      ["إشعارات غير مقروءة", stats.unreadNotifications, "تحتاج متابعة", "red"]
    ],
    devices: [
      ["القنوات المتصلة", stats.connectedChannels, "قناة فعالة", "green"],
      ["مخاطر مرتفعة", stats.risks.high, "تحتاج متابعة", "red"],
      ["مخاطر حرجة", stats.risks.critical, "تحتاج إجراءً فوريًا", "red"],
      ["رسائل في الانتظار", stats.queue.pending, "ضمن طابور الإرسال", "cyan"]
    ],
    security: [
      ["مخاطر حرجة", stats.risks.critical, "أعلى مستوى تنبيه", "red"],
      ["مخاطر مرتفعة", stats.risks.high, "تحتاج مراجعة", "red"],
      ["إشعارات غير مقروءة", stats.unreadNotifications, "داخل المنصة", "violet"],
      ["فشل الإرسال", stats.queue.failed, "عملية مسجلة", "red"]
    ],
    reports: [
      ["إجمالي عمليات الإرسال", stats.queue.total, "كل الحالات", "blue"],
      ["تم الإرسال", stats.queue.sent, "رسالة", "green"],
      ["في الانتظار", stats.queue.pending, "رسالة", "cyan"],
      ["معدل التسليم", `${stats.deliveryRate}%`, `${stats.queue.failed} فشل`, "violet"]
    ],
    roles: [
      ["دور الحساب", ROLE_LABELS[admin.role] || admin.role, "الدور الإداري الحالي", "blue"],
      ["الجلسة", "نشطة", "جلسة إدارية محمية", "green"],
      ["سجل التدقيق", data.recentAudit.length, "آخر العمليات الظاهرة", "violet"],
      ["نطاق العرض", "مباشر", "بيانات فعلية من المنصة", "cyan"]
    ]
  }[activePanel] : [];

  const auditItems = (data?.recentAudit || []).filter((item) => {
    if (["overview", "roles"].includes(activePanel)) return true;
    const value = `${item.action || ""} ${item.resource || ""}`.toLowerCase();
    const terms = {
      subscriptions: ["subscription", "billing", "plan"],
      users: ["user", "customer", "tenant", "account"],
      devices: ["device", "channel", "whatsapp"],
      security: ["security", "permission", "login", "access", "risk"],
      reports: ["report", "export", "queue", "message"]
    }[activePanel] || [];
    return terms.some((term) => value.includes(term));
  });
  return (
    <main className={styles.dashboard} dir="rtl">
      <aside className={styles.sidebar}>
        <Brand />
        <nav aria-label="قائمة الأدمن">
          {ADMIN_NAV.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={activePanel === key ? styles.activeNav : ""}
              onClick={() => setActivePanel(key)}
              aria-current={activePanel === key ? "page" : undefined}
            >{label}</button>
          ))}
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
              <h1>{panelCopy[0]}</h1>
              <p>{panelCopy[1]}</p>
            </div>
            <button className={styles.refreshButton} onClick={load}>تحديث البيانات</button>
          </div>

          {error ? <div className={styles.error}>{error}</div> : null}
          {!stats ? (
            <div className={styles.loading}>جارٍ تحميل بيانات المنصة...</div>
          ) : (
            <>
              <section className={styles.statsGrid}>
                {panelCards.map(([label, value, helper, tone]) => (
                  <StatCard key={label} label={label} value={value} helper={helper} tone={tone} />
                ))}
              </section>

              {activePanel === "roles" ? (
                <section className={styles.permissionCard}>
                  <div className={styles.sectionHeading}>
                    <div><h2>صلاحيات الدور الحالي</h2><p>تُطبّق الصلاحيات على الخادم وتُسجل محاولات الوصول في سجل التدقيق.</p></div>
                  </div>
                  <div className={styles.permissionGrid}>
                    {(ROLE_SCOPES[admin.role] || ["عرض المؤشرات"]).map((label) => (
                      <span key={label}>✓ {label}</span>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className={styles.auditCard}>
                <div className={styles.sectionHeading}>
                  <div>
                    <h2>أحدث النشاط الإداري</h2>
                    <p>آخر العمليات المسجلة في سجل التدقيق.</p>
                  </div>
                </div>
                {auditItems.length === 0 ? (
                  <div className={styles.emptyState}>
                    <strong>لا توجد عمليات مطابقة في السجل الحالي</strong>
                    <span>ستظهر هنا العمليات التابعة لهذا القسم فور تسجيلها.</span>
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
                        {auditItems.map((item) => (
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
