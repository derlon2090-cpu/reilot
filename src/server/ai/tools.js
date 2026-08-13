import { z } from "zod";
import { can } from "../../lib/permissions.js";

const emptySchema = z.object({}).strict();
const periodSchema = z.object({ from: z.string().date().optional(), to: z.string().date().optional() }).strict();

const definitions = {
  getAccountHealth: {
    description: "يعيد صحة حساب Renvix والمخاطر والفرص الحالية من بيانات الحساب الحقيقية.", permission: "read:any", mode: "READ", schema: emptySchema,
    select: (snapshot) => ({ scores: snapshot.scores, risks: snapshot.risks, opportunities: snapshot.opportunities, recommendations: snapshot.recommendations, period: snapshot.period })
  },
  getRenewalAnalytics: {
    description: "يعيد ملخص التجديدات والإيرادات واتجاهها للفترة الحالية.", permission: "read:any", mode: "READ", schema: periodSchema,
    select: (snapshot) => ({
      totalSubscriptions: snapshot.metrics.subscriptionsTotal, active: snapshot.metrics.activeSubscriptions,
      renewed: snapshot.metrics.renewedCurrent, failed: snapshot.metrics.failedRenewals,
      upcoming: snapshot.metrics.upcomingRenewals, successRate: snapshot.metrics.renewalSuccessRate,
      revenue: snapshot.metrics.renewalRevenue, renewalChange: snapshot.metrics.renewalChange,
      revenueChange: snapshot.metrics.revenueChange, period: snapshot.period
    })
  },
  getChannelHealth: {
    description: "يعيد صحة قنوات التواصل والتسليم والأخطاء.", permission: "read:any", mode: "READ", schema: emptySchema,
    select: (snapshot) => ({ connected: snapshot.metrics.connectedChannels, unhealthy: snapshot.metrics.unhealthyChannels, totalMessages: snapshot.metrics.messagesTotal, delivered: snapshot.metrics.deliveredMessages, failed: snapshot.metrics.failedMessages, deliveryRate: snapshot.metrics.deliveryRate })
  },
  getCampaignPerformance: {
    description: "يعيد أداء الحملات خلال آخر 30 يومًا.", permission: "read:any", mode: "READ", schema: periodSchema,
    select: (snapshot) => ({ campaigns: snapshot.metrics.campaignsTotal, delivered: snapshot.metrics.campaignDelivered, failed: snapshot.metrics.campaignFailed, successRate: snapshot.metrics.campaignSuccessRate, period: snapshot.period })
  },
  getPlanUsage: {
    description: "يعيد اسم الخطة الحالية وموعد انتهاء الفترة.", permission: "read:any", mode: "READ", schema: emptySchema,
    select: (snapshot) => snapshot.plan
  },
  getSupportHistory: {
    description: "يعيد عدد التذاكر المفتوحة والتي تنتظر رد المستخدم فقط.", permission: "read:any", mode: "READ", schema: emptySchema,
    select: (snapshot) => ({ open: snapshot.metrics.openTickets, needsUserReply: snapshot.metrics.ticketsNeedReply })
  },
  getGrowthOpportunities: {
    description: "يعيد فرص النمو المشتقة من مؤشرات الحساب الحالية.", permission: "read:any", mode: "READ", schema: emptySchema,
    select: (snapshot) => ({ opportunities: snapshot.opportunities, recommendations: snapshot.recommendations })
  }
};

export const AI_TOOL_REGISTRY = Object.freeze(definitions);

function jsonSchema(name) {
  return name === "getRenewalAnalytics" || name === "getCampaignPerformance"
    ? { type: "object", properties: { from: { type: "string", format: "date" }, to: { type: "string", format: "date" } }, additionalProperties: false }
    : { type: "object", properties: {}, additionalProperties: false };
}

export function aiToolDefinitions() {
  return Object.entries(AI_TOOL_REGISTRY).map(([name, tool]) => ({
    type: "function",
    function: { name, description: tool.description, parameters: jsonSchema(name) }
  }));
}

export function chooseAccountTools(prompt = "") {
  const text = String(prompt).toLowerCase();
  const selected = new Set(["getAccountHealth"]);
  if (/تجديد|اشتراك|إيراد|دخل|renew|subscription|revenue/.test(text)) selected.add("getRenewalAnalytics");
  if (/قناة|واتساب|بريد|تسليم|رسائل|channel|whatsapp|email|delivery/.test(text)) selected.add("getChannelHealth");
  if (/حملة|حملات|campaign/.test(text)) selected.add("getCampaignPerformance");
  if (/باقة|خطة|استخدام|plan|usage/.test(text)) selected.add("getPlanUsage");
  if (/تذكرة|دعم|رسالة|ticket|support/.test(text)) selected.add("getSupportHistory");
  if (/فرص|نمو|تحسين|عملاء منته|opportun|growth/.test(text)) selected.add("getGrowthOpportunities");
  if (/ملخص|حسابي|صحة|كيف تشوف|overview|health|summary/.test(text)) {
    selected.add("getRenewalAnalytics"); selected.add("getChannelHealth"); selected.add("getGrowthOpportunities");
  }
  return [...selected].slice(0, 5);
}

export function executeAIReadTool(session, snapshot, name, input = {}) {
  const tool = AI_TOOL_REGISTRY[name];
  if (!tool) throw Object.assign(new Error("AI_TOOL_NOT_ALLOWED"), { code: "AI_TOOL_NOT_ALLOWED", status: 400 });
  if (tool.mode !== "READ") throw Object.assign(new Error("AI_ACTION_REQUIRES_CONFIRMATION"), { code: "AI_ACTION_REQUIRES_CONFIRMATION", status: 409 });
  if (!can(session.role, tool.permission)) throw Object.assign(new Error("ليس لديك صلاحية للاطلاع على هذه البيانات."), { code: "AI_TOOL_PERMISSION_DENIED", status: 403 });
  const validated = tool.schema.parse(input || {});
  return { ok: true, name, data: tool.select(snapshot, validated), source: "renvix_account_data" };
}

export function toolsToUIBlocks(executions = []) {
  const byName = new Map(executions.map((item) => [item.name, item.result?.data || item.result]));
  const blocks = [];
  if (byName.has("getAccountHealth")) blocks.push({ type: "account_health", data: byName.get("getAccountHealth") });
  if (byName.has("getRenewalAnalytics")) blocks.push({ type: "renewal_summary", data: byName.get("getRenewalAnalytics") });
  if (byName.has("getChannelHealth")) blocks.push({ type: "channel_status", data: byName.get("getChannelHealth") });
  if (byName.has("getCampaignPerformance")) blocks.push({ type: "campaign_stats", data: byName.get("getCampaignPerformance") });
  if (byName.has("getSupportHistory")) blocks.push({ type: "support_summary", data: byName.get("getSupportHistory") });
  return blocks.slice(0, 3);
}
