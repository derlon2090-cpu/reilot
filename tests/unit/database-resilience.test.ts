import { describe, expect, it } from "vitest";
import { databaseFailureReason, isTransientDatabaseError } from "../../src/server/db.js";

describe("database connection resilience", () => {
  it.each(["08006", "57P01", "53300", "ECONNRESET", "ETIMEDOUT"])(
    "treats %s as a transient connection failure",
    (code) => expect(isTransientDatabaseError({ code })).toBe(true)
  );

  it("does not retry deterministic query errors", () => {
    expect(isTransientDatabaseError({ code: "23505" })).toBe(false);
  });

  it("separates connectivity, schema, and authentication service failures", () => {
    expect(databaseFailureReason({ code: "ECONNREFUSED" })).toBe("database_unavailable");
    expect(databaseFailureReason({ code: "42703" })).toBe("database_schema_missing");
    expect(databaseFailureReason({ code: "22023" })).toBe("admin_auth_service_unavailable");
  });
});
