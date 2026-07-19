import { baseEmail, emailButton, escapeEmailHtml } from "./base-email.js";

export function orderInfoLinkEmail({
  customerName,
  storeName,
  orderNumber,
  publicUrl,
  locale = "ar"
}) {
  const english = locale === "en";
  const name = customerName || (english ? "Customer" : "عميلنا");
  const store = storeName || "Renvix";
  const safeName = escapeEmailHtml(name);
  const safeStore = escapeEmailHtml(store);
  const safeOrder = escapeEmailHtml(orderNumber);
  const title = english ? "Your order information is ready" : "معلومات طلبك جاهزة";

  const html = baseEmail({
    title,
    preview: english ? `Order #${orderNumber}` : `معلومات الطلب #${orderNumber}`,
    locale,
    footerText: store,
    children: `
      <p style="margin:0 0 14px">${english ? `Hello ${safeName},` : `مرحبًا ${safeName}،`}</p>
      <p style="margin:0 0 20px">${english
        ? `You can securely review order <strong>#${safeOrder}</strong> and its subscription details using the link below.`
        : `يمكنك مراجعة معلومات الطلب رقم <strong>#${safeOrder}</strong> ومدة الاشتراك بأمان من خلال الرابط التالي.`}</p>
      <p style="margin:24px 0">${emailButton({ href: publicUrl, label: english ? "View order information" : "عرض معلومات الطلب" })}</p>
      <p style="margin:0;color:#64748b">${english ? `Thank you,<br>${safeStore}` : `شكرًا لك،<br>${safeStore}`}</p>
    `
  });
  const text = english
    ? `Hello ${name}, view order #${orderNumber}: ${publicUrl}\n\n${store}`
    : `مرحبًا ${name}، يمكنك عرض معلومات الطلب #${orderNumber} من الرابط:\n${publicUrl}\n\n${store}`;

  return {
    subject: english ? `Order #${orderNumber} - ${store}` : `معلومات الطلب #${orderNumber} - ${store}`,
    html,
    text
  };
}
