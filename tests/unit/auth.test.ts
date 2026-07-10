import { describe, expect, it } from "vitest";
import { createRegistrationArtifacts, isSessionActive, loginFailureMessage, requireSession } from "../../src/lib/auth.js";

describe("auth unit behavior", () => {
  it("rejects missing and expired sessions", () => {
    expect(requireSession(null).status).toBe(401);
    expect(isSessionActive({ userId: "u1", expiresAt: "2026-01-01T00:00:00.000Z" }, new Date("2026-07-10T00:00:00.000Z"))).toBe(false);
  });

  it("creates all tenant bootstrap records for a new registration", () => {
    const artifacts = createRegistrationArtifacts({ userId: "user-1", tenantId: "tenant-1", storeId: "store-1", planId: "trial" });

    expect(artifacts.tenantMember.role).toBe("owner");
    expect(artifacts.platformSubscription.status).toBe("trial");
    expect(artifacts.notificationTemplates).toHaveLength(3);
    expect(artifacts.automationRules.every((rule) => rule.isActive)).toBe(true);
    expect(artifacts.messageUsage.messageLimit).toBe(50);
  });

  it("does not reveal whether an email exists on login failure", () => {
    expect(loginFailureMessage()).toBe("Invalid email or password");
  });
});
