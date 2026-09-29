import { describe, expect, it } from "vitest";
import { formatAITokenCount } from "../../src/app/ai-token-format.js";

describe("AI token balance formatting", () => {
  it("shows the exact remaining count after a small charge", () => {
    expect(formatAITokenCount(5_000_000, "en")).toBe("5,000,000");
    expect(formatAITokenCount(4_999_860, "en")).toBe("4,999,860");
    expect(formatAITokenCount(4_999_860, "ar")).not.toBe(formatAITokenCount(5_000_000, "ar"));
  });

  it("handles invalid or fractional provisional counts without displaying misleading tokens", () => {
    expect(formatAITokenCount(140.9, "en")).toBe("140");
    expect(formatAITokenCount(-1, "en")).toBe("0");
    expect(formatAITokenCount("invalid", "en")).toBe("0");
  });
});
