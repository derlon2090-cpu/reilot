import net from 'node:net';
import https from 'node:https';
import { Readable } from 'node:stream';

const blockedV4 = new net.BlockList();
for (const [network, prefix] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10],
  ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24],
  ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]]) blockedV4.addSubnet(network, prefix, 'ipv4');
const globalV6 = new net.BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');
const blockedV6 = new net.BlockList();
for (const [network, prefix] of [['2001::', 32], ['2001:db8::', 32], ['2002::', 16]]) blockedV6.addSubnet(network, prefix, 'ipv6');

export function isPublicWebhookIp(address) {
  const family = net.isIP(address);
  if (family === 4) return !blockedV4.check(address, 'ipv4');
  // Reject mapped IPv4, NAT64, local, multicast and tunnelling ranges.
  return family === 6 && globalV6.check(address, 'ipv6') && !blockedV6.check(address, 'ipv6');
}

export function pinnedWebhookRequest(url, { addresses, headers, body, signal }, { requester = https.request } = {}) {
  const target = new URL(url);
  if (target.protocol !== 'https:' || target.username || target.password
    || !addresses?.length || addresses.some(address => !isPublicWebhookIp(address))) {
    throw new Error('Unsafe webhook destination');
  }
  // Never resolve DNS a second time. Original hostname remains TLS SNI and is
  // validated against the certificate; no redirects or pooled socket reuse.
  const address = addresses[0];
  const family = net.isIP(address);
  return new Promise((resolve, reject) => {
    const request = requester(target, {
      method: 'POST', headers, signal, agent: false,
      lookup: (_hostname, options, callback) => options.all
        ? callback(null, [{ address, family }]) : callback(null, address, family)
    }, response => resolve({ status: response.statusCode, body: Readable.toWeb(response) }));
    request.on('error', reject);
    request.end(body);
  });
}
