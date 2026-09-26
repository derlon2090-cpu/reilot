import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("edge scanner policy", () => {
  it("uses the current ASN field and preserves explicit public endpoints", () => {
    const expression = read("deploy/security/cloudflare-cloud-asn-expression.txt");
    expect(expression).toContain("ip.src.asnum in {14061 14618 48090 199457 202412}");
    expect(expression).not.toContain("ip.geoip.asnum");
    expect(expression).toContain('"/api/v1/legit-webhook"');
    expect(expression).toContain('"/health"');
  });

  it("blocks the requested sensitive route families at both layers", () => {
    const edge = read("deploy/security/cloudflare-probe-expression.txt");
    const nginx = read("deploy/nginx.conf");
    for (const [edgeToken, nginxToken] of [
      [".vscode", "vscode"], [".idea", "idea"], [".svn", "svn"],
      ["graphql", "graphql"], ["/api/gql", "api/gql"], ["info", "info"], ["phpinfo", "phpinfo"]
    ]) {
      expect(edge).toContain(edgeToken);
      expect(nginx).toContain(nginxToken);
    }
    expect(edge).toContain('starts_with(lower(http.request.uri.path), "/admin/")');
    expect(nginx).toContain("return 444;");
    expect(nginx).toContain("if=$log_regular_access");
    expect(read("deploy/security/probe-log.conf")).toContain("map $is_decoy_probe $log_regular_access");
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
    for (const ip of ["142.93.0.66", "159.65.18.197", "159.65.144.72", "130.12.180.117"]) {
      expect(incidentIps).toContain(ip);
    }
  });

  it("installs the hard block before the ASN managed challenge", () => {
    const installer = read("deploy/security/install-probe-waf");
    expect(installer.indexOf("renvix_probe_paths block"))
      .toBeLessThan(installer.indexOf("renvix_commercial_cloud_asn managed_challenge"));
  });
});
