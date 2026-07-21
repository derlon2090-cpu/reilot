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
  ["overview", "الرئيسية", "grid"],
  ["subscriptions", "إدارة الاشتراكات", "card"],
  ["users", "إدارة العملاء", "users"],
  ["provisioning", "تفعيل حسابات سلة", "users"],
  ["devices", "الأجهزة والقنوات", "device"],
  ["security", "الحماية والامتثال", "shield"],
  ["reports", "التقارير", "chart"],
  ["roles", "الأدوار والصلاحيات", "team"],
  ["settings", "إعدادات النظام", "settings"]
];

const PANEL_COPY = {
  overview: ["لوحة الأدمن", "نظرة تشغيلية مباشرة على منصة Renvix."],
  subscriptions: ["الاشتراكات", "متابعة اشتراكات المنصة وحالاتها الحالية."],
  users: ["المستخدمون", "ملخص حسابات المنصة ومساحات العمل المسجلة."],
  provisioning: ["تفعيل حسابات سلة", "طلبات إنشاء الحسابات الناتجة عن منتجات سلة المربوطة فقط."],
  devices: ["الأجهزة والقنوات", "متابعة القنوات المتصلة وحالتها التشغيلية."],
  security: ["الحماية والامتثال", "متابعة المخاطر والتنبيهات وسجل التدقيق الإداري."],
  reports: ["التقارير", "مؤشرات الإرسال والتسليم والعمليات المسجلة."],
  roles: ["الأدوار والصلاحيات", "إدارة الأدوار والصلاحيات والتحكم في الوصول."],
  settings: ["إعدادات النظام", "الإعدادات العامة والتكاملات وخيارات تشغيل المنصة."]
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

const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M8 15h4"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.8M16 3.2a4 4 0 0 1 0 7.6"/>',
  device: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  chart: '<path d="M3 3v18h18"/><path d="m7 16 4-5 4 3 5-7"/>',
  team: '<circle cx="9" cy="7" r="3"/><circle cx="17" cy="9" r="2"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M15 15a5 5 0 0 1 6 4v2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V20h-2.6v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H6v-2.6h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1L9 6.6l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V5h2.6v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1v2.6h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  refresh: '<path d="M20 11a8 8 0 1 0 1 4M20 4v7h-7"/>'
};

function Icon({ name }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[name] || ICONS.grid }} />;
}

function StatCard({ label, value, helper, tone = "blue", icon = "chart" }) {
  return (
    <article className={styles.statCard}>
      <span className={`${styles.statIcon} ${styles[tone]}`}><Icon name={icon} /></span>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </article>
  );
}

function iconForLabel(label) {
  const value = String(label);
  if (value.includes("اشتراك") || value.includes("فترة")) return "card";
  if (value.includes("مستخدم") || value.includes("مستأجر") || value.includes("عملاء")) return "users";
  if (value.includes("قناة") || value.includes("جهاز")) return "device";
  if (value.includes("خطر") || value.includes("فشل") || value.includes("تنبيه")) return "shield";
  if (value.includes("دور") || value.includes("صلاح")) return "team";
  if (value.includes("جلسة")) return "shield";
  return "chart";
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" }).format(date);
}

function statusLabel(value) {
  const labels = { active: "نشط", trial: "تجريبي", expired: "منتهي", connected: "متصل", disconnected: "غير متصل", pending: "معلّق", sent: "تم الإرسال", failed: "فشل", disabled: "معطل" };
  return labels[value] || value || "—";
}

