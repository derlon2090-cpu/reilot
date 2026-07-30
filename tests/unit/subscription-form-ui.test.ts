import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const appSource = fs.readFileSync(path.resolve(process.cwd(), "src/app/app.js"), "utf8");
const styles = fs.readFileSync(path.resolve(process.cwd(), "src/styles/globals.css"), "utf8");
const createRoute = fs.readFileSync(path.resolve(process.cwd(), "app/api/subscriptions/route.js"), "utf8");
const subscriptionFormSource = appSource.slice(
  appSource.indexOf("function subscriptionForm("),
  appSource.indexOf("function customerForm(")
);
const reminderSettingsSource = appSource.slice(
  appSource.indexOf("const settingsSection ="),
  appSource.indexOf("const templatesSection =")
);

describe("manual subscription delivery form", () => {
  it("shows both contact fields and changes the required field with the selected channel", () => {
    expect(appSource).toContain('data-action="subscription-reminder-channel"');
    expect(appSource).toContain('data-subscription-contact="whatsapp"');
    expect(appSource).toContain('data-subscription-contact="email"');
    expect(appSource).toContain("syncSubscriptionDeliveryFields");
    expect(appSource).toContain("رقم واتساب مطلوب");
    expect(appSource).toContain("البريد الإلكتروني مطلوب");
    expect(styles).toContain(".manual-subscription-form .subscription-delivery-settings { display: block; }");
  });

  it("keeps scheduling controls in reminder settings instead of the add-subscription form", () => {
    expect(subscriptionFormSource).not.toContain('name="fallbackChannel"');
    expect(subscriptionFormSource).not.toContain('name="reminderMode"');
    expect(subscriptionFormSource).not.toContain('name="reminderDaysBefore"');
    expect(reminderSettingsSource).toContain('name="reminderMode"');
    expect(reminderSettingsSource).toContain('name="reminderDaysBefore"');
    expect(reminderSettingsSource).not.toContain("الاشتراك المحدد");
  });

  it("enforces the delivery contact again on the server", () => {
    expect(createRoute).toContain("validateSubscriptionDeliveryContact");
    expect(createRoute).toContain("whatsappNumber: body.whatsappNumber");
    expect(createRoute).toContain("message: contact.message");
  });

  it("keeps RTL workspace and action icons from wrapping over table content", () => {
    expect(styles).toContain("direction:rtl");
    expect(styles).toContain(".subscription-list-card .subscription-actions");
    expect(styles).toContain("flex-wrap: nowrap");
  });
});
