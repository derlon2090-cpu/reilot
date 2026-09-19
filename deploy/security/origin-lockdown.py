#!/usr/bin/env python3
"""Atomic nftables Cloudflare-only public ingress; Python 3.9+, nft required."""
import fcntl
import ipaddress
import json
import os
from pathlib import Path
import re
import subprocess
import urllib.request


def nft(batch):
    subprocess.run(['nft', '-c', '-f', '-'], input=batch, text=True, check=True)
    subprocess.run(['nft', '-f', '-'], input=batch, text=True, check=True)


def ranges(version):
    with urllib.request.urlopen(f'https://www.cloudflare.com/ips-v{version}', timeout=20) as response:
        lines = response.read(65536).decode('ascii').splitlines()
    networks = [ipaddress.ip_network(line.strip(), strict=True) for line in lines if line.strip()]
    if not 5 <= len(networks) <= 256:
        raise ValueError('Unexpected Cloudflare list size; existing firewall preserved')
    for net in networks:
        if net.version != version or not net.is_global or net.prefixlen < (8 if version == 4 else 19):
            raise ValueError('Invalid or overly broad Cloudflare range')
    return ', '.join(map(str, networks))


def main():
    if os.geteuid() != 0:
        raise SystemExit('Run as root')
    interfaces = os.environ.get('PUBLIC_INTERFACES', '').split(',')
    if not interfaces or any(not re.fullmatch(r'[A-Za-z0-9_.:-]{1,15}', item) for item in interfaces):
        raise SystemExit('Set PUBLIC_INTERFACES to comma-separated public NICs, e.g. eth0,eth1')
    with open('/run/renvix-origin-lock.lock', 'w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        # Fetch and validate BOTH families before changing anything.
        v4, v6 = ranges(4), ranges(6)
        exists = subprocess.run(['nft', 'list', 'table', 'inet', 'renvix_origin'],
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0
        nic = ', '.join(json.dumps(item) for item in interfaces)
        if not exists:
            batch = f'''add table inet renvix_origin
add set inet renvix_origin cf4 {{ type ipv4_addr; flags interval; }}
add set inet renvix_origin cf6 {{ type ipv6_addr; flags interval; }}
add set inet renvix_origin banned4 {{ type ipv4_addr; flags interval; auto-merge; elements = {{ 195.178.110.72, 45.115.26.203 }}; }}
add set inet renvix_origin banned6 {{ type ipv6_addr; flags interval; auto-merge; }}
add chain inet renvix_origin ingress {{ type filter hook prerouting priority -310; policy accept; }}
add rule inet renvix_origin ingress iifname {{ {nic} }} ip saddr @banned4 counter drop
add rule inet renvix_origin ingress iifname {{ {nic} }} ip6 saddr @banned6 counter drop
add rule inet renvix_origin ingress iifname {{ {nic} }} tcp dport {{ 80, 443 }} ip saddr @cf4 accept
add rule inet renvix_origin ingress iifname {{ {nic} }} tcp dport {{ 80, 443 }} ip6 saddr @cf6 accept
add rule inet renvix_origin ingress iifname {{ {nic} }} tcp dport {{ 80, 443 }} counter drop
add rule inet renvix_origin ingress iifname {{ {nic} }} udp dport {{ 80, 443 }} counter drop
'''
        else:
            # Preserve bans and all guard chains; never flush the host ruleset.
            batch = 'flush set inet renvix_origin cf4\nflush set inet renvix_origin cf6\n'
        batch += f'add element inet renvix_origin cf4 {{ {v4} }}\nadd element inet renvix_origin cf6 {{ {v6} }}\n'
        nft(batch)
        # Dedicated snapshot only; do not overwrite /etc/nftables.conf.
        directory = Path('/etc/renvix-secops')
        directory.mkdir(mode=0o700, exist_ok=True)
        snapshot = subprocess.check_output(['nft', 'list', 'table', 'inet', 'renvix_origin'], text=True)
        temporary = directory / 'origin.nft.tmp'
        temporary.write_text(snapshot, encoding='utf-8')
        os.chmod(temporary, 0o600)
        temporary.replace(directory / 'origin.nft')
        print(json.dumps({'event': 'origin_allowlist_updated', 'interfaces': interfaces}))


if __name__ == '__main__':
    main()
