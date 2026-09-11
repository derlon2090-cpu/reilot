"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./AdminPortal.module.css";

const TABS = [
  ["inspector", "الفاحص الدوري"], ["incidents", "الحوادث الأمنية"], ["honeypot", "الفخ الأمني"],
  ["notifications", "إشعارات الأمان"], ["alerts", "قنوات التنبيه"], ["blocks", "المحظورون"], ["audit", "سجل الإجراءات"]
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

function telemetryKind(value) {
  return ({ page_view: "فتح الصفحة", interaction: "تفاعل", login_attempt: "محاولة دخول", page_hidden: "إخفاء الصفحة", page_exit: "مغادرة" })[value] || "طلب HTTP";
}

function confidence(value) {
  return ({ high: "مرتفعة", medium: "متوسطة", low: "منخفضة", unavailable: "غير متاحة" })[value] || "غير متاحة";
}

function approximateLocation(event) {
  const coordinates = event?.ipLocation?.latitude != null && event?.ipLocation?.longitude != null
    ? `${event.ipLocation.latitude}, ${event.ipLocation.longitude}` : "لا تتوفر إحداثيات";
  return `${event?.location || "غير معروف"} · ${coordinates}`;
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
  const [selectedHoneypotEvent, setSelectedHoneypotEvent] = useState(null);
  const [duration, setDuration] = useState("60");
  const [reason, setReason] = useState("");
  const [containmentOpen, setContainmentOpen] = useState(false);
  const [scopes, setScopes] = useState([]);
  const [containmentDeviceId, setContainmentDeviceId] = useState("");
  const [unblock, setUnblock] = useState(null);

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

  useEffect(() => {
    const incidentId = new URLSearchParams(window.location.search).get("incident") || "";
    load(incidentId).then(() => {
      if (!incidentId) return;
      setTab("incidents");
    });
  }, [load]);

  useEffect(() => {
    const incidentId = new URLSearchParams(window.location.search).get("incident");
    if (!incidentId || !data?.incidents?.length || selectedIncident) return;
    const incident = data.incidents.find((item) => item.id === incidentId);
    if (incident) setSelectedIncident(incident);
  }, [data, selectedIncident]);

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
      setContainmentOpen(false);
      await load(selectedIncident.id);
      setSelectedIncident((current) => current ? { ...current, status: extra.status || "Mitigated" } : current);
    } catch {
      setError("تعذر تنفيذ الإجراء. تحقق من الصلاحية والسبب المدخل.");
    } finally { setBusy(false); }
  }

  async function selectIncident(incident) {
    if (!incident) return;
    setSelectedIncident(incident);
    setTab("incidents");
    await load(incident.id);
  }

  async function openHoneypotDeviceBlock(event) {
    if (!event?.incidentId || !event?.honeypotDeviceId) return;
    const incident = data?.incidents?.find((item) => item.id === event.incidentId) || {
      id: event.incidentId,
      incidentNumber: event.incidentNumber || "حادث Honeypot",
      title: "محاولة اكتشاف واجهة الإدارة"
    };
    setSelectedIncident(incident);
    setTab("incidents");
    await load(event.incidentId);
    setScopes(["device"]);
    setContainmentDeviceId(event.honeypotDeviceId);
    setDuration("10080");
    setReason(`حظر Renvix Device ID المرتبط بالحادث ${event.incidentNumber || event.incidentId}`.slice(0, 300));
    setContainmentOpen(true);
  }

  function openContainment() {
    const available = data?.containment?.availableTargets || {};
    const suggested = ["account", "session", "device", "ip"].filter((scope) => available[scope]);
    setScopes(suggested);
    setContainmentDeviceId("");
    setDuration("60");
    setReason("");
    setContainmentOpen(true);
  }

  function toggleScope(scope) {
    setScopes((current) => current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope]);
  }

  async function markNotification(item) {
    await fetch("/api/admin/security-center/notifications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ notificationId: item.id, read: true }) }).catch(() => null);
    const incident = data?.incidents?.find((entry) => entry.id === item.incidentId);
    if (incident) await selectIncident(incident);
  }

  async function unblockSource() {
    if (!unblock || reason.trim().length < 5) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/security-center/blocks/${unblock.id}/actions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "unblock", reason }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.reason || "unblock_failed");
      setUnblock(null); setReason(""); await load(selectedIncident?.id || "");
    } catch { setError("تعذر فك الحظر. تحقق من السبب والصلاحية واتصال مزود الحافة."); }
    finally { setBusy(false); }
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
        {data?.permissions?.canManageIncidents ? <div className={styles.securityActions}><button type="button" disabled={busy} onClick={openContainment}>احتواء التهديد</button><button type="button" disabled={busy} onClick={() => incidentAction("set_status", { status: "Investigating" })}>بدء التحقيق</button><button type="button" disabled={busy} onClick={() => incidentAction("set_status", { status: "Resolved" })}>حل الحادث</button><button type="button" disabled={busy} onClick={() => incidentAction("set_status", { status: "False Positive" })}>إيجابي كاذب</button></div> : null}
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
      <section className={styles.adminSurface}><div className={styles.securitySectionHead}><div><h3>الأحداث المرصودة</h3><p>اختر سجلًا لعرض مواصفات الجهاز وملخص الحركة. لا يتم حفظ محتوى الحقول أو كلمات المرور.</p></div></div><Table rows={data?.events} onRow={setSelectedHoneypotEvent} columns={[
        { key: "time", label: "الوقت", render: date }, { key: "severity", label: "الخطورة", render: (value, row) => <Severity value={value} score={row.riskScore} /> },
        { key: "ip", label: "IP" }, { key: "location", label: "الموقع التقريبي" }, { key: "device", label: "الجهاز" }, { key: "browser", label: "المتصفح" },
        { key: "honeypotDeviceId", label: "Renvix Device ID", render: (value) => <span dir="ltr">{value || "—"}</span> },
        { key: "telemetry", label: "الإشارة", render: (value) => telemetryKind(value?.kind) },
        { key: "movement", label: "الحركة", render: (_value, row) => row.telemetry?.interaction?.mouseMoves || 0 },
        { key: "clicks", label: "النقرات", render: (_value, row) => row.telemetry?.interaction?.clicks || 0 },
        { key: "path", label: "المسار" }
      ]} />
        {selectedHoneypotEvent ? <article className={styles.securityTelemetryPanel}>
          <div className={styles.securitySectionHead}><div><h3>تفاصيل الرصد</h3><p>{date(selectedHoneypotEvent.time)} · {telemetryKind(selectedHoneypotEvent.telemetry?.kind)}</p></div><button type="button" onClick={() => setSelectedHoneypotEvent(null)}>إغلاق</button></div>
          {selectedHoneypotEvent.telemetry ? <>
            <dl className={styles.securityTelemetryGrid}>
              <div><dt>معرّف الزيارة</dt><dd dir="ltr">{selectedHoneypotEvent.telemetry.visitId || "—"}</dd></div>
              <div><dt>Renvix Device ID</dt><dd dir="ltr">{selectedHoneypotEvent.honeypotDeviceId || "—"}</dd></div>
              <div><dt>بصمة الجهاز التقديرية</dt><dd dir="ltr">{selectedHoneypotEvent.deviceFingerprint || "—"}</dd></div>
              <div><dt>ثقة مطابقة البصمة</dt><dd>{confidence(selectedHoneypotEvent.fingerprintConfidence)} — ليست Device ID قطعيًا</dd></div>
              <div><dt>الموقع عبر IP</dt><dd>{approximateLocation(selectedHoneypotEvent)} — تقريبي وليس GPS</dd></div>
              <div><dt>الشاشة</dt><dd>{selectedHoneypotEvent.telemetry.device?.screenWidth || 0} × {selectedHoneypotEvent.telemetry.device?.screenHeight || 0}</dd></div>
              <div><dt>نافذة العرض</dt><dd>{selectedHoneypotEvent.telemetry.device?.viewportWidth || 0} × {selectedHoneypotEvent.telemetry.device?.viewportHeight || 0}</dd></div>
              <div><dt>النظام / المنطقة</dt><dd>{selectedHoneypotEvent.telemetry.device?.platform || selectedHoneypotEvent.os || "—"} · {selectedHoneypotEvent.telemetry.device?.timezone || "—"}</dd></div>
              <div><dt>اللغة والاتصال</dt><dd>{selectedHoneypotEvent.telemetry.device?.language || "—"} · {selectedHoneypotEvent.telemetry.device?.connection || "—"}</dd></div>
              <div><dt>المعالج / الذاكرة</dt><dd>{selectedHoneypotEvent.telemetry.device?.hardwareConcurrency || "—"} أنوية · {selectedHoneypotEvent.telemetry.device?.deviceMemory || "—"} GB</dd></div>
              <div><dt>حركة المؤشر</dt><dd>{selectedHoneypotEvent.telemetry.interaction?.mouseMoves || 0} عينة · {selectedHoneypotEvent.telemetry.interaction?.mouseDistance || 0}px</dd></div>
              <div><dt>النقر / لوحة المفاتيح</dt><dd>{selectedHoneypotEvent.telemetry.interaction?.clicks || 0} / {selectedHoneypotEvent.telemetry.interaction?.keyPresses || 0}</dd></div>
              <div><dt>التمرير / مدة النشاط</dt><dd>{selectedHoneypotEvent.telemetry.interaction?.scrollDepth || 0}% · {Math.round((selectedHoneypotEvent.telemetry.interaction?.activeMs || 0) / 1000)}ث</dd></div>
              <div><dt>محاولات الدخول</dt><dd>{selectedHoneypotEvent.telemetry.interaction?.loginAttempts || 0}</dd></div>
            </dl>
            <div className={styles.securityHeatmap} aria-label="خريطة حركة المؤشر">{(selectedHoneypotEvent.telemetry.interaction?.heatmap || []).map((count, index) => <span key={index} style={{ "--heat": Math.min(1, Number(count || 0) / Math.max(...(selectedHoneypotEvent.telemetry.interaction?.heatmap || [1]), 1)) }} title={`${count} حركة`}>{count}</span>)}</div>
            <section className={styles.securityRecentActivity}><h4>آخر 5 زيارات مرتبطة بهذا الجهاز</h4>{selectedHoneypotEvent.recentActivity?.length ? <ol>{selectedHoneypotEvent.recentActivity.map((item, index) => <li key={`${item.path}-${item.lastSeen}-${index}`}><div><b dir="ltr">{item.path || "/"}</b><span>{[item.country, item.region, item.city].filter(Boolean).join("، ") || "موقع غير معروف"}</span></div><time>{date(item.lastSeen)}</time></li>)}</ol> : <Empty>لا توجد زيارات أخرى مرتبطة بهذا المعرّف أو البصمة.</Empty>}</section>
            {selectedHoneypotEvent.incidentId ? <div className={styles.securityTelemetryActions}>{selectedHoneypotEvent.honeypotDeviceId && data?.permissions?.canManageIncidents ? <button type="button" onClick={() => openHoneypotDeviceBlock(selectedHoneypotEvent)}>حظر Renvix Device ID</button> : null}<button type="button" onClick={() => selectIncident(data?.incidents?.find((incident) => incident.id === selectedHoneypotEvent.incidentId))}>فتح الحادث وخيارات الاحتواء</button><small>المعرّف موقّع وHost-Only وليس رقمًا عتاديًا؛ مسح بيانات المتصفح أو إغلاق جلسة خفية قد يؤدي إلى إصدار معرّف جديد.</small></div> : null}
          </> : <Empty>هذا سجل طلب HTTP أولي؛ تفاصيل الجهاز والحركة تصل بعد تشغيل JavaScript في المتصفح.</Empty>}
        </article> : null}
      </section>
    </> : null}

    {tab === "notifications" ? <section className={styles.adminSurface}><div className={styles.securitySectionHead}><div><h3>إشعارات الأمان</h3><p>{data?.securityUnreadCount || 0} غير مقروء. تُجمع الإشعارات المتكررة تحت الحادث نفسه، وتعود غير مقروءة عند التصعيد.</p></div></div><Table rows={data?.notifications} onRow={markNotification} columns={[
      { key: "severity", label: "الخطورة", render: (value) => <Severity value={value} /> }, { key: "title", label: "التنبيه" }, { key: "reason", label: "السبب" },
      { key: "incidentNumber", label: "الحادث" }, { key: "occurrenceCount", label: "التكرار" }, { key: "unread", label: "الحالة", render: (value) => value ? "جديد" : "مقروء" }, { key: "lastSeen", label: "آخر ظهور", render: date }
    ]} /></section> : null}

    {tab === "alerts" ? <section className={styles.adminSurface}><div className={styles.securitySectionHead}><div><h3>التنبيهات</h3><p>البريد للحالات HIGH، وقناة ثانوية اختيارية للحالات CRITICAL مع منع التكرار.</p></div></div><Table rows={data?.alerts} columns={[
      { key: "severity", label: "المستوى", render: (value) => <Severity value={value} /> }, { key: "channel", label: "القناة" }, { key: "status", label: "الحالة" }, { key: "attempts", label: "المحاولات" }, { key: "createdAt", label: "الإنشاء", render: date }, { key: "sentAt", label: "الإرسال", render: date }
    ]} /></section> : null}

    {tab === "blocks" ? <section className={styles.adminSurface}><div className={styles.securitySectionHead}><div><h3>إدارة المحظورين</h3><p>الحساب والجلسة وRenvix Device ID والجهاز الموثوق وIP أهداف مستقلة. لا يُعامل IP أو بصمة المتصفح كجهاز قطعي.</p></div></div><Table rows={data?.blocks} onRow={(block) => block.status === "active" && data?.permissions?.canManageIncidents ? setUnblock(block) : null} columns={[
      { key: "referenceId", label: "المرجع" }, { key: "targetType", label: "النطاق" }, { key: "targetLabel", label: "الهدف" }, { key: "severity", label: "الخطورة", render: (value) => <Severity value={value} /> },
      { key: "status", label: "الحالة" }, { key: "incidentNumber", label: "الحادث" }, { key: "expiresAt", label: "الانتهاء", render: (value) => value ? date(value) : "دائم" }, { key: "createdAt", label: "الإنشاء", render: date }
    ]} /></section> : null}

    {tab === "audit" ? <section className={styles.adminSurface}><div className={styles.securitySectionHead}><div><h3>سجل الإجراءات</h3><p>سجل إجراءات التخفيف الموثقة وتواريخ انتهائها. سلسلة الحوادث مرتبطة بالـhash وقاعدة البيانات تمنع تعديل سجل الأمان.</p></div></div><Table rows={data?.mitigations} columns={[
      { key: "incidentNumber", label: "الحادث" }, { key: "type", label: "الإجراء" }, { key: "status", label: "الحالة" }, { key: "reason", label: "السبب" }, { key: "startsAt", label: "البداية", render: date }, { key: "expiresAt", label: "الانتهاء", render: date }
    ]} /></section> : null}

    {containmentOpen ? <div className={styles.securityModalBackdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setContainmentOpen(false)}><section className={styles.securityModal} role="dialog" aria-modal="true" aria-labelledby="containment-title"><div className={styles.securitySectionHead}><div><h3 id="containment-title">احتواء التهديد</h3><p>ينفذ فقط النطاقات التي أكدتها. إبطال الحساب أو الجهاز ينهي الجلسات والتحديات المفتوحة.</p></div><button type="button" onClick={() => setContainmentOpen(false)}>إغلاق</button></div>
      <label>سبب الاحتواء<input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} placeholder="مثال: محاولة استكشاف لوحة الإدارة" /></label>
      <label>المدة<select value={duration} onChange={(event) => { setDuration(event.target.value); if (event.target.value === "permanent") setScopes((current) => current.filter((scope) => scope !== "ip")); }}><option value="60">ساعة</option><option value="1440">24 ساعة</option><option value="10080">7 أيام</option><option value="permanent">دائم (غير متاح لـ IP)</option></select></label>
      {containmentDeviceId ? <p>المعرّف المستهدف: <b dir="ltr">{containmentDeviceId}</b></p> : null}
      <fieldset><legend>نطاق الاحتواء</legend>{[["account","الحساب"],["session","الجلسة"],["device","Device ID موقّع من الخادم"],["ip","IP مؤقتًا"]].map(([scope,label]) => { const available = Boolean(data?.containment?.availableTargets?.[scope]); const explicitDevice = scope === "device" && Boolean(containmentDeviceId); const disabled = (!available && !explicitDevice) || (scope === "ip" && duration === "permanent") || (Boolean(containmentDeviceId) && scope !== "device"); return <label key={scope}><input type="checkbox" checked={scopes.includes(scope)} disabled={disabled} onChange={() => toggleScope(scope)} />{label}{!available && !explicitDevice ? " — غير متاح لهذا الحادث" : ""}</label>; })}</fieldset>
      <div className={styles.securityModalActions}><button type="button" onClick={() => setContainmentOpen(false)}>إلغاء</button><button type="button" disabled={busy || reason.trim().length < 5 || scopes.length === 0} onClick={() => incidentAction("contain_threat", { duration, scopes, targetDeviceId: containmentDeviceId || undefined })}>{busy ? "جارٍ الاحتواء..." : "تأكيد الاحتواء"}</button></div>
    </section></div> : null}

    {unblock ? <div className={styles.securityModalBackdrop}><section className={styles.securityModal} role="dialog" aria-modal="true"><div className={styles.securitySectionHead}><div><h3>فك الحظر</h3><p>{unblock.referenceId} · {unblock.targetType}</p></div></div><label>سبب فك الحظر<input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} placeholder="سبب إداري واضح ومراجع" /></label><div className={styles.securityModalActions}><button type="button" onClick={() => { setUnblock(null); setReason(""); }}>إلغاء</button><button type="button" disabled={busy || reason.trim().length < 5} onClick={unblockSource}>تأكيد فك الحظر</button></div></section></div> : null}
  </div>;
}
