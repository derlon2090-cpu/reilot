import { describe, expect, it } from "vitest";
import { evolutionConnect, extractEvolutionPairingCode, isEvolutionInstanceMissing, isEvolutionPairingUnsupported, isEvolutionTimeout, isEvolutionUnreachable, isValidPairingCode, normalizeEvolutionQr } from "../../src/server/evolution-client.js";
import { evolutionInstanceName } from "../../src/server/whatsapp-repository.js";

describe("normalizeEvolutionQr", () => {
  it("accepts only sufficiently sized PNG or JPEG payloads", () => {
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(900)
    ]).toString("base64");

    expect(normalizeEvolutionQr(png)).toBe(`data:image/png;base64,${png}`);
    expect(normalizeEvolutionQr("base64-qr")).toBeNull();
    expect(normalizeEvolutionQr(Buffer.alloc(900).toString("base64"))).toBeNull();
    expect(normalizeEvolutionQr("data:image/svg+xml;base64,PHN2Zz4=")).toBeNull();
  });

  it("recognizes a missing provider instance without masking other failures", () => {
    expect(isEvolutionInstanceMissing(new Error("Evolution API 404: instance does not exist"))).toBe(true);
    expect(isEvolutionInstanceMissing(new Error("Evolution API 503: unavailable"))).toBe(false);
  });

  it("extracts only short provider pairing codes and rejects QR payloads", () => {
    expect(extractEvolutionPairingCode({ data: { pairingCode: "7K9M-2Q4P" } })).toBe("7K9M-2Q4P");
    expect(extractEvolutionPairingCode({ pairingCode: null, code: "x".repeat(3000) })).toBeNull();
    expect(isValidPairingCode("data:image/png;base64,abc")).toBe(false);
  });

  it("does not classify an HTTP 200 response without a code as unsupported", () => {
    expect(isEvolutionPairingUnsupported(new Error("Evolution API 501: not implemented"))).toBe(true);
    expect(isEvolutionPairingUnsupported(new Error("pairing code not supported"))).toBe(true);
    expect(isEvolutionPairingUnsupported(new Error("HTTP 200 without a valid pairing code"))).toBe(false);
  });

  it("returns a stable timeout code when Evolution exceeds its deadline", async () => {
    const previousFetch = globalThis.fetch;
    const previousKey = process.env.EVOLUTION_API_KEY;
    const previousUrl = process.env.EVOLUTION_API_URL;
    process.env.EVOLUTION_API_KEY = "test-key";
    process.env.EVOLUTION_API_URL = "https://evolution.test";
    globalThis.fetch = async () => {
      const error = new Error("The operation timed out");
      error.name = "TimeoutError";
      throw error;
    };
    try {
      await expect(evolutionConnect("rp_test", undefined, 20)).rejects.toMatchObject({ code: "EVOLUTION_TIMEOUT", timeoutMs: 20 });
      await evolutionConnect("rp_test", undefined, 20).catch((error) => expect(isEvolutionTimeout(error)).toBe(true));
    } finally {
      globalThis.fetch = previousFetch;
      if (previousKey === undefined) delete process.env.EVOLUTION_API_KEY; else process.env.EVOLUTION_API_KEY = previousKey;
      if (previousUrl === undefined) delete process.env.EVOLUTION_API_URL; else process.env.EVOLUTION_API_URL = previousUrl;
    }
  });

  it("returns a stable unavailable code for provider network failures", async () => {
    const previousFetch = globalThis.fetch;
    const previousKey = process.env.EVOLUTION_API_KEY;
    const previousUrl = process.env.EVOLUTION_API_URL;
    process.env.EVOLUTION_API_KEY = "test-key";
    process.env.EVOLUTION_API_URL = "https://evolution.test";
    globalThis.fetch = async () => { throw new TypeError("fetch failed"); };
    try {
      await evolutionConnect("rp_test").catch((error) => {
        expect(error).toMatchObject({ code: "EVOLUTION_UNREACHABLE" });
        expect(isEvolutionUnreachable(error)).toBe(true);
      });
    } finally {
      globalThis.fetch = previousFetch;
      if (previousKey === undefined) delete process.env.EVOLUTION_API_KEY; else process.env.EVOLUTION_API_KEY = previousKey;
      if (previousUrl === undefined) delete process.env.EVOLUTION_API_URL; else process.env.EVOLUTION_API_URL = previousUrl;
    }
  });

  it("keeps the provider pairing-capable by creating instances without an eager QR", async () => {
    const previousFetch = globalThis.fetch;
    const previousKey = process.env.EVOLUTION_API_KEY;
    const previousUrl = process.env.EVOLUTION_API_URL;
    process.env.EVOLUTION_API_KEY = "test-key";
    process.env.EVOLUTION_API_URL = "https://evolution.test";
    let payload = null;
    globalThis.fetch = async (_url, init) => {
      payload = JSON.parse(String(init?.body || "{}"));
      return new Response(JSON.stringify({ instance: { instanceName: "rp_test" } }), { status: 201, headers: { "Content-Type": "application/json" } });
    };
    const { evolutionCreateInstance } = await import("../../src/server/evolution-client.js");
    try {
      await evolutionCreateInstance("rp_test");
      expect(payload).toMatchObject({ instanceName: "rp_test", qrcode: false, integration: "WHATSAPP-BAILEYS" });
    } finally {
      globalThis.fetch = previousFetch;
      if (previousKey === undefined) delete process.env.EVOLUTION_API_KEY; else process.env.EVOLUTION_API_KEY = previousKey;
      if (previousUrl === undefined) delete process.env.EVOLUTION_API_URL; else process.env.EVOLUTION_API_URL = previousUrl;
    }
  });

  it("creates a unique tenant-scoped instance name for every link", () => {
    const first = evolutionInstanceName("tn8f3-example");
    const second = evolutionInstanceName("tn8f3-example");
    expect(first).toMatch(/^rp_tn8f3exa_[a-z0-9]+$/);
    expect(second).not.toBe(first);
  });
});