function DataTable({ title, description, columns, rows, empty = "لا توجد بيانات فعلية لهذا القسم حتى الآن." }) {
  return <section className={styles.dataCard}>
    <div className={styles.sectionHeading}><div><h2>{title}</h2><p>{description}</p></div><button className={styles.filterButton} type="button"><Icon name="refresh" /> تحديث</button></div>
    {!rows?.length ? <div className={styles.emptyState}><strong>{empty}</strong><span>تعرض هذه الصفحة البيانات المحفوظة فقط من قاعدة البيانات.</span></div> : <div className={styles.tableWrap}><table><thead><tr>{columns.map(([key, label]) => <th key={key}>{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.id || index}>{columns.map(([key]) => <td key={key}>{key === "status" ? <span className={styles.status}>{statusLabel(row[key])}</span> : key === "createdAt" || key === "expiresAt" || key === "startsAt" || key === "lastCheckAt" || key === "lastLoginAt" ? formatDate(row[key]) : row[key] ?? "—"}</td>)}</tr>)}</tbody></table></div>}
  </section>;
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
    ],
    provisioning: [
      ["وظائف التفعيل", data.provisioningJobs?.length || 0, "آخر 30 وظيفة", "blue"],
      ["بانتظار المعالجة", (data.provisioningJobs || []).filter((job) => job.status === "pending").length, "تحتاج Worker", "violet"],
      ["فشل البريد", (data.provisioningJobs || []).filter((job) => job.status === "email_failed").length, "تحتاج إعادة إرسال", "red"],
      ["مكتملة", (data.provisioningJobs || []).filter((job) => job.status === "completed").length, "تفعيل ناجح", "green"]
    ]
  }[activePanel] || [] : [];

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
          {ADMIN_NAV.map(([key, label, icon]) => (
            <button
              key={key}
              type="button"
              className={activePanel === key ? styles.activeNav : ""}
              onClick={() => setActivePanel(key)}
              aria-current={activePanel === key ? "page" : undefined}
            ><Icon name={icon} /><span>{label}</span></button>
          ))}
        </nav>
        <div className={styles.sidebarNote}>
          <strong>وصول إداري محمي</strong>
          <span>كل إجراء حساس مسجل في سجل التدقيق.</span>
        </div>
      </aside>

      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.topbarIdentity}>
            <span className={styles.avatar}>{(admin.name || admin.email || "A").slice(0, 1).toUpperCase()}</span>
            <div><strong>{admin.name || admin.email}</strong><span>{ROLE_LABELS[admin.role] || admin.role}</span></div>
          </div>
          <div className={styles.topbarCenter}><label className={styles.adminSearch}><Icon name="search" /><input placeholder="بحث سريع..." aria-label="بحث سريع" /></label><span className={styles.planBadge}>لوحة التحكم</span></div>
          <div className={styles.topbarActions}><button className={styles.iconButton} type="button" aria-label="التنبيهات"><Icon name="bell" /><b>{data?.stats?.unreadNotifications || 0}</b></button><button onClick={logout} className={styles.logoutButton}>تسجيل الخروج</button></div>
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
                  <StatCard key={label} label={label} value={value} helper={helper} tone={tone} icon={iconForLabel(label)} />
                ))}
              </section>

              {activePanel === "overview" ? <section className={styles.overviewGrid}>
                <article className={styles.chartCard}><div className={styles.sectionHeading}><div><h2>نظرة عامة على المنصة</h2><p>المؤشرات الحالية من الطوابير والاشتراكات والقنوات.</p></div><span className={styles.periodBadge}>بيانات مباشرة</span></div><div className={styles.metricBars}><div><span>الرسائل المرسلة</span><b>{stats.queue.sent.toLocaleString("ar-SA")}</b><i className={styles.barBlue} /></div><div><span>القنوات المتصلة</span><b>{stats.connectedChannels.toLocaleString("ar-SA")}</b><i className={styles.barCyan} /></div><div><span>الاشتراكات النشطة</span><b>{stats.platformSubscriptions.active.toLocaleString("ar-SA")}</b><i className={styles.barGreen} /></div></div></article>
                <article className={styles.quickCard}><div className={styles.sectionHeading}><div><h2>إجراءات سريعة</h2><p>اختصارات لا تغيّر البيانات دون تأكيد.</p></div></div><button type="button"><Icon name="users" /> مراجعة العملاء</button><button type="button"><Icon name="card" /> مراجعة الاشتراكات</button><button type="button"><Icon name="shield" /> مراجعة المخاطر</button><button type="button"><Icon name="chart" /> فتح التقارير</button></article>
                <article className={styles.healthCard}><div className={styles.sectionHeading}><div><h2>صحة الأنظمة</h2><p>نتائج الاتصال المسجلة حاليًا.</p></div><span className={styles.goodDot}>سليم</span></div><div className={styles.healthLine}><span>قنوات واتساب</span><strong>{stats.connectedChannels} متصلة</strong></div><div className={styles.healthLine}><span>Queue</span><strong>{stats.queue.pending} معلّقة</strong></div><div className={styles.healthLine}><span>جلسات الأدمن</span><strong>{stats.activeSessions} نشطة</strong></div></article>
              </section> : null}

              {activePanel === "users" ? <DataTable title="إدارة العملاء ومساحات العمل" description="المستأجرون والحسابات المرتبطة بهم من السجلات الفعلية." columns={[["name","المتجر"],["ownerName","المالك"],["email","البريد"],["memberCount","الأعضاء"],["subscriptionCount","الاشتراكات"],["status","الحالة"],["createdAt","تاريخ الإنشاء"]]} rows={data.tenants} /> : null}
              {activePanel === "provisioning" ? <DataTable title="تفعيل حسابات سلة" description="كل وظيفة مرتبطة بطلب سلة، مع عرض حالات البريد والأخطاء دون بيانات تجريبية." columns={[["orderId","رقم الطلب"],["customerName","العميل"],["email","البريد"],["planName","الباقة"],["status","حالة التفعيل"],["emailStatus","حالة البريد"],["failureCode","سبب التعثر"],["createdAt","تاريخ الإنشاء"]]} rows={data.provisioningJobs} empty="لا توجد وظائف تفعيل حسابات سلة حتى الآن." /> : null}
              {activePanel === "subscriptions" ? <DataTable title="إدارة اشتراكات المنصة" description="الاشتراكات المفعلة أو التجريبية حسب بيانات الفوترة." columns={[["tenantName","مساحة العمل"],["planName","الباقة"],["billingCycle","الدورة"],["status","الحالة"],["paymentProvider","مزود الدفع"],["startsAt","البداية"],["expiresAt","النهاية"]]} rows={data.subscriptions} /> : null}
              {activePanel === "devices" ? <DataTable title="الأجهزة والقنوات" description="القنوات المسجلة وحالة الاتصال وفحص الصحة الأخير." columns={[["tenantName","مساحة العمل"],["displayName","اسم القناة"],["phoneNumber","الرقم"],["status","الحالة"],["healthScore","درجة الصحة"],["lastCheckAt","آخر فحص"]]} rows={data.channels} /> : null}
              {activePanel === "settings" ? <DataTable title="إعدادات حسابات الأدمن" description="الحسابات الإدارية المسجلة وصلاحياتها الحالية." columns={[["name","المسؤول"],["email","البريد"],["role","الدور"],["mfaEnabled","MFA"],["status","الحالة"],["lastLoginAt","آخر دخول"]]} rows={data.adminUsers} /> : null}

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
  if (!initialAdmin) return null;
  return <Dashboard admin={initialAdmin} onLogout={() => window.location.assign("/advanced-pro-control")} />;
}
