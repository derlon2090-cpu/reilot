"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./AdminPortal.module.css";

const ICONS = {
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.8M16 3.2a4 4 0 0 1 0 7.6"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M8 15h4"/>',
  store: '<path d="M3 9l2-5h14l2 5"/><path d="M5 13v8h14v-8M9 21v-6h6v6"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  device: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  chart: '<path d="M3 3v18h18"/><path d="m7 16 4-5 4 3 5-7"/>',
  template: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V20h-2.6v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H6v-2.6h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1L9 6.6l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V5h2.6v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1v2.6h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  refresh: '<path d="M20 11a8 8 0 1 0 1 4M20 4v7h-7"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  alert: '<path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>'
};

function Glyph({ name }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[name] || ICONS.chart }} />;
}

function n(value) {
  return Number(value || 0);
}

function ar(value) {
  return n(value).toLocaleString("en-US");
}

function formatDate(value, withTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-SA", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(date);
}

function humanStatus(value) {
  return {
    active: "نشط", trial: "تجريبي", expired: "منتهي", pending: "معلّق", connected: "متصل",
    disconnected: "غير متصل", healthy: "سليم", degraded: "يحتاج متابعة", error: "متعثر",
    not_configured: "غير مهيأ", sent: "تم الإرسال", failed: "فشل", disabled: "معطل",
    scheduled: "مجدول", queueing: "قيد الجدولة", sending: "قيد الإرسال", draft: "مسودة",
    validating: "جارٍ التحقق", preparing: "تجهيز الجمهور", publishing: "قيد النشر",
    published: "تم النشر", partially_published: "نشر جزئي", cancelled: "ملغي", archived: "مؤرشف"
  }[value] || value || "—";
}

function statusTone(value) {
  if (["active", "connected", "healthy", "sent", "completed"].includes(value)) return "good";
  if (["failed", "error", "expired", "disconnected"].includes(value)) return "bad";
  return "warn";
}

function MiniLine({ values = [], color = "#2563eb" }) {
  const nums = values.map(n);
  const source = nums.length > 1 ? nums : [0, 0, 0, 0, 0, 0, 0];
  const min = Math.min(...source);
  const max = Math.max(...source);
  const range = Math.max(1, max - min);
  const points = source.map((value, index) => `${(index / Math.max(1, source.length - 1)) * 100},${32 - ((value - min) / range) * 24}`).join(" ");
  return <svg className={styles.adminSparkline} viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden="true"><polyline points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>;
}

function Kpi({ label, value, helper, icon = "chart", tone = "blue", values }) {
  const color = { blue: "#2563eb", green: "#12a66a", violet: "#7c3aed", orange: "#f59e0b", red: "#ef4444", cyan: "#0ba6b6" }[tone];
  return <article className={`${styles.adminKpi} ${styles[`adminKpi_${tone}`]}`}>
    <span className={styles.adminKpiIcon}><Glyph name={icon} /></span>
    <div><span>{label}</span><strong>{value}</strong><small>{helper}</small></div>
    <MiniLine values={values} color={color} />
  </article>;
}

function KpiGrid({ items, metrics }) {
  return <section className={styles.adminKpiGrid}>{items.map((item) => <Kpi key={item.label} {...item} values={item.values || metrics} />)}</section>;
}

function PanelTitle({ title, description, action, onAction }) {
  return <div className={styles.adminPanelTitle}>
    <div><h2>{title}</h2><p>{description}</p></div>
    {action ? <button type="button" onClick={onAction} className={styles.adminOutlineButton}><Glyph name="refresh" />{action}</button> : null}
  </div>;
}

function SearchFilters({ value, onChange, placeholders = [], searchPlaceholder = "بحث..." }) {
  return <div className={styles.adminFilters}>
    <label className={styles.adminSearchField}><Glyph name="chart" /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={searchPlaceholder} /></label>
    {placeholders.map((label) => <select key={label} aria-label={label} defaultValue=""><option value="">{label}</option></select>)}
    <button type="button" className={styles.adminFilterButton}>تطبيق الفلاتر</button>
    <button type="button" className={styles.adminResetButton} onClick={() => onChange("")}><Glyph name="refresh" /> إعادة ضبط</button>
  </div>;
}

function Empty({ title = "لا توجد بيانات فعلية حتى الآن", description = "ستظهر السجلات هنا فور إضافتها إلى قاعدة البيانات." }) {
  return <div className={styles.adminEmpty}><span><Glyph name="database" /></span><strong>{title}</strong><p>{description}</p></div>;
}

function StatusPill({ value }) {
  return <span className={`${styles.adminStatus} ${styles[`adminStatus_${statusTone(value)}`]}`}>{humanStatus(value)}</span>;
}

function SimpleTable({ columns, rows, emptyTitle }) {
  if (!rows?.length) return <Empty title={emptyTitle} />;
  return <div className={styles.adminTableWrap}><table><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>
    {rows.map((row, index) => <tr key={row.id || index}>{columns.map((column) => <td key={column.key}>{column.render ? column.render(row[column.key], row) : (row[column.key] ?? "—")}</td>)}</tr>)}
  </tbody></table></div>;
}

