import styles from "../admin/AdminPortal.module.css";

export default function AdminLoginLayout({ children, title = "منطقة إدارة خاصة", description = "هذه الصفحة مخصصة لإدارة منصة Renvix فقط، ولا تظهر في واجهة العملاء." }) {
  return (
    <main className={styles.adminAuthPage} dir="rtl">
      <span className={`${styles.authDecor} ${styles.authDecorTop}`} aria-hidden="true" />
      <span className={`${styles.authDecor} ${styles.authDecorBottom}`} aria-hidden="true" />
      <span className={`${styles.authDots} ${styles.authDotsTop}`} aria-hidden="true" />
      <span className={`${styles.authDots} ${styles.authDotsBottom}`} aria-hidden="true" />
      <section className={styles.adminAuthContent}>
        <div className={styles.adminAuthBrand} aria-label="Renvix">
          <img className={styles.brandLogo} src="/assets/renewpilot-logo-horizontal.png" alt="Renvix" />
        </div>
        <h1>{title === "منطقة إدارة خاصة" ? "دخول الأدمن" : title}</h1>
        <p className={styles.adminAuthDescription}>{title === "منطقة إدارة خاصة" ? "Renvix | وصول آمن إلى لوحة إدارة المنصة" : description}</p>
        <section className={styles.loginPanel}>{children}</section>
        <div className={styles.authSecurityCard}><span className={styles.authSecurityIcon}>✓</span><div><strong>اتصال آمن ومحمي</strong><span>جميع الاتصالات مشفرة باستخدام TLS 1.2+ لحماية بياناتك</span></div></div>
      </section>
    </main>
  );
}
