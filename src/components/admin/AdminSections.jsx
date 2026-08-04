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
  wallet: '<path d="M4 7V5a2 2 0 0 1 2-2h12v4"/><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M16 12h5v4h-5a2 2 0 0 1 0-4Z"/>',
  swap: '<path d="M7 7h11l-3-3M17 17H6l3 3"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"/>',
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

const MANAGE_CUSTOMER_ROLES = new Set(["super_admin", "operations_admin", "admin", "billing_admin"]);

function TenantActions({ row, plans = [], onComplete, canManage = false }) {
  const [action, setAction] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [planId, setPlanId] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const tenantName = row.tenantName || row.name || "العميل";

  function open(nextAction) {
    setAction(nextAction);
    setAmount("");
    setNote("");
    setConfirmation("");
    setPlanId(plans.find((plan) => plan.name === row.planName)?.id || plans[0]?.id || "");
    setError("");
    setSuccess("");
  }

  async function submit(event) {
    event.preventDefault();
    if (!row.tenantId) return setError("تعذر تحديد مساحة عمل العميل.");
    setBusy(true);
    setError("");
    try {
      const body = action === "add_credit"
        ? { action, amount: Number(amount), note: note.trim() }
        : action === "change_plan"
          ? { action, planId }
          : { action, confirmation: confirmation.trim() };
      const response = await fetch(`/api/admin/tenants/${row.tenantId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const messages = {
          confirmation_mismatch: "اكتب اسم مساحة العمل كما هو لتأكيد الإزالة.",
          admin_tenant_cannot_be_removed: "لا يمكن إزالة مساحة عمل مرتبطة بحساب أدمن نشط.",
          customer_removed: "هذا العميل مُزال بالفعل ولا يمكن تعديل رصيده أو باقته.",
          plan_not_found: "الباقة المحددة غير متاحة حاليًا."
        };
        throw new Error(messages[payload.reason] || "تعذر تنفيذ العملية. حاول مرة أخرى.");
      }
      setSuccess(payload.message || "تم تنفيذ العملية بنجاح.");
      await onComplete?.();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  if (!canManage) return <span className={styles.adminReadOnlyLabel}>عرض فقط</span>;
  const submitDisabled = busy || success || (action === "add_credit" && (!Number.isFinite(Number(amount)) || Number(amount) < 1))
    || (action === "change_plan" && !planId)
    || (action === "remove_customer" && confirmation.trim() !== tenantName);
  return <>
    <div className={styles.adminCustomerActions} aria-label={`إدارة ${tenantName}`}>
      <button type="button" onClick={() => open("add_credit")} title="إضافة رصيد"><Glyph name="wallet" /><span>رصيد</span></button>
      <button type="button" onClick={() => open("change_plan")} title="تغيير الباقة"><Glyph name="swap" /><span>الباقة</span></button>
      <button type="button" className={styles.adminCustomerRemoveButton} onClick={() => open("remove_customer")} title="إزالة العميل"><Glyph name="trash" /><span>إزالة</span></button>
    </div>
    {action ? <div className={styles.adminCustomerModalBackdrop} role="presentation" onMouseDown={() => !busy && setAction("")}>
      <section className={styles.adminCustomerModal} role="dialog" aria-modal="true" aria-labelledby="admin-customer-action-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span className={`${styles.adminCustomerModalIcon} ${action === "remove_customer" ? styles.adminCustomerModalIconDanger : ""}`}><Glyph name={action === "add_credit" ? "wallet" : action === "change_plan" ? "swap" : "trash"} /></span>
            <div><h2 id="admin-customer-action-title">{action === "add_credit" ? "إضافة رصيد العميل" : action === "change_plan" ? "تغيير باقة العميل" : "إزالة العميل"}</h2><p>{tenantName}</p></div>
          </div>
          <button type="button" aria-label="إغلاق" disabled={busy} onClick={() => setAction("")}>×</button>
        </header>
        {success ? <div className={styles.adminCustomerActionSuccess}><Glyph name="check" /><div><strong>تمت العملية بنجاح</strong><p>{success}</p></div></div> : <form onSubmit={submit}>
          {action === "add_credit" ? <>
            <div className={styles.adminCurrentBalance}><span>الرصيد الحالي</span><strong>{Number(row.walletBalance || 0).toLocaleString("en-US")} ر.س</strong></div>
            <label><span>المبلغ المراد إضافته (ر.س)</span><input autoFocus type="number" min="1" max="100000" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="مثال: 100" /></label>
            <label><span>ملاحظة العملية <small>اختياري</small></span><input value={note} maxLength={240} onChange={(event) => setNote(event.target.value)} placeholder="سبب إضافة الرصيد" /></label>
            <p className={styles.adminCustomerActionHint}>ستُحفظ الإضافة كعملية تعديل إداري في سجل محفظة العميل وسجل التدقيق.</p>
          </> : null}
          {action === "change_plan" ? <>
            <div className={styles.adminPlanChangeSummary}><div><span>الباقة الحالية</span><strong>{row.planName || "غير محددة"}</strong></div><Glyph name="swap" /><div><span>الباقة الجديدة</span><strong>{plans.find((plan) => plan.id === planId)?.name || "اختر الباقة"}</strong></div></div>
            <label><span>اختر الباقة الجديدة</span><select autoFocus value={planId} onChange={(event) => setPlanId(event.target.value)}>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} — {Number(plan.monthlyPriceSar || 0).toLocaleString("en-US")} ر.س/شهر</option>)}</select></label>
            <p className={styles.adminCustomerActionHint}>يُحدّث هذا الخيار صلاحيات باقة Renvix فورًا، ولا ينشئ عملية خصم جديدة لدى مزود الدفع الخارجي.</p>
          </> : null}
          {action === "remove_customer" ? <>
            <div className={styles.adminCustomerDangerNote}><Glyph name="alert" /><div><strong>عملية حساسة</strong><p>سيُعطّل الحساب، وتُلغى اشتراكاته النشطة وتنتهي جلساته فورًا، مع الاحتفاظ بالسجلات والفواتير لأغراض المراجعة.</p></div></div>
            <label><span>اكتب اسم مساحة العمل للتأكيد</span><input autoFocus value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={tenantName} autoComplete="off" /></label>
          </> : null}
          {error ? <div className={styles.adminCustomerActionError}>{error}</div> : null}
          <footer><button type="submit" disabled={submitDisabled} className={action === "remove_customer" ? styles.adminDangerButton : styles.adminPrimaryButton}>{busy ? "جارٍ التنفيذ..." : action === "remove_customer" ? "تأكيد إزالة العميل" : "حفظ وتنفيذ"}</button><button type="button" className={styles.adminOutlineButton} disabled={busy} onClick={() => setAction("")}>إلغاء</button></footer>
        </form>}
        {success ? <footer><button type="button" className={styles.adminPrimaryButton} onClick={() => setAction("")}>إغلاق</button></footer> : null}
      </section>
    </div> : null}
  </>;
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

function Subscriptions({ data, stats, admin, onRefresh }) {
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
        { key: "paymentProvider", label: "مزود الدفع" }, { key: "status", label: "الحالة", render: (value) => <StatusPill value={value} /> },
        { key: "actions", label: "إدارة العميل", render: (_value, row) => <TenantActions row={row} plans={data.plans || []} onComplete={onRefresh} canManage={MANAGE_CUSTOMER_ROLES.has(admin.role)} /> }
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

function Stores({ data, stats, admin, onRefresh }) {
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
          { key: "sallaStatus", label: "سلة", render: (value) => <StatusPill value={value} /> }, { key: "status", label: "الحالة", render: (value) => <StatusPill value={value} /> },
          { key: "actions", label: "إدارة العميل", render: (_value, row) => <TenantActions row={row} plans={data.plans || []} onComplete={onRefresh} canManage={MANAGE_CUSTOMER_ROLES.has(admin.role)} /> }
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

const ADMIN_DEVICE_STATUS_OPTIONS = [
  ["", "كل الحالات"], ["connected", "متصل"], ["pending", "بانتظار الاقتران"],
  ["disconnected", "غير متصل"], ["needs_attention", "يحتاج متابعة"]
];

function relativeAdminTime(value) {
  if (!value) return "لا توجد مزامنة";
  const elapsed = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return formatDate(value, true);
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `منذ ${ar(minutes)} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${ar(hours)} ساعة`;
  return `منذ ${ar(Math.floor(hours / 24))} يوم`;
}

async function adminDeviceRequest(url, options) {
  const response = await fetch(url, { cache: "no-store", ...options });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload.message || payload.reason || "device_request_failed"), { status: response.status, reason: payload.reason });
  return payload;
}

function AdminDeviceStatus({ device }) {
  return <span className={`${styles.adminDeviceStatus} ${styles[`adminDeviceStatus_${device.status}`] || ""}`}><i />{device.statusLabel}</span>;
}

function Devices() {
  const [payload, setPayload] = useState({ devices: [], stores: [], stats: { total: 0, connected: 0, attention: 0, messagesToday: 0 }, pagination: { page: 1, pageSize: 20, total: 0 } });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [storeId, setStoreId] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [drawer, setDrawer] = useState("");
  const [selected, setSelected] = useState(null);
  const [menuId, setMenuId] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [pairingTab, setPairingTab] = useState("qr");
  const [pairing, setPairing] = useState({ qrCode: "", pairingCode: "", expiresAt: 0 });
  const [pairingPhone, setPairingPhone] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [detailsTab, setDetailsTab] = useState("details");
  const [policyForm, setPolicyForm] = useState(null);
  const [createStep, setCreateStep] = useState(1);
  const [createForm, setCreateForm] = useState({ displayName: "", storeId: "", phoneNumber: "", method: "qr" });

  const loadDevices = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      if (storeId) params.set("storeId", storeId);
      const result = await adminDeviceRequest(`/api/admin/evolution/devices?${params}`);
      setPayload(result);
    } catch {
      setError("تعذر تحميل أجهزة Evolution الإدارية حاليًا.");
    } finally {
      setLoading(false);
    }
  }, [page, search, status, storeId]);

  useEffect(() => {
    const timer = setTimeout(loadDevices, search ? 280 : 0);
    return () => clearTimeout(timer);
  }, [loadDevices, search]);

  useEffect(() => {
    if (!pairing.expiresAt) return undefined;
    const update = () => setSecondsLeft(Math.max(0, Math.ceil((pairing.expiresAt - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [pairing.expiresAt]);

  async function openDetails(device) {
    setDrawer("details");
    setDetailsTab("details");
    setSelected(device);
    setBusy("details");
    try {
      const result = await adminDeviceRequest(`/api/admin/evolution/devices/${encodeURIComponent(device.id)}`);
      setSelected(result.device);
      setPolicyForm(result.device.policy || null);
    } catch {
      setNotice("تعذر تحميل تفاصيل الجهاز.");
    } finally {
      setBusy("");
    }
  }

  function openPairing(device, tab = "qr") {
    setSelected(device);
    setPairingTab(tab);
    setPairing({ qrCode: "", pairingCode: "", expiresAt: 0 });
    setPairingPhone("");
    setDrawer("pairing");
  }

  async function runAction(device, action, extra = {}) {
    setBusy(action);
    setNotice("");
    try {
      const result = await adminDeviceRequest(`/api/admin/evolution/devices/${encodeURIComponent(device.id)}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra })
      });
      if (action === "qr") setPairing({ qrCode: result.qrCode, pairingCode: "", expiresAt: Date.now() + Number(result.expiresIn || 60) * 1000 });
      if (action === "pairing_code") setPairing({ qrCode: "", pairingCode: result.pairingCode, expiresAt: Date.now() + Number(result.expiresIn || 60) * 1000 });
      if (["refresh", "reconnect", "logout"].includes(action)) {
        setNotice(action === "refresh" ? "تم تحديث حالة الجهاز." : action === "logout" ? "تم تسجيل الخروج من الجهاز." : "بدأت إعادة اتصال الجهاز.");
        await loadDevices();
      }
      return result;
    } catch (actionError) {
      setNotice(actionError.reason === "rate_limited" ? "تم بلوغ حد المحاولات المؤقت. حاول لاحقًا." : "تعذر تنفيذ العملية. تحقق من إعداد Evolution وحالة الاتصال.");
      return null;
    } finally {
      setBusy("");
      setMenuId("");
    }
  }

  async function createDevice() {
    setBusy("create");
    setNotice("");
    try {
      const result = await adminDeviceRequest("/api/admin/evolution/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm)
      });
      setSelected(result.device);
      setPairingTab(createForm.method);
      setPairingPhone(createForm.phoneNumber);
      setDrawer("pairing");
      setCreateStep(1);
      setCreateForm({ displayName: "", storeId: "", phoneNumber: "", method: "qr" });
      await loadDevices();
    } catch {
      setNotice("تعذر إنشاء الجهاز. تحقق من إعداد Evolution وعدم تكرار الجلسة.");
    } finally {
      setBusy("");
    }
  }

  async function deleteDevice(device) {
    if (!window.confirm(`سيتم حذف الجهاز «${device.displayName}» وجلسة Evolution نهائيًا. هل تريد المتابعة؟`)) return;
    setBusy("delete");
    try {
      await adminDeviceRequest(`/api/admin/evolution/devices/${encodeURIComponent(device.id)}`, { method: "DELETE" });
      setNotice("تم حذف الجهاز والجلسة المرتبطة به.");
      setDrawer("");
      await loadDevices();
    } catch {
      setNotice("تعذر حذف الجهاز.");
    } finally {
      setBusy("");
      setMenuId("");
    }
  }

  async function savePolicy() {
    if (!selected?.id || !policyForm) return;
    setBusy("policy");
    setNotice("");
    try {
      const result = await adminDeviceRequest(`/api/admin/evolution/devices/${encodeURIComponent(selected.id)}/sending-policy`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policyForm)
      });
      setPolicyForm(result.policy);
      setSelected((value) => ({ ...value, policy: result.policy }));
      setNotice("تم حفظ سياسة حماية الإرسال لهذا الجهاز فقط.");
    } catch (policyError) {
      setNotice(policyError.status === 403 ? "لا تملك صلاحية إدارة سياسة الإرسال." : "تعذر حفظ سياسة الإرسال. راجع القيم وحاول مجددًا.");
    } finally {
      setBusy("");
    }
  }

  const hasFilters = Boolean(search || status || storeId);
  const pages = Math.max(1, Math.ceil(payload.pagination.total / payload.pagination.pageSize));
  return <>
    <div className={styles.adminDevicesToolbar}>
      <button type="button" className={styles.adminPrimaryButton} onClick={() => { setDrawer("create"); setCreateStep(1); setNotice(""); }}><Glyph name="device" /> إضافة جهاز</button>
      <button type="button" className={styles.adminOutlineButton} onClick={loadDevices} disabled={loading}><Glyph name="refresh" /> تحديث الحالات</button>
    </div>

    <section className={styles.adminDeviceKpis} aria-label="مؤشرات الأجهزة">
      <article><span><Glyph name="device" /></span><div><small>إجمالي الأجهزة</small><strong>{ar(payload.stats.total)}</strong><p>{ar(payload.stats.messagesToday)} رسالة اليوم</p></div></article>
      <article><span className={styles.adminDeviceKpiGreen}><Glyph name="check" /></span><div><small>الأجهزة المتصلة</small><strong>{ar(payload.stats.connected)}</strong><p>جاهزة للإرسال</p></div></article>
      <article><span className={styles.adminDeviceKpiOrange}><Glyph name="alert" /></span><div><small>تحتاج متابعة</small><strong>{ar(payload.stats.attention)}</strong><p>اقتران أو اتصال مطلوب</p></div></article>
    </section>

    <section className={`${styles.adminSurface} ${styles.adminDevicesSurface}`}>
      <div className={styles.adminDeviceFilters}>
        <label className={styles.adminDeviceSearch}><Glyph name="chart" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="ابحث باسم الجهاز، المتجر أو رقم الهاتف..." /></label>
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} aria-label="تصفية حسب الحالة">{ADMIN_DEVICE_STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select value={storeId} onChange={(event) => { setStoreId(event.target.value); setPage(1); }} aria-label="تصفية حسب المتجر"><option value="">جميع المتاجر</option>{payload.stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select>
        {hasFilters ? <button type="button" className={styles.adminResetButton} onClick={() => { setSearch(""); setStatus(""); setStoreId(""); setPage(1); }}><Glyph name="refresh" /> مسح الفلاتر</button> : null}
      </div>
      {notice ? <div className={styles.adminDeviceNotice}>{notice}</div> : null}
      {error ? <div className={styles.adminDeviceError}>{error}</div> : null}
      {loading ? <div className={styles.adminDeviceLoading}>جارٍ تحميل الأجهزة...</div> : !payload.devices.length ? <Empty title="لا توجد أجهزة Evolution إدارية" description="أضف جهازًا جديدًا ثم أنشئ رمز QR أو رمز اقتران عند الحاجة." /> : <div className={styles.adminDevicesTableWrap}><table><thead><tr><th>الجهاز</th><th>المتجر المرتبط</th><th>رقم واتساب</th><th>الحالة</th><th>آخر ظهور</th><th>الرسائل</th><th>الإجراءات</th></tr></thead><tbody>{payload.devices.map((device) => <tr key={device.id}>
        <td><div className={styles.adminDeviceName}><span><Glyph name="device" /></span><div><strong>{device.displayName}</strong><small dir="ltr">{device.instanceName}</small></div></div></td>
        <td>{device.storeName}</td><td dir="ltr">{device.phoneNumber}</td><td><AdminDeviceStatus device={device} /></td>
        <td><strong className={styles.adminDeviceRelative}>{relativeAdminTime(device.lastSeenAt)}</strong></td>
        <td><strong>{ar(device.metrics.sent)}</strong><small className={styles.adminDeviceCellHint}>{ar(device.metrics.today)} اليوم</small></td>
        <td><div className={styles.adminDeviceActions}><button type="button" onClick={() => openDetails(device)}>التفاصيل</button><div><button type="button" aria-label="المزيد من الإجراءات" onClick={() => setMenuId(menuId === device.id ? "" : device.id)}>•••</button>{menuId === device.id ? <div className={styles.adminDeviceMenu}>
          <button type="button" onClick={() => runAction(device, "refresh")}>تحديث الحالة</button>
          <button type="button" onClick={() => runAction(device, "reconnect")}>إعادة الاتصال</button>
          <button type="button" onClick={() => openPairing(device)}>تجديد الاقتران</button>
          <button type="button" onClick={() => runAction(device, "logout")}>تسجيل الخروج</button>
          <button type="button" className={styles.adminDeviceDanger} onClick={() => deleteDevice(device)}>حذف الجهاز</button>
        </div> : null}</div></div></td>
      </tr>)}</tbody></table></div>}
      {payload.pagination.total > payload.pagination.pageSize ? <div className={styles.adminDevicePagination}><span>صفحة {ar(page)} من {ar(pages)}</span><div><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>السابق</button><button type="button" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>التالي</button></div></div> : null}
    </section>

    {drawer ? <div className={styles.adminDeviceDrawerOverlay} onMouseDown={(event) => { if (event.target === event.currentTarget) setDrawer(""); }}><aside className={styles.adminDeviceDrawer} aria-label={drawer === "create" ? "إضافة جهاز" : drawer === "pairing" ? "اقتران الجهاز" : "تفاصيل الجهاز"}>
      <header><div><span><Glyph name={drawer === "pairing" ? "link" : "device"} /></span><div><h2>{drawer === "create" ? "إضافة جهاز جديد" : drawer === "pairing" ? "ربط جهاز واتساب" : selected?.displayName}</h2><p>{drawer === "create" ? `الخطوة ${createStep} من 2` : selected?.instanceName}</p></div></div><button type="button" aria-label="إغلاق" onClick={() => setDrawer("")}>×</button></header>
      <div className={styles.adminDeviceDrawerBody}>
        {drawer === "create" ? <>
          {createStep === 1 ? <div className={styles.adminDeviceForm}>
            <label>اسم الجهاز<input value={createForm.displayName} onChange={(event) => setCreateForm((value) => ({ ...value, displayName: event.target.value }))} placeholder="مثال: جهاز الدعم الرئيسي" /></label>
            <label>المتجر<select value={createForm.storeId} onChange={(event) => setCreateForm((value) => ({ ...value, storeId: event.target.value }))}><option value="">اختر المتجر</option>{payload.stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>
            <label>رقم واتساب (اختياري)<input dir="ltr" inputMode="tel" value={createForm.phoneNumber} onChange={(event) => setCreateForm((value) => ({ ...value, phoneNumber: event.target.value.replace(/\D/g, "") }))} placeholder="9665XXXXXXXX" /></label>
            <button type="button" className={styles.adminPrimaryButton} disabled={!createForm.displayName.trim() || !createForm.storeId} onClick={() => setCreateStep(2)}>التالي</button>
          </div> : <div className={styles.adminDeviceForm}>
            <h3>اختر طريقة الربط</h3><div className={styles.adminPairingChoice}><button type="button" className={createForm.method === "qr" ? styles.adminPairingChoiceActive : ""} onClick={() => setCreateForm((value) => ({ ...value, method: "qr" }))}><Glyph name="chart" /><strong>رمز QR</strong><small>مسح الرمز من واتساب</small></button><button type="button" className={createForm.method === "code" ? styles.adminPairingChoiceActive : ""} onClick={() => setCreateForm((value) => ({ ...value, method: "code" }))}><Glyph name="link" /><strong>رمز اقتران</strong><small>ربط باستخدام رقم الهاتف</small></button></div>
            {notice ? <div className={styles.adminDeviceError}>{notice}</div> : null}<div className={styles.adminDeviceFormActions}><button type="button" className={styles.adminOutlineButton} onClick={() => setCreateStep(1)}>السابق</button><button type="button" className={styles.adminPrimaryButton} disabled={busy === "create" || (createForm.method === "code" && !/^\d{8,15}$/.test(createForm.phoneNumber))} onClick={createDevice}>{busy === "create" ? "جارٍ الإنشاء..." : "إنشاء وبدء الربط"}</button></div>
          </div>}
        </> : null}

        {drawer === "details" && selected ? <div className={styles.adminDeviceDetails}>
          <nav className={styles.adminDeviceDetailsTabs} aria-label="أقسام تفاصيل الجهاز"><button type="button" className={detailsTab === "details" ? styles.adminDeviceDetailsTabActive : ""} onClick={() => setDetailsTab("details")}>تفاصيل الجهاز</button><button type="button" className={detailsTab === "policy" ? styles.adminDeviceDetailsTabActive : ""} onClick={() => setDetailsTab("policy")}>حماية الإرسال</button></nav>
          {busy === "details" ? <div className={styles.adminDeviceLoading}>جارٍ تحميل التفاصيل...</div> : detailsTab === "details" ? <>
            <section><h3>معلومات الجهاز</h3><dl><div><dt>اسم الجلسة</dt><dd dir="ltr">{selected.instanceName}</dd></div><div><dt>المتجر</dt><dd>{selected.storeName}</dd></div><div><dt>رقم واتساب</dt><dd dir="ltr">{selected.phoneNumber}</dd></div><div><dt>الحالة</dt><dd><AdminDeviceStatus device={selected} /></dd></div><div><dt>المزود</dt><dd>evolution_admin</dd></div><div><dt>آخر ظهور</dt><dd>{relativeAdminTime(selected.lastSeenAt)}</dd></div><div><dt>Webhook</dt><dd>{selected.webhookStatus}</dd></div><div><dt>API</dt><dd>{selected.apiStatus}</dd></div></dl></section>
            <section><h3>الإرسال</h3><div className={styles.adminDeviceMetricGrid}><div><strong>{ar(selected.metrics?.sent)}</strong><span>إجمالي المرسل</span></div><div><strong>{ar(selected.metrics?.today)}</strong><span>اليوم</span></div><div><strong>{ar(selected.metrics?.delivered)}</strong><span>تم التسليم</span></div><div><strong>{selected.metrics?.successRate == null ? "لا توجد بيانات" : `${selected.metrics.successRate}%`}</strong><span>نسبة النجاح</span></div></div></section>
            <section><h3>مستوى الخطر</h3><div className={styles.adminEvolutionRisk}><strong>{selected.risk?.riskLevel || "low"}</strong><span>{selected.risk?.score ?? 0}/100</span><small>{selected.risk?.action === "pause_device" ? "الجهاز متوقف وقائيًا" : selected.risk?.action === "hold_batches" ? "الدفعات الجديدة موقوفة للمراجعة" : selected.risk?.action === "reduce_rate" ? "تم تخفيض معدل الإرسال" : "الإرسال يعمل ضمن السياسة"}</small></div></section>
            <section><h3>آخر النشاطات</h3>{selected.activity?.length ? <ul className={styles.adminDeviceActivity}>{selected.activity.map((item) => <li key={item.id}><span><Glyph name="check" /></span><div><strong>{item.title}</strong><small>{relativeAdminTime(item.createdAt)}</small></div></li>)}</ul> : <p className={styles.adminDeviceMuted}>لا توجد نشاطات مسجلة لهذا الجهاز.</p>}</section>
          </> : policyForm ? <section className={styles.adminEvolutionPolicy}><header><div><h3>حماية إرسال Evolution</h3><p>سياسات داخلية لتنظيم الإرسال عبر الجهاز الإداري وحمايته من الانقطاع أو الحظر.</p></div><label className={styles.adminPolicySwitch}><input type="checkbox" checked={policyForm.enabled} onChange={(event) => setPolicyForm((value) => ({ ...value, enabled: event.target.checked }))} /><span>{policyForm.enabled ? "مفعلة" : "متوقفة"}</span></label></header>
            <fieldset><legend>الفاصل بين الرسائل</legend><div className={styles.adminPolicyGrid}><label>القيمة الأساسية بالثواني<input type="number" min="1" max="86400" value={policyForm.baseDelaySeconds} onChange={(event) => setPolicyForm((value) => ({ ...value, baseDelaySeconds: Number(event.target.value) }))} /></label><label>أقل نطاق عشوائي<input type="number" min="0" max="86400" value={policyForm.jitterMinSeconds} onChange={(event) => setPolicyForm((value) => ({ ...value, jitterMinSeconds: Number(event.target.value) }))} /></label><label>أعلى نطاق عشوائي<input type="number" min="0" max="86400" value={policyForm.jitterMaxSeconds} onChange={(event) => setPolicyForm((value) => ({ ...value, jitterMaxSeconds: Number(event.target.value) }))} /></label></div><small>يُحجز الموعد داخل Queue مؤجلة دون تنفيذ sleep داخل الطلب.</small></fieldset>
            <fieldset><legend>حدود الإرسال</legend><div className={styles.adminPolicyGrid}><label>الحد في الساعة<input type="number" min="1" value={policyForm.hourlyLimit} onChange={(event) => setPolicyForm((value) => ({ ...value, hourlyLimit: Number(event.target.value) }))} /></label><label>الحد اليومي<input type="number" min="1" value={policyForm.dailyLimit} onChange={(event) => setPolicyForm((value) => ({ ...value, dailyLimit: Number(event.target.value) }))} /></label><label>حد الدفعة<input type="number" min="1" value={policyForm.batchLimit} onChange={(event) => setPolicyForm((value) => ({ ...value, batchLimit: Number(event.target.value) }))} /></label><label>فترة التهدئة بالثواني<input type="number" min="0" value={policyForm.cooldownSeconds} onChange={(event) => setPolicyForm((value) => ({ ...value, cooldownSeconds: Number(event.target.value) }))} /></label></div></fieldset>
            <fieldset><legend>منع التكرار</legend><label>نافذة منع الرسالة نفسها لنفس المستلم بالثواني<input type="number" min="0" value={policyForm.duplicateWindowSeconds} onChange={(event) => setPolicyForm((value) => ({ ...value, duplicateWindowSeconds: Number(event.target.value) }))} /></label><small>يعتمد المفتاح على المستلم وبصمة المحتوى والجهاز الإداري.</small></fieldset>
            <fieldset><legend>الحماية والفحص</legend><div className={styles.adminPolicyChecks}>{[["stopOnHighRisk", "إيقاف مؤقت عند ارتفاع الخطر"], ["reduceOnMediumRisk", "تخفيض سرعة الإرسال عند الخطر المتوسط"], ["blockNewCampaignsOnHighRisk", "منع الحملات الجديدة عند الخطر المرتفع"], ["notifyAdminOnRisk", "تنبيه الأدمن"], ["pauseOnDisconnect", "إيقاف الإرسال عند انقطاع الجهاز"], ["validateTemplates", "فحص الرسائل والمتغيرات"], ["blockUnsafeLinks", "منع الروابط غير الآمنة"]].map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(policyForm[key])} onChange={(event) => setPolicyForm((value) => ({ ...value, [key]: event.target.checked }))} />{label}</label>)}</div></fieldset>
            <button type="button" className={styles.adminPrimaryButton} disabled={busy === "policy"} onClick={savePolicy}>{busy === "policy" ? "جارٍ الحفظ..." : "حفظ سياسة الجهاز"}</button>
          </section> : <div className={styles.adminDeviceLoading}>لا توجد سياسة مهيأة لهذا الجهاز.</div>}
        </div> : null}

        {drawer === "pairing" && selected ? <div className={styles.adminPairingPanel}>
          {selected.status === "connected" ? <div className={styles.adminDeviceConnected}><span><Glyph name="check" /></span><strong>الجهاز متصل</strong><p>لا حاجة لعرض رمز اقتران طالما أن الجلسة نشطة.</p></div> : <>
            <div className={styles.adminPairingTabs}><button type="button" className={pairingTab === "qr" ? styles.adminPairingTabActive : ""} onClick={() => { setPairingTab("qr"); setPairing({ qrCode: "", pairingCode: "", expiresAt: 0 }); }}>رمز QR</button><button type="button" className={pairingTab === "code" ? styles.adminPairingTabActive : ""} onClick={() => { setPairingTab("code"); setPairing({ qrCode: "", pairingCode: "", expiresAt: 0 }); }}>رمز الاقتران</button></div>
            {pairingTab === "qr" ? <div className={styles.adminQrPanel}>{pairing.qrCode && secondsLeft > 0 ? <><img src={pairing.qrCode} alt="رمز QR لربط جهاز واتساب" /><strong>ينتهي الرمز خلال {ar(secondsLeft)} ثانية</strong></> : <div className={styles.adminQrPlaceholder}><Glyph name="chart" /><strong>{pairing.qrCode ? "انتهت صلاحية الرمز" : "أنشئ رمزًا عند الاستعداد للمسح"}</strong></div>}<button type="button" className={styles.adminPrimaryButton} disabled={busy === "qr"} onClick={() => runAction(selected, "qr")}><Glyph name="refresh" /> {pairing.qrCode ? "تحديث رمز QR" : "إنشاء رمز QR"}</button></div> : <div className={styles.adminPairingCodePanel}>
              <label>رقم واتساب بصيغة دولية<input dir="ltr" inputMode="tel" value={pairingPhone} onChange={(event) => setPairingPhone(event.target.value.replace(/\D/g, ""))} placeholder="9665XXXXXXXX" /></label>
              {pairing.pairingCode && secondsLeft > 0 ? <div className={styles.adminPairingCode}><code dir="ltr">{pairing.pairingCode}</code><button type="button" onClick={() => navigator.clipboard.writeText(pairing.pairingCode)}>نسخ</button><small>ينتهي خلال {ar(secondsLeft)} ثانية</small></div> : null}
              <button type="button" className={styles.adminPrimaryButton} disabled={busy === "pairing_code" || !/^\d{8,15}$/.test(pairingPhone)} onClick={() => runAction(selected, "pairing_code", { phoneNumber: pairingPhone })}><Glyph name="refresh" /> {pairing.pairingCode ? "تجديد رمز الاقتران" : "إنشاء رمز الاقتران"}</button>
            </div>}
            {notice ? <div className={styles.adminDeviceError}>{notice}</div> : null}
          </>}
        </div> : null}
      </div>
    </aside></div> : null}
  </>;
}

