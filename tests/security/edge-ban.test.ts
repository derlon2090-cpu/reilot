import { describe, it, expect, vi } from 'vitest';
import { EdgeBan, containHoneypotVisitor } from '../../deploy/cloudflare/admin-honeypot/src/edge-ban.js';

function runtime() {
  const values = new Map();
  const storage = {
    get: vi.fn(async key => values.get(key)),
    put: vi.fn(async (key, value) => { values.set(key, value); }),
    delete: vi.fn(async key => values.delete(key)),
    setAlarm: vi.fn(async () => {}), deleteAlarm: vi.fn(async () => {})
  };
  return { storage, blockConcurrencyWhile: async fn => fn() };
}

describe('honeypot edge containment', () => {
  it('creates explicit IPv6 account block once and persists the returned ID', async () => {
    const api = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ success: true, result: [] }))
      .mockResolvedValueOnce(Response.json({ success: true, result: { id: 'rule1' } }));
    const ctx = runtime();
    const object = new EdgeBan(ctx, { CF_ACCOUNT_ID: 'account1', CF_EDGE_BLOCK_TOKEN: 'secret' });
    const request = () => new Request('https://internal/', { method: 'POST', body: JSON.stringify({ ip: '2001:db8::1' }) });
    expect((await object.fetch(request())).status).toBe(204);
    expect(api).not.toHaveBeenCalled();
    expect((await object.fetch(request())).status).toBe(204);
    expect(api).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(api.mock.calls[1][1].body))).toMatchObject({ mode: 'block', configuration: { target: 'ip6', value: '2001:db8::1' } });
    expect(ctx.storage.setAlarm).toHaveBeenCalled();
  });

  it('does not mark an API failure as banned and schedules recovery', async () => {
    const api = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ success: false }, { status: 429 }))
      .mockResolvedValueOnce(Response.json({ success: true, result: [] }))
      .mockResolvedValueOnce(Response.json({ success: true, result: { id: 'recovered' } }));
    const ctx = runtime();
    const object = new EdgeBan(ctx, { CF_ACCOUNT_ID: 'account1', CF_EDGE_BLOCK_TOKEN: 'secret' });
    const request = () => new Request('https://internal/', { method: 'POST', body: JSON.stringify({ ip: '192.0.2.1' }) });
    await object.fetch(request());
    await expect(object.fetch(request())).rejects.toThrow();
    expect(await ctx.storage.get('ruleId')).toBeUndefined();
    expect(ctx.storage.setAlarm).toHaveBeenCalled();
    await object.alarm();
    expect(await ctx.storage.get('ruleId')).toBe('recovered');
    expect(api).toHaveBeenCalledTimes(3);
  });

  it('expires only the owned account rule and retries failed deletion', async () => {
    const api = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ success: true, result: [] }))
      .mockResolvedValueOnce(Response.json({ success: true, result: { id: 'rule2' } }))
      .mockResolvedValueOnce(Response.json({ success: true, result: { id: 'rule2', notes: 'renvix-honeypot:192.0.2.5', configuration: { value: '192.0.2.5' }, mode: 'block' } }))
      .mockResolvedValueOnce(Response.json({ success: true, result: { id: 'rule2' } }));
    const ctx = runtime();
    const object = new EdgeBan(ctx, { CF_ACCOUNT_ID: 'account1', CF_EDGE_BLOCK_TOKEN: 'secret' });
    const request = () => new Request('https://internal/', { method: 'POST', body: JSON.stringify({ ip: '192.0.2.5' }) });
    await object.fetch(request());
    await object.fetch(request());
    await ctx.storage.put('expiresAt', Date.now() - 1);
    await object.alarm();
    expect(api.mock.calls[3][1]?.method).toBe('DELETE');
    expect(await ctx.storage.get('ruleId')).toBeUndefined();
  });

  it('exempts trusted test sources and refuses untrusted body IPs', async () => {
    const env = { EDGE_AUTO_BLOCK: 'true', CF_ACCOUNT_ID: 'a', CF_EDGE_BLOCK_TOKEN: 's', EDGE_BANS: {}, TRUSTED_TEST_IPS: '192.0.2.1' };
    await expect(containHoneypotVisitor(new Request('https://honeypot/', { headers: { 'CF-Connecting-IP': '192.0.2.1' } }), env)).resolves.toBeUndefined();
    await expect(containHoneypotVisitor(new Request('https://honeypot/', { method: 'POST', body: '{"ip":"192.0.2.2"}' }), env)).rejects.toThrow('Missing trusted visitor IP');
  });
});
