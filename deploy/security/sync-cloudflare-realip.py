#!/usr/bin/env python3
"""Refresh trusted Nginx Cloudflare real-IP CIDRs without accepting spoofed headers."""
import ipaddress
import os
from pathlib import Path
import subprocess
import urllib.request

TARGET = Path('/etc/nginx/conf.d/00-cloudflare-realip.conf')


def published(version):
    with urllib.request.urlopen(f'https://www.cloudflare.com/ips-v{version}', timeout=20) as response:
        lines = response.read(65536).decode('ascii').splitlines()
    networks = [ipaddress.ip_network(line.strip(), strict=True) for line in lines if line.strip()]
    if not 5 <= len(networks) <= 256:
        raise ValueError('Cloudflare list size outside expected range')
    if any(net.version != version or not net.is_global
           or net.prefixlen < (8 if version == 4 else 19) for net in networks):
        raise ValueError('Invalid Cloudflare address range')
    return networks


def main():
    if os.geteuid() != 0:
        raise SystemExit('Run as root')
    networks = published(4) + published(6)
    content = '# Managed by sync-cloudflare-realip.py; include in nginx http {}.\n'
    content += ''.join(f'set_real_ip_from {net};\n' for net in networks)
    content += 'real_ip_header CF-Connecting-IP;\nreal_ip_recursive on;\n'
    old = TARGET.read_bytes() if TARGET.exists() else None
    if old == content.encode('ascii'):
        # A previous reload may have failed; retry without rewriting the file.
        subprocess.run(['nginx', '-t'], check=True)
        subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
        return
    temporary = TARGET.with_suffix('.tmp')
    temporary.write_text(content, encoding='ascii')
    os.chmod(temporary, 0o644)
    temporary.replace(TARGET)
    try:
        subprocess.run(['nginx', '-t'], check=True)
    except Exception:
        if old is None:
            TARGET.unlink()
        else:
            temporary.write_bytes(old)
            temporary.replace(TARGET)
        raise
    subprocess.run(['systemctl', 'reload', 'nginx'], check=True)


if __name__ == '__main__':
    main()
