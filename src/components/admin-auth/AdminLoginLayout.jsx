import styles from "../admin/AdminPortal.module.css";

export default function AdminLoginLayout({ children, title = "منطقة إدارة خاصة", description = "هذه الصفحة مخصصة لإدارة منصة Renvix فقط، ولا تظهر في واجهة العملاء." }) {
  return (
    <main className={styles.loginPage} dir="rtl">
      <section className={styles.loginIntro}>
        <div className={styles.brand} aria-label="Renvix">
          <img className={styles.brandLogo} src="/assets/renewpilot-logo-horizontal.png" alt="Renvix" />
        </div>
        <div className={styles.introMark}><img src="/assets/renvix-mark.png" alt="" /></div>
        <h1>{title}</h1>
        <p>{description}</p>
        <div className={styles.securityPill}>جلسة مشفرة · صلاحيات دقيقة · سجل تدقيق</div>
      </section>
      <section className={styles.loginPanel}>{children}</section>
    </main>
  );
}

