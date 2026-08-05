import { Resend } from "resend";

const CONSUMER_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com"
]);

export const RENVIX_FROM_EMAIL = "Renvix <noreply@renvix.app>";
export const RENVIX_REPLY_TO_EMAIL = "support@renvix.app";
const RENVIX_EMAIL_ROOT_DOMAIN = "renvix.app";
const DOMAIN_CACHE_TTL_MS = 5 * 60 * 1000;

let domainCache = null;

export function extractAddress(value) {
  const match = String(value || "").match(/<([^>]+)>/);
  return (match?.[1] || value || "").trim().toLowerCase();
}

export function isAllowedRenvixSender(value) {
  const domain = extractAddress(value).split("@")[1] || "";
  return domain === RENVIX_EMAIL_ROOT_DOMAIN || domain.endsWith(`.${RENVIX_EMAIL_ROOT_DOMAIN}`);
}

function configuredFromAddress() {
  const configured = String(process.env.RESEND_FROM_EMAIL || "").trim();
  if (!configured) return RENVIX_FROM_EMAIL;
  if (!isAllowedRenvixSender(configured)) {
    const error = new Error("RESEND_FROM_EMAIL must use renvix.app or a Renvix subdomain");
    error.code = "EMAIL_CONFIGURATION_ERROR";
    throw error;
  }
  // `notify.renvix.app` was used by the old example before that subdomain
  // existed in DNS. Keep deployments carrying the legacy value operational
  // by moving only that exact identity to the configured root-domain sender.
  if (extractAddress(configured).endsWith("@notify.renvix.app")) return RENVIX_FROM_EMAIL;
  return configured;
}

export function getEmailConfig() {
  const provider = (process.env.EMAIL_PROVIDER || "resend").trim().toLowerCase();
  const apiKey = process.env.RESEND_API_KEY?.trim();
  // This is a deployment-only value and is restricted to the Renvix domain.
  // Request data can never control the sender identity.
  const from = configuredFromAddress();
  const supportEmail = String(process.env.SUPPORT_EMAIL || RENVIX_REPLY_TO_EMAIL).trim();

  if (provider !== "resend") throw new Error("EMAIL_PROVIDER must be resend");
  if (!apiKey) throw new Error("RESEND_API_KEY is missing");
  const senderAddress = extractAddress(from);
  const senderDomain = senderAddress.split("@")[1];
  if (!senderDomain || CONSUMER_EMAIL_DOMAINS.has(senderDomain)) {
    throw new Error("RESEND_FROM_EMAIL must use a verified sending domain");
  }

  return { apiKey, from, supportEmail };
}

export function createResendClient() {
  return new Resend(getEmailConfig().apiKey);
}

function senderDomain(from) {
  return extractAddress(from).split("@")[1] || "";
}

function verifiedSendingDomain(domain) {
  return domain?.status === "verified" && domain?.capabilities?.sending !== "disabled";
}

async function listDomains({ force = false } = {}) {
  if (!force && domainCache?.expiresAt > Date.now()) return domainCache.value;
  const resend = createResendClient();
  const result = await resend.domains.list({ limit: 100 });
  if (result?.error) {
    const error = new Error(result.error.message || "Unable to inspect Resend domains");
    error.code = "EMAIL_PROVIDER_ERROR";
    error.providerCode = result.error.name || result.error.statusCode || null;
    throw error;
  }
  const domains = Array.isArray(result?.data?.data) ? result.data.data : [];
  domainCache = { value: domains, expiresAt: Date.now() + DOMAIN_CACHE_TTL_MS };
  return domains;
}

function formatSender(from, domain) {
  const address = extractAddress(from);
  const localPart = address.split("@")[0] || "noreply";
  const display = String(from).includes("<") ? String(from).split("<")[0].trim() : "Renvix";
  return `${display || "Renvix"} <${localPart}@${domain}>`;
}

export async function resolveVerifiedEmailConfig() {
  const config = getEmailConfig();
  let domains;
  try {
    domains = await listDomains();
  } catch (error) {
    // A send-only Resend key may not be allowed to list domains. In that case
    // retain the explicitly configured, server-side whitelisted identity.
    if (error?.providerCode === "restricted_api_key" || /permission|restricted/i.test(error?.message || "")) {
      return config;
    }
    throw error;
  }

  const configuredDomain = senderDomain(config.from);
  const exact = domains.find((item) => String(item?.name || "").toLowerCase() === configuredDomain);
  if (verifiedSendingDomain(exact)) return config;

  const fallback = domains.find((item) => {
    const name = String(item?.name || "").toLowerCase();
    return isAllowedRenvixSender(`noreply@${name}`) && verifiedSendingDomain(item);
  });
  if (fallback) return { ...config, from: formatSender(config.from, String(fallback.name).toLowerCase()) };

  const error = new Error("No verified Renvix sending domain is available in Resend");
  error.code = "EMAIL_DELIVERY_UNAVAILABLE";
  error.senderDomain = configuredDomain;
  throw error;
}

export async function resendProviderHealth({ force = false } = {}) {
  const config = getEmailConfig();
  const configuredDomain = senderDomain(config.from);
  try {
    const domains = await listDomains({ force });
    const renvixDomains = domains.filter((item) => isAllowedRenvixSender(`noreply@${String(item?.name || "").toLowerCase()}`));
    const exact = renvixDomains.find((item) => String(item?.name || "").toLowerCase() === configuredDomain);
    const verified = renvixDomains.filter(verifiedSendingDomain);
    return {
      ok: verified.length > 0,
      providerReachable: true,
      senderDomain: configuredDomain,
      senderDomainStatus: exact?.status || "not_registered",
      verifiedRenvixDomainAvailable: verified.length > 0
    };
  } catch (error) {
    if (error?.providerCode === "restricted_api_key" || /permission|restricted/i.test(error?.message || "")) {
      return {
        ok: false,
        providerReachable: true,
        senderDomain: configuredDomain,
        senderDomainStatus: "inspection_restricted",
        verifiedRenvixDomainAvailable: null,
        deliveryProbeRequired: true
      };
    }
    return {
      ok: false,
      providerReachable: false,
      senderDomain: configuredDomain,
      errorCode: String(error?.providerCode || error?.code || "EMAIL_PROVIDER_ERROR")
    };
  }
}
