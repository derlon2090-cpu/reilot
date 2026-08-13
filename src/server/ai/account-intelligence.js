import { query } from "../db.js";

const clamp = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
const numeric = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const ratio = (part, total, empty = 100) => total > 0 ? clamp((part / total) * 100) : empty;
const change = (current, previous) => previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : current > 0 ? 100 : 0;

function accountSignals(metrics) {
  const risks = [];
  const opportunities = [];
  const recommendations = [];
  if (metrics.failedRenewals > 0) {
    risks.push({ severity: metrics.failedRenewals >= 10 ? "high" : "medium", title: `${metrics.failedRenewals} تجديدًا يحتاج المتابعة`, type: "renewals", href: "/dashboard/subscriptions?status=expired" });
    recommendations.push({ priority: "high", title: "معالجة التجديدات غير المكتملة", description: "ابدأ بالعملاء الأقرب للتجديد لتقليل الإيراد المفقود.", href: "/dashboard/subscriptions?status=expired" });
  }
  if (metrics.failedMessages > 0 || metrics.deliveryRate < 90) {
    risks.push({ severity: metrics.deliveryRate < 80 ? "high" : "medium", title: "قناة الإرسال تحتاج مراجعة", type: "channels", href: "/dashboard/channels" });
    recommendations.push({ priority: "high", title: "فحص حالة القنوات", description: `معدل التسليم الحالي ${metrics.deliveryRate}%. راجع الأخطاء قبل الإرسال القادم.`, href: "/dashboard/channels" });
  }
  if (metrics.connectedChannels === 0) {
    risks.push({ severity: "medium", title: "لا توجد قناة واتساب متصلة", type: "integration", href: "/dashboard/channels" });
  }
  if (metrics.expiredThirtyDays > 0) {
    opportunities.push({ impact: "high", title: `استعادة ${metrics.expiredThirtyDays} عميلًا منتهيًا`, description: "يمكن تجهيز حملة إعادة استهداف بعد مراجعتك.", href: "/dashboard/campaigns/new" });
    recommendations.push({ priority: "medium", title: "تجهيز إعادة استهداف", description: "أنشئ مسودة فقط ثم راجع الجمهور والرسالة قبل الإرسال.", href: "/dashboard/campaigns/new" });
  }
  if (metrics.renewalChange > 0) {
    opportunities.push({ impact: "medium", title: `التجديدات أفضل بـ ${metrics.renewalChange}%`, description: "حافظ على توقيت التذكيرات الحالي وراقب القنوات الأعلى أداءً.", href: "/dashboard/reports" });
  }
  if (!recommendations.length) recommendations.push({ priority: "low", title: "مراجعة الملخص الأسبوعي", description: "الحساب مستقر. راقب التغيرات الرئيسية من التقارير.", href: "/dashboard/reports" });
  return { risks: risks.slice(0, 3), opportunities: opportunities.slice(0, 3), recommendations: recommendations.slice(0, 3) };
}

