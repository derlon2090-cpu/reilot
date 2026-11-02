const BAN_MS = 7 * 24 * 60 * 60 * 1000;
const INTERNAL_ORIGIN = "https://edge-ban.internal";
let edgeAutoBlockConfigurationWarningLogged = false;

function warnAutoBlockUnavailable() {
  if (edgeAutoBlockConfigurationWarningLogged) return;
  edgeAutoBlockConfigurationWarningLogged = true;
  console.error(JSON.stringify({ event: "edge_auto_block_unconfigured" }));
}

function isIpAddress(value) {
  const ip = String(value || "").trim();
  const octets = ip.split(".");
  if (octets.length === 4 && octets.every(octet => /^\d{1,3}$/.test(octet) && Number(octet) <= 255)) return true;
  if (!ip.includes(":") || !/^[0-9a-f:.]+$/i.test(ip)) return false;
  try { return new URL(`http://[${ip}]/`).hostname.length > 2; } catch { return false; }
}

function trustedIp(env, ip) {
  return (env.TRUSTED_TEST_IPS || "").split(",").map(value => value.trim()).filter(Boolean).includes(ip);
}

function accountRulesEnabled(env) {
  return env.EDGE_AUTO_BLOCK === "true"
    && /^[a-f0-9]{32}$/i.test(String(env.CF_ACCOUNT_ID || ""))
    && String(env.CF_EDGE_BLOCK_TOKEN || "").length >= 20;
}

function safeReason(value) {
  return /^(?:trap_stage_[0-3]|signed_deep_canary|honeypot_entry)$/.test(String(value || ""))
    ? String(value) : "honeypot_entry";
}

function accountRulesUrl(env) {
  return `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/firewall/access_rules/rules`;
}

function authHeaders(env) {
  return { Authorization: `Bearer ${env.CF_EDGE_BLOCK_TOKEN}`, "Content-Type": "application/json" };
}

async function cloudflareJson(url, init) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(10000) });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(`Cloudflare edge rule request failed: ${response.status}`);
  return result;
}

async function ensureAccountRule(env, ip) {
  const base = accountRulesUrl(env);
  const target = ip.includes(":") ? "ip6" : "ip";
  const notes = `renvix-honeypot:${ip}`;
  const query = new URLSearchParams({ "configuration.target": target, "configuration.value": ip, mode: "block", per_page: "50" });
  const found = await cloudflareJson(`${base}?${query}`, { headers: authHeaders(env) });
  let rule = found.result.find(item => item.notes === notes && item.configuration?.value === ip && item.mode === "block");
  if (!rule) {
    const created = await cloudflareJson(base, {
      method: "POST", headers: authHeaders(env),
      body: JSON.stringify({ mode: "block", configuration: { target, value: ip }, notes })
    });
    rule = created.result;
  }
  if (!rule?.id) throw new Error("Cloudflare did not return an owned edge rule ID");
  return rule;
}

async function removeOwnedAccountRule(env, ip, ruleId) {
  const base = accountRulesUrl(env);
  const headers = authHeaders(env);
  const check = await fetch(`${base}/${encodeURIComponent(ruleId)}`, { headers, signal: AbortSignal.timeout(10000) });
  if (check.status === 404) return;
  const existing = await check.json();
  if (!check.ok || !existing.success) throw new Error(`Cloudflare edge expiry lookup failed: ${check.status}`);
  if (existing.result?.notes !== `renvix-honeypot:${ip}`
      || existing.result?.configuration?.value !== ip || existing.result?.mode !== "block") return;
  await cloudflareJson(`${base}/${encodeURIComponent(ruleId)}`, { method: "DELETE", headers });
}

async function clearExpiredState(storage) {
  for (const key of ["blockedUntil", "referenceId", "pendingIp", "ruleId", "expiresAt", "hits", "reason", "retries"]) {
    await storage.delete(key);
  }
}

