import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("edge scanner policy", () => {
  it("uses the current ASN field and preserves explicit public endpoints", () => {
    const expression = read("deploy/security/cloudflare-cloud-asn-expression.txt");
    expect(expression).toContain("ip.src.asnum in {14061 14618 48090 199457 202412 396982 34343 25369}");
    expect(expression).not.toContain("ip.geoip.asnum");
    expect(expression).not.toContain("13335");
    expect(expression).not.toContain('lower(http.host) ne "admin.renvix.app"');
    expect(expression).toContain('"/api/v1/legit-webhook"');
    expect(expression).toContain('"/health"');
  });

  it("blocks the requested sensitive route families at both layers", () => {
    const edge = read("deploy/security/cloudflare-probe-expression.txt");
    const nginx = read("deploy/nginx.conf");
    for (const [edgeToken, nginxToken] of [
      [".vscode", "vscode"], [".idea", "idea"], [".svn", "svn"],
      ["graphql", "graphql"], ["/api/gql", "api/gql"], ["info", "info"], ["pinfo", "pinfo"],
      ["phpinfo", "phpinfo"], ["credentials", "credentials"]
    ]) {
      expect(edge).toContain(edgeToken);
      expect(nginx).toContain(nginxToken);
    }
    expect(edge).toContain('starts_with(lower(http.request.uri.path), "/admin/")');
    for (const token of ["*/.git*", "*/fly.toml", "*/env-config*", "wlwmanifest", '".toml"', '".local"', '".staging"']) {
      expect(edge).toContain(token);
    }
    expect(nginx).toContain("return 444;");
    expect(nginx).toContain("location ~* ^/+.*(wp-includes|wlwmanifest\\.xml)");
    expect(nginx).toContain(".well-known/security\\.txt");
    expect(nginx).toContain("storage/logs");
    expect(nginx).toContain("zzcanary-");
    expect(nginx).toContain("access_log off;");
    expect(nginx).toContain("if=$log_regular_access");
    expect(read("deploy/security/probe-log.conf")).toContain("map $is_decoy_probe $log_regular_access");
  });

  it("bounds origin work and rejects unknown virtual hosts", () => {
    const nginx = read("deploy/nginx.conf");
    const gateway = read("deploy/security/probe-log.conf");
    const compose = read("docker-compose.yml");
    expect(nginx).toContain("listen 80 default_server");
    expect(nginx).toContain("listen [::]:80 default_server");
    expect(nginx).toContain('server_name "";');
    expect(nginx).toContain("limit_conn renvix_per_ip 30");
    expect(nginx).toContain("limit_req zone=renvix_general");
    expect(nginx).toContain("limit_req zone=renvix_auth");
    expect(nginx).toContain("client_header_timeout 10s");
    expect(nginx).toContain("reset_timedout_connection on");
    expect(nginx).toContain("renvix-honeypot-deny-*.conf");
    expect(nginx).toContain('^(?:TRACE|CONNECT)$');
    expect(nginx).toContain("proxy_next_upstream off");
    expect(nginx).toContain("Connection $connection_upgrade");
    expect(gateway).toContain("limit_conn_zone $binary_remote_addr");
    expect(gateway).toContain("limit_req_zone $renvix_auth_limit_key");
    expect(compose).toContain("./deploy/security/probe-log.conf:/etc/nginx/conf.d/00-security-gateway.conf:ro");
  });

  it("ships a bounded honeypot intelligence engine instead of raw regex generation", () => {
    const engine = read("deploy/security/honeypot-intel-engine.py");
    const service = read("deploy/security/renvix-honeypot-intel.service");
    expect(engine).toContain("SAFE_PATH");
    expect(engine).toContain("classify_path");
    expect(engine).toContain('location = "{path}"');
    expect(engine).toContain('run([nginx, "-t"])');
    expect(engine).toContain("os.replace");
    expect(service).toContain("ProtectSystem=strict");
  });

  it("uses ipset for constant-time dynamic source containment", () => {
    const jail = read("deploy/fail2ban/jail.d/honeypot-probes.local");
    const action = read("deploy/security/ipset-probe-action");
    const loader = read("deploy/security/load-incident-blocklist");
    const incidentIps = read("deploy/security/incident-scanner-ips.txt");
    expect(jail).toContain("action = honeypot-ipset");
    expect(action).toContain("hash:ip");
    expect(action).toContain('--match-set "$setid" src -j DROP');
    expect(loader).toContain("ipaddress.ip_address");
    for (const ip of [
      "147.182.200.94", "138.197.191.87", "142.93.0.66", "159.65.18.197",
      "159.65.144.72", "130.12.180.117", "34.140.132.132", "91.148.245.81",
      "91.92.240.86", "35.241.202.92", "85.204.70.92", "23.98.157.29",
      "34.152.30.165", "34.52.133.111"
    ]) {
      expect(incidentIps).toContain(ip);
    }
    expect(incidentIps).not.toContain("104.28.254.47");
    expect(incidentIps).not.toContain("104.28.222.43");
    const blacklist = read("deploy/security/install-honeypot-blacklist");
    expect(blacklist).toContain("honeypot_blacklist");
    expect(blacklist).toContain("185.19.40.179");
    expect(blacklist).not.toContain('185.19.40.179 timeout 604800');
    expect(blacklist).toContain("34.152.30.165 timeout 604800");
    expect(blacklist).toContain("34.52.133.111 timeout 604800");
    expect(blacklist).toContain("timeout 0");
    const sentry = read("deploy/security/honeypot-sentry");
    const service = read("deploy/security/renvix-honeypot-sentry.service");
    expect(sentry).toContain("timeout_seconds=604800");
    expect(sentry).toContain("ipset add");
    expect(service).toContain("Restart=always");
    const triage = read("deploy/security/triage-honeypot-ban");
    expect(triage).toContain("ipset test");
    expect(triage).toContain("renvix-honeypot-sentry.service");
    expect(triage).not.toContain("honeypot-autoban.service");
  });

  it("ships a single terminating WAF payload for the incident vectors", () => {
    const payload = JSON.parse(read("deploy/security/cloudflare-latest-incidents-rule.json"));
    expect(payload.action).toBe("block");
    expect(payload.enabled).toBe(true);
    expect(payload.expression).not.toContain("ip.src.asnum");
    expect(payload.expression).toContain('lower(http.host) ne "admin.renvix.app"');
    expect(payload.expression).toContain("ip.src in {34.152.30.165 34.52.133.111 185.19.40.179}");
    for (const token of ["*/.env*", "*/.git*", "*/fly.toml", "*/env-config*", "wlwmanifest", "/.vscode", "/storage/logs", "/actuator", "/info.php", "/pinfo.php", "/api/phpinfo.php", "/credentials", "/api/gql", "canary", ".log", "/.well-known/security.txt"]) {
      expect(payload.expression).toContain(token);
    }
  });

  it("restores client IPs only from Cloudflare's validated published ranges", () => {
    const updater = read("deploy/security/sync-cloudflare-realip.py");
    expect(updater).toContain("https://www.cloudflare.com/ips-v{version}");
    expect(updater).toContain("set_real_ip_from");
    expect(updater).toContain("real_ip_header CF-Connecting-IP");
    expect(updater).toContain("real_ip_recursive on");
    expect(updater).toContain("ipaddress.ip_network");
    expect(updater).toContain("nginx', '-t");
  });

  it("installs the hard block before the ASN managed challenge", () => {
    const installer = read("deploy/security/install-probe-waf");
    expect(installer.indexOf("renvix_protocol_abuse block"))
      .toBeLessThan(installer.indexOf("renvix_latest_honeypot_incidents block"));
    expect(installer.indexOf("renvix_latest_honeypot_incidents block"))
      .toBeLessThan(installer.indexOf("renvix_probe_paths block"));
    expect(installer.indexOf("renvix_probe_paths block"))
      .toBeLessThan(installer.indexOf("renvix_commercial_cloud_asn managed_challenge"));
  });

  it("installs one plan-compatible edge rate-limit rule for costly surfaces", () => {
    const installer = read("deploy/security/install-edge-rate-limits");
    expect(installer).toContain("http_ratelimit");
    expect(installer).toContain('characteristics:["cf.colo.id","ip.src"]');
    expect(installer).toContain("renvix_sensitive_api_burst");
    expect(installer).toContain('starts_with(lower(http.request.uri.path), "/api/ai/")');
    expect(installer).toContain('starts_with(lower(http.request.uri.path), "/api/storage/")');
    expect(installer).toContain('lower(http.request.uri.path) eq "/api/storage"');
    expect(installer.match(/upsert_rate_rule renvix_/g)).toHaveLength(1);
  });
});
