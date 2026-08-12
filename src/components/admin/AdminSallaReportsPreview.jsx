"use client";

import { useState } from "react";
import styles from "./AdminPortal.module.css";

function ReportIcon({ name }) {
  const paths = {
    cart: <><path d="M3 4h2l2 11h11l2-8H6" /><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></>,
    recovered: <><path d="M7 7h10v12H7z" /><path d="M9 7V5a3 3 0 0 1 6 0v2M9 13l2 2 4-4" /></>,
    value: <><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v6c0 1.7 3.6 3 8 3M20 6v4M4 12v6c0 1.7 3.6 3 8 3 1.2 0 2.4-.1 3.4-.3" /><circle cx="18" cy="16" r="4" /></>,
    rate: <><circle cx="12" cy="12" r="9" /><path d="m8 16 8-8M9 8h.01M15 16h.01" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
    download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4" /><path d="M5 20h14" /></>
  };
  return <svg className="line-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name] || paths.info}</svg>;
}

const metrics = [
  ["السلات المتروكة", "عدد السلات التي تنطبق عليها شروط الترك", "cart"],
  ["السلات المستعادة", "طلبات مكتملة مطابقة لعملية استعادة", "recovered"],
  ["قيمة المبيعات المستعادة", "قيمة مؤكدة للطلبات المستعادة", "value"],
  ["معدل الاستعادة", "السلات المستعادة ÷ السلات المتروكة", "rate"]
];

export default function AdminSallaReportsPreview({ admin }) {
  const [period, setPeriod] = useState("30");
  const [metric, setMetric] = useState("abandoned");
  const [search, setSearch] = useState("");

  return <div className={`${styles.adminSallaWorkspace} dashboard-main`} dir="rtl">
    <div className="salla-template-editor-top"><a className="btn btn-secondary" href="/admin/integrations">العودة إلى التطبيقات</a></div>
    <div className="page-title">
      <div><h1>تقارير سلة</h1><p className="muted">معاينة إدارية مطابقة للواجهة التي تظهر للمستخدم بعد ربط متجر سلة بنجاح.</p></div>
      <div className="salla-report-head-actions">
        <span className="status neutral">معاينة إدارية</span>
        <select className="select" value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="فترة التقرير">
          <option value="7">آخر 7 أيام</option><option value="30">آخر 30 يومًا</option><option value="90">آخر 90 يومًا</option><option value="custom">فترة مخصصة</option>
        </select>
        <button className="btn btn-primary" type="button" disabled title="التصدير متاح داخل حساب متجر مرتبط فقط"><ReportIcon name="download" /> تصدير التقرير</button>
      </div>
    </div>
    <p className="page-kicker">تحليل أداء المتجر وعمليات استعادة السلات بالاعتماد على بيانات المتجر الفعلية فقط.</p>
    <section className="inline-notice info salla-templates-notice"><ReportIcon name="info" /><span><strong>وضع معاينة آمن:</strong> لا تملك جلسة الأدمن بيانات متجر مستخدم، لذلك تظهر المؤشرات بشرطة — بدل أرقام تجريبية. في حساب المستخدم تُقرأ القيم من Webhooks وAPI وبيانات سلة المخزنة فعليًا.</span></section>
    <p className={styles.adminSallaAdminIdentity}>جلسة الأدمن: {admin.role}</p>

    <section className="salla-report-metrics">{metrics.map(([title, caption, icon]) => <article className="card" key={title}><span><ReportIcon name={icon} /></span><div><h2>{title}</h2><strong>—</strong><small>{caption}</small></div></article>)}</section>

    <section className="salla-report-performance">
      <article className="card"><div className="section-head"><div><h2>أداء استعادة السلات</h2><p>يتغير الرسم حسب الفترة وبيانات المتجر الحقيقية.</p></div><div className="salla-report-metric-tabs">{[["abandoned","السلات المتروكة"],["recovered","السلات المستعادة"],["recoveredValue","القيمة المستعادة"]].map(([key, label]) => <button type="button" key={key} className={metric === key ? "active" : ""} onClick={() => setMetric(key)}>{label}</button>)}</div></div><div className="salla-report-zero-state" data-zero-report-chart><div className="salla-report-zero-legend"><span><i className="abandoned" />السلات المتروكة</span><span><i className="recovered" />السلات المسترجعة</span></div><div className="salla-report-zero-chart" role="img" aria-label="لا توجد بيانات؛ جميع قيم السلات المتروكة والمسترجعة تساوي صفرًا">{Array.from({ length: 30 }, (_, index) => <span key={index}><i className="abandoned" /><i className="recovered" /></span>)}</div><div className="salla-report-zero-copy"><strong>٠ سلة خلال الفترة المحددة</strong><small>جميع القيم عند خط الصفر، وسيبدأ الرسم بالارتفاع عند وصول بيانات فعلية من سلة.</small></div></div></article>
      <aside className="card salla-report-summary"><h2>ملخص الاستعادة</h2><dl><div><dt>عدد عمليات الاستعادة</dt><dd>—</dd></div><div><dt>قيمة المبيعات المستعادة</dt><dd>—</dd></div><div><dt>متوسط الطلب المستعاد</dt><dd>—</dd></div><div><dt>أفضل قناة استعادة</dt><dd>—</dd></div></dl><p>لا يُنسب الاسترجاع إلى Renvix إلا عند مطابقة الطلب مع السلة ومحاولة إرسال ناجحة مرتبطة بها.</p></aside>
    </section>

    <section className="card salla-report-table-card"><div className="section-head"><div><h2>السلات المتروكة</h2><p>الجدول نفسه المستخدم في حساب المتجر، دون إنشاء سجلات تجريبية.</p></div></div><div className="salla-report-filters"><label className="salla-report-search"><ReportIcon name="cart" /><input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="بحث بالعميل أو رقم الطلب..." /></label><select className="select" defaultValue="all"><option value="all">كل الحالات</option><option>متروكة</option><option>قيد الاستعادة</option><option>تمت الاستعادة</option><option>انتهت</option><option>مستبعدة</option></select><select className="select" defaultValue="all"><option value="all">كل القنوات</option><option>واتساب</option><option>البريد</option></select><input className="input" type="number" min="0" placeholder="القيمة من" /><input className="input" type="number" min="0" placeholder="القيمة إلى" /><button className="btn btn-secondary" type="button">تطبيق</button><button className="btn btn-ghost" type="button" onClick={() => setSearch("")}>مسح الفلاتر</button></div><div className="salla-report-preview-table"><div className="salla-report-preview-table-head"><span>العميل</span><span>قيمة السلة</span><span>تاريخ الترك</span><span>حالة الاستعادة</span><span>القناة</span><span>آخر محاولة</span><span>الطلب المستعاد</span><span>الإجراءات</span></div><div className="salla-report-preview-empty compact"><ReportIcon name="cart" /><h3>لا توجد بيانات في المعاينة الإدارية</h3><p>لن تظهر سجلات إلا داخل حساب متجر مرتبط يملك سلات فعلية.</p></div></div></section>
  </div>;
}
