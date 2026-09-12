import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("admin honeypot telemetry visibility", () => {
  it("returns stored client telemetry through the protected security-center API", () => {
    const route = read("app/api/admin/security-center/route.js");
    expect(route).toContain("requireAdminPermission");
    expect(route).toContain("metadata->'clientTelemetry' AS telemetry");
    expect(route).toContain("metadata->>'honeypotDeviceId' AS \"honeypotDeviceId\"");
    expect(route).toContain("metadata->>'deviceFingerprint' AS \"deviceFingerprint\"");
    expect(route).toContain("metadata->>'fingerprintConfidence' AS \"fingerprintConfidence\"");
    expect(route).toContain("metadata->'ipLocation' AS \"ipLocation\"");
    expect(route).toContain("LIMIT 5");
    expect(route).toContain('AS "recentActivity"');
    expect(route).toContain("requestedHost");
    expect(route).toContain("blockedNavigation");
  });

  it("shows device and aggregate interaction details without presenting captured field values", () => {
    const component = read("src/components/admin/SecurityCenter.jsx");
    expect(component).toContain("تفاصيل الرصد");
    expect(component).toContain("mouseMoves");
    expect(component).toContain("mouseDistance");
    expect(component).toContain("loginAttempts");
    expect(component).toContain("بصمة الجهاز التقديرية");
    expect(component).toContain("Renvix Device ID");
    expect(component).toContain("حظر Renvix Device ID");
    expect(component).toContain("آخر 5 مسارات داخل نطاقات Renvix");
    expect(component).toContain("محاولة مُنعت بواسطة الحظر");
    expect(component).toContain("لا يستطيع الموقع قراءة سجل التصفح خارج نطاقاته");
    expect(component).toContain("تقريبي وليس GPS");
    expect(component).toContain("فتح الحادث وخيارات الاحتواء");
    expect(component).toContain("لا يتم حفظ محتوى الحقول أو كلمات المرور");
    expect(component).not.toContain("telemetry.password");
    expect(component).not.toContain("telemetry.identity");
  });
});