const PROVIDER_INFO = {
  meta: ["Meta Cloud API", "ربط واتساب الرسمي لمتاجر المستخدمين", "link"],
  meta_cloud_api: ["Meta Cloud API", "ربط واتساب الرسمي لمتاجر المستخدمين", "link"],
  evolution: ["Evolution Admin", "قناة واتساب الإدارية المركزية", "device"],
  evolution_admin: ["Evolution Admin", "قناة واتساب الإدارية المركزية والمعزولة عن حسابات المتاجر", "device"],
  resend: ["Resend", "إرسال البريد الإلكتروني للرسائل والتنبيهات", "mail"],
  salla: ["سلة", "مزامنة الطلبات والعملاء والمنتجات", "store"],
  database: ["PostgreSQL", "قاعدة بيانات المنصة", "database"],
  redis: ["Queue / Redis", "طوابير المهام والرسائل", "database"]
};

function PlatformAppLogo({ provider }) {
  if (provider === "salla") return <span className={styles.adminPlatformAppLogo}><img src="/assets/salla-logo.svg" alt="سلة" /></span>;
  if (provider === "zid") return <span className={`${styles.adminPlatformAppLogo} ${styles.adminPlatformAppLogoZid}`}><img src="/assets/zid-logo-original.webp" alt="زد" /></span>;
  return <span className={styles.adminPlatformAppLogo}><svg viewBox="0 0 48 48" role="img" aria-label="شوبيفاي"><path className={styles.shopifyBag} d="M12 15.5h24l2.2 26H9.8z" /><path className={styles.shopifyHandle} d="M17 17c.3-6 3-10 7-10s6.7 4 7 10" /><text x="24" y="34" textAnchor="middle">S</text></svg></span>;
}

