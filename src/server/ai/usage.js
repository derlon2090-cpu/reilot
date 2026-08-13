import { query } from "../db.js";

const FALLBACK_LIMITS = Object.freeze({
  trial: 20_000,
  retired_free: 20_000,
  starter: 150_000,
  professional: 750_000,
  business: 2_000_000,
  enterprise: -1
});

const safeNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

export function estimateAITokens(value = "") {
  const text = typeof value === "string" ? value : JSON.stringify(value || "");
  return Math.max(1, Math.ceil(text.length / 4));
}

export async function getAIUsageSummary(session) {
  const result = await query(
    `WITH active_plan AS (
       SELECT pp.name,pp.slug,pp.ai_monthly_token_limit,
              ps.current_period_start,ps.current_period_end
         FROM platform_subscriptions ps
         JOIN platform_plans pp ON pp.id=ps.plan_id
        WHERE ps.tenant_id=$1
        ORDER BY CASE
          WHEN ps.status='active' AND ps.current_period_end>now() THEN 0
          WHEN ps.status='trial' AND COALESCE(ps.trial_ends_at,ps.current_period_end)>now() THEN 1
          WHEN ps.status='past_due' THEN 2 ELSE 3 END,
          ps.created_at DESC
        LIMIT 1
     )
     SELECT ap.name AS "planName",ap.slug AS "planSlug",
            ap.ai_monthly_token_limit AS "limitTokens",
            ap.current_period_start AS "periodStart",ap.current_period_end AS "periodEnd",
            COALESCE(sum(u.input_tokens+u.output_tokens),0)::bigint AS "usedTokens",
            COALESCE(sum(u.request_count),0)::int AS "requestCount"
       FROM active_plan ap
       LEFT JOIN ai_usage_daily u ON u.tenant_id=$1
        AND u.usage_date >= CASE WHEN ap.current_period_end>now()
          THEN COALESCE(ap.current_period_start,date_trunc('month',now()))::date
          ELSE date_trunc('month',now())::date END
        AND u.usage_date < CASE WHEN ap.current_period_end>now()
          THEN COALESCE(ap.current_period_end,date_trunc('month',now())+interval '1 month')::date
          ELSE (date_trunc('month',now())+interval '1 month')::date END
      GROUP BY ap.name,ap.slug,ap.ai_monthly_token_limit,ap.current_period_start,ap.current_period_end`,
    [session.tenantId]
  );
  const row = result.rows[0] || {};
  const planSlug = String(row.planSlug || "trial");
  const limitTokens = row.limitTokens === null || row.limitTokens === undefined
    ? (FALLBACK_LIMITS[planSlug] ?? 20_000)
    : safeNumber(row.limitTokens);
  const usedTokens = safeNumber(row.usedTokens);
  const unlimited = limitTokens < 0;
  const remainingTokens = unlimited ? null : Math.max(0, limitTokens - usedTokens);
  return {
    planName: row.planName || "التجربة",
    planSlug,
    limitTokens,
    usedTokens,
    remainingTokens,
    requestCount: safeNumber(row.requestCount),
    percent: unlimited || limitTokens <= 0 ? 0 : Math.min(100, Math.round((usedTokens / limitTokens) * 1000) / 10),
    unlimited,
    periodStart: row.periodStart || null,
    periodEnd: row.periodEnd || null
  };
}

export async function assertAIUsageAvailable(session, estimatedInputTokens = 0) {
  const usage = await getAIUsageSummary(session);
  if (!usage.unlimited && (usage.remainingTokens || 0) < Math.max(128, safeNumber(estimatedInputTokens))) {
    throw Object.assign(new Error("استهلكت مساحة ذكاء Renvix المتاحة في باقتك لهذا الشهر."), {
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
            quick_actions_enabled AS "quickActionsEnabled"
       FROM ai_user_preferences
      WHERE tenant_id=$1 AND user_id=$2 LIMIT 1`,
    [session.tenantId, session.userId]
  );
  return result.rows[0] || {
    language: "unset",
    responseStyle: "balanced",
    accountContextEnabled: true,
    quickActionsEnabled: true
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
  const result = await query(
    `INSERT INTO ai_user_preferences
      (tenant_id,user_id,language,response_style,account_context_enabled,quick_actions_enabled,updated_at)
     VALUES($1,$2,$3,$4,$5,$6,now())
     ON CONFLICT(tenant_id,user_id) DO UPDATE SET
       language=EXCLUDED.language,response_style=EXCLUDED.response_style,
       account_context_enabled=EXCLUDED.account_context_enabled,
       quick_actions_enabled=EXCLUDED.quick_actions_enabled,updated_at=now()
     RETURNING language,response_style AS "responseStyle",
       account_context_enabled AS "accountContextEnabled",
       quick_actions_enabled AS "quickActionsEnabled"`,
    [session.tenantId, session.userId, language, responseStyle, accountContextEnabled, quickActionsEnabled]
  );
  return result.rows[0];
}
