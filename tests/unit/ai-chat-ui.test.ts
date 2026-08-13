import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const readUI = async () => Promise.all([
  readFile("src/app/app.js", "utf8"),
  readFile("src/styles/globals.css", "utf8"),
  readFile("app/api/ai/overview/route.js", "utf8"),
  readFile("src/server/ai/orchestrator.js", "utf8")
]);

describe("Renvix Intelligence chat UI", () => {
  it("uses the interface locale without a manual language onboarding step", async () => {
    const source = await readFile("src/app/app.js", "utf8");
    expect(source).not.toContain('data-action="ai-select-language"');
    expect(source).not.toContain("اختر لغتك للبدء");
    expect(source).toContain('locale: state.language === "en" ? "en" : "ar"');
    expect(source).toContain("لغة الشات تتبع لغة الواجهة");
  });

  it("keeps quick actions and support return while storage cleanup lives in account settings", async () => {
    const source = await readFile("src/app/app.js", "utf8");
    expect(source).toContain("العودة إلى مركز الدعم");
    expect(source).toContain('class="rvx-ai-quick-actions"');
    expect(source).not.toContain('data-action="ai-cleanup-storage"');
    expect(source).not.toContain('class="rvx-ai-storage-cleanup"');
    expect(source).toContain("مساحة محادثاتك");
  });

  it("keeps platform navigation visible and clears the welcome grid before the first message", async () => {
    const [source, css] = await readUI();
    expect(source).toContain('.rvx-ai-welcome,.rvx-ai-loading,.rvx-ai-start,.rvx-ai-onboarding');
    expect(css).toContain('.dashboard-main:has(.rvx-ai-page)>.topbar{display:flex}');
    expect(css).toContain('grid-template-columns:minmax(0,1fr);grid-template-rows:82px minmax(0,1fr)');
    expect(css).toContain('@media(max-width:980px)');
    expect(css).toContain('grid-template-rows:72px minmax(0,1fr)');
    expect(css).not.toContain('.dashboard-shell:has(.rvx-ai-page)>.sidebar,.dashboard-shell:has(.rvx-ai-page)>.sidebar-backdrop{display:none}');
    expect(css).not.toContain('.dashboard-shell:has(.rvx-ai-page){grid-template-columns:minmax(0,1fr)}');
  });

  it("renders safe structured assistant copy and reports real chat storage", async () => {
    const [source, css, overviewRoute, orchestrator] = await readUI();
    expect(source).toContain("function renderAIMessageContent");
    expect(source).toContain('class="rvx-ai-rich-text"');
    expect(source).toContain("state.aiChatStorage = payload.chatStorage || null");
    expect(css).toContain(".rvx-ai-rich-text h3");
    expect(overviewRoute).toContain("getAIChatStorage(auth.session)");
    expect(overviewRoute).toContain("preferences, chatStorage");
    expect(orchestrator).toContain("لا تستخدم الفواصل الزخرفية");
  });

  it("supports professional conversation actions without rerendering the message stream", async () => {
    const [source, css] = await Promise.all([
      readFile("src/app/app.js", "utf8"),
      readFile("src/styles/globals.css", "utf8")
    ]);
    for (const action of ["ai-pin-conversation", "ai-rename-conversation", "ai-archive-conversation", "ai-delete-conversation"]) {
      expect(source).toContain(`data-action="${action}"`);
    }
    expect(source).toContain("function queueAIMessageScroll");
    expect(source).not.toContain('streamNode?.scrollIntoView');
    expect(source).toContain("refreshAIStateSilently().then(refreshAIConversationSidebar)");
    expect(css).toContain(".rvx-ai-conversation-menu");
  });

  it("uploads and previews real chat attachments with a clean focus state", async () => {
    const [source, css, uploadRoute] = await Promise.all([
      readFile("src/app/app.js", "utf8"),
      readFile("src/styles/globals.css", "utf8"),
      readFile("app/api/ai/conversations/[conversationId]/attachments/route.js", "utf8")
    ]);
    expect(source).toContain('data-action="ai-add-attachment"');
    expect(source).toContain("function uploadAIAttachments");
    expect(source).toContain("rvx-ai-attachment-preview");
    expect(css).toContain(".rvx-ai-composer textarea:focus-visible");
    expect(uploadRoute).toContain('access: "public"');
    expect(uploadRoute).toContain("getAIConversation(auth.session, conversationId)");
  });

  it("paces streamed copy and follows only the inner message viewport", async () => {
    const [source, css] = await Promise.all([
      readFile("src/app/app.js", "utf8"),
      readFile("src/styles/globals.css", "utf8")
    ]);
    expect(source).toContain("function createAIStreamWriter");
    expect(source).toContain("await streamWriter?.drain()");
    expect(source).toContain("state.aiProgrammaticScroll");
    expect(source).toContain("function stopAIMessageFollowing");
    expect(source).not.toContain('streamNode?.scrollIntoView');
    expect(css).toContain("overflow-anchor:none");
  });

  it("keeps usage and response data cards compact across chat viewports", async () => {
    const css = await readFile("src/styles/globals.css", "utf8");
    expect(css).toContain(".rvx-ai-side-bottom .rvx-ai-usage-card{gap:4px;padding:7px 9px");
    expect(css).toContain(".rvx-ai-assistant-message .rvx-ai-data-card{width:min(100%,640px)");
    expect(css).toContain("@media(max-width:700px){.rvx-ai-assistant-message .rvx-ai-data-card{width:100%");
  });

  it("isolates storage values and opens saved conversations at their latest message", async () => {
    const [source, css] = await Promise.all([
      readFile("src/app/app.js", "utf8"),
      readFile("src/styles/globals.css", "utf8")
    ]);
    expect(source).toContain('class="rvx-ai-storage-value" dir="ltr"');
    expect(source).toContain('state.aiConversationOpenAtBottom = true');
    expect(source).toContain("function openAIConversationAtLatestMessage");
    expect(source).toContain("list.scrollTop = list.scrollHeight");
    expect(css).toContain(".rvx-ai-storage-value{display:inline-block;direction:ltr;unicode-bidi:isolate;white-space:nowrap");
  });

  it("separates conversation metadata without an active edge stripe", async () => {
    const css = await readFile("src/styles/globals.css", "utf8");
    expect(css).toContain(".rvx-ai-conversation-open small{display:flex;align-items:center;justify-content:space-between;gap:12px");
    expect(css).toContain("min-width:max-content;margin-inline-start:8px;direction:ltr");
    expect(css).toContain(".rvx-ai-conversation-item.active{border-color:#b8ddd7;background:#e9f7f4;box-shadow:none}");
    expect(css).not.toContain("box-shadow:inset 3px 0 0 #0b776c");
  });
});