function Integrations({ data }) {
  const rows = data.integrationHealth || [];
  const catalog = [
    { provider: "salla", name: "سلة", description: "مزامنة الطلبات والعملاء والمنتجات وتشغيل قوالب الرسائل المرتبطة بالأحداث الموثقة.", features: ["12 قالبًا", "واتساب", "بريد إلكتروني"], available: true },
    { provider: "zid", name: "زد", description: "منصة التجارة الإلكترونية زد. سيُتاح الربط بعد اكتمال واعتماد التكامل الرسمي.", features: ["تكامل رسمي", "قريبًا"], available: false },
    { provider: "shopify", name: "شوبيفاي", description: "منصة شوبيفاي للتجارة الإلكترونية. التكامل معروض في الكتالوج وغير متاح للربط حاليًا.", features: ["تكامل رسمي", "قريبًا"], available: false }
  ];
  return <>
    <KpiGrid items={[
      { label: "التطبيقات المسجلة", value: ar(catalog.length), helper: "كتالوج تطبيقات المنصة", icon: "link", tone: "green" },
      { label: "التكاملات النشطة", value: ar(rows.filter((row) => row.status === "healthy").length), helper: "سليمة حاليًا", icon: "chart", tone: "violet" },
      { label: "أخطاء المزامنة", value: ar(rows.reduce((sum, row) => sum + n(row.errorCount), 0)), helper: "من سجلات الفحص", icon: "alert", tone: "red" },
      { label: "آخر مزامنة", value: rows.length ? formatDate(rows.map((row) => row.lastCheckedAt).filter(Boolean).sort().at(-1)) : "—", helper: "آخر فحص مسجل", icon: "clock", tone: "green" }
    ]} />
    <section className={`${styles.adminSurface} ${styles.adminPlatformCatalog}`}>
      <div className={styles.adminPlatformCatalogHeader}><div><h2>كتالوج تطبيقات Renvix</h2><p>يظهر الكتالوج دائمًا للأدمن، بينما يبقى ظهور واجهة سلة للمستخدم مرتبطًا باكتمال الربط.</p></div><span>3 تطبيقات</span></div>
      <div className={styles.adminIntegrationGrid}>{catalog.map((app) => <article key={app.provider} className={`${styles.adminPlatformAppCard} ${app.available ? "" : styles.adminPlatformAppCardDisabled}`}>
        <div className={styles.adminPlatformAppTop}><PlatformAppLogo provider={app.provider} /><span className={`${styles.adminPlatformAppStatus} ${app.available ? "" : styles.adminPlatformAppStatusLocked}`}>{app.available ? "متاح للأدمن" : "غير متاح حاليًا"}</span></div>
        <h3>{app.name}</h3><p>{app.description}</p><div className={styles.adminPlatformAppFeatures}>{app.features.map((feature) => <span key={feature}>{feature}</span>)}</div>
        <footer className={styles.adminPlatformAppFooter}><small>{app.available ? "لا يحتاج ربطًا للمعاينة الإدارية" : "الربط مقفل للمستخدم والأدمن"}</small>{app.available ? <a href="/admin/integrations/salla">معاينة وتحرير</a> : <button type="button" disabled>غير متاح</button>}</footer>
      </article>)}</div>
    </section>
    <section className={`${styles.adminSurface} ${styles.adminHealthSection}`}>
      <div className={styles.adminPlatformCatalogHeader}><div><h2>صحة اتصالات المنصة</h2><p>نتائج الفحص الفعلية منفصلة عن كتالوج التطبيقات، ودون عرض أسرار أو مفاتيح.</p></div></div>
      {!rows.length ? <Empty title="لا توجد نتائج فحص مسجلة" description="لا يؤثر ذلك في معاينة التطبيقات الإدارية أعلاه." /> : <div className={styles.adminIntegrationGrid}>{rows.map((row) => {
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

const SUPPORT_STATUS_LABELS = {
  NEW: "جديدة", OPEN: "مفتوحة", IN_PROGRESS: "قيد المعالجة",
  WAITING_FOR_USER: "تم الرد", WAITING_FOR_SUPPORT: "بانتظار الرد",
  RESOLVED: "تم الحل", CLOSED: "مغلقة", REOPENED: "أعيد فتحها"
};

const SUPPORT_TYPE_LABELS = {
  INQUIRY: "استفسار", TECHNICAL_ISSUE: "مشكلة تقنية", SUGGESTION: "اقتراح",
  COMPLAINT: "شكوى", BILLING: "فوترة", INTEGRATION: "تكاملات",
  ACCOUNT: "حساب", OTHER: "أخرى"
};

const SUPPORT_PRIORITY_LABELS = {
  LOW: "منخفضة", NORMAL: "عادية", HIGH: "عالية", URGENT: "عاجلة"
};

async function supportRequest(url, options) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) throw new Error(payload.message || "تعذر تنفيذ الطلب.");
  return payload;
}

function Support({ admin }) {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ total: 0, open: 0, replied: 0, pending: 0 });
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadList = useCallback(async (quiet = false) => {
    if (!quiet) setBusy(true);
    try {
      const params = new URLSearchParams({ limit: "25" });
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      if (type) params.set("type", type);
      const payload = await supportRequest(`/api/admin/support/tickets?${params}`);
      setItems(payload.items || []);
      setStats(payload.stats || {});
      setError("");
      if (!selectedId && payload.items?.[0]?.id) setSelectedId(payload.items[0].id);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      if (!quiet) setBusy(false);
    }
  }, [search, status, type, selectedId]);

  const loadDetail = useCallback(async (id, quiet = false) => {
    if (!id) { setDetail(null); return; }
    if (!quiet) setBusy(true);
    try {
      const payload = await supportRequest(`/api/admin/support/tickets/${id}`);
      setDetail(payload.item || null);
      if (Number(payload.item?.adminUnreadCount || 0) > 0) {
        await supportRequest(`/api/admin/support/tickets/${id}/read`, {
          method: "POST",
          body: "{}"
        });
        setItems((current) => current.map((item) => item.id === id ? { ...item, adminUnreadCount: 0 } : item));
      }
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      if (!quiet) setBusy(false);
    }
  }, []);

  useEffect(() => { loadList(); }, [search, status, type]);
  useEffect(() => { loadDetail(selectedId); }, [selectedId, loadDetail]);
  useEffect(() => {
    const timer = setInterval(() => {
      loadList(true);
      if (selectedId) loadDetail(selectedId, true);
    }, 25_000);
    return () => clearInterval(timer);
  }, [selectedId, loadList, loadDetail]);

  async function sendReply(event) {
    event.preventDefault();
    if (!selectedId || reply.trim().length < 2) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload = await supportRequest(`/api/admin/support/tickets/${selectedId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: reply, internal })
      });
      setReply("");
      setInternal(false);
      if (internal) {
        setNotice("تم حفظ الملاحظة الداخلية.");
      } else if (payload.item?.emailDelivery?.status === "sent") {
        setNotice("تم حفظ الرد وإرساله إلى بريد العميل.");
      } else {
        setError("تم حفظ الرد داخل التذكرة، لكن تعذر إرساله إلى البريد. يمكنك إعادة المحاولة بعد التحقق من إعدادات البريد.");
      }
      await Promise.all([loadDetail(selectedId, true), loadList(true)]);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function updateTicket(patch) {
    if (!selectedId) return;
    setBusy(true);
    try {
      await supportRequest(`/api/admin/support/tickets/${selectedId}`, {
        method: "PATCH",
        body: JSON.stringify(patch)
      });
      await Promise.all([loadDetail(selectedId, true), loadList(true)]);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  const selected = detail || items.find((item) => item.id === selectedId);
  const attachments = Array.isArray(detail?.attachments) ? detail.attachments : [];
  return <>
    <KpiGrid items={[
      { label: "إجمالي الرسائل", value: ar(stats.total), helper: "كل الرسائل والشكاوى", icon: "mail", tone: "blue" },
      { label: "الشكاوى المفتوحة", value: ar(stats.open), helper: "تحتاج مراجعة", icon: "alert", tone: "red" },
      { label: "تم الرد", value: ar(stats.replied), helper: "بانتظار المستخدم", icon: "check", tone: "green" },
      { label: "بانتظار المعالجة", value: ar(stats.pending), helper: "تحتاج إجراء من الدعم", icon: "clock", tone: "orange" }
    ]} />
    {notice ? <div className={styles.adminSupportNotice} role="status">{notice}</div> : null}
    {error ? <div className={styles.adminSupportError} role="alert">{error}</div> : null}
    <section className={styles.adminSupportToolbar}>
      <label className={styles.adminSearchField}><Glyph name="mail" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث بالاسم أو البريد أو رقم التذكرة..." /></label>
      <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="حالة التذكرة"><option value="">جميع الحالات</option>{Object.entries(SUPPORT_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <select value={type} onChange={(event) => setType(event.target.value)} aria-label="نوع الرسالة"><option value="">كل الأنواع</option>{Object.entries(SUPPORT_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <button type="button" className={styles.adminOutlineButton} onClick={() => loadList()} disabled={busy}><Glyph name="refresh" /> تحديث</button>
    </section>
    <section className={styles.adminSupportLayout}>
      <div className={styles.adminSupportTableCard}>
        <div className={styles.adminTabs}><button className={styles.adminTabActive}>الكل</button><button onClick={() => setType("COMPLAINT")}>الشكاوى</button><button onClick={() => setType("INQUIRY")}>الرسائل</button></div>
        {!items.length ? <Empty title={busy ? "جارٍ تحميل الرسائل..." : "لا توجد رسائل أو شكاوى"} description="ستظهر تذاكر المستخدمين هنا فور إرسالها." /> :
          <div className={styles.adminSupportTableWrap}><table><thead><tr><th>العميل</th><th>النوع</th><th>الموضوع</th><th>التاريخ</th><th>الحالة</th><th>الأولوية</th><th>الإجراء</th></tr></thead><tbody>
            {items.map((ticket) => <tr key={ticket.id} className={selectedId === ticket.id ? styles.adminSupportSelectedRow : ""}>
              <td><button className={styles.adminSupportCustomer} onClick={() => setSelectedId(ticket.id)}><span>{String(ticket.requesterName || ticket.requesterEmail || "?").trim().slice(0, 1)}</span><b>{ticket.requesterName || "مستخدم Renvix"}<small>{ticket.requesterEmail}</small></b></button></td>
              <td><span className={ticket.type === "COMPLAINT" ? styles.adminSupportComplaint : styles.adminSupportMessage}><Glyph name={ticket.type === "COMPLAINT" ? "alert" : "mail"} />{SUPPORT_TYPE_LABELS[ticket.type] || ticket.type}</span></td>
              <td><button className={styles.adminSupportSubject} onClick={() => setSelectedId(ticket.id)}>{ticket.subject}<small>{ticket.ticketNumber}</small></button></td>
              <td>{formatDate(ticket.updatedAt, true)}</td>
              <td><span className={styles.adminSupportStatus}>{SUPPORT_STATUS_LABELS[ticket.status] || ticket.status}</span></td>
              <td><span className={`${styles.adminSupportPriority} ${styles[`adminSupportPriority_${ticket.priority}`]}`}>{SUPPORT_PRIORITY_LABELS[ticket.priority] || ticket.priority}</span></td>
              <td><button className={styles.adminSupportDetailsButton} onClick={() => setSelectedId(ticket.id)}>عرض التفاصيل</button></td>
            </tr>)}
          </tbody></table></div>}
      </div>
      <aside className={styles.adminSupportPreview}>
        {!selected ? <Empty title="اختر رسالة للمعاينة" description="تظهر المحادثة وإجراءات المعالجة هنا." /> : <>
          <header><div className={styles.adminSupportAvatar}>{String(selected.requesterName || selected.requesterEmail || "?").trim().slice(0, 1)}</div><div><strong>{selected.requesterName || "مستخدم Renvix"}</strong><span>{selected.requesterEmail}</span></div><span>{SUPPORT_TYPE_LABELS[selected.type]}</span></header>
          <div className={styles.adminSupportMeta}><span><b>الموضوع</b>{selected.subject}</span><span><b>رقم الرسالة</b>{selected.ticketNumber}</span><span><b>المتجر</b>{selected.tenantName}</span></div>
          <div className={styles.adminSupportControls}>
            <label><span>الحالة</span><select value={selected.status || "NEW"} onChange={(event) => updateTicket({ status: event.target.value })}>{Object.entries(SUPPORT_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span>الأولوية</span><select value={selected.priority || "NORMAL"} onChange={(event) => updateTicket({ priority: event.target.value })}>{Object.entries(SUPPORT_PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <button type="button" className={styles.adminSupportAssignButton} disabled={busy || selected.assignedAdminUserId === admin?.adminId} onClick={() => updateTicket({ assignedAdminUserId: admin?.adminId })}>{selected.assignedAdminUserId === admin?.adminId ? "مسندة إليك" : "إسناد إليّ"}</button>
          </div>
          <div className={styles.adminSupportThread}>{(selected.messages || []).map((message) => <article key={message.id} className={`${message.senderType === "ADMIN" ? styles.adminSupportBubbleAdmin : styles.adminSupportBubbleUser} ${message.isInternalNote ? styles.adminSupportInternal : ""}`}><b>{message.isInternalNote ? "ملاحظة داخلية" : message.senderType === "ADMIN" ? message.senderName || "فريق الدعم" : message.senderName || selected.requesterName}</b><p>{message.body}</p>{attachments.filter((file) => file.messageId === message.id).map((file) => <a key={file.id} className={styles.adminSupportAttachment} href={file.url} target="_blank" rel="noreferrer"><Glyph name="document" />{file.originalName}</a>)}{message.senderType === "ADMIN" && !message.isInternalNote ? <small className={`${styles.adminSupportEmailStatus} ${message.emailDeliveryStatus === "failed" ? styles.adminSupportEmailFailed : ""}`}>{message.emailDeliveryStatus === "sent" ? "تم الإرسال إلى البريد" : message.emailDeliveryStatus === "failed" ? "تعذر إرسال البريد" : "جارٍ إرسال البريد"}</small> : null}<time>{formatDate(message.createdAt, true)}</time></article>)}</div>
          <form className={styles.adminSupportReply} onSubmit={sendReply}>
            <textarea value={reply} onChange={(event) => setReply(event.target.value)} maxLength={2000} placeholder="اكتب ردك على الرسالة..." required />
            <label><input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} /> ملاحظة داخلية لا تظهر للمستخدم</label>
            <button className={styles.adminPrimaryButton} type="submit" disabled={busy || reply.trim().length < 2}><Glyph name="send" /> {internal ? "حفظ الملاحظة" : "الرد على الرسالة"}</button>
          </form>
        </>}
      </aside>
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

export const SPECIAL_ADMIN_PANELS = new Set(["overview", "subscriptions", "customers", "stores", "notifications", "support", "templates", "devices", "integrations", "security", "reports", "settings"]);

export default function AdminSectionView({ panel, data, stats, admin, onRefresh }) {
  if (!data || !stats) return null;
  const components = {
    overview: Overview, subscriptions: Subscriptions, customers: Customers, stores: Stores, notifications: Notifications, support: Support, templates: Templates,
    devices: Devices, integrations: Integrations, security: Security, reports: Reports, settings: Settings
  };
  const Component = components[panel];
  return Component ? <Component data={data} stats={stats} admin={admin} onRefresh={onRefresh} /> : null;
}