export async function buildAccountIntelligenceSnapshot(tenantId) {
  const result = await query(
    `SELECT
      (SELECT count(*) FROM subscriptions WHERE tenant_id=$1)::int AS "subscriptionsTotal",
      (SELECT count(*) FROM subscriptions WHERE tenant_id=$1 AND status IN ('active','expiring_soon','renewed'))::int AS "activeSubscriptions",
      (SELECT count(*) FROM subscriptions WHERE tenant_id=$1 AND status='expired' AND end_date >= current_date-30)::int AS "expiredThirtyDays",
      (SELECT count(*) FROM subscriptions WHERE tenant_id=$1 AND status='expired' AND end_date >= date_trunc('month',current_date))::int AS "failedRenewals",
      (SELECT count(*) FROM subscriptions WHERE tenant_id=$1 AND status='renewed' AND updated_at >= date_trunc('month',current_date))::int AS "renewedCurrent",
      (SELECT count(*) FROM subscriptions WHERE tenant_id=$1 AND status='renewed' AND updated_at >= date_trunc('month',current_date)-interval '1 month' AND updated_at < date_trunc('month',current_date))::int AS "renewedPrevious",
      (SELECT count(*) FROM subscriptions WHERE tenant_id=$1 AND end_date BETWEEN current_date AND current_date+30)::int AS "upcomingRenewals",
      (SELECT COALESCE(sum(price),0) FROM subscriptions WHERE tenant_id=$1 AND status='renewed' AND updated_at >= date_trunc('month',current_date))::numeric AS "renewalRevenue",
      (SELECT COALESCE(sum(price),0) FROM subscriptions WHERE tenant_id=$1 AND status='renewed' AND updated_at >= date_trunc('month',current_date)-interval '1 month' AND updated_at < date_trunc('month',current_date))::numeric AS "previousRenewalRevenue",
      (SELECT count(*) FROM customers WHERE tenant_id=$1)::int AS "customersTotal",
      (SELECT count(*) FROM customers WHERE tenant_id=$1 AND status='active')::int AS "activeCustomers",
      (SELECT count(*) FROM notification_logs WHERE tenant_id=$1 AND created_at >= now()-interval '30 days')::int AS "messagesTotal",
      (SELECT count(*) FROM notification_logs WHERE tenant_id=$1 AND created_at >= now()-interval '30 days' AND status IN ('delivered','read'))::int AS "deliveredMessages",
      (SELECT count(*) FROM notification_logs WHERE tenant_id=$1 AND created_at >= now()-interval '30 days' AND status='failed')::int AS "failedMessages",
      (SELECT count(*) FROM whatsapp_channels WHERE tenant_id=$1 AND status='connected')::int AS "connectedChannels",
      (SELECT count(*) FROM whatsapp_channels WHERE tenant_id=$1 AND status IN ('disconnected','expired','error'))::int AS "unhealthyChannels",
      (SELECT count(*) FROM campaigns WHERE tenant_id=$1 AND created_at >= now()-interval '30 days')::int AS "campaignsTotal",
      (SELECT COALESCE(sum(delivered_count),0) FROM campaigns WHERE tenant_id=$1 AND created_at >= now()-interval '30 days')::int AS "campaignDelivered",
      (SELECT COALESCE(sum(failed_count),0) FROM campaigns WHERE tenant_id=$1 AND created_at >= now()-interval '30 days')::int AS "campaignFailed",
      (SELECT count(*) FROM support_tickets WHERE tenant_id=$1 AND status NOT IN ('RESOLVED','CLOSED'))::int AS "openTickets",
      (SELECT count(*) FROM support_tickets WHERE tenant_id=$1 AND status='WAITING_FOR_USER')::int AS "ticketsNeedReply",
      (SELECT count(*) FROM activity_logs WHERE tenant_id=$1 AND type='subscription.renewed' AND created_at >= now()-interval '7 days')::int AS "renewedSinceVisit",
      (SELECT pp.name FROM platform_subscriptions ps JOIN platform_plans pp ON pp.id=ps.plan_id WHERE ps.tenant_id=$1 ORDER BY ps.created_at DESC LIMIT 1) AS "planName",
      (SELECT ps.current_period_end FROM platform_subscriptions ps WHERE ps.tenant_id=$1 ORDER BY ps.created_at DESC LIMIT 1) AS "planPeriodEnd"`,
    [tenantId]
  );
  const row = result.rows[0] || {};
  const renewalBase = numeric(row.renewedCurrent) + numeric(row.failedRenewals);
  const messagesTotal = numeric(row.messagesTotal);
  const campaignMessages = numeric(row.campaignDelivered) + numeric(row.campaignFailed);
  const renewalSuccessRate = ratio(numeric(row.renewedCurrent), renewalBase);
  const deliveryRate = ratio(numeric(row.deliveredMessages), messagesTotal);
  const retentionRate = ratio(numeric(row.activeCustomers), numeric(row.customersTotal));
  const campaignSuccessRate = ratio(numeric(row.campaignDelivered), campaignMessages, 75);
  const renewalHealth = clamp(renewalSuccessRate);
  const communicationHealth = clamp(deliveryRate);
  const integrationHealth = row.connectedChannels > 0 ? clamp(100 - numeric(row.unhealthyChannels) * 20) : 45;
  const campaignHealth = clamp(campaignSuccessRate);
  const customerRetentionScore = clamp(retentionRate);
  const healthScore = clamp(
    renewalHealth * .3 + communicationHealth * .2 + integrationHealth * .15 + campaignHealth * .15 + customerRetentionScore * .2
  );
  const renewalChange = change(numeric(row.renewedCurrent), numeric(row.renewedPrevious));
  const revenueChange = change(numeric(row.renewalRevenue), numeric(row.previousRenewalRevenue));
  const growthScore = clamp(50 + Math.max(-25, Math.min(25, revenueChange)) + Math.max(-15, Math.min(15, renewalChange)));
  const metrics = {
    subscriptionsTotal: numeric(row.subscriptionsTotal), activeSubscriptions: numeric(row.activeSubscriptions),
    expiredThirtyDays: numeric(row.expiredThirtyDays), failedRenewals: numeric(row.failedRenewals),
    renewedCurrent: numeric(row.renewedCurrent), renewedPrevious: numeric(row.renewedPrevious),
    upcomingRenewals: numeric(row.upcomingRenewals), renewalRevenue: numeric(row.renewalRevenue),
    previousRenewalRevenue: numeric(row.previousRenewalRevenue), renewalSuccessRate, renewalChange, revenueChange,
    customersTotal: numeric(row.customersTotal), activeCustomers: numeric(row.activeCustomers), retentionRate,
    messagesTotal, deliveredMessages: numeric(row.deliveredMessages), failedMessages: numeric(row.failedMessages), deliveryRate,
    connectedChannels: numeric(row.connectedChannels), unhealthyChannels: numeric(row.unhealthyChannels),
    campaignsTotal: numeric(row.campaignsTotal), campaignDelivered: numeric(row.campaignDelivered), campaignFailed: numeric(row.campaignFailed), campaignSuccessRate,
    openTickets: numeric(row.openTickets), ticketsNeedReply: numeric(row.ticketsNeedReply), renewedSinceVisit: numeric(row.renewedSinceVisit)
  };
  const signals = accountSignals(metrics);
  return {
    period: "last_30_days",
    scores: { healthScore, growthScore, renewalHealth, communicationHealth, integrationHealth, campaignHealth, customerRetentionScore },
    metrics,
    risks: signals.risks,
    opportunities: signals.opportunities,
    recommendations: signals.recommendations,
    plan: { name: row.planName || "التجربة المجانية", periodEnd: row.planPeriodEnd || null },
    sinceLastVisit: [
      metrics.renewedSinceVisit ? `تم تجديد ${metrics.renewedSinceVisit} اشتراكًا خلال آخر 7 أيام.` : "لا توجد تجديدات مسجلة خلال آخر 7 أيام.",
      metrics.failedRenewals ? `يوجد ${metrics.failedRenewals} تجديدًا يحتاج متابعة.` : "لا توجد تجديدات متعثرة هذا الشهر.",
      `تغير إيراد التجديد ${revenueChange >= 0 ? "بارتفاع" : "بانخفاض"} ${Math.abs(revenueChange)}% عن الشهر السابق.`,
      metrics.ticketsNeedReply ? `توجد ${metrics.ticketsNeedReply} تذكرة بانتظار ردك.` : "لا توجد تذاكر بانتظار ردك."
    ]
  };
}

