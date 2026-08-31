"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./AdminPortal.module.css";

const TABS = [
  ["inspector", "الفاحص الدوري"], ["incidents", "الحوادث الأمنية"], ["honeypot", "الفخ الأمني"],
  ["alerts", "التنبيهات"], ["audit", "سجل الإجراءات"]
];

function date(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function Severity({ value, score }) {
  return <span className={`${styles.securitySeverity} ${styles[`securitySeverity_${String(value || "INFO").toLowerCase()}`]}`}>{value || "INFO"}{score == null ? "" : ` · ${score}/100`}</span>;
}

function Empty({ children }) {
  return <div className={styles.securityEmpty}>{children}</div>;
}

function Metric({ label, value, helper }) {
  return <article className={styles.securityMetric}><span>{label}</span><strong>{value}</strong><small>{helper}</small></article>;
}

function Table({ columns, rows, onRow }) {
  if (!rows?.length) return <Empty>لا توجد سجلات ضمن هذا النطاق حتى الآن.</Empty>;
  return <div className={styles.adminTableWrap}><table><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>
    {rows.map((row, index) => <tr key={row.id || index} onClick={onRow ? () => onRow(row) : undefined} className={onRow ? styles.securityClickableRow : undefined}>
      {columns.map((column) => <td key={column.key}>{column.render ? column.render(row[column.key], row) : (row[column.key] ?? "—")}</td>)}
    </tr>)}
  </tbody></table></div>;
}

export default function SecurityCenter() {
  const [tab, setTab] = useState("inspector");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [duration, setDuration] = useState("60");
  const [reason, setReason] = useState("");

  const load = useCallback(async (incidentId = "") => {
    setError("");
    try {
      const query = incidentId ? `?incident=${encodeURIComponent(incidentId)}` : "";
      const response = await fetch(`/api/admin/security-center${query}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.reason || "load_failed");
      setData(payload);
    } catch {
      setError("تعذر تحميل مركز الأمان حاليًا.");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runScan() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/security-center/scan", { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.reason || "scan_failed");
      await load();
    } catch (scanError) {
      setError(scanError.message === "scan_already_running" ? "يوجد فحص آخر قيد التشغيل." : "تعذر تشغيل الفحص الآن.");
    } finally { setBusy(false); }
  }

  async function incidentAction(action, extra = {}) {
    if (!selectedIncident) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/security-center/incidents/${selectedIncident.id}/actions`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, reason, ...extra })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.reason || "action_failed");
      setReason("");
      await load(selectedIncident.id);
      setSelectedIncident((current) => current ? { ...current, status: extra.status || "Mitigated" } : current);
    } catch {
      setError("تعذر تنفيذ الإجراء. تحقق من الصلاحية والسبب المدخل.");
    } finally { setBusy(false); }
  }

  async function selectIncident(incident) {
    setSelectedIncident(incident);
    setTab("incidents");
    await load(incident.id);
  }

  const incidentCounts = data?.incidentCounts || {};
  const honeypot = data?.honeypot || {};
  const latestRun = data?.latestRun;
  const platformState = Number(incidentCounts.critical || 0) ? "خطر" : Number(incidentCounts.high || 0) ? "تحذير" : "سليمة";
  const lastIncident = useMemo(() => data?.incidents?.[0], [data]);

  if (!data && !error) return <div className={styles.loading}>جارٍ تحميل مركز الأمان...</div>;
  return <div className={styles.securityCenter}>
    <section className={styles.securityHero}>
      <div><span>Security Operations Center</span><h2>حالة المنصة: {platformState}</h2><p>آخر فحص: {date(data?.schedule?.lastRunAt)} · {incidentCounts.critical || 0} حرجة · {incidentCounts.high || 0} مرتفعة</p></div>
      <button type="button" disabled={busy || !data?.permissions?.canRun} onClick={runScan}>{busy ? "جارٍ التنفيذ..." : "تشغيل فحص الآن"}</button>
    </section>
    {error ? <div className={styles.error}>{error}</div> : null}
    <nav className={styles.securityTabs} aria-label="أقسام مركز الأمان">{TABS.map(([key, label]) => <button type="button" key={key} onClick={() => setTab(key)} className={tab === key ? styles.securityTabActive : ""}>{label}</button>)}</nav>

    {tab === "inspector" ? <>
      <section className={styles.securityMetrics}>
        <Metric label="الحالة العامة" value={platformState} helper={data?.assurance} />
        <Metric label="آخر فحص" value={date(data?.schedule?.lastRunAt)} helper={`المدة: ${latestRun?.durationMs == null ? "—" : `${latestRun.durationMs}ms`}`} />
        <Metric label="الفحص القادم" value={date(data?.schedule?.nextRunAt)} helper="فاصل فعلي ثابت: 10 ساعات" />
        <Metric label="المشاكل المفتوحة" value={incidentCounts.open || 0} helper={`${incidentCounts.critical || 0} حرجة`} />
      </section>
      <section className={styles.adminSurface}><div className={styles.securitySectionHead}><div><h3>نتائج الفاحص الدوري</h3><p>فحوصات محدودة المهلة، للقراءة فقط حيثما أمكن، وتُشغّل بقفل يمنع التوازي.</p></div><span>{latestRun?.status || "لم يعمل"}</span></div>
        <Table rows={data?.findings} columns={[
          { key: "severity", label: "الخطورة", render: (value, row) => <Severity value={value} score={row.riskScore} /> },
          { key: "title", label: "النتيجة" }, { key: "category", label: "المجموعة" }, { key: "affectedService", label: "الخدمة" },
          { key: "occurrenceCount", label: "التكرار" }, { key: "lastSeen", label: "آخر ظهور", render: date }
        ]} />
      </section>
    </> : null}

    {tab === "incidents" ? <section className={styles.securitySplit}>
      <article className={styles.adminSurface}><div className={styles.securitySectionHead}><div><h3>الحوادث الأمنية</h3><p>تُجمع الإشارات المترابطة تحت حادث واحد.</p></div></div>
        <Table rows={data?.incidents} onRow={selectIncident} columns={[
          { key: "incidentNumber", label: "الحادث" }, { key: "severity", label: "الخطورة", render: (value, row) => <Severity value={value} score={row.riskScore} /> },
          { key: "title", label: "التصنيف" }, { key: "occurrenceCount", label: "المحاولات" }, { key: "status", label: "الحالة" }, { key: "lastSeen", label: "آخر ظهور", render: date }
        ]} />
      </article>
      <aside className={styles.securityIncidentPanel}>{selectedIncident ? <>
        <div className={styles.securitySectionHead}><div><h3>{selectedIncident.incidentNumber}</h3><p>{selectedIncident.title}</p></div><Severity value={selectedIncident.severity} score={selectedIncident.riskScore} /></div>
        <dl><div><dt>الخدمة</dt><dd>{selectedIncident.affectedService || "—"}</dd></div><div><dt>أول ظهور</dt><dd>{date(selectedIncident.firstSeen)}</dd></div><div><dt>آخر ظهور</dt><dd>{date(selectedIncident.lastSeen)}</dd></div></dl>
        <h4>التسلسل الزمني الموقّع</h4><ol className={styles.securityTimeline}>{(data?.timeline || []).map((item) => <li key={item.id}><b>{item.eventType}</b><span>{date(item.occurredAt)}</span></li>)}</ol>
        {data?.permissions?.canManageIncidents ? <div className={styles.securityActions}><input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} placeholder="سبب الإجراء (مطلوب للعزل)" /><select value={duration} onChange={(event) => setDuration(event.target.value)}><option value="15">15 دقيقة</option><option value="60">ساعة</option><option value="1440">24 ساعة</option></select><button type="button" disabled={busy || reason.trim().length < 5} onClick={() => incidentAction("temporary_block", { minutes: Number(duration) })}>عزل مؤقت</button><button type="button" disabled={busy} onClick={() => incidentAction("set_status", { status: "Investigating" })}>بدء التحقيق</button><button type="button" disabled={busy} onClick={() => incidentAction("set_status", { status: "Resolved" })}>حل الحادث</button><button type="button" disabled={busy} onClick={() => incidentAction("set_status", { status: "False Positive" })}>إيجابي كاذب</button></div> : null}
      </> : <Empty>اختر حادثًا لعرض التفاصيل والتسلسل والإجراءات.</Empty>}</aside>
    </section> : null}

    {tab === "honeypot" ? <>
      <section className={styles.securityMetrics}>
        <Metric label="محاولات 24 ساعة" value={honeypot.attempts24h || 0} helper="كل الطلبات" />
        <Metric label="محاولات 7 أيام" value={honeypot.attempts7d || 0} helper={`${honeypot.uniqueIps || 0} مصادر فريدة`} />
        <Metric label="عالية الخطورة" value={honeypot.highRisk || 0} helper="HIGH / CRITICAL" />
        <Metric label="آخر حادث" value={lastIncident?.incidentNumber || "—"} helper={lastIncident ? date(lastIncident.lastSeen) : "لا يوجد"} />
      </section>
      <section className={styles.securityTopLists}>{[["أكثر الدول", honeypot.countries], ["أكثر الشبكات ASN", honeypot.asns], ["أكثر المسارات", honeypot.paths]].map(([title, rows]) => <article key={title}><h3>{title}</h3>{rows?.length ? rows.map((row) => <div key={row.label}><span>{row.label}</span><b>{row.count}</b></div>) : <Empty>لا توجد بيانات.</Empty>}</article>)}</section>
      <section className={styles.adminSurface}><Table rows={data?.events} onRow={(row) => row.incidentId && selectIncident(data.incidents.find((incident) => incident.id === row.incidentId))} columns={[
        { key: "time", label: "الوقت", render: date }, { key: "severity", label: "الخطورة", render: (value, row) => <Severity value={value} score={row.riskScore} /> },
        { key: "ip", label: "IP" }, { key: "location", label: "الموقع التقريبي" }, { key: "device", label: "الجهاز" }, { key: "browser", label: "المتصفح" },
        { key: "path", label: "المسار" }, { key: "incidentNumber", label: "الحادث" }
      ]} /></section>
    </> : null}

    {tab === "alerts" ? <section className={styles.adminSurface}><div className={styles.securitySectionHead}><div><h3>التنبيهات</h3><p>البريد للحالات HIGH، وقناة ثانوية اختيارية للحالات CRITICAL مع منع التكرار.</p></div></div><Table rows={data?.alerts} columns={[
      { key: "severity", label: "المستوى", render: (value) => <Severity value={value} /> }, { key: "channel", label: "القناة" }, { key: "status", label: "الحالة" }, { key: "attempts", label: "المحاولات" }, { key: "createdAt", label: "الإنشاء", render: date }, { key: "sentAt", label: "الإرسال", render: date }
    ]} /></section> : null}

    {tab === "audit" ? <section className={styles.adminSurface}><div className={styles.securitySectionHead}><div><h3>سجل الإجراءات</h3><p>سجل إجراءات التخفيف الموثقة وتواريخ انتهائها. سلسلة الحوادث مرتبطة بالـhash وقاعدة البيانات تمنع تعديل سجل الأمان.</p></div></div><Table rows={data?.mitigations} columns={[
      { key: "incidentNumber", label: "الحادث" }, { key: "type", label: "الإجراء" }, { key: "status", label: "الحالة" }, { key: "reason", label: "السبب" }, { key: "startsAt", label: "البداية", render: date }, { key: "expiresAt", label: "الانتهاء", render: date }
    ]} /></section> : null}
  </div>;
}
