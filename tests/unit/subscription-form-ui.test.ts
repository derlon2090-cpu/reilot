import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const appSource = fs.readFileSync(path.resolve(process.cwd(), "src/app/app.js"), "utf8");
const styles = fs.readFileSync(path.resolve(process.cwd(), "src/styles/globals.css"), "utf8");
const createRoute = fs.readFileSync(path.resolve(process.cwd(), "app/api/subscriptions/route.js"), "utf8");
const updateRoute = fs.readFileSync(path.resolve(process.cwd(), "app/api/subscriptions/[id]/route.js"), "utf8");
const operationsSource = fs.readFileSync(path.resolve(process.cwd(), "src/server/subscription-operations.js"), "utf8");
const remindersSource = fs.readFileSync(path.resolve(process.cwd(), "src/server/renewal-reminders.js"), "utf8");
const lifecycleSource = fs.readFileSync(path.resolve(process.cwd(), "src/lib/subscription-lifecycle.js"), "utf8");
const reminderActivationMigration = fs.readFileSync(path.resolve(process.cwd(), "drizzle/0048_subscription_reminder_activation.sql"), "utf8");
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

  it("loads every subscription by default and keeps reminder settings independent from list filters", () => {
    expect(appSource).toContain('subscriptionWindow: ""');
    expect(createRoute).toContain("const hasActiveFilters = Boolean(");
    expect(createRoute).toContain("settingsItems: settingsListing.items");
    expect(appSource).toContain("const settingsRows = Array.isArray(meta.settingsItems) ? meta.settingsItems : rows");
    expect(reminderSettingsSource).toContain("settingsRows.length");
  });

  it("persists a dedicated reminder activation state and blocks every delivery path when disabled", () => {
    expect(reminderSettingsSource).toContain('title: "تفعيل رسالة التذكير"');
    expect(reminderSettingsSource).toContain('inputName: "reminderEnabled"');
    expect(appSource).toContain('aria-label="${escapeHtml(title)}"');
    expect(updateRoute).toContain('reminder_enabled=$8');
    expect(updateRoute).toContain('updated.reminderEnabled && updated.reminderMode === "automatic"');
    expect(operationsSource).toContain("canScheduleSubscriptionReminder(subscription, enabled)");
    expect(remindersSource).toContain("isSubscriptionReminderEnabled(row)");
    expect(lifecycleSource).toContain("source.reminder_enabled !== false && source.reminderEnabled !== false");
    expect(remindersSource).toContain('reason: "reminder_disabled"');
    expect(reminderActivationMigration).toContain("ADD COLUMN IF NOT EXISTS reminder_enabled boolean NOT NULL DEFAULT true");
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
