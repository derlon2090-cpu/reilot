import { describe, it, expect, vi } from 'vitest';
import { EdgeBan, checkHoneypotVisitor, containHoneypotVisitor } from '../../deploy/cloudflare/admin-honeypot/src/edge-ban.js';

function runtime(env = {}) {
  const values = new Map();
  const storage = {
    get: vi.fn(async key => values.get(key)),
    put: vi.fn(async (key, value) => { values.set(key, value); }),
    delete: vi.fn(async key => values.delete(key)),
    setAlarm: vi.fn(async () => {}), deleteAlarm: vi.fn(async () => {})
  };
  const ctx = { storage, blockConcurrencyWhile: async fn => fn() };
  const object = new EdgeBan(ctx, env);
  const binding = {
    idFromName: vi.fn(value => value),
    get: vi.fn(() => ({ fetch: (url, init) => object.fetch(new Request(url, init)) }))
  };
  return { storage, object, binding, env: { ...env, EDGE_BANS: binding } };
}

const blockRequest = (ip, reason = 'honeypot_entry') => new Request('https://edge-ban.internal/block', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ip, reason })
});

describe('honeypot local and Cloudflare edge containment', () => {
  it('persists a seven-day local IP block immediately without any Cloudflare token', async () => {
    const { object, storage } = runtime();
    const api = vi.spyOn(globalThis, 'fetch');
    api.mockClear();
    const response = await object.fetch(blockRequest('192.0.2.90'));
    expect(response.status).toBe(204);
    expect(Number(await storage.get('blockedUntil'))).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);
    expect(await storage.get('reason')).toBe('honeypot_entry');

    const check = await object.fetch(new Request('https://edge-ban.internal/check'));
    expect(await check.json()).toMatchObject({ blocked: true });
    expect(api).not.toHaveBeenCalled();
    api.mockRestore();
  });

  it('returns the same durable block reference for later requests from that IP', async () => {
    const { env, object } = runtime();
    await object.fetch(blockRequest('192.0.2.91'));
    const request = new Request('https://admin.renvix.app/', { headers: { 'CF-Connecting-IP': '192.0.2.91' } });
    const first = await checkHoneypotVisitor(request, env);
    const second = await checkHoneypotVisitor(request, env);
    expect(first).toMatchObject({ blocked: true });
    expect(second?.referenceId).toBe(first?.referenceId);
  });

  it('schedules an account-wide block as a secondary layer after local persistence', async () => {
    const env = { EDGE_AUTO_BLOCK: 'true', CF_ACCOUNT_ID: 'a'.repeat(32), CF_EDGE_BLOCK_TOKEN: 'secret-token-value-long-enough' };
    const { object, storage } = runtime(env);
    const api = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ success: true, result: [] }))
      .mockResolvedValueOnce(Response.json({ success: true, result: { id: 'edge-rule' } }));
    try {
      await object.fetch(blockRequest('192.0.2.92', 'trap_stage_1'));
      expect(api).not.toHaveBeenCalled();
      expect(await storage.get('blockedUntil')).toBeGreaterThan(Date.now());

      await object.alarm();
      expect(api).toHaveBeenCalledTimes(2);
      expect(JSON.parse(String(api.mock.calls[1][1]?.body))).toMatchObject({
        mode: 'block', configuration: { target: 'ip', value: '192.0.2.92' }, notes: 'renvix-honeypot:192.0.2.92'
      });
      expect(await storage.get('ruleId')).toBe('edge-rule');
    } finally {
      api.mockRestore();
    }
  });

  it('keeps the local ban active and retries when the optional account API fails', async () => {
    const env = { EDGE_AUTO_BLOCK: 'true', CF_ACCOUNT_ID: 'a'.repeat(32), CF_EDGE_BLOCK_TOKEN: 'secret-token-value-long-enough' };
    const { object, storage } = runtime(env);
    const api = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Cloudflare unavailable'));
    try {
      await object.fetch(blockRequest('192.0.2.93'));
      await object.alarm();
      expect(Number(await storage.get('blockedUntil'))).toBeGreaterThan(Date.now());
      expect(await storage.get('retries')).toBe(1);
      expect(storage.setAlarm).toHaveBeenCalled();
    } finally {
      api.mockRestore();
    }
  });

  it('removes only its own expired account rule and clears the local block', async () => {
    const env = { EDGE_AUTO_BLOCK: 'true', CF_ACCOUNT_ID: 'a'.repeat(32), CF_EDGE_BLOCK_TOKEN: 'secret-token-value-long-enough' };
    const { object, storage } = runtime(env);
    await storage.put('pendingIp', '192.0.2.94');
    await storage.put('ruleId', 'rule-owned');
    await storage.put('blockedUntil', Date.now() - 1);
    const api = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ success: true, result: { id: 'rule-owned', notes: 'renvix-honeypot:192.0.2.94', configuration: { value: '192.0.2.94' }, mode: 'block' } }))
      .mockResolvedValueOnce(Response.json({ success: true, result: { id: 'rule-owned' } }));
    try {
      await object.alarm();
      expect(api.mock.calls[1][1]?.method).toBe('DELETE');
      expect(await storage.get('blockedUntil')).toBeUndefined();
      expect(await storage.get('ruleId')).toBeUndefined();
    } finally {
      api.mockRestore();
    }
  });

  it('keeps test IPs blocked on the honeypot but exempts them from account-wide rules', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const envConfig = {
      EDGE_AUTO_BLOCK: 'true', CF_ACCOUNT_ID: 'a'.repeat(32),
      CF_EDGE_BLOCK_TOKEN: 'secret-token-value-long-enough', TRUSTED_TEST_IPS: '192.0.2.1'
    };
    const { env, object, storage } = runtime(envConfig);
    const api = vi.spyOn(globalThis, 'fetch');
    try {
      await expect(containHoneypotVisitor(new Request('https://honeypot/', {
        headers: { 'CF-Connecting-IP': '192.0.2.1' }
      }), env)).resolves.toBe(true);
      expect(Number(await storage.get('blockedUntil'))).toBeGreaterThan(Date.now());
      await object.alarm();
      expect(api).not.toHaveBeenCalled();
      expect(await checkHoneypotVisitor(new Request('https://admin.renvix.app/', {
        headers: { 'CF-Connecting-IP': '192.0.2.1' }
      }), env)).toMatchObject({ blocked: true });
    } finally {
      api.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it('ignores untrusted body-supplied IPs and rejects invalid direct Durable Object input', async () => {
    const { object } = runtime();
    await expect(object.fetch(new Request('https://edge-ban.internal/block', {
      method: 'POST', body: JSON.stringify({ ip: 'not-an-ip' })
    }))).resolves.toMatchObject({ status: 400 });
    await expect(containHoneypotVisitor(new Request('https://honeypot/', {
      method: 'POST', body: JSON.stringify({ ip: '192.0.2.2' })
    }), runtime().env)).rejects.toThrow('Missing trusted visitor IP');
  });
});