export async function saveAccountIntelligenceProfile(tenantId, snapshot) {
  const s = snapshot.scores;
  await query(
    `INSERT INTO account_intelligence_profiles
      (tenant_id,health_score,growth_score,renewal_health,communication_health,integration_health,campaign_health,customer_retention_score,current_risks,current_opportunities,recommended_actions,snapshot,last_analyzed_at,updated_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,now(),now())
     ON CONFLICT(tenant_id) DO UPDATE SET health_score=EXCLUDED.health_score,growth_score=EXCLUDED.growth_score,
       renewal_health=EXCLUDED.renewal_health,communication_health=EXCLUDED.communication_health,
       integration_health=EXCLUDED.integration_health,campaign_health=EXCLUDED.campaign_health,
       customer_retention_score=EXCLUDED.customer_retention_score,current_risks=EXCLUDED.current_risks,
       current_opportunities=EXCLUDED.current_opportunities,recommended_actions=EXCLUDED.recommended_actions,
       snapshot=EXCLUDED.snapshot,profile_version=account_intelligence_profiles.profile_version+1,last_analyzed_at=now(),updated_at=now()`,
    [tenantId, s.healthScore, s.growthScore, s.renewalHealth, s.communicationHealth, s.integrationHealth,
      s.campaignHealth, s.customerRetentionScore, JSON.stringify(snapshot.risks), JSON.stringify(snapshot.opportunities),
      JSON.stringify(snapshot.recommendations), JSON.stringify(snapshot)]
  );
}

export async function getAccountIntelligence(tenantId, { persist = true } = {}) {
  const snapshot = await buildAccountIntelligenceSnapshot(tenantId);
  if (persist) await saveAccountIntelligenceProfile(tenantId, snapshot).catch(() => {});
  return snapshot;
}
