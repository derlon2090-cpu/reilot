export type MessageChannel = "whatsapp" | "email" | "sms";

export type ReserveMessageQuotaInput = {
  tenantId: string;
  channelType: MessageChannel;
  quantity?: number;
  isBillable?: boolean;
};

export type MessageQuotaMutationInput = {
  tenantId?: string;
  channelType?: MessageChannel;
  quantity?: number;
  queueId?: string | null;
  periodId?: string | null;
};

export type MessageChannelUsage = {
  channel: MessageChannel;
  limit: number;
  used: number;
  reserved: number;
  consumed: number;
  remaining: number;
  percentage: number | null;
  unlimited: boolean;
  isNearLimit: boolean;
  isLimitReached: boolean;
};

export type MessageUsage = {
  periodId: unknown;
  platformSubscriptionId: unknown;
  planId: unknown;
  planName: unknown;
  planSlug: unknown;
  periodStart: unknown;
  periodEnd: unknown;
  limit: number;
  used: number;
  reserved: number;
  consumed: number;
  remaining: number;
  percentage: number | null;
  unlimited: boolean;
  isNearLimit: boolean;
  isLimitReached: boolean;
  totalUsed: number;
  totalReserved: number;
  channels: Record<MessageChannel, MessageChannelUsage>;
  byChannel: Record<MessageChannel, number>;
};

export declare const PLAN_MESSAGE_LIMIT_REACHED = "PLAN_MESSAGE_LIMIT_REACHED";

export declare class MessageQuotaError extends Error {
  code: typeof PLAN_MESSAGE_LIMIT_REACHED;
  status: number;
  usage: MessageUsage;
  constructor(usage: MessageUsage);
}

export declare function calculateMessageUsage(row: Record<string, unknown>): MessageUsage;
export declare function getOrCreateUsagePeriodWithClient(client: unknown, tenantId: string): Promise<Record<string, unknown>>;
export declare function getCurrentMessageUsageWithClient(client: unknown, tenantId: string): Promise<MessageUsage>;
export declare function getCurrentMessageUsage(tenantId: string): Promise<MessageUsage>;
export declare function reserveMessageQuotaWithClient(client: unknown, input: ReserveMessageQuotaInput): Promise<unknown>;
export declare function reserveMessageQuota(input: ReserveMessageQuotaInput): Promise<unknown>;
export declare function consumeReservedQuotaWithClient(client: unknown, input: MessageQuotaMutationInput): Promise<unknown>;
export declare function consumeReservedQuota(input: MessageQuotaMutationInput): Promise<unknown>;
export declare function releaseReservedQuotaWithClient(client: unknown, input: MessageQuotaMutationInput): Promise<unknown>;
export declare function releaseReservedQuota(input: MessageQuotaMutationInput): Promise<unknown>;
export declare function assertMessageQuotaAvailable(input: ReserveMessageQuotaInput): Promise<MessageUsage>;
export declare function getRemainingMessages(tenantId: string, channelType?: MessageChannel): Promise<number>;
