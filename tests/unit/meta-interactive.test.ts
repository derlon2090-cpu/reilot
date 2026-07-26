import { describe, expect, it } from "vitest";
import {
  buildMetaInteractivePayload,
  interactiveMessageSchema
} from "../../src/server/meta-interactive-service.js";

const channelId = "11111111-1111-4111-8111-111111111111";

describe("Meta interactive messages", () => {
  it("rejects duplicate row identifiers", () => {
    const parsed = interactiveMessageSchema.safeParse({
      channelId,
      name: "قائمة الدعم",
      interactiveType: "list",
      definition: {
        body: "كيف يمكننا مساعدتك؟",
        buttonText: "عرض الخيارات",
        sections: [
          {
            id: "support",
            title: "الدعم",
            rows: [
              { id: "same", title: "الفواتير", actionType: "reply" },
              { id: "same", title: "الحساب", actionType: "reply" }
            ]
          }
        ]
      }
    });
    expect(parsed.success).toBe(false);
  });

  it("builds the official list payload without exposing local actions", () => {
    const payload = buildMetaInteractivePayload("list", {
      body: "اختر الخدمة",
      buttonText: "الخدمات",
      sections: [{
        id: "main",
        title: "الخدمات",
        rows: [{
          id: "billing",
          title: "الفواتير",
          description: "مساعدة الفوترة",
          actionType: "open_url",
          actionValue: "https://renvix.app/billing"
        }]
      }]
    }, "+966501234567");
    expect(payload.messaging_product).toBe("whatsapp");
    expect(payload.interactive.type).toBe("list");
    expect(payload.interactive.action.sections[0].rows[0]).toEqual({
      id: "billing",
      title: "الفواتير",
      description: "مساعدة الفوترة"
    });
    expect(JSON.stringify(payload)).not.toContain("actionValue");
  });

  it("accepts reply buttons with unique identifiers", () => {
    const parsed = interactiveMessageSchema.safeParse({
      channelId,
      name: "تأكيد",
      interactiveType: "reply_buttons",
      status: "active",
      definition: {
        body: "هل تريد المتابعة؟",
        buttons: [
          { id: "yes", title: "نعم", actionType: "reply" },
          { id: "no", title: "لا", actionType: "reply" }
        ]
      }
    });
    expect(parsed.success).toBe(true);
  });
});
