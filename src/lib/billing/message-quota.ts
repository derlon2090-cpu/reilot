export type MessageChannel = "whatsapp" | "email" | "sms";

export type ReserveMessageQuotaInput = {
  tenantId: string;
  channelType: MessageChannel;
  quantity?: number;
  isBillable: boolean;
};

export {
  MessageQuotaError,
  PLAN_MESSAGE_LIMIT_REACHED,
  assertMessageQuotaAvailable,
  calculateMessageUsage,
  consumeReservedQuota,
  getCurrentMessageUsage,
  getRemainingMessages,
  releaseReservedQuota,
  reserveMessageQuota
} from "./message-quota.js";
