import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const server = fs.readFileSync(path.resolve("src/server/salla-templates.js"), "utf8");
const pages = fs.readFileSync(path.resolve("src/server/salla-public-pages.js"), "utf8");
const route = fs.readFileSync(path.resolve("app/api/public/salla-page/[publicId]/route.js"), "utf8");
const migration = fs.readFileSync(path.resolve("drizzle/0057_salla_smart_digital_delivery.sql"), "utf8");
const tokenMigration = fs.readFileSync(path.resolve("drizzle/0059_salla_public_page_token_hardening.sql"), "utf8");

describe("Salla smart digital delivery security", () => {
  it("stores customer delivery values only in the encrypted page payload", () => {
    expect(pages).toContain("secure_payload_ciphertext");
    expect(pages).toContain("encryptSecret(JSON.stringify({ assets:");
    expect(pages).toContain("decryptSecret(item.securePayloadCiphertext");
    expect(pages).not.toContain('payload_snapshot=$2::jsonb,branding=$3::jsonb,updated_at=now()');
  });

  it("uses token hashes, expiry, revocation, view limits and no-store headers", () => {
    expect(pages).toContain("token_hash=$2");
    expect(pages).toContain("viewLimitReached");
    expect(pages).toContain("revokedAt");
    expect(route).toContain('"Cache-Control": "private, no-store');
    expect(route).toContain('"X-Robots-Tag": "noindex');
    expect(route).toContain('"X-Content-Type-Options": "nosniff"');
    expect(route).toContain('"Content-Security-Policy"');
  });

  it("uses at least 128 random bits for public ids and never stores a recoverable raw token", () => {
    expect(pages).toContain("randomToken(32)");
    expect(pages).toContain("randomToken(16)");
    expect(pages).toContain("token_hash=$6,token_ciphertext=NULL");
    expect(pages).not.toContain("decryptSecret(existing.rows[0].tokenCiphertext");
    expect(tokenMigration).toContain("ALTER COLUMN token_ciphertext DROP NOT NULL");
    expect(tokenMigration).toContain("SET token_ciphertext = NULL");
  });

  it("checks expiry while holding the row lock before consuming a view", () => {
    const expiryCheck = pages.indexOf("expired: true");
    const viewUpdate = pages.indexOf("view_count=view_count+1");
    expect(expiryCheck).toBeGreaterThan(-1);
    expect(viewUpdate).toBeGreaterThan(expiryCheck);
  });

  it("sends only the secure link rather than parsed secrets", () => {
    expect(server).toContain("لأمان بياناتك، اعرضها من الرابط الآمن التالي فقط");
    expect(server).toContain('activation_code: ""');
    expect(server).toContain("variables.digital_content_url = publicPage.url");
  });

  it("requires a trusted per-store source and never scans notes", () => {
    expect(server).toContain("salla_delivery_source_configs");
    expect(migration).toContain("UNIQUE (tenant_id, store_id)");
    expect(migration).toContain("source_field_key");
    expect(server).not.toMatch(/data\.(?:notes|internal_notes).*digitalDelivery/);
  });

  it("uses a durable completed transition and item entitlement uniqueness", () => {
    expect(migration).toContain("salla_order_transition_state");
    expect(migration).toContain("UNIQUE (tenant_id, store_id, external_order_id, external_order_item_id)");
    expect(server).toContain("not_a_new_transition");
  });

  it("revokes pages, entitlements and queued delivery after cancellation or refund", () => {
    expect(server).toContain("revokeSallaPublicPages");
    expect(server).toContain("digital_delivery_revoked");
    expect(server).toContain("salla_digital_entitlements SET status='revoked'");
  });
});
