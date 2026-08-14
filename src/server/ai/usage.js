import { query } from "../db.js";
import { getAIEntitlementSummary } from "./entitlements.js";

const safeNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

export function estimateAITokens(value = "") {
  const text = typeof value === "string" ? value : JSON.stringify(value || "");
  return Math.max(1, Math.ceil(text.length / 4));
}

export async function getAIUsageSummary(session) {
  return getAIEntitlementSummary(session);
}

export async function assertAIUsageAvailable(session, estimatedInputTokens = 0) {
  const usage = await getAIUsageSummary(session);
  if ((usage.remainingTokens || 0) < Math.max(128, safeNumber(estimatedInputTokens))) {
    throw Object.assign(new Error("استهلكت رصيد ذكاء Renvix المتاح لهذه الدورة."), {
      status: 429,
      code: "AI_PLAN_TOKEN_LIMIT_REACHED",
      usage
    });
  }
  return usage;
}

export async function getAIUserPreferences(session) {
  const result = await query(
    `SELECT language,response_style AS "responseStyle",
            account_context_enabled AS "accountContextEnabled",
            quick_actions_enabled AS "quickActionsEnabled",
            image_analysis_enabled AS "imageAnalysisEnabled",
            audio_transcription_enabled AS "audioTranscriptionEnabled"
       FROM ai_user_preferences
      WHERE tenant_id=$1 AND user_id=$2 LIMIT 1`,
    [session.tenantId, session.userId]
  );
  return result.rows[0] || {
    language: "unset",
    responseStyle: "balanced",
    accountContextEnabled: true,
    quickActionsEnabled: true,
    imageAnalysisEnabled: true,
    audioTranscriptionEnabled: true
  };
}

export async function updateAIUserPreferences(session, input = {}) {
  const current = await getAIUserPreferences(session);
  const language = ["unset", "ar", "en"].includes(input.language) ? input.language : current.language;
  const responseStyle = ["concise", "balanced", "detailed"].includes(input.responseStyle)
    ? input.responseStyle : current.responseStyle;
  const accountContextEnabled = Object.hasOwn(input, "accountContextEnabled")
    ? Boolean(input.accountContextEnabled) : current.accountContextEnabled;
  const quickActionsEnabled = Object.hasOwn(input, "quickActionsEnabled")
    ? Boolean(input.quickActionsEnabled) : current.quickActionsEnabled;
  const imageAnalysisEnabled = Object.hasOwn(input, "imageAnalysisEnabled")
    ? Boolean(input.imageAnalysisEnabled) : current.imageAnalysisEnabled;
  const audioTranscriptionEnabled = Object.hasOwn(input, "audioTranscriptionEnabled")
    ? Boolean(input.audioTranscriptionEnabled) : current.audioTranscriptionEnabled;
  const result = await query(
    `INSERT INTO ai_user_preferences
      (tenant_id,user_id,language,response_style,account_context_enabled,quick_actions_enabled,image_analysis_enabled,audio_transcription_enabled,updated_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,now())
     ON CONFLICT(tenant_id,user_id) DO UPDATE SET
       language=EXCLUDED.language,response_style=EXCLUDED.response_style,
       account_context_enabled=EXCLUDED.account_context_enabled,
       quick_actions_enabled=EXCLUDED.quick_actions_enabled,image_analysis_enabled=EXCLUDED.image_analysis_enabled,
       audio_transcription_enabled=EXCLUDED.audio_transcription_enabled,updated_at=now()
     RETURNING language,response_style AS "responseStyle",
       account_context_enabled AS "accountContextEnabled",
       quick_actions_enabled AS "quickActionsEnabled",image_analysis_enabled AS "imageAnalysisEnabled",
       audio_transcription_enabled AS "audioTranscriptionEnabled"`,
    [session.tenantId, session.userId, language, responseStyle, accountContextEnabled, quickActionsEnabled,
      imageAnalysisEnabled, audioTranscriptionEnabled]
  );
  return result.rows[0];
}
