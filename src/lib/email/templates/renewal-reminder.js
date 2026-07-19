import { baseEmail, emailButton, escapeEmailHtml } from "./base-email.js";

export function renewalReminderEmail({
  customerName,
  serviceName,
  endDate,
  remainingDays,
  renewalLink,
  storeName = "Renvix",
  locale = "ar"
}) {
  const english = locale === "en";
  const name = customerName || (english ? "Customer" : "عميلنا");
  const safeName = escapeEmailHtml(name);
  const safeService = escapeEmailHtml(serviceName || (english ? "your subscription" : "اشتراكك"));
  const safeEndDate = escapeEmailHtml(endDate || "");
  const safeStore = escapeEmailHtml(storeName);
  const title = english ? "Subscription renewal reminder" : "تذكير بتجديد الاشتراك";
  const daysCopy = Number.isFinite(Number(remainingDays))
    ? (english ? `${remainingDays} days remaining` : `متبقٍ ${remainingDays} يومًا`)
    : "";

  const html = baseEmail({
    title,
    preview: english ? `${safeService} renewal reminder` : `تذكير بتجديد ${safeService}`,
    locale,
    footerText: storeName,
    children: `
      <p style="margin:0 0 14px">${english ? `Hello ${safeName},` : `مرحبًا ${safeName}،`}</p>
      <p style="margin:0 0 12px">${english
        ? `Your ${safeService} subscription is approaching its renewal date${safeEndDate ? ` on <strong>${safeEndDate}</strong>` : ""}.`
        : `نذكرك بأن اشتراكك في ${safeService} يقترب من موعد التجديد${safeEndDate ? ` بتاريخ <strong>${safeEndDate}</strong>` : ""}.`}</p>
      ${daysCopy ? `<p style="margin:0 0 20px;color:#087f97;font-weight:700">${escapeEmailHtml(daysCopy)}</p>` : ""}
      ${renewalLink ? `<p style="margin:24px 0">${emailButton({ href: renewalLink, label: english ? "Renew subscription" : "تجديد الاشتراك" })}</p>` : ""}
      <p style="margin:0;color:#64748b">${english ? `Thank you,<br>${safeStore}` : `شكرًا لك،<br>${safeStore}`}</p>
    `
  });
  const text = english
    ? `Hello ${name}, your ${serviceName || "subscription"} renewal is approaching${endDate ? ` on ${endDate}` : ""}.${renewalLink ? ` Renew: ${renewalLink}` : ""}`
    : `مرحبًا ${name}، يقترب موعد تجديد اشتراكك في ${serviceName || "الخدمة"}${endDate ? ` بتاريخ ${endDate}` : ""}.${renewalLink ? ` رابط التجديد: ${renewalLink}` : ""}`;

  return {
    subject: english ? `Renewal reminder - ${serviceName || storeName}` : `تذكير بالتجديد - ${serviceName || storeName}`,
    html,
    text
  };
}
