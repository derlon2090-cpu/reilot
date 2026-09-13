import { expect, test } from "@playwright/test";
import crypto from "node:crypto";
import path from "node:path";
import pg from "pg";

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:3000";
const token = crypto.randomBytes(32).toString("base64url");
const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
let sessionId = "";
let client: pg.Client;

test.beforeAll(async () => {
  client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false }
  });
  await client.connect();
  const user = await client.query(
    `SELECT u.id FROM users u
      JOIN tenants t ON t.id=u.tenant_id AND t.status<>'disabled'
     ORDER BY u.created_at ASC LIMIT 1`
  );
  expect(user.rows[0], "An active development user is required for the storage viewport test.").toBeTruthy();
  const session = await client.query(
    `INSERT INTO sessions(user_id,token,expires_at,user_agent)
     VALUES($1,$2,now()+interval '20 minutes','ipad-storage-toolbar') RETURNING id`,
    [user.rows[0].id, tokenHash]
  );
  sessionId = session.rows[0].id;
});

test.afterAll(async () => {
  if (sessionId) await client.query("DELETE FROM sessions WHERE id=$1", [sessionId]);
  await client?.end();
});

test("storage toolbar controls stay complete inside an iPad landscape card", async ({ context, page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await context.addCookies([
    { name: "renewpilot_session", value: token, url: baseURL, httpOnly: true, sameSite: "Lax" }
  ]);
  await page.goto("/dashboard/storage", { waitUntil: "domcontentloaded" });

  const browser = page.locator(".storage-browser");
  const toolbar = browser.locator(".storage-toolbar");
  await expect(browser).toBeVisible({ timeout: 20_000 });
  await expect(toolbar).toBeVisible();
  await expect(toolbar.locator(":scope > label, :scope > select, :scope > input, :scope > div")).toHaveCount(5);

  const geometry = await browser.evaluate((card) => {
    const cardBox = card.getBoundingClientRect();
    const toolbarElement = card.querySelector<HTMLElement>(".storage-toolbar");
    const toolbarBox = toolbarElement?.getBoundingClientRect();
    const controls = Array.from(toolbarElement?.children || []).map((element) => {
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width };
    });
    return {
      card: { left: cardBox.left, right: cardBox.right },
      toolbar: toolbarBox ? { left: toolbarBox.left, right: toolbarBox.right } : null,
      controls,
      viewportWidth: innerWidth
    };
  });

  expect(geometry.toolbar).not.toBeNull();
  expect(geometry.toolbar!.left).toBeGreaterThanOrEqual(geometry.card.left - 1);
  expect(geometry.toolbar!.right).toBeLessThanOrEqual(geometry.card.right + 1);
  for (const control of geometry.controls) {
    expect(control.width).toBeGreaterThan(40);
    expect(control.left).toBeGreaterThanOrEqual(geometry.card.left - 1);
    expect(control.right).toBeLessThanOrEqual(geometry.card.right + 1);
  }

  await page.screenshot({ path: path.resolve("test-results-ipad-fix/storage-toolbar-1280x720.png") });
});
