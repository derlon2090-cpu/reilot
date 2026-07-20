export function escapeEmailHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character]);
}

export function baseEmail({
  title,
  preview,
  children,
  locale = "ar",
  footerText,
  brandName = "Renvix",
  themeColor = "#0EA5A8"
}) {
  const english = locale === "en";
  const direction = english ? "ltr" : "rtl";
  const align = english ? "left" : "right";
  const safeTitle = escapeEmailHtml(title);
  const safePreview = escapeEmailHtml(preview || title);
  const safeBrand = escapeEmailHtml(brandName || "Renvix");
  const safeTheme = /^#[0-9A-F]{6}$/i.test(String(themeColor || "")) ? String(themeColor).toUpperCase() : "#0EA5A8";
  const safeFooter = escapeEmailHtml(
    footerText || (english ? "Renvix - subscriptions made clearer." : "Renvix - إدارة أوضح للاشتراكات والتجديدات.")
  );

  return `<!doctype html>
<html lang="${english ? "en" : "ar"}" dir="${direction}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;background:#f4f7fb;color:#0f2550;font-family:Arial,'Segoe UI',sans-serif">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">${safePreview}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:32px 12px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e3eaf3;border-radius:18px;overflow:hidden;box-shadow:0 12px 34px rgba(15,37,80,.07)">
            <tr>
              <td style="height:6px;background:${safeTheme}"></td>
            </tr>
            <tr>
              <td style="padding:28px 32px 18px;text-align:${align}">
                <div style="display:inline-block;color:${safeTheme};font-size:22px;font-weight:800">${safeBrand}</div>
                <h1 style="margin:22px 0 8px;color:#0f2550;font-size:26px;line-height:1.45">${safeTitle}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 30px;text-align:${align};font-size:16px;line-height:1.9;color:#475569">${children}</td>
            </tr>
            <tr>
              <td style="padding:20px 32px;border-top:1px solid #e8eef5;background:#f8fafc;text-align:center;color:#718096;font-size:13px;line-height:1.7">${safeFooter}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function emailButton({ href, label, themeColor = "#0EA5A8" }) {
  const safeTheme = /^#[0-9A-F]{6}$/i.test(String(themeColor || "")) ? String(themeColor).toUpperCase() : "#0EA5A8";
  return `<a href="${escapeEmailHtml(href)}" style="display:inline-block;padding:13px 24px;border-radius:9px;background:${safeTheme};color:#ffffff;text-decoration:none;font-weight:700">${escapeEmailHtml(label)}</a>`;
}