function TrendChart({ metrics = [], title = "اتجاه الأداء", keys = [{ key: "accepted", label: "الرسائل", color: "#2563eb" }] }) {
  const data = metrics.length ? metrics : [{ date: new Date().toISOString(), accepted: 0 }];
  const max = Math.max(1, ...data.flatMap((item) => keys.map((entry) => n(item[entry.key]))));
  return <article className={styles.adminChartCard}>
    <div className={styles.adminCardHead}><div><h3>{title}</h3><p>من السجلات اليومية المحفوظة في المنصة</p></div><span>آخر {data.length} يومًا</span></div>
    <div className={styles.adminLegend}>{keys.map((entry) => <span key={entry.key}><i style={{ background: entry.color }} />{entry.label}</span>)}</div>
    <svg className={styles.adminTrend} viewBox="0 0 600 220" preserveAspectRatio="none" role="img" aria-label={title}>
      {[35, 80, 125, 170].map((y) => <line key={y} x1="20" x2="580" y1={y} y2={y} stroke="#e9eef6" />)}
      {keys.map((entry) => {
        const points = data.map((item, index) => `${20 + (index / Math.max(1, data.length - 1)) * 560},${190 - (n(item[entry.key]) / max) * 145}`).join(" ");
        return <polyline key={entry.key} points={points} fill="none" stroke={entry.color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />;
      })}
    </svg>
    <div className={styles.adminChartDates}><span>{formatDate(data[0]?.date)}</span><span>{formatDate(data[data.length - 1]?.date)}</span></div>
  </article>;
}

function ActivityList({ rows = [] }) {
  return <article className={styles.adminListCard}><div className={styles.adminCardHead}><div><h3>أحدث الأنشطة</h3><p>سجل التدقيق الإداري</p></div></div>
    {!rows.length ? <Empty title="لا توجد أنشطة مسجلة" /> : <div className={styles.adminActivityList}>{rows.slice(0, 6).map((row) => <div key={row.id}><span className={styles.adminActivityIcon}><Glyph name="check" /></span><div><strong>{row.action}</strong><small>{row.name || row.email || "النظام"} · {formatDate(row.createdAt, true)}</small></div></div>)}</div>}
  </article>;
}

function Overview({ data, stats }) {
  const metrics = data.dailyMetrics || [];
  const health = data.integrationHealth || [];
  const healthy = health.filter((item) => item.status === "healthy").length;
  const healthRate = health.length ? Math.round((healthy / health.length) * 100) : 0;
  return <>
    <KpiGrid metrics={metrics.map((m) => m.accepted)} items={[
      { label: "إجمالي المتاجر", value: ar(stats.stores), helper: "متجر مسجل فعليًا", icon: "store", tone: "green", values: metrics.map((m) => m.stores) },
      { label: "المستخدمون النشطون", value: ar(stats.users), helper: "حساب داخل المنصة", icon: "users", tone: "blue", values: metrics.map((m) => m.activeUsers) },
      { label: "الرسائل المرسلة", value: ar(stats.queue.sent), helper: `${ar(stats.queue.pending)} في الانتظار`, icon: "send", tone: "cyan" },
      { label: "الأجهزة المتصلة", value: ar(stats.connectedChannels), helper: "قناة فعالة", icon: "device", tone: "violet" },
      { label: "التنبيهات المفتوحة", value: ar(stats.risks.high + stats.risks.critical), helper: `${ar(stats.risks.critical)} حرجة`, icon: "bell", tone: "orange" },
      { label: "صحة التكاملات", value: `${healthRate}%`, helper: health.length ? `${healthy} من ${health.length} سليمة` : "لا توجد فحوصات مسجلة", icon: "link", tone: "blue" }
    ]} />
    <section className={styles.adminOverviewBody}>
      <TrendChart metrics={metrics} title="نظرة عامة على الرسائل" keys={[{ key: "accepted", label: "المقبولة", color: "#2563eb" }, { key: "delivered", label: "المسلّمة", color: "#12a66a" }, { key: "failed", label: "الفاشلة", color: "#ef4444" }]} />
      <ActivityList rows={data.recentAudit} />
      <article className={styles.adminHealthCard}><div className={styles.adminCardHead}><div><h3>حالة المنصة</h3><p>نتائج الفحص الحقيقية</p></div><StatusPill value={healthRate === 100 ? "healthy" : "degraded"} /></div>
        <div className={styles.adminHealthRows}>
          <div><span>قاعدة البيانات</span><b>متصلة</b></div>
          <div><span>طابور الرسائل</span><b>{stats.queue.pending ? `${ar(stats.queue.pending)} معلّقة` : "سليم"}</b></div>
          <div><span>قنوات الإرسال</span><b>{ar(stats.connectedChannels)} متصلة</b></div>
          {health.slice(0, 3).map((item) => <div key={item.provider}><span>{item.provider}</span><StatusPill value={item.status} /></div>)}
        </div>
      </article>
    </section>
    <div className={styles.adminInfoBanner}><span><Glyph name="link" /></span><div><strong>إدارة مركزية للقنوات والتكاملات</strong><p>تعرض لوحة الأدمن بيانات المنصة الفعلية، بينما تبقى قنوات كل متجر معزولة داخل مساحة عمله.</p></div></div>
  </>;
}

function Subscriptions({ data, stats }) {
  const [search, setSearch] = useState("");
  const rows = useMemo(() => (data.subscriptions || []).filter((row) => `${row.tenantName} ${row.planName} ${row.status}`.toLowerCase().includes(search.toLowerCase())), [data.subscriptions, search]);
  return <>
    <KpiGrid items={[
      { label: "إجمالي الاشتراكات", value: ar(stats.platformSubscriptions.total), helper: "كل حالات الاشتراك", icon: "card", tone: "green" },
      { label: "الاشتراكات النشطة", value: ar(stats.platformSubscriptions.active), helper: "حساب نشط", icon: "chart", tone: "blue" },
      { label: "الفترات التجريبية", value: ar(stats.platformSubscriptions.trial), helper: "قيد التجربة", icon: "clock", tone: "orange" },
      { label: "الإيراد الشهري", value: `${ar(stats.monthlyRevenue)} ر.س`, helper: "من الاشتراكات الفعلية", icon: "card", tone: "green" }
    ]} />
    <section className={styles.adminSurface}>
      <div className={styles.adminTabs}><button className={styles.adminTabActive}>قائمة الاشتراكات</button><button>إعدادات التذكير</button><button>سجل الإرسال</button></div>
      <SearchFilters value={search} onChange={setSearch} searchPlaceholder="بحث في الاشتراكات..." placeholders={["كل الباقات", "كل الحالات", "كل القنوات", "كل المتاجر", "تاريخ البداية", "تاريخ الانتهاء"]} />
      <SimpleTable emptyTitle="لا توجد اشتراكات مسجلة حتى الآن" rows={rows} columns={[
        { key: "tenantName", label: "المتجر" }, { key: "planName", label: "الباقة" }, { key: "billingCycle", label: "الدورة" },
        { key: "startsAt", label: "تاريخ البداية", render: formatDate }, { key: "expiresAt", label: "تاريخ الانتهاء", render: formatDate },
        { key: "paymentProvider", label: "مزود الدفع" }, { key: "status", label: "الحالة", render: (value) => <StatusPill value={value} /> }
      ]} />
    </section>
  </>;
}

function Customers({ data, stats }) {
  const [search, setSearch] = useState("");
  const rows = useMemo(() => (data.customers || []).filter((row) => `${row.name} ${row.email} ${row.tenantName}`.toLowerCase().includes(search.toLowerCase())), [data.customers, search]);
  return <>
    <KpiGrid items={[
      { label: "إجمالي العملاء", value: ar(stats.users), helper: "حساب مستخدم مسجل", icon: "users", tone: "green" },
      { label: "مساحات العمل", value: ar(stats.tenants), helper: "مساحة معزولة", icon: "store", tone: "blue" },
      { label: "متوسط المستخدمين", value: stats.tenants ? (stats.users / stats.tenants).toFixed(1) : "0", helper: "لكل مساحة عمل", icon: "chart", tone: "violet" },
      { label: "حسابات تحتاج متابعة", value: ar((data.customers || []).filter((row) => row.status && row.status !== "active").length), helper: "بحسب الحالة الفعلية", icon: "alert", tone: "orange" }
    ]} />
    <section className={styles.adminSurface}>
      <div className={styles.adminActionRow}><button className={styles.adminPrimaryButton}>إضافة عميل +</button><button className={styles.adminOutlineButton}><Glyph name="mail" /> دعوة عميل</button><button className={styles.adminOutlineButton}>تصدير</button></div>
      <SearchFilters value={search} onChange={setSearch} searchPlaceholder="ابحث عن عميل أو بريد..." placeholders={["كل الباقات", "كل الحالات", "كل المصادر", "عدد المتاجر", "تاريخ الانضمام"]} />
      <SimpleTable emptyTitle="لا توجد حسابات عملاء حتى الآن" rows={rows} columns={[
        { key: "name", label: "العميل" }, { key: "email", label: "البريد الإلكتروني" }, { key: "phone", label: "الهاتف" },
        { key: "storeCount", label: "عدد المتاجر" }, { key: "planName", label: "الباقة الحالية" },
        { key: "status", label: "الحالة", render: (value) => <StatusPill value={value} /> }, { key: "createdAt", label: "آخر نشاط", render: formatDate }
      ]} />
    </section>
  </>;
}

function Stores({ data, stats }) {
  const [search, setSearch] = useState("");
  const rows = useMemo(() => (data.stores || []).filter((row) => `${row.name} ${row.domain} ${row.ownerName}`.toLowerCase().includes(search.toLowerCase())), [data.stores, search]);
  const ranked = [...(data.stores || [])].sort((a, b) => n(b.messageVolume) - n(a.messageVolume)).slice(0, 5);
  return <>
    <KpiGrid items={[
      { label: "إجمالي المتاجر", value: ar(stats.stores), helper: "متجر مسجل", icon: "store", tone: "green" },
      { label: "المتاجر النشطة", value: ar((data.stores || []).filter((row) => row.status === "active").length), helper: "ضمن النتائج الحالية", icon: "users", tone: "blue" },
      { label: "متاجر سلة المرتبطة", value: ar((data.stores || []).filter((row) => row.sallaStatus === "connected").length), helper: "اتصال فعلي", icon: "link", tone: "violet" },
      { label: "المتاجر المعلّقة", value: ar((data.stores || []).filter((row) => row.status && row.status !== "active").length), helper: "تحتاج مراجعة", icon: "alert", tone: "orange" }
    ]} />
    <TrendChart metrics={data.dailyMetrics} title="حركة المتاجر والرسائل" keys={[{ key: "stores", label: "المتاجر", color: "#12a66a" }, { key: "accepted", label: "الرسائل", color: "#2563eb" }]} />
    <section className={styles.adminTwoColumn}>
      <div className={styles.adminSurface}>
        <SearchFilters value={search} onChange={setSearch} searchPlaceholder="ابحث عن متجر..." placeholders={["كل المنصات", "كل الحالات", "جميع الملاك", "كل الباقات"]} />
        <SimpleTable emptyTitle="لا توجد متاجر مسجلة حتى الآن" rows={rows} columns={[
          { key: "name", label: "المتجر" }, { key: "domain", label: "النطاق" }, { key: "ownerName", label: "المالك" },
          { key: "planName", label: "الباقة" }, { key: "messageVolume", label: "حجم الرسائل", render: ar },
          { key: "sallaStatus", label: "سلة", render: (value) => <StatusPill value={value} /> }, { key: "status", label: "الحالة", render: (value) => <StatusPill value={value} /> }
        ]} />
      </div>
      <article className={styles.adminRanking}><div className={styles.adminCardHead}><div><h3>أعلى المتاجر</h3><p>بحسب حجم الرسائل الحالي</p></div></div>
        {!ranked.length ? <Empty title="لا توجد بيانات ترتيب" /> : ranked.map((row, index) => <div key={row.id}><b>{index + 1}</b><span>{row.name}</span><strong>{ar(row.messageVolume)}</strong></div>)}
      </article>
    </section>
  </>;
}

function Templates({ data, stats }) {
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState("all");
  const rows = useMemo(() => (data.adminTemplates || []).filter((row) => (channel === "all" || row.channel === channel) && `${row.name} ${row.description}`.toLowerCase().includes(search.toLowerCase())), [data.adminTemplates, search, channel]);
  return <>
    <KpiGrid items={[
      { label: "القوالب النشطة", value: ar((data.adminTemplates || []).filter((row) => row.isActive).length), helper: `من إجمالي ${ar((data.adminTemplates || []).length)}`, icon: "template", tone: "violet" },
      { label: "القوالب المستخدمة اليوم", value: ar((data.adminMessages || []).filter((row) => new Date(row.createdAt).toDateString() === new Date().toDateString()).length), helper: "من سجل الإرسال", icon: "send", tone: "blue" },
      { label: "معدل نجاح الرسائل", value: `${stats.deliveryRate}%`, helper: `${ar(stats.queue.failed)} فشل`, icon: "check", tone: "green" }
    ]} />
    <section className={styles.adminSurface}>
      <div className={styles.adminTabs}><button onClick={() => setChannel("all")} className={channel === "all" ? styles.adminTabActive : ""}>الكل</button><button onClick={() => setChannel("email")} className={channel === "email" ? styles.adminTabActive : ""}>البريد الإلكتروني</button><button onClick={() => setChannel("whatsapp")} className={channel === "whatsapp" ? styles.adminTabActive : ""}>واتساب</button><button onClick={() => setChannel("system")} className={channel === "system" ? styles.adminTabActive : ""}>النظام</button></div>
      <SearchFilters value={search} onChange={setSearch} searchPlaceholder="بحث في القوالب..." placeholders={["التصنيف", "اللغة", "حالة القالب"]} />
      {!rows.length ? <Empty title="لا توجد قوالب مطابقة" /> : <div className={styles.adminTemplateList}>{rows.map((row) => <article key={row.id}><span className={styles.adminTemplateIcon}><Glyph name={row.channel === "email" ? "mail" : row.channel === "evolution_whatsapp" ? "send" : "settings"} /></span><div><h3>{row.name}</h3><p>{row.description}</p><span><StatusPill value={row.isActive ? "active" : "disabled"} /> · الإصدار {row.version}</span></div><div className={styles.adminRowActions}><a href={`/admin/templates/${row.templateKey}`}>تحرير</a><a href={`/admin/templates/${row.templateKey}?preview=1`}>معاينة</a></div></article>)}</div>}
    </section>
  </>;
}

const NOTIFICATION_TYPE_LABELS = {
  general: "عام", update: "تحديث", maintenance: "صيانة", warning: "تنبيه",
  security: "أمان", billing: "فوترة", promotion: "عرض", action_required: "يتطلب إجراء"
};

const NOTIFICATION_AUDIENCE_LABELS = {
  all_users: "جميع مستخدمي المنصة", active_users: "المستخدمون النشطون",
  selected_plans: "باقات محددة", selected_stores: "متاجر محددة", selected_users: "مستخدمون محددون",
  subscription_status: "حسب حالة الاشتراك", integration_status: "حسب حالة التكامل", custom_filter: "جمهور مخصص"
};

function Notifications() {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ scheduled: 0, publishedToday: 0, drafts: 0, recipients: 0 });
  const [estimate, setEstimate] = useState(0);
  const [status, setStatus] = useState("all");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "", body: "", notificationType: "general", priority: "normal", audienceType: "all_users",
    scheduleMode: "draft", scheduledAt: "", expiresAt: "", deliverySurfaces: ["notification_center"],
    actionLabel: "", actionUrl: "", requireAcknowledgement: false, dismissible: true, pinned: false
  });

  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/notifications?status=${encodeURIComponent(status)}`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.reason || "load_failed");
    setItems(payload.items || []);
    setSummary(payload.summary || {});
  }, [status]);

  useEffect(() => {
    load().catch(() => setError("تعذر تحميل سجل إشعارات المنصة."));
  }, [load]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const response = await fetch("/api/admin/notifications/estimate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audienceType: form.audienceType, audienceFilters: {} })
      }).catch(() => null);
      if (!response?.ok) return;
      const payload = await response.json();
      setEstimate(Number(payload.estimate?.eligible || 0));
    }, 250);
    return () => clearTimeout(timer);
  }, [form.audienceType]);

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleSurface(surface) {
    setForm((current) => {
      const exists = current.deliverySurfaces.includes(surface);
      const next = exists ? current.deliverySurfaces.filter((value) => value !== surface) : [...current.deliverySurfaces, surface];
      return { ...current, deliverySurfaces: next.length ? next : ["notification_center"] };
    });
  }

  async function submit(scheduleMode) {
    setError("");
    setNotice("");
    if (form.priority === "critical" && scheduleMode !== "draft" && !window.confirm("سيظهر هذا الإشعار بشكل بارز لجميع المستخدمين المستهدفين. هل تريد المتابعة؟")) return;
    if (scheduleMode === "now" && !window.confirm(`سيبدأ تجهيز الإشعار للنشر إلى ${estimate.toLocaleString("ar-SA")} مستخدمًا مطابقًا. هل تريد المتابعة؟`)) return;
    setBusy(true);
    try {
      const payload = {
        ...form,
        scheduleMode,
        audienceFilters: {},
        scheduledAt: scheduleMode === "scheduled" && form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        actionLabel: form.actionLabel || null,
        actionUrl: form.actionUrl || null
      };
      const response = await fetch("/api/admin/notifications", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const fieldMessage = Object.values(result.errors || {}).flat().filter(Boolean)[0];
        throw new Error(fieldMessage || result.message || "تعذر حفظ الإشعار.");
      }
      setNotice(result.message || "تم حفظ الإشعار.");
      setForm((current) => ({ ...current, title: "", body: "", actionLabel: "", actionUrl: "" }));
      await load();
    } catch (submissionError) {
      setError(submissionError.message || "تعذر حفظ الإشعار.");
    } finally {
      setBusy(false);
    }
  }

  const previewType = NOTIFICATION_TYPE_LABELS[form.notificationType];
  return <>
    <div className={styles.adminActionRow}>
      <button type="button" className={styles.adminPrimaryButton} onClick={() => document.getElementById("admin-notification-composer")?.scrollIntoView({ behavior: "smooth" })}>إشعار جديد +</button>
      <button type="button" className={styles.adminOutlineButton} onClick={() => document.getElementById("admin-notification-log")?.scrollIntoView({ behavior: "smooth" })}><Glyph name="template" /> سجل الإشعارات</button>
    </div>
    <KpiGrid items={[
      { label: "إشعارات مجدولة", value: ar(summary.scheduled), helper: "بانتظار موعد النشر", icon: "clock", tone: "blue" },
      { label: "تم النشر اليوم", value: ar(summary.publishedToday), helper: "من قاعدة البيانات", icon: "send", tone: "green" },
      { label: "مسودات", value: ar(summary.drafts), helper: "لم تنشر بعد", icon: "template", tone: "violet" },
      { label: "المستلمون المؤهلون", value: ar(estimate), helper: NOTIFICATION_AUDIENCE_LABELS[form.audienceType], icon: "users", tone: "blue" }
    ]} />
    {notice ? <div className={styles.adminSuccessMessage}>{notice}</div> : null}
    {error ? <div className={styles.adminErrorMessage}>{error}</div> : null}
    <section id="admin-notification-composer" className={styles.adminNotificationComposer}>
      <article className={styles.adminNotificationForm}>
        <PanelTitle title="إنشاء إشعار جديد" description="يُحفظ المحتوى مرة واحدة، ثم يبني العامل الجمهور على دفعات عند النشر." />
        <label className={styles.adminFormField}><span>عنوان الإشعار</span><input value={form.title} maxLength={120} onChange={(event) => setField("title", event.target.value)} placeholder="أدخل عنوان الإشعار" /></label>
        <div className={styles.adminFormGrid}>
          <label className={styles.adminFormField}><span>نوع الإشعار</span><select value={form.notificationType} onChange={(event) => setField("notificationType", event.target.value)}>{Object.entries(NOTIFICATION_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className={styles.adminFormField}><span>الأولوية</span><select value={form.priority} onChange={(event) => setField("priority", event.target.value)}><option value="low">منخفضة</option><option value="normal">عادية</option><option value="high">عالية</option><option value="critical">حرجة</option></select></label>
          <label className={styles.adminFormField}><span>الجمهور المستهدف</span><select value={form.audienceType} onChange={(event) => setField("audienceType", event.target.value)}>{Object.entries(NOTIFICATION_AUDIENCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        <label className={styles.adminFormField}><span>محتوى الإشعار</span><textarea value={form.body} maxLength={2000} onChange={(event) => setField("body", event.target.value)} placeholder="اكتب محتوى واضحًا ومختصرًا..." /><small>{form.body.length}/2000</small></label>
        <div className={styles.adminNotificationSurfaces}>
          <strong>طريقة الظهور داخل المنصة</strong>
          {[["notification_center", "جرس الإشعارات"], ["in_app_toast", "تنبيه منبثق"], ["top_banner", "شريط أعلى المنصة"], ["blocking_modal", "نافذة إلزامية"]].map(([value, label]) => <label key={value}><input type="checkbox" checked={form.deliverySurfaces.includes(value)} onChange={() => toggleSurface(value)} />{label}</label>)}
        </div>
        <div className={styles.adminFormGrid}>
          <label className={styles.adminFormField}><span>نص زر الإجراء (اختياري)</span><input value={form.actionLabel} maxLength={40} onChange={(event) => setField("actionLabel", event.target.value)} /></label>
          <label className={styles.adminFormField}><span>رابط الإجراء</span><input value={form.actionUrl} onChange={(event) => setField("actionUrl", event.target.value)} placeholder="/dashboard/..." dir="ltr" /></label>
        </div>
        <div className={styles.adminFormGrid}>
          <label className={styles.adminFormField}><span>موعد الجدولة</span><input type="datetime-local" value={form.scheduledAt} onChange={(event) => setField("scheduledAt", event.target.value)} /></label>
          <label className={styles.adminFormField}><span>تاريخ الانتهاء (للشريط العلوي)</span><input type="datetime-local" value={form.expiresAt} onChange={(event) => setField("expiresAt", event.target.value)} /></label>
        </div>
        <div className={styles.adminNotificationOptions}><label><input type="checkbox" checked={form.pinned} onChange={(event) => setField("pinned", event.target.checked)} /> تثبيت أعلى القائمة</label><label><input type="checkbox" checked={form.requireAcknowledgement} onChange={(event) => setField("requireAcknowledgement", event.target.checked)} /> يتطلب تأكيد الاطلاع</label></div>
        <div className={styles.adminNotificationActions}><button disabled={busy} onClick={() => submit("now")} className={styles.adminPrimaryButton}>إرسال الآن</button><button disabled={busy || !form.scheduledAt} onClick={() => submit("scheduled")} className={styles.adminOutlineButton}>جدولة الإشعار</button><button disabled={busy} onClick={() => submit("draft")} className={styles.adminOutlineButton}>حفظ كمسودة</button></div>
      </article>
      <article className={styles.adminNotificationPreview}>
        <PanelTitle title="معاينة الإشعار" description="المكوّن نفسه المستخدم داخل لوحة المستخدم." />
        <div className={`${styles.adminPlatformNotificationCard} ${styles[`adminNotification_${form.notificationType}`]}`}>
          <span className={styles.adminNotificationBell}><Glyph name={form.notificationType === "security" ? "shield" : form.notificationType === "warning" ? "alert" : "bell"} /></span>
          <div><i>{previewType} · {form.priority === "critical" ? "حرج" : form.priority === "high" ? "عالي" : "عام"}</i><h3>{form.title || "عنوان الإشعار يظهر هنا"}</h3><p>{form.body || "اكتب محتوى الإشعار لمعاينته داخل المنصة."}</p>{form.actionLabel ? <button type="button">{form.actionLabel}</button> : null}<small>الآن</small></div>
        </div>
        <div className={styles.adminBellPreview}><div><Glyph name="bell" /><strong>الإشعارات</strong></div><article><span /><div><b>{form.title || "إشعار جديد"}</b><p>{form.body || "ستظهر معاينة مختصرة هنا."}</p></div></article></div>
        <div className={styles.adminEstimateBox}><Glyph name="users" /><div><strong>{ar(estimate)} مستخدم مؤهل</strong><span>هذا تقدير فقط، ولا ينشئ سجلات مستلمين.</span></div></div>
      </article>
    </section>
    <section id="admin-notification-log" className={styles.adminSurface}>
      <div className={styles.adminTabs}>{[["all", "الكل"], ["scheduled", "المجدولة"], ["published", "المنشورة"], ["draft", "المسودات"], ["cancelled", "الملغاة"]].map(([value, label]) => <button key={value} onClick={() => setStatus(value)} className={status === value ? styles.adminTabActive : ""}>{label}</button>)}</div>
      <SimpleTable rows={items} emptyTitle="لا توجد إشعارات منصة محفوظة" columns={[
        { key: "title", label: "العنوان" }, { key: "notificationType", label: "النوع", render: (value) => NOTIFICATION_TYPE_LABELS[value] || value },
        { key: "status", label: "الحالة", render: (value) => <StatusPill value={value} /> }, { key: "audienceType", label: "الجمهور", render: (value) => NOTIFICATION_AUDIENCE_LABELS[value] || value },
        { key: "createdRecipients", label: "المستلمون", render: ar }, { key: "readCount", label: "القراءات", render: ar },
        { key: "scheduledAt", label: "موعد النشر", render: (value, row) => formatDate(value || row.publishedAt || row.createdAt, true) }
      ]} />
    </section>
  </>;
}

function Devices({ data, stats }) {
  const [search, setSearch] = useState("");
  const rows = useMemo(() => (data.channels || []).filter((row) => `${row.displayName} ${row.phoneNumber} ${row.tenantName}`.toLowerCase().includes(search.toLowerCase())), [data.channels, search]);
  return <>
    <div className={styles.adminBannerGrid}>
      <div className={`${styles.adminModeBanner} ${styles.adminModeGreen}`}><span><Glyph name="database" /></span><div><strong>الإدارة المركزية عبر Evolution Admin</strong><p>قنوات المنصة الإدارية معزولة عن قنوات المستخدمين النهائيين.</p></div></div>
      <div className={styles.adminModeBanner}><span><Glyph name="link" /></span><div><strong>ربط المستخدمين عبر Meta Cloud API</strong><p>تتم إدارة قنوات كل مساحة عمل من لوحة المستخدم الخاصة بها.</p></div></div>
    </div>
    <KpiGrid items={[
      { label: "حالة الاتصال", value: stats.connectedChannels ? "متصل" : "لا توجد قناة", helper: "من القنوات المسجلة", icon: "chart", tone: "green" },
      { label: "التنبيهات", value: ar(stats.risks.high + stats.risks.critical), helper: "تحتاج متابعة", icon: "bell", tone: "orange" },
      { label: "القنوات المتصلة", value: ar(stats.connectedChannels), helper: "قناة فعالة", icon: "users", tone: "violet" },
      { label: "الأرقام المرتبطة", value: ar((data.channels || []).filter((row) => row.phoneNumber).length), helper: "رقم محفوظ", icon: "device", tone: "green" }
    ]} />
    <section className={styles.adminSurface}>
      <div className={styles.adminActionRow}><button className={styles.adminPrimaryButton}>إضافة قناة جديدة +</button></div>
      <SearchFilters value={search} onChange={setSearch} searchPlaceholder="بحث في الأجهزة..." placeholders={["كل الحالات", "كل المتاجر"]} />
      <SimpleTable emptyTitle="لا توجد أجهزة أو قنوات مسجلة" rows={rows} columns={[
        { key: "displayName", label: "اسم القناة" }, { key: "phoneNumber", label: "رقم الهاتف" }, { key: "tenantName", label: "المتجر المرتبط" },
        { key: "healthScore", label: "درجة الصحة", render: (value) => value == null ? "—" : `${value}%` },
        { key: "status", label: "الحالة", render: (value) => <StatusPill value={value} /> }, { key: "lastCheckAt", label: "آخر مزامنة", render: formatDate }
      ]} />
    </section>
  </>;
}

const PROVIDER_INFO = {
  meta: ["Meta Cloud API", "ربط واتساب الرسمي لمتاجر المستخدمين", "link"],
  meta_cloud_api: ["Meta Cloud API", "ربط واتساب الرسمي لمتاجر المستخدمين", "link"],
  evolution: ["Evolution Admin", "قناة واتساب الإدارية المركزية", "device"],
  resend: ["Resend", "إرسال البريد الإلكتروني للرسائل والتنبيهات", "mail"],
  salla: ["سلة", "مزامنة الطلبات والعملاء والمنتجات", "store"],
  database: ["PostgreSQL", "قاعدة بيانات المنصة", "database"],
  redis: ["Queue / Redis", "طوابير المهام والرسائل", "database"]
};

function Integrations({ data }) {
  const rows = data.integrationHealth || [];
  return <>
    <KpiGrid items={[
      { label: "التطبيقات المسجلة", value: ar(rows.length), helper: "فحص تكامل حقيقي", icon: "link", tone: "green" },
      { label: "التكاملات النشطة", value: ar(rows.filter((row) => row.status === "healthy").length), helper: "سليمة حاليًا", icon: "chart", tone: "violet" },
      { label: "أخطاء المزامنة", value: ar(rows.reduce((sum, row) => sum + n(row.errorCount), 0)), helper: "من سجلات الفحص", icon: "alert", tone: "red" },
      { label: "آخر مزامنة", value: rows.length ? formatDate(rows.map((row) => row.lastCheckedAt).filter(Boolean).sort().at(-1)) : "—", helper: "آخر فحص مسجل", icon: "clock", tone: "green" }
    ]} />
    <section className={styles.adminSurface}>
      <div className={styles.adminActionRow}><button className={styles.adminOutlineButton}>إضافة تطبيق جديد +</button></div>
      {!rows.length ? <Empty title="لا توجد تكاملات مفحوصة" description="ستظهر التكاملات بعد تشغيل فحص الصحة أو تهيئة المزود." /> : <div className={styles.adminIntegrationGrid}>{rows.map((row) => {
        const info = PROVIDER_INFO[row.provider] || [row.provider, "تكامل منصة مسجل", "link"];
        return <article key={row.provider}><div className={styles.adminIntegrationHead}><span><Glyph name={info[2]} /></span><div><h3>{info[0]}</h3><p>{info[1]}</p></div><StatusPill value={row.status} /></div><div className={styles.adminIntegrationMeta}><span>زمن الاستجابة <b>{row.responseTimeMs == null ? "—" : `${row.responseTimeMs}ms`}</b></span><span>آخر فحص <b>{formatDate(row.lastCheckedAt)}</b></span></div><div className={styles.adminIntegrationActions}><button>فتح الإعدادات</button><button>اختبار الاتصال</button><button>عرض السجل</button></div></article>;
      })}</div>}
    </section>
  </>;
}

function Security({ data, stats }) {
  const risks = n(stats.risks.critical) + n(stats.risks.high);
  const integrationRows = data.integrationHealth || [];
  const integrationErrors = integrationRows.filter((row) => ["error", "degraded"].includes(row.status)).length;
  const score = Math.max(0, Math.min(100, 100 - n(stats.risks.critical) * 20 - n(stats.risks.high) * 8 - integrationErrors * 4));
  const platformScore = integrationRows.length ? Math.round((integrationRows.filter((row) => row.status === "healthy").length / integrationRows.length) * 100) : 0;
  return <>
    <KpiGrid items={[
      { label: "الخطر الحالي", value: risks ? ar(risks) : "منخفض", helper: `${ar(stats.risks.critical)} حرجة`, icon: "alert", tone: risks ? "orange" : "green" },
      { label: "أمان المنصة", value: `${platformScore}%`, helper: "بحسب صحة التكاملات", icon: "database", tone: "violet" },
      { label: "أمان الحسابات", value: `${score}%`, helper: `${ar(stats.activeSessions)} جلسة نشطة`, icon: "users", tone: "blue" },
      { label: "مؤشر الحماية العام", value: `${score}/100`, helper: score >= 85 ? "ممتاز" : score >= 60 ? "جيد" : "يحتاج إجراء", icon: "shield", tone: "green" }
    ]} />
    <section className={styles.adminSecurityGrid}>
      <article className={styles.adminGaugeCard}><div className={styles.adminCardHead}><div><h3>مؤشر الحماية العام</h3><p>تقييم ديناميكي من السجلات الحالية</p></div></div><div className={styles.adminGauge} style={{ "--score": `${score * 3.6}deg` }}><div><strong>{score}</strong><span>/100</span></div></div><b>{score >= 85 ? "ممتاز" : score >= 60 ? "جيد" : "يتطلب متابعة"}</b></article>
      <article className={styles.adminListCard}><div className={styles.adminCardHead}><div><h3>تنبيهات الأمن</h3><p>التنبيهات والمخاطر المسجلة</p></div></div><div className={styles.adminSecuritySummary}><div><span>مخاطر حرجة</span><b>{ar(stats.risks.critical)}</b></div><div><span>مخاطر مرتفعة</span><b>{ar(stats.risks.high)}</b></div><div><span>إشعارات غير مقروءة</span><b>{ar(stats.unreadNotifications)}</b></div><div><span>فشل الإرسال</span><b>{ar(stats.queue.failed)}</b></div></div></article>
      <ActivityList rows={data.recentAudit} />
    </section>
    <section className={styles.adminSecurityBottom}>
      <article><h3>سياسات الحماية</h3>{["المصادقة متعددة العوامل", "سجل التدقيق الإداري", "عزل مساحات العمل", "تشفير كلمات المرور"].map((label) => <div key={label}><span>{label}</span><StatusPill value="active" /></div>)}</article>
      <article><h3>الجلسات النشطة</h3><div><span>جلسات صالحة حاليًا</span><strong>{ar(stats.activeSessions)}</strong></div><div><span>آخر دخول للأدمن</span><strong>{formatDate(data.adminUsers?.[0]?.lastLoginAt, true)}</strong></div></article>
      <article><h3>الامتثال والتدقيق</h3>{["الاحتفاظ بسجل العمليات", "عدم عرض أسرار التكامل", "تقييد الوصول الإداري", "مراجعة المخاطر"].map((label) => <div key={label}><span>{label}</span><Glyph name="check" /></div>)}</article>
    </section>
  </>;
}

function Reports({ data, stats }) {
  const metrics = data.dailyMetrics || [];
  return <>
    <div className={styles.adminReportFilters}><select defaultValue=""><option value="">نطاق التاريخ</option></select><select defaultValue=""><option value="">كل المتاجر</option></select><select defaultValue=""><option value="">كل القنوات</option></select><button className={styles.adminOutlineButton}>تصدير التقرير</button></div>
    <KpiGrid items={[
      { label: "الإيرادات", value: `${ar(stats.monthlyRevenue)} ر.س`, helper: "إيراد شهري محسوب", icon: "database", tone: "violet", values: metrics.map((m) => m.revenue) },
      { label: "الرسائل الفاشلة", value: ar(stats.queue.failed), helper: "من الطابور الفعلي", icon: "alert", tone: "red", values: metrics.map((m) => m.failed) },
      { label: "معدل التسليم", value: `${stats.deliveryRate}%`, helper: "من الإرسال المسجل", icon: "check", tone: "blue", values: metrics.map((m) => m.delivered) },
      { label: "الرسائل المرسلة", value: ar(stats.queue.sent), helper: "كل القنوات", icon: "send", tone: "cyan", values: metrics.map((m) => m.accepted) },
      { label: "إجمالي الرسائل", value: ar(stats.queue.total), helper: "كل الحالات", icon: "store", tone: "green", values: metrics.map((m) => m.accepted) }
    ]} />
    <section className={styles.adminReportsGrid}>
      <TrendChart metrics={metrics} title="اتجاه الأداء" keys={[{ key: "accepted", label: "المرسلة", color: "#2563eb" }, { key: "delivered", label: "تم التسليم", color: "#12a66a" }, { key: "failed", label: "الفاشلة", color: "#ef4444" }]} />
      <TrendChart metrics={metrics} title="اتجاه الإيرادات" keys={[{ key: "revenue", label: "الإيرادات", color: "#12a66a" }]} />
      <TrendChart metrics={metrics} title="نمو الاشتراكات" keys={[{ key: "activeSubscriptions", label: "الاشتراكات", color: "#7c3aed" }, { key: "activeUsers", label: "المستخدمون", color: "#2563eb" }]} />
    </section>
    <section className={styles.adminSurface}><PanelTitle title="التقارير المتاحة" description="تقارير قابلة للتصدير من البيانات الفعلية" />
      <SimpleTable rows={[
        { id: "daily", name: "تقرير الأداء اليومي", description: "ملخص الرسائل ومعدل التسليم", range: metrics.length ? `${formatDate(metrics[0]?.date)} — ${formatDate(metrics.at(-1)?.date)}` : "لا توجد بيانات" },
        { id: "stores", name: "تقرير المتاجر", description: "أداء المتاجر وحجم الرسائل", range: `${ar(data.stores?.length)} متجر في النتائج الحالية` },
        { id: "security", name: "تقرير الحماية", description: "المخاطر وسجل التدقيق", range: `${ar(data.recentAudit?.length)} سجل ظاهر` }
      ]} columns={[{ key: "name", label: "اسم التقرير" }, { key: "description", label: "الوصف" }, { key: "range", label: "نطاق البيانات" }]} />
    </section>
  </>;
}

function SettingCard({ icon, title, description, children }) {
  return <article className={styles.adminSettingCard}><div className={styles.adminCardHead}><span><Glyph name={icon} /></span><div><h3>{title}</h3><p>{description}</p></div></div><div className={styles.adminSettingBody}>{children}</div></article>;
}

function SafeField({ label, value }) {
  return <label className={styles.adminSafeField}><span>{label}</span><input value={value || "غير مضبوط"} readOnly /></label>;
}

function Settings({ data, stats, admin }) {
  const provider = (name) => (data.integrationHealth || []).find((row) => row.provider?.toLowerCase().includes(name));
  const whatsapp = provider("meta") || provider("evolution");
  const email = provider("resend") || provider("email");
  return <>
    <section className={styles.adminSettingsGrid}>
      <SettingCard icon="users" title="الحساب الشخصي" description="بيانات المسؤول الحالي"><SafeField label="الاسم" value={admin.name} /><SafeField label="البريد الإلكتروني" value={admin.email} /><SafeField label="الدور" value={admin.role} /><button className={styles.adminOutlineButton}>تغيير كلمة المرور</button></SettingCard>
      <SettingCard icon="send" title="إعدادات واتساب" description="حالة قناة المنصة الإدارية"><div className={styles.adminSettingStatus}><span>حالة التكامل</span><StatusPill value={whatsapp?.status || "not_configured"} /></div><SafeField label="المزود" value={whatsapp?.provider} /><SafeField label="آخر فحص" value={formatDate(whatsapp?.lastCheckedAt, true)} /></SettingCard>
      <SettingCard icon="mail" title="إعدادات البريد" description="إرسال رسائل المنصة والتنبيهات"><div className={styles.adminSettingStatus}><span>حالة المزود</span><StatusPill value={email?.status || "not_configured"} /></div><SafeField label="المزود" value={email?.provider} /><SafeField label="آخر فحص" value={formatDate(email?.lastCheckedAt, true)} /></SettingCard>
      <SettingCard icon="settings" title="هوية المنصة" description="الهوية البصرية المعتمدة"><SafeField label="اسم المنصة" value="Renvix" /><SafeField label="اللغة الافتراضية" value="العربية" /><SafeField label="النمط" value="فاتح" /></SettingCard>
      <SettingCard icon="shield" title="الصلاحيات العامة" description="سياسات الوصول الحالية"><div className={styles.adminSettingStatus}><span>المصادقة متعددة العوامل</span><StatusPill value={data.adminUsers?.[0]?.mfaEnabled ? "active" : "disabled"} /></div><div className={styles.adminSettingStatus}><span>الجلسات النشطة</span><strong>{ar(stats.activeSessions)}</strong></div><div className={styles.adminSettingStatus}><span>سجل التدقيق</span><StatusPill value="active" /></div></SettingCard>
      <SettingCard icon="bell" title="التنبيهات" description="مؤشرات التنبيه من السجلات"><div className={styles.adminSettingStatus}><span>تنبيهات غير مقروءة</span><strong>{ar(stats.unreadNotifications)}</strong></div><div className={styles.adminSettingStatus}><span>مخاطر حرجة</span><strong>{ar(stats.risks.critical)}</strong></div><div className={styles.adminSettingStatus}><span>رسائل فاشلة</span><strong>{ar(stats.queue.failed)}</strong></div></SettingCard>
    </section>
    <section className={styles.adminSurface}><PanelTitle title="سجلات النظام" description="آخر العمليات الإدارية الحساسة المسجلة" /><SimpleTable rows={data.recentAudit} emptyTitle="لا توجد سجلات إدارية" columns={[{ key: "name", label: "المسؤول" }, { key: "action", label: "العملية" }, { key: "resource", label: "المورد" }, { key: "status", label: "الحالة", render: (value) => <StatusPill value={value} /> }, { key: "createdAt", label: "الوقت", render: (value) => formatDate(value, true) }]} /></section>
  </>;
}

export const SPECIAL_ADMIN_PANELS = new Set(["overview", "subscriptions", "customers", "stores", "notifications", "templates", "devices", "integrations", "security", "reports", "settings"]);

export default function AdminSectionView({ panel, data, stats, admin }) {
  if (!data || !stats) return null;
  const components = {
    overview: Overview, subscriptions: Subscriptions, customers: Customers, stores: Stores, notifications: Notifications, templates: Templates,
    devices: Devices, integrations: Integrations, security: Security, reports: Reports, settings: Settings
  };
  const Component = components[panel];
  return Component ? <Component data={data} stats={stats} admin={admin} /> : null;
}
