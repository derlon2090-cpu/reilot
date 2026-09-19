// Service-internal DO: never exposed as an HTTP log-ingestion endpoint.
const BAN_MS = 7 * 24 * 60 * 60 * 1000;
const WINDOW_MS = 60 * 1000;
export class EdgeBan {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async alarm() {
    const ip = await this.ctx.storage.get('pendingIp');
    const ruleId = await this.ctx.storage.get('ruleId');
    if (ruleId) {
      let expiry = Number(await this.ctx.storage.get('expiresAt'));
      if (!expiry) {
        expiry = Date.now() + BAN_MS;
        await this.ctx.storage.put('expiresAt', expiry);
      }
      if (expiry > Date.now()) {
        await this.ctx.storage.setAlarm(expiry);
        return;
      }
      const base = `https://api.cloudflare.com/client/v4/accounts/${this.env.CF_ACCOUNT_ID}/firewall/access_rules/rules`;
      const headers = { Authorization: `Bearer ${this.env.CF_EDGE_BLOCK_TOKEN}` };
      try {
        const check = await fetch(`${base}/${ruleId}`, { headers, signal: AbortSignal.timeout(10000) });
        if (check.status !== 404) {
          const existing = await check.json();
          if (!check.ok || !existing.success) throw new Error(`Edge expiry lookup failed: ${check.status}`);
          // Delete only our own exact IP rule, never an operator-edited rule.
          if (existing.result?.notes === `renvix-honeypot:${ip}`
            && existing.result?.configuration?.value === ip && existing.result?.mode === 'block') {
            const removed = await fetch(`${base}/${ruleId}`, { method: 'DELETE', headers, signal: AbortSignal.timeout(10000) });
            if (!removed.ok || !(await removed.json()).success) throw new Error(`Edge expiry failed: ${removed.status}`);
          }
        }
        await this.ctx.storage.delete('ruleId');
        await this.ctx.storage.delete('expiresAt');
        await this.ctx.storage.delete('pendingIp');
        await this.ctx.storage.delete('hits');
        console.log(JSON.stringify({ event: 'edge_ip_unbanned', source_ip: ip, rule_id: ruleId }));
      } catch {
        await this.ctx.storage.setAlarm(Date.now() + 60000);
        console.error(JSON.stringify({ event: 'edge_unban_retry', source_ip: ip, rule_id: ruleId }));
      }
      return;
    }
    const retries = (await this.ctx.storage.get('retries')) || 0;
    if (!ip) return;
    if (retries >= 5) {
      console.error(JSON.stringify({ event: 'edge_ban_retry_exhausted', source_ip: ip }));
      await this.ctx.storage.put('retries', 0);
      await this.ctx.storage.setAlarm(Date.now() + 5 * 60 * 1000);
      return;
    }
    await this.ctx.storage.put('retries', retries + 1);
    try {
      await this.fetch(new Request('https://edge-ban.internal/', { method: 'POST', body: JSON.stringify({ ip }) }));
    } catch {
      console.error(JSON.stringify({ event: 'edge_ban_retry_failed', source_ip: ip, attempt: retries + 1 }));
    }
  }

  async fetch(request) {
    return this.ctx.blockConcurrencyWhile(async () => {
      const { ip } = await request.json();
      if (typeof ip !== 'string' || !/^[0-9a-fA-F:.]{3,45}$/.test(ip)) return new Response(null, { status: 400 });
      if (await this.ctx.storage.get('ruleId')) return new Response(null, { status: 204 });
      if (await this.ctx.storage.get('pendingIp') !== ip) {
        const now = Date.now();
        const windowStart = Number(await this.ctx.storage.get('windowStart'));
        const hits = now - windowStart < WINDOW_MS ? Number(await this.ctx.storage.get('hits')) + 1 : 1;
        await this.ctx.storage.put('windowStart', hits === 1 ? now : windowStart);
        await this.ctx.storage.put('hits', hits);
        if (hits < 2) return new Response(null, { status: 204 });
      }
      await this.ctx.storage.put('pendingIp', ip);
      await this.ctx.storage.setAlarm(Date.now() + 60000);
      const base = `https://api.cloudflare.com/client/v4/accounts/${this.env.CF_ACCOUNT_ID}/firewall/access_rules/rules`;
      const headers = { Authorization: `Bearer ${this.env.CF_EDGE_BLOCK_TOKEN}`, 'Content-Type': 'application/json' };
      const notes = `renvix-honeypot:${ip}`;
      const target = ip.includes(':') ? 'ip6' : 'ip';
      // Reconcile an API success followed by a storage failure; avoid duplicate rules.
      const lookup = await fetch(`${base}?configuration.target=${target}&configuration.value=${encodeURIComponent(ip)}&mode=block&per_page=50`,
        { headers, signal: AbortSignal.timeout(10000) });
      const found = await lookup.json();
      if (!lookup.ok || !found.success) throw new Error(`Edge lookup failed: ${lookup.status}`);
      let rule = found.result.find(item => item.notes === notes && item.configuration.value === ip && item.mode === 'block');
      if (!rule) {
        const response = await fetch(base, { method: 'POST', headers,
          body: JSON.stringify({ mode: 'block', configuration: { target, value: ip }, notes }),
          signal: AbortSignal.timeout(10000) });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(`Edge block failed: ${response.status}`);
        rule = result.result;
      }
      await this.ctx.storage.put('ruleId', rule.id);
      const expiresAt = Date.now() + BAN_MS;
      await this.ctx.storage.put('expiresAt', expiresAt);
      await this.ctx.storage.setAlarm(expiresAt);
      console.log(JSON.stringify({ timestamp: new Date().toISOString(), event: 'edge_ip_banned',
        source_ip: ip, rule_id: rule.id, scope: 'account', reason: 'honeypot_two_hits', expires_at: new Date(expiresAt).toISOString() }));
      return new Response(null, { status: 204 });
    });
  }
}

export async function containHoneypotVisitor(request, env) {
  if (env.EDGE_AUTO_BLOCK !== 'true') return;
  if (!env.EDGE_BANS || !env.CF_ACCOUNT_ID || !env.CF_EDGE_BLOCK_TOKEN) throw new Error('Missing edge containment binding/secret');
  // CF creates this header on the visitor request. Ignore telemetry body IP fields.
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip || !/^[0-9a-fA-F:.]{3,45}$/.test(ip)) throw new Error('Missing trusted visitor IP');
  const trusted = (env.TRUSTED_TEST_IPS || '').split(',').map(value => value.trim());
  if (trusted.includes(ip)) return;
  const stub = env.EDGE_BANS.get(env.EDGE_BANS.idFromName(ip));
  const response = await stub.fetch('https://edge-ban.internal/', { method: 'POST', body: JSON.stringify({ ip }) });
  if (!response.ok) throw new Error(`Containment failed: ${response.status}`);
}
