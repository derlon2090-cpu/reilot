import { describe, expect, it, vi } from 'vitest';
import { PassThrough } from 'node:stream';
import { EventEmitter } from 'node:events';
import { isPublicWebhookIp, pinnedWebhookRequest } from '../../src/server/webhook-network.js';

describe('webhook destination isolation', () => {
  it('rejects private, mapped, reserved and tunnel addresses', () => {
    for (const ip of ['127.0.0.1', '169.254.169.254', '10.0.0.1', '100.64.0.1',
      '224.0.0.1', '240.0.0.1', '::ffff:127.0.0.1', '::1', 'fd00::1',
      'fe80::1', '64:ff9b::7f00:1', '2002:7f00:1::', '2001:db8::1']) {
      expect(isPublicWebhookIp(ip), ip).toBe(false);
    }
    expect(isPublicWebhookIp('8.8.8.8')).toBe(true);
    expect(isPublicWebhookIp('2606:4700:4700::1111')).toBe(true);
  });

  it('pins the socket to the validated IP while retaining the TLS hostname', async () => {
    let options;
    let target;
    const requester = vi.fn((url, config, callback) => {
      options = config; target = url;
      return Object.assign(new EventEmitter(), { end: () => {
        const response = Object.assign(new PassThrough(), { statusCode: 204 });
        callback(response); response.end();
      } });
    });
    const response = await pinnedWebhookRequest('https://hook.example/events',
      { addresses: ['8.8.8.8'], headers: {}, body: '{}' }, { requester });
    expect(response.status).toBe(204);
    expect(target.hostname).toBe('hook.example');
    expect(options.agent).toBe(false);
    const lookupResult = vi.fn();
    options.lookup('hook.example', { all: true }, lookupResult);
    expect(lookupResult).toHaveBeenCalledWith(null, [{ address: '8.8.8.8', family: 4 }]);
  });

  it('refuses a mixed public/private DNS result before opening a socket', () => {
    const requester = vi.fn();
    expect(() => pinnedWebhookRequest('https://hook.example',
      { addresses: ['8.8.8.8', '127.0.0.1'] }, { requester })).toThrow();
    expect(requester).not.toHaveBeenCalled();
  });
});
