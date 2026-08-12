import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  adminDeviceStatusLabel,
  deviceMessageMetrics,
  isAdminPairingExpired,
  maskAdminDevicePhone,
  normalizeAdminDeviceStatus
} from "../../src/server/admin-evolution-devices.js";
import { EvolutionAdminAdapter, adminEvolutionHealth } from "../../src/server/admin-evolution-provider.js";

describe("admin Evolution device presentation", () => {
  it.each([
    ["open", "connected", "متصل"],
    ["pending_qr", "pending_pairing", "بانتظار الاقتران"],
    ["close", "disconnected", "غير متصل"],
    ["risk_hold", "error", "يحتاج متابعة"]
  ])("localizes %s without exposing the raw state", (raw, normalized, label) => {
    expect(normalizeAdminDeviceStatus(raw)).toBe(normalized);
    expect(adminDeviceStatusLabel(raw)).toBe(label);
  });

  it("does not display a false 0% success rate when there are no messages", () => {
    expect(deviceMessageMetrics()).toEqual({ sent: 0, delivered: 0, failed: 0, today: 0, successRate: null });
  });

  it("calculates delivery metrics from actual attempts", () => {
    expect(deviceMessageMetrics({ sent: 18, delivered: 15, failed: 2, today: 4 })).toEqual({ sent: 18, delivered: 15, failed: 2, today: 4, successRate: 90 });
  });

  it("masks phone numbers unless the administrator has the explicit permission", () => {
    expect(maskAdminDevicePhone("966512345678", false)).toBe("+9665••••678");
    expect(maskAdminDevicePhone("966512345678", true)).toBe("+966512345678");
  });

  it("expires pairing material at the requested time", () => {
    expect(isAdminPairingExpired("2026-08-03T10:00:00.000Z", Date.parse("2026-08-03T10:00:01.000Z"))).toBe(true);
    expect(isAdminPairingExpired("2026-08-03T10:01:00.000Z", Date.parse("2026-08-03T10:00:01.000Z"))).toBe(false);
  });

  it("keeps the admin page limited to platform-owned devices and on-demand pairing", () => {
    const source = readFileSync(resolve("src/components/admin/AdminSections.jsx"), "utf8");
    expect(source).toContain("أجهزة الإدارة فقط");
    expect(source).toContain("لن يرتبط الجهاز بأي متجر أو حساب عميل");
    expect(source).not.toContain("المتجر المرتبط");
    expect(source).not.toContain("الإدارة المركزية عبر Evolution Admin");
    expect(source).not.toContain("ربط المستخدمين عبر Meta Cloud API");
    expect(source).toContain('runAction(selected, "qr")');
    expect(source).toContain('runAction(selected, "pairing_code"');
    expect(source).toContain('await runAction(result.device, pairingAction');
  });

  it("keeps QR and pairing action icons compact inside their buttons", () => {
    const css = readFileSync(resolve("src/components/admin/AdminPortal.module.css"), "utf8");
    expect(css).toContain(".adminQrPanel > .adminPrimaryButton svg");
    expect(css).toContain(".adminPairingCodePanel > .adminPrimaryButton svg");
    expect(css).toMatch(/\.adminPairingCodePanel\s*>\s*\.adminPrimaryButton svg\s*\{[^}]*width:\s*18px;[^}]*height:\s*18px;[^}]*flex:\s*0 0 18px;/s);
  });

  it("does not persist QR images or pairing codes in the admin device service", () => {
    const source = readFileSync(resolve("src/server/admin-evolution-devices.js"), "utf8");
    expect(source).not.toMatch(/qr_code_cache\s*=\s*\$|pairing_code\s*=\s*\$/);
    expect(source).toContain("platform_messaging_channels");
    expect(source).not.toContain("FROM whatsapp_channels");
  });
});

describe("EvolutionAdminAdapter pairing", () => {
  beforeEach(() => {
    process.env.EVOLUTION_ADMIN_API_URL = "https://evolution.test";
    process.env.EVOLUTION_ADMIN_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.EVOLUTION_ADMIN_API_URL;
    delete process.env.EVOLUTION_ADMIN_API_KEY;
    delete process.env.EVOLUTION_API_URL;
    delete process.env.EVOLUTION_API_KEY;
  });

  it("generates an ephemeral QR image from provider pairing text", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ qrcode: { code: "pairing-payload-that-is-long-enough-for-a-secure-qr-code-123456789" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await new EvolutionAdminAdapter().getQrCode({ instanceName: "admin_device_01" });
    expect(result.qrCode).toMatch(/^data:image\/png;base64,/);
    expect(result.expiresIn).toBe(60);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/instance/connect/admin_device_01"), expect.objectContaining({ headers: expect.objectContaining({ apikey: "test-key" }) }));
  });

  it("creates a Baileys instance with QR enabled using the Evolution v2 contract", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ instance: { instanceName: "admin_device_01" } }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await new EvolutionAdminAdapter().createInstance({ instanceName: "admin_device_01", phoneNumber: "966512345678" });

    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    const request = calls[0]?.[1];
    expect(JSON.parse(String(request?.body))).toEqual({
      instanceName: "admin_device_01",
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
      number: "966512345678"
    });
  });

  it("recreates a missing provider instance before pairing", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ instance: { instanceName: "admin_device_01" } }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new EvolutionAdminAdapter().ensureInstance({ instanceName: "admin_device_01" });

    expect(result).toMatchObject({ existing: false, recreated: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("https://evolution.test/instance/create");
  });

  it("extracts a pairing code without logging or persisting it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ pairingCode: "A8K3-7M2Q" }), { status: 200 })));
    const result = await new EvolutionAdminAdapter().generatePairingCode({ instanceName: "admin_device_01", phoneNumber: "966512345678" });
    expect(result).toEqual({ pairingCode: "A8K3-7M2Q", expiresIn: 60 });
  });

  it("refreshes the connection state from Evolution without generating pairing material", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ instance: { state: "open" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await new EvolutionAdminAdapter().getConnectionState({ instanceName: "admin_device_01" });
    expect(result).toEqual({ instance: { state: "open" } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://evolution.test/instance/connectionState/admin_device_01",
      expect.objectContaining({ headers: expect.objectContaining({ apikey: "test-key" }) })
    );
  });

  it("uses the self-hosted Evolution server when dedicated admin credentials are omitted", async () => {
    delete process.env.EVOLUTION_ADMIN_API_URL;
    delete process.env.EVOLUTION_ADMIN_API_KEY;
    process.env.EVOLUTION_API_URL = "http://evolution-api:8080";
    process.env.EVOLUTION_API_KEY = "shared-server-key";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ pairingCode: "8H5M-2Q7P" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new EvolutionAdminAdapter().generatePairingCode({ instanceName: "admin_device_01", phoneNumber: "966512345678" });

    expect(result.pairingCode).toBe("8H5M-2Q7P");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://evolution-api:8080/instance/connect/admin_device_01?number=966512345678",
      expect.objectContaining({ headers: expect.objectContaining({ apikey: "shared-server-key" }) })
    );
  });

  it("checks the authenticated Evolution v2 instances endpoint for server health", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([{ instance: { instanceName: "admin_device_01" } }]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await adminEvolutionHealth();

    expect(result).toMatchObject({ ok: true, instances: 1 });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://evolution.test/instance/fetchInstances",
      expect.objectContaining({ headers: expect.objectContaining({ apikey: "test-key" }) })
    );
  });
});
