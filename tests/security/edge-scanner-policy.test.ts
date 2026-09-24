import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("edge scanner policy", () => {
  it("uses the current ASN field and preserves explicit public endpoints", () => {
    const expression = read("deploy/security/cloudflare-cloud-asn-expression.txt");
    expect(expression).toContain("ip.src.asnum in {14061 14618 48090 199457}");
    expect(expression).not.toContain("ip.geoip.asnum");
    expect(expression).toContain('"/api/v1/legit-webhook"');
    expect(expression).toContain('"/health"');
  });

  it("blocks the requested sensitive route families at both layers", () => {
    const edge = read("deploy/security/cloudflare-probe-expression.txt");
    const nginx = read("deploy/nginx.conf");
    for (const [edgeToken, nginxToken] of [
      [".vscode", "vscode"], [".idea", "idea"], [".svn", "svn"],
      ["graphql", "graphql"], ["info", "info"], ["phpinfo", "phpinfo"]
    ]) {
      expect(edge).toContain(edgeToken);
      expect(nginx).toContain(nginxToken);
    }
    expect(edge).toContain('starts_with(lower(http.request.uri.path), "/admin/")');
    expect(nginx).toContain("return 444;");
  });

  it("installs the hard block before the ASN managed challenge", () => {
    const installer = read("deploy/security/install-probe-waf");
    expect(installer.indexOf("renvix_probe_paths block"))
      .toBeLessThan(installer.indexOf("renvix_commercial_cloud_asn managed_challenge"));
  });
});
