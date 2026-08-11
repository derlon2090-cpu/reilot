import { baseEmail, emailButton, escapeEmailHtml } from "./base-email.js";
import { inspectCustomEmailHtml, supportedEmailContentMode, supportedEmailDesign } from "../custom-email-html.js";

const DEFAULT_TEMPLATE = {
  storeName: "Renvix",
  title: "تذكير بتجديد اشتراكك في {{اسم_الخدمة}}",
  themeColor: "#062B28",
  body: "مرحبًا {{اسم_العميل}}،\n\nنود تذكيرك بأن اشتراكك في {{اسم_الخدمة}} سينتهي بتاريخ {{تاريخ_الانتهاء}}.\n\nلضمان استمرار الخدمة دون انقطاع، يرجى تجديد اشتراكك الآن.",
  buttonLabel: "جدد اشتراكك الآن",
  footerText: "شكرًا لثقتك بنا"
};

function replaceVariables(value, variables) {
  return String(value || "").replace(/{{\s*([^{}]+?)\s*}}/g, (match, name) => (
    Object.prototype.hasOwnProperty.call(variables, name) ? String(variables[name] ?? "") : match
  ));
}

function safeHttpsUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function paragraphs(value) {
  return String(value || "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p style="margin:0 0 16px">${escapeEmailHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function presetBody({ design, body, renewalUrl, buttonLabel, themeColor, footerText }) {
  const content = `${paragraphs(body)}${renewalUrl && buttonLabel ? `<p style="margin:24px 0;text-align:center">${emailButton({ href: renewalUrl, label: buttonLabel, themeColor })}</p>` : ""}<p style="margin:20px 0 0;color:#64748b">${escapeEmailHtml(footerText)}</p>`;
  if (design === "modern") return `<div style="padding:30px;border-radius:24px;background:#f3f8f7;border-top:6px solid ${themeColor};box-shadow:0 12px 30px rgba(6,43,40,.08)">${content}</div>`;
  if (design === "minimal") return `<div style="padding:8px 2px;border-bottom:2px solid ${themeColor}">${content}</div>`;
  if (design === "premium") return `<div style="padding:32px;border-radius:20px;background:#071f1d;color:#f8fffe;border:1px solid #315b56"><div style="height:3px;background:${themeColor};margin-bottom:24px"></div>${content}</div>`;
  return `<div style="padding:24px;border:1px solid #dce9e7;border-radius:18px">${content}</div>`;
}

export function renewalReminderEmail({
  customerName,
  serviceName,
  endDate,
  remainingDays,
  renewalLink,
  orderNumber,
  storeName,
  template = {},
  locale = "ar"
}) {
  const english = locale === "en" && !template?.body;
  if (english) {
    const name = customerName || "Customer";
    const service = serviceName || "your subscription";
    const title = "Subscription renewal reminder";
    const link = safeHttpsUrl(renewalLink);
    const text = `Hello ${name}, your ${service} renewal is approaching${endDate ? ` on ${endDate}` : ""}.${link ? ` Renew: ${link}` : ""}`;
    return {
      subject: `Renewal reminder - ${serviceName || storeName || "Renvix"}`,
      text,
      html: baseEmail({
        title,
        preview: text,
        locale: "en",
        footerText: storeName || "Renvix",
        brandName: storeName || "Renvix",
        brandImageUrl: template.storeImageUrl || "",
        brandImageRadius: template.storeImageRadius,
        children: `${paragraphs(`Hello ${name},\n\nYour ${service} subscription is approaching its renewal date${endDate ? ` on ${endDate}` : ""}.`)}${link ? `<p style="margin:24px 0">${emailButton({ href: link, label: "Renew subscription" })}</p>` : ""}`
      })
    };
  }

  const resolved = { ...DEFAULT_TEMPLATE, ...template };
  resolved.storeName = template.storeName || storeName || DEFAULT_TEMPLATE.storeName;
  const variables = {
    اسم_العميل: customerName || "عميلنا",
    اسم_الخدمة: serviceName || "الاشتراك",
    تاريخ_الانتهاء: endDate || "",
    الأيام_المتبقية: Number.isFinite(Number(remainingDays)) ? Number(remainingDays) : "",
    رابط_التجديد: safeHttpsUrl(renewalLink),
    رقم_الطلب: orderNumber || "",
    اسم_المتجر: resolved.storeName,
    customer_name: customerName || "عميلنا",
    service_name: serviceName || "الاشتراك",
    end_date: endDate || "",
    renewal_link: safeHttpsUrl(renewalLink)
  };
  const subject = replaceVariables(resolved.title, variables).replace(/[\r\n]+/g, " ").trim();
  const body = replaceVariables(resolved.body, variables).trim();
  const buttonLabel = replaceVariables(resolved.buttonLabel, variables).trim();
  const footerText = replaceVariables(resolved.footerText, variables).trim();
  const renewalUrl = safeHttpsUrl(renewalLink);
  const text = `${body}${renewalUrl && buttonLabel ? `\n\n${buttonLabel}: ${renewalUrl}` : ""}${footerText ? `\n\n${footerText}` : ""}`;
  const emailDesign = supportedEmailDesign(resolved.emailDesign);
  const emailContentMode = supportedEmailContentMode(resolved.emailContentMode);
  const customInspection = emailContentMode === "html" ? inspectCustomEmailHtml(resolved.emailHtmlContent) : null;
  const safeHtmlVariables = Object.fromEntries(Object.entries(variables).map(([key, value]) => [key, escapeEmailHtml(value)]));
  const customChildren = customInspection?.ok
    ? replaceVariables(customInspection.html, safeHtmlVariables)
    : "";
  const html = baseEmail({
    title: subject,
    preview: subject,
    footerText,
    brandName: resolved.storeName,
    brandImageUrl: resolved.storeImageUrl || "",
    brandImageRadius: resolved.storeImageRadius,
    themeColor: resolved.themeColor,
    children: customChildren || presetBody({ design: emailDesign, body, renewalUrl, buttonLabel, themeColor: resolved.themeColor, footerText })
  });
  return { subject, html, text };
}