// The Durable Object is the immediate, persistent block boundary. Cloudflare
// account rules are an optional second layer and are reconciled by its alarm.
export class EdgeBan {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/check") {
      const until = Number(await this.ctx.storage.get("blockedUntil")) || 0;
      const referenceId = String(await this.ctx.storage.get("referenceId") || "SEC-UNKNOWN");
      return Response.json({ blocked: until > Date.now(), referenceId, expiresAt: until || null }, {
        headers: { "cache-control": "no-store" }
      });
    }
    if (request.method !== "POST") return new Response(null, { status: 405 });

    let payload;
    try { payload = await request.json(); } catch { return new Response(null, { status: 400 }); }
    const ip = payload?.ip;
    if (typeof ip !== "string" || !isIpAddress(ip)) return new Response(null, { status: 400 });
    const reason = safeReason(payload?.reason);
    const now = Date.now();

    return this.ctx.blockConcurrencyWhile(async () => {
      const existingUntil = Number(await this.ctx.storage.get("blockedUntil")) || 0;
      if (existingUntil <= now) {
        const referenceId = `HP-${crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
        await this.ctx.storage.put("blockedUntil", now + BAN_MS);
        await this.ctx.storage.put("referenceId", referenceId);
        await this.ctx.storage.put("pendingIp", ip);
        await this.ctx.storage.put("reason", reason);
        await this.ctx.storage.put("retries", 0);
      }
      const alarmAt = accountRulesEnabled(this.env) && !trustedIp(this.env, ip) ? now + 1000 : now + BAN_MS;
      await this.ctx.storage.setAlarm(alarmAt);
      return new Response(null, { status: 204 });
    });
  }

  async alarm() {
    const ip = await this.ctx.storage.get("pendingIp");
    const until = Number(await this.ctx.storage.get("blockedUntil")) || 0;
    const ruleId = await this.ctx.storage.get("ruleId");
    if (!until || until <= Date.now()) {
      if (ruleId && ip && accountRulesEnabled(this.env)) {
        try { await removeOwnedAccountRule(this.env, ip, ruleId); }
        catch {
          await this.ctx.storage.setAlarm(Date.now() + 60000);
          console.error(JSON.stringify({ event: "edge_unban_retry", source_ip: ip, rule_id: ruleId }));
          return;
        }
      }
      await clearExpiredState(this.ctx.storage);
      return;
    }
    if (ruleId) {
      await this.ctx.storage.setAlarm(until);
      return;
    }
    if (!ip) return;
    if (!accountRulesEnabled(this.env) || trustedIp(this.env, ip)) {
      if (!trustedIp(this.env, ip)) warnAutoBlockUnavailable();
      await this.ctx.storage.setAlarm(until);
      return;
    }

    try {
      const rule = await ensureAccountRule(this.env, ip);
      await this.ctx.storage.put("ruleId", rule.id);
      await this.ctx.storage.put("expiresAt", until);
      await this.ctx.storage.setAlarm(until);
      console.log(JSON.stringify({ event: "edge_ip_banned", source_ip: ip, rule_id: rule.id,
        scope: "account", reason: await this.ctx.storage.get("reason"), expires_at: new Date(until).toISOString() }));
    } catch (error) {
      const retries = (Number(await this.ctx.storage.get("retries")) || 0) + 1;
      await this.ctx.storage.put("retries", retries);
      await this.ctx.storage.setAlarm(Math.min(until, Date.now() + Math.min(retries, 5) * 60000));
      console.error(JSON.stringify({ event: "edge_account_rule_retry", source_ip: ip, attempt: retries,
        message: String(error?.message || "unknown").slice(0, 160) }));
    }
  }
}

export async function checkHoneypotVisitor(request, env) {
  const ip = request.headers.get("CF-Connecting-IP");
  if (!isIpAddress(ip) || typeof env.EDGE_BANS?.get !== "function") return null;
  try {
    const stub = env.EDGE_BANS.get(env.EDGE_BANS.idFromName(ip));
    const result = await stub.fetch(`${INTERNAL_ORIGIN}/check`, { method: "GET" });
    if (!result.ok) return null;
    const state = await result.json();
    return state?.blocked ? { blocked: true, referenceId: String(state.referenceId || "SEC-UNKNOWN").slice(0, 40) } : null;
  } catch {
    return null;
  }
}

export function isTrustedHoneypotVisitor(request, env) {
  const ip = request.headers.get("CF-Connecting-IP");
  return isIpAddress(ip) && trustedIp(env, ip);
}

export async function containHoneypotVisitor(request, env, { reason = "honeypot_entry" } = {}) {
  const ip = request.headers.get("CF-Connecting-IP");
  if (!isIpAddress(ip)) throw new Error("Missing trusted visitor IP");
  if (typeof env.EDGE_BANS?.get !== "function") {
    warnAutoBlockUnavailable();
    return false;
  }
  const stub = env.EDGE_BANS.get(env.EDGE_BANS.idFromName(ip));
  const response = await stub.fetch(`${INTERNAL_ORIGIN}/block`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ip, reason })
  });
  if (!response.ok) throw new Error(`Local containment failed: ${response.status}`);
  return true;
}
