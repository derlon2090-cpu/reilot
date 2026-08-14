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
    expect(overviewRoute).toContain("getAIChatStorageSummary(auth.session)");
    expect(overviewRoute).not.toContain("getAccountIntelligence");
    expect(overviewRoute).toContain('preferences: preferencesResult.status === "fulfilled"');
    expect(overviewRoute).toContain('chatStorage: chatStorageResult.status === "fulfilled"');
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
    expect(source).toContain("reconcileAILiveMeter(liveMeter).then(refreshAIConversationSidebar)");
    expect(css).toContain(".rvx-ai-conversation-menu");
  });

  it("separates image, file and voice controls and supports a private backend upload relay", async () => {
    const [source, css, uploadRoute] = await Promise.all([
      readFile("src/app/app.js", "utf8"),
      readFile("src/styles/globals.css", "utf8"),
      readFile("app/api/ai/conversations/[conversationId]/attachments/route.js", "utf8")
    ]);
    expect(source).toContain('data-action="ai-add-image"');
    expect(source).toContain('name="images" type="file" multiple accept="image/png,image/jpeg,image/webp"');
    expect(source).toContain('name="files" type="file" multiple accept=".pdf,.txt,.log,application/pdf,text/plain"');
    expect(source).toContain('data-action="ai-record-audio"');
    expect(source).toContain("navigator.mediaDevices.getUserMedia");
    expect(source).toContain("new MediaRecorder");
    expect(source).toContain('.split(";", 1)[0].trim().toLowerCase()');
    expect(source).toContain('data-ai-recording-time');
    expect(source).toContain("function uploadAIAttachments");
    expect(source).toContain("rvx-ai-attachment-preview");
    expect(css).toContain(".rvx-ai-composer textarea:focus-visible");
    expect(uploadRoute).toContain("createAttachmentUpload");
    expect(uploadRoute).not.toContain('access: "public"');
    expect(source).toContain("prepared.upload.url");
    expect(source).toContain('"X-Renvix-Upload-Url": prepared.upload.url');
    expect(source).toContain("friendlyAIAttachmentError");
    expect(source).toContain("الملف ما زال محفوظًا في المحرر");
    expect(source).toContain('/upload`');
    expect(source).toContain("/complete");
    expect(source).toContain("/process");
  });

  it("allows same-origin microphone capture and prevents duplicate message submission", async () => {
    const [source, nextConfig] = await Promise.all([
      readFile("src/app/app.js", "utf8"),
      readFile("next.config.mjs", "utf8")
    ]);
    expect(nextConfig).toContain('microphone=(self)');
    expect(nextConfig).not.toContain('microphone=()');
    expect(source).toContain('form.dataset.aiSubmitting === "true"');
    expect(source).toContain('form.dataset.aiSubmitting = "true"');
    expect(source).toContain('delete form.dataset.aiSubmitting');
    expect(source).toContain('form.elements.prompt.value = ""');
    expect(source).toContain('form?.dataset.aiMicrophoneStarting === "true"');
    expect(source).toContain('"/backend/ai/messages"');
    expect(source).not.toContain('"/api/ai/messages"');
  });

  it("exposes professional media privacy settings", async () => {
    const source = await readFile("src/app/app.js", "utf8");
    expect(source).toContain('name="imageAnalysisEnabled"');
    expect(source).toContain('name="audioTranscriptionEnabled"');
    expect(source).toContain("تحليل الصور المرفوعة");
    expect(source).toContain("تحويل الرسائل الصوتية");
  });

  it("paces streamed copy and follows only the inner message viewport", async () => {
    const [source, css] = await Promise.all([
      readFile("src/app/app.js", "utf8"),
      readFile("src/styles/globals.css", "utf8")
    ]);
    expect(source).toContain("function createAIStreamWriter");
    expect(source).toContain("await streamWriter?.drain()");
    expect(source).toContain("streamWriter?.finalize()");
    expect(source).toContain("revealAIResponseBlocks(blockNode, assistantBlocks)");
    expect(source).toContain("Math.ceil(pending.length / 180)");
    expect(source).toContain("state.aiProgrammaticScroll");
    expect(source).toContain("function stopAIMessageFollowing");
    expect(source).toContain("current.scrollTop = Math.max(0, current.scrollHeight - current.clientHeight)");
    expect(source).not.toContain("const maxStep = state.aiStreaming ? 42 : 72");
    expect(source).not.toContain("current.scrollTop += Math.sign(distance)");
    expect(source).not.toContain("current.scrollTo({ behavior: \"smooth\"");
    expect(source).not.toContain('streamNode?.scrollIntoView');
    expect(css).toContain("overflow-y:scroll");
    expect(css).toContain("overflow-anchor:none");
    expect(css).toContain("@keyframes rvx-ai-typing{50%{opacity:.38}}");
    expect(css).toContain(".rvx-ai-tools{min-height:30px");
  });

  it("keeps AI data updates local and isolates ticket live refreshes from the chat", async () => {
    const source = await readFile("src/app/app.js", "utf8");
    expect(source).toContain('const isAIPage = state.route === "/dashboard/support/ai"');
    expect(source).toContain("const batchesInitialRender = isDashboardHome");
    expect(source).toContain("renderOnComplete: !batchesInitialRender && !isAIPage");
    expect(source).toContain('else if (target === "aiConversation") refreshAIConversationWorkspace()');
    expect(source).toContain("const shouldLoadDashboardChromeData = state.route.startsWith(\"/dashboard\") && !isAIPage");
    expect(source).toContain('state.route !== "/dashboard/support/ai"');
    expect(source).toContain("if (!supportLiveRouteActive())");
  });

  it("hydrates recent chats and balance without flashing an empty or zero state", async () => {
    const [source, css] = await Promise.all([
      readFile("src/app/app.js", "utf8"),
      readFile("src/styles/globals.css", "utf8")
    ]);
    expect(source).toContain("function readCachedAIViewState");
    expect(source).toContain("function cacheAIViewState");
    expect(source).toContain("cachedAIViewState?.conversations || null");
    expect(source).toContain("state.aiConversationsRevalidationPending = false");
    expect(source).toContain("cachedAIViewState?.usage || null");
    expect(source).toContain("cachedAIViewState?.chatStorage || null");
    expect(source).toContain("scheduleAIRemoteRetry");
    expect(source).toContain("/backend/ai/conversations?limit=40");
    expect(source).toContain("payload.snapshot || { loaded: true }");
    expect(source).toContain("if (!state.aiUsage)");
    expect(source).toContain("rvx-ai-conversation-skeleton");
    expect(source).toContain("function aiConversationLoadingMarkup");
    expect(css).toContain(".rvx-ai-conversation-skeleton");
    expect(css).toContain(".rvx-ai-conversation-loading");
    expect(css).toContain(".rvx-ai-usage-card.is-loading");
  });

  it("preserves text entered while an assistant response is streaming", async () => {
    const source = await readFile("src/app/app.js", "utf8");
    const streamHandler = source.slice(source.indexOf("async function handleAIMessageSubmit"), source.indexOf("async function handleSubmit"));
    expect(source).toContain("if (state.aiStreaming) state.aiDraftEditedDuringStream = true");
    expect(streamHandler).toContain("const composerDraft = String(form.elements.prompt?.value || \"\")");
    expect(streamHandler).toContain("state.aiDraft = composerDraft");
    expect(streamHandler).toContain("const restoredDraft = draftEditedDuringStream ? composerDraft : (composerDraft || prompt)");
    expect(streamHandler).not.toContain('if (messageInserted && messageAccepted) {\n      state.aiDraft = "";');
  });

  it("defers structured cards until the paced response text is complete", async () => {
    const source = await readFile("src/app/app.js", "utf8");
    const streamHandler = source.slice(source.indexOf("async function handleAIMessageSubmit"), source.indexOf("async function handleSubmit"));
    expect(streamHandler.indexOf("await streamWriter?.drain()")).toBeLessThan(streamHandler.indexOf("revealAIResponseBlocks(blockNode, assistantBlocks)"));
    expect(streamHandler).not.toContain("blockNode.innerHTML = assistantBlocks.map(renderAIBlock)");
    expect(source).toContain("line.textContent = activeLine");
  });

  it("stops stream consumption, copies completed replies and refreshes usage without a page reload", async () => {
    const [source, css] = await Promise.all([
      readFile("src/app/app.js", "utf8"),
      readFile("src/styles/globals.css", "utf8")
    ]);
    expect(source).toContain("state.aiStopRequested = true");
    expect(source).toContain("state.aiActiveStreamWriter?.cancel()");
    expect(source).toContain('signal?.addEventListener("abort", stopReading');
    expect(source).toContain('data-action="ai-copy-response"');
    expect(source).toContain("function refreshAIUsageCards");
    expect(source).toContain("refreshAIUsageCards();");
    expect(source).toContain("function beginAILiveMeter");
    expect(source).toContain("applyAIAuthoritativeUsage(payload.usage)");
    expect(source).toContain('type === "storage"');
    expect(css).toContain(".rvx-ai-live-meter");
    expect(source).toContain("عذرًا، نفد رصيد الذكاء المتاح. تواصل مع الدعم أو رقِّ الباقة للمتابعة.");
    expect(css).toContain(".rvx-ai-message-meta button");
    const liveAdvance = source.slice(source.indexOf("function advanceAILiveMeter"), source.indexOf("function confirmAILiveAttachmentStorage"));
    expect(liveAdvance).not.toContain("scheduleAILiveMeterRefresh");
    expect(css).toContain("font-variant-numeric:tabular-nums");
  });

  it("publishes reserved usage and exact chat storage while the response is still live", async () => {
    const orchestrator = await readFile("src/server/ai/orchestrator.js", "utf8");
    expect(orchestrator).toContain("usage: reservation.usage");
    expect(orchestrator).toContain('emit("storage", { phase: "accepted", storage: acceptedStorage })');
    expect(orchestrator).toContain('emit("storage", { phase: "settled", storage: updatedStorage })');
    expect(orchestrator).toContain("getAIChatStorageSummary(session)");
  });

  it("keeps usage and response data cards compact across chat viewports", async () => {
    const css = await readFile("src/styles/globals.css", "utf8");
    expect(css).toContain(".rvx-ai-side-bottom .rvx-ai-usage-card{gap:4px;min-height:142px;padding:7px 9px");
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

  it("opens saved conversations with a cancellable targeted update for tablet performance", async () => {
    const [source, css] = await Promise.all([
      readFile("src/app/app.js", "utf8"),
      readFile("src/styles/globals.css", "utf8")
    ]);
    const openHandler = source.slice(source.indexOf('if (action === "ai-open-conversation")'), source.indexOf('if (action === "ai-toggle-sidebar")'));
    const sidebarHandler = source.slice(source.indexOf('if (action === "ai-toggle-sidebar")'), source.indexOf('if (action === "ai-open-settings")'));
    expect(source).toContain("state.aiConversationRequestController?.abort()");
    expect(source).toContain("function refreshAIConversationWorkspace()");
    expect(source).toContain("?limit=40");
    expect(openHandler).toContain("refreshAIConversationSelection()");
    expect(openHandler).toContain("void loadAIConversation(state.aiConversationId, { force: true })");
    expect(openHandler).not.toContain("syncRouteData(true)");
    expect(openHandler).not.toContain("return render()");
    expect(sidebarHandler).toContain('.classList.toggle("open", state.aiSidebarOpen)');
    expect(sidebarHandler).not.toContain("render()");
    expect(css).toContain("content-visibility:auto");
    expect(css).toContain("contain-intrinsic-size:auto 112px");
  });

  it("separates conversation metadata without an active edge stripe", async () => {
    const css = await readFile("src/styles/globals.css", "utf8");
    expect(css).toContain(".rvx-ai-conversation-open small{display:flex;align-items:center;justify-content:space-between;gap:12px");
    expect(css).toContain("min-width:max-content;margin-inline-start:8px;direction:ltr");
    expect(css).toContain("border:1px solid #e5efed;border-radius:11px;background:#fff");
    expect(css).toContain("border-inline-start:1px solid #dce8e6");
    expect(css).toContain(".rvx-ai-conversation-item.active{border-color:#b8ddd7;background:#e9f7f4;box-shadow:none}");
    expect(css).not.toContain("box-shadow:inset 3px 0 0 #0b776c");
  });

  it("shows refill-to-cap balance and calm threshold states without provider internals", async () => {
    const [source, css] = await Promise.all([
      readFile("src/app/app.js", "utf8"),
      readFile("src/styles/globals.css", "utf8")
    ]);
    expect(source).toContain("رصيد الذكاء");
    expect(source).toContain("يتجدد إلى");
    expect(source).toContain("لا توجد تعبئة خامسة");
    expect(source).toContain('percent >= 100 ? "exhausted"');
    expect(source).toContain("visibleStorageBytes");
    expect(source).toContain('english ? "Calculating…" : "جارٍ الحساب…"');
    expect(css).toContain(".rvx-ai-usage-card.is-warning");
    expect(css).toContain(".rvx-ai-usage-card.is-critical");
    const card = source.slice(source.indexOf("function aiUsageCard()"), source.indexOf("function aiConversationItemsMarkup"));
    expect(card).not.toMatch(/deepseek|cache hit|provider cost|flash thinking/i);
  });

  it("loads the balance independently with bounded requests and paints it without waiting for the dashboard batch", async () => {
    const source = await readFile("src/app/app.js", "utf8");
    expect(source).toContain('queue("aiUsage", "/backend/ai/usage", "aiUsage", aiReadOptions)');
    expect(source).toContain("scheduleAIStorageSummaryRefresh({ force })");
    expect(source).toContain("requestIdleCallback(start, { timeout: 2500 })");
    expect(source).toContain("timeoutMs: 6_000");
    expect(source).toContain('if (["aiUsage", "aiStorageSummary"].includes(target)) refreshAIUsageCards()');
    expect(source).toContain('timeoutError.code = "REQUEST_TIMEOUT"');
    expect(source).toContain('class="rvx-ai-usage-error" role="status"');
    expect(source).toContain("تم إنهاؤه بأمان. أعد تحميل الرصيد");
    expect(source).toContain('{ error: error.message || "تعذر تحميل رصيد الذكاء", retrying: true }');
  });
});
