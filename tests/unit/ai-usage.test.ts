import { describe, expect, it } from "vitest";

import { estimateAITokens } from "../../src/server/ai/usage.js";

describe("AI plan usage", () => {
  it("estimates at least one token for an empty prompt", () => {
    expect(estimateAITokens("")).toBe(1);
  });

  it("uses a conservative four-character token estimate", () => {
    expect(estimateAITokens("12345678")).toBe(2);
  });
});
