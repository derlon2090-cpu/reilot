import { describe, expect, it } from "vitest";

import { classifyAIRequest } from "../../src/server/ai/router.js";

describe("Renvix AI request routing", () => {
  it("routes ordinary chat to Flash without thinking or account tools", () => {
    expect(classifyAIRequest({ prompt: "اشرح لي طريقة إنشاء تذكير جديد" })).toMatchObject({
      intent: "general_chat",
      modelTier: "flash",
      thinking: "disabled",
      useTools: false
    });
  });

  it("routes ordinary account questions to Flash plus Renvix tools", () => {
    expect(classifyAIRequest({ prompt: "اعرض ملخص التجديدات في حسابي" })).toMatchObject({
      intent: "account_query",
      modelTier: "flash",
      thinking: "disabled",
      useTools: true
    });
  });

  it("routes multi-source root-cause analysis to Pro thinking", () => {
    expect(classifyAIRequest({
      prompt: "حلل بعمق السبب الجذري لانخفاض التجديدات وقارن أداء الحملات والقنوات خلال عدة فترات"
    })).toMatchObject({
      intent: "deep_analysis",
      modelTier: "pro",
      thinking: "enabled",
      reasoningEffort: "high",
      useTools: true
    });
  });

  it("uses Flash thinking for a medium image-assisted analysis", () => {
    expect(classifyAIRequest({
      prompt: "ليش أداء الحملة منخفض؟",
      attachments: [{ purpose: "image" }]
    })).toMatchObject({
      modelTier: "flash",
      thinking: "enabled",
      reasoningEffort: "low"
    });
  });

  it("escalates a prior quality failure without escalating a technical retry", () => {
    expect(classifyAIRequest({ prompt: "راجع النتيجة", previousFailure: "quality" }).thinking).toBe("enabled");
    expect(classifyAIRequest({ prompt: "راجع النتيجة", previousFailure: "technical" }).thinking).toBe("disabled");
  });

  it("marks sensitive actions for explicit confirmation", () => {
    expect(classifyAIRequest({ prompt: "أرسل الحملة الآن إلى كل العملاء" })).toMatchObject({
      intent: "sensitive_action",
      requiresConfirmation: true,
      useTools: true
    });
  });

  it("never enables account tools when account context is disabled", () => {
    expect(classifyAIRequest({
      prompt: "حلل اشتراكات حسابي",
      accountContextEnabled: false
    }).useTools).toBe(false);
  });
});
