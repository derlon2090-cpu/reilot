import { describe, it, expect, vi } from 'vitest';
import { PassThrough } from 'node:stream';
import { EventEmitter } from 'node:events';
import { mutationOriginAllowed, mutationOriginResponse } from '../../src/shared/request-origin.js';
import { isPublicWebhookIp, pinnedWebhookRequest } from '../../src/server/webhook-network.js';

describe('mutation origin protection', () => {
  const url = 'https://api.renvix.app/api/settings';
  const request = headers => new Request(url, { method: 'POST', headers });
  it('rejects cross-site form submissions even without Origin', () => {
    expect(mutationOriginAllowed(request({ 'sec-fetch-site': 'cross-site' }), {})).toBe(false);
    expect(mutationOriginResponse(request({ origin: 'https://attacker.example' }), {}).status).toBe(403);
  });
  it('does not trust a forwarded hostname or metadata to override a foreign Origin', () => {
    expect(mutationOriginAllowed(request({ origin: 'https://attacker.example', 'x-forwarded-host': 'attacker.example', 'sec-fetch-site': 'same-origin' }), {})).toBe(false);
  });
  it('preserves configured split hosts, origin-less server clients and safe reads', () => {
    expect(mutationOriginAllowed(request({ origin: 'https://dash.renvix.app' }), { APP_URL: 'https://dash.renvix.app' })).toBe(true);
    expect(mutationOriginAllowed(request({}), {})).toBe(true);
    expect(mutationOriginAllowed(new Request(url), {})).toBe(true);
    expect(mutationOriginAllowed(request({ origin: 'null', 'sec-fetch-site': 'same-origin' }), {})).toBe(true);
    expect(mutationOriginAllowed(request({ origin: 'null', 'sec-fetch-site': 'cross-site' }), {})).toBe(false);
  });
});

describe('webhook SSRF protection', () => {
  it('rejects private and mapped/tunnel/reserved address variants', () => {
    for (const ip of ['127.0.0.1', '169.254.169.254', '10.0.0.1', '100.64.0.1', '224.0.0.1', '240.0.0.1',
      '::ffff:127.0.0.1', '::ffff:7f00:1', '::1', 'fd00::1', 'fe80::1', '64:ff9b::7f00:1', '2002:7f00:1::', '2001:db8::1']) {
      expect(isPublicWebhookIp(ip), ip).toBe(false);
    }
    expect(isPublicWebhookIp('8.8.8.8')).toBe(true);
    expect(isPublicWebhookIp('2606:4700:4700::1111')).toBe(true);
  });
  it('pins the socket lookup to the checked address and preserves TLS hostname', async () => {
    let options;
    let target;
    const requester = vi.fn((url, config, callback) => {
      options = config; target = url;
      const socket = Object.assign(new EventEmitter(), { end: () => {
        const response = Object.assign(new PassThrough(), { statusCode: 204 });
        callback(response); response.end();
      } });
      return socket;
    });
    const response = await pinnedWebhookRequest('https://hook.example/events', { addresses: ['8.8.8.8'], headers: {}, body: '{}' }, { requester });
    expect(response.status).toBe(204);
    expect(target.hostname).toBe('hook.example');
    expect(options.agent).toBe(false);
    const result = vi.fn();
    options.lookup('hook.example', { all: true }, result);
    expect(result).toHaveBeenCalledWith(null, [{ address: '8.8.8.8', family: 4 }]);
  });
  it('refuses mixed public/private destinations before opening any socket', () => {
    const requester = vi.fn();
    expect(() => pinnedWebhookRequest('https://hook.example', { addresses: ['8.8.8.8', '127.0.0.1'] }, { requester })).toThrow();
    expect(requester).not.toHaveBeenCalled();
  });
});
