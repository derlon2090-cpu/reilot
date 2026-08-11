"use client";

function NavIcon({ name }) {
  const paths = {
    template: <><path d="M6 2h9l4 4v16H6z" /><path d="M14 2v5h5M9 12h6M9 16h6" /></>,
    reports: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /><path d="m4 8 6-4 6 6 5-5" /></>
  };
  return <svg className="line-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name] || paths.template}</svg>;
}

export default function AdminSallaWorkspaceNav({ active = "templates" }) {
  const go = (path) => window.location.assign(path);
  return <nav className="salla-workspace-nav" aria-label="أقسام تكامل سلة في لوحة الأدمن">
    <button type="button" className={active === "templates" ? "active" : ""} aria-current={active === "templates" ? "page" : undefined} onClick={() => go("/admin/integrations/salla")}>
      <NavIcon name="template" /><span><strong>معاينة وتحرير</strong><small>قوالب الرسائل والأتمتة</small></span>
    </button>
    <button type="button" className={active === "reports" ? "active" : ""} aria-current={active === "reports" ? "page" : undefined} onClick={() => go("/admin/integrations/salla/reports")}>
      <NavIcon name="reports" /><span><strong>تقارير سلة</strong><small>السلات المتروكة والاستعادة</small></span>
    </button>
  </nav>;
}
