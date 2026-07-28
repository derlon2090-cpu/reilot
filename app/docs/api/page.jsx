import "./styles.css";

const scopes = [
  ["customers:read", "قراءة العملاء"],
  ["customers:write", "إنشاء العملاء وتحديثهم"],
  ["subscriptions:read", "قراءة الاشتراكات"],
  ["subscriptions:write", "إنشاء الاشتراكات وتحديثها"],
  ["messages:send", "إرسال الرسائل"],
  ["events:write", "إنشاء الأحداث"],
  ["webhooks:manage", "إدارة نقاط Webhook"]
];

export const metadata = {
  title: "توثيق API وWebhook | Renvix",
  description: "التوثيق الرسمي للتكامل المخصص في Renvix."
};

export default function ApiDocumentationPage() {
  return (
    <main className="api-docs" dir="rtl">
      <header className="api-docs__header">
        <a className="api-docs__brand" href="/" aria-label="Renvix">
          <img src="/assets/renewpilot-logo-horizontal.png" alt="Renvix" />
        </a>
        <nav>
          <a href="#authentication">المصادقة</a>
          <a href="#requests">الطلبات</a>
          <a href="#webhooks">Webhook</a>
          <a href="/openapi/renvix-v1.json" target="_blank" rel="noreferrer">OpenAPI JSON</a>
        </nav>
        <a className="api-docs__dashboard" href="/dashboard/settings/integrations/custom-api">العودة إلى لوحة التحكم</a>
      </header>

      <section className="api-docs__hero">
        <span>توثيق المطورين</span>
        <h1>تكامل Renvix API / Webhook</h1>
        <p>اربط نظامك بواجهات موثقة ومفاتيح محدودة الصلاحيات، واستقبل الأحداث بتوقيع يمكن التحقق منه.</p>
        <div className="api-docs__base"><b>Base URL</b><code dir="ltr">https://renvix.app/api/v1</code></div>
      </section>

      <div className="api-docs__layout">
        <aside className="api-docs__toc">
          <strong>المحتويات</strong>
          <a href="#authentication">المصادقة</a>
          <a href="#scopes">الصلاحيات</a>
          <a href="#requests">تنفيذ طلب</a>
          <a href="#idempotency">منع التكرار</a>
          <a href="#webhooks">توقيع Webhook</a>
          <a href="#retries">إعادة المحاولة</a>
        </aside>

        <article className="api-docs__content">
          <section id="authentication">
            <div className="api-docs__section-title"><span>01</span><div><h2>المصادقة</h2><p>أرسل مفتاح البيئة المناسبة في ترويسة Authorization.</p></div></div>
            <pre dir="ltr"><code>{`Authorization: Bearer rvx_live_your_key\nContent-Type: application/json`}</code></pre>
            <div className="api-docs__notice">يظهر المفتاح الكامل مرة واحدة عند الإنشاء. خزّنه في مدير أسرار ولا ترسله في الرابط أو السجلات.</div>
          </section>

          <section id="scopes">
            <div className="api-docs__section-title"><span>02</span><div><h2>الصلاحيات</h2><p>أنشئ كل مفتاح بأقل صلاحيات يحتاجها التكامل.</p></div></div>
            <div className="api-docs__scopes">{scopes.map(([key, label]) => <div key={key}><code dir="ltr">{key}</code><span>{label}</span></div>)}</div>
          </section>

          <section id="requests">
            <div className="api-docs__section-title"><span>03</span><div><h2>تنفيذ طلب</h2><p>مثال قراءة قائمة العملاء.</p></div></div>
            <pre dir="ltr"><code>{`curl --request GET \\\n  --url https://renvix.app/api/v1/customers \\\n  --header 'Authorization: Bearer rvx_live_your_key' \\\n  --header 'Accept: application/json'`}</code></pre>
            <p>تعيد الاستجابة الناجحة كائنًا يحتوي على <code dir="ltr">data</code> وبيانات ترقيم الصفحات. الأخطاء تستخدم رمزًا ثابتًا ورسالة آمنة.</p>
          </section>

          <section id="idempotency">
            <div className="api-docs__section-title"><span>04</span><div><h2>منع تكرار عمليات الكتابة</h2><p>أرسل مفتاحًا فريدًا مع كل عملية إنشاء أو تعديل.</p></div></div>
            <pre dir="ltr"><code>{`Idempotency-Key: order-8472-renewal-1`}</code></pre>
            <p>عند تكرار المفتاح والطلب نفسه تعاد الاستجابة السابقة. استخدام المفتاح نفسه مع محتوى مختلف يعيد خطأ <code dir="ltr">idempotency_conflict</code>.</p>
          </section>

          <section id="webhooks">
            <div className="api-docs__section-title"><span>05</span><div><h2>التحقق من توقيع Webhook</h2><p>احسب HMAC-SHA256 على الطابع الزمني وجسم الطلب الخام.</p></div></div>
            <pre dir="ltr"><code>{`X-Renvix-Event-Id: evt_xxxxx\nX-Renvix-Delivery-Id: dlv_xxxxx\nX-Renvix-Timestamp: 1785141900\nX-Renvix-Signature: v1=HEX_SIGNATURE\n\nsignedPayload = timestamp + "." + rawBody`}</code></pre>
            <ul>
              <li>استخدم جسم الطلب الخام قبل تحويله إلى JSON.</li>
              <li>ارفض الطلب إذا تجاوز عمره خمس دقائق.</li>
              <li>قارن التوقيع بزمن ثابت واحفظ Event ID لمنع إعادة التشغيل.</li>
              <li>أعد استجابة 2xx بسرعة ثم عالج الحدث في Queue.</li>
            </ul>
          </section>

          <section id="retries">
            <div className="api-docs__section-title"><span>06</span><div><h2>سياسة إعادة المحاولة</h2><p>يعاد الإرسال عند انقطاع الشبكة أو 408 و425 و429 وأخطاء 5xx.</p></div></div>
            <div className="api-docs__retry"><span>فورًا</span><span>1 دقيقة</span><span>5 دقائق</span><span>15 دقيقة</span><span>ساعة</span><span>6 ساعات</span><span>24 ساعة</span></div>
          </section>
        </article>
      </div>
      <footer>© 2026 Renvix. جميع الحقوق محفوظة.</footer>
    </main>
  );
}
