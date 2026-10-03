const TOKEN_PATTERN = /^hp1\.(\d{5})\.([a-z0-9_]{2,32})\.([a-f0-9]{64})$/;
const DEEP_TARGET = "/_internal/archive/manifest.json";

function normalizedPath(value) {
  const path = String(value || "/").split("?")[0].slice(0, 300).toLowerCase();
  return path.startsWith("/") ? path : `/${path}`;
}

function dayNumber(now = Date.now()) {
  return Math.floor(Number(now) / 86_400_000);
}

function hex(bytes) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function unhex(value) {
  if (!/^[a-f0-9]{64}$/.test(String(value || ""))) return new Uint8Array();
  return Uint8Array.from(String(value).match(/.{2}/g), (pair) => Number.parseInt(pair, 16));
}

async function sign(secret, value) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(String(secret || "")), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]
  );
  return hex(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

async function verify(secret, value, signature) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(String(secret || "")), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
  );
  return crypto.subtle.verify("HMAC", key, unhex(signature), encoder.encode(value));
}

export function classifyTrapPath(value) {
  const path = normalizedPath(value);
  if ([DEEP_TARGET, "/_ops/diagnostics/export", "/private/backups/index.json"].includes(path)) {
    return { stage: 3, family: "deep_canary", profile: "sealed_manifest", path };
  }
  if (/^\/storage\/logs(?:\/|$)/.test(path) || path.endsWith(".log")) {
    return { stage: 2, family: "log_extraction", profile: "synthetic_log", path };
  }
  if (/^\/(?:backup|backups|private\/backup|database|db)(?:\/|$)/.test(path)
      || /\.(?:sql|dump|sqlite|tar|zip)(?:\.|$)/.test(path)) {
    return { stage: 2, family: "archive_extraction", profile: "archive_index", path };
  }
  if (/^\/\.git(?:\/|$)/.test(path)) {
    return { stage: 2, family: "repository_extraction", profile: "git_metadata", path };
  }
  if (/(?:^|\/)credentials?(?:\.json|\.ya?ml|\.txt)?$/.test(path)
      || /(?:^|\/)wp-content\/debug\.log$/.test(path)) {
    return { stage: 2, family: "credential_extraction", profile: "synthetic_log", path };
  }
  if (/^\/\.env(?:[./]|$)/.test(path)
      || /(?:^|\/)\.env(?:[./]|$)/.test(path)
      || /(?:^|\/)env-config[^/]*$/.test(path)
      || /(?:^|\/)fly\.toml$/.test(path)) {
    return { stage: 1, family: "environment_probe", profile: "environment_stub", path };
  }
  if (/^\/\.vscode(?:\/|$)/.test(path)) {
    return { stage: 1, family: "ide_probe", profile: "ide_stub", path };
  }
  if (path === "/info.php" || /^\/actuator(?:\/|$)/.test(path) || /^\/api\/gql(?:\/|$)/.test(path)) {
    return { stage: 1, family: "runtime_probe", profile: "runtime_stub", path };
  }
  if (/^\/{1,2}(?:wp-admin|wp-json|wordpress|wp)(?:\/|$)/.test(path)
      || /^\/{1,2}(?:xmlrpc|index)\.php$/.test(path)
      || /(?:^|\/)[^/]*wlwmanifest[^/]*\.xml$/.test(path)) {
    return { stage: 1, family: "framework_probe", profile: "runtime_stub", path };
  }
  if (path === "/.well-known/security.txt") {
    return { stage: 1, family: "disclosure_probe", profile: "security_contact", path };
  }
  if (/^\/zzcanary-[^/]*\.xml$/.test(path) || path.includes("canary")) {
    return { stage: 3, family: "canary_probe", profile: "sealed_manifest", path };
  }
  return { stage: 0, family: "surface_discovery", profile: "session_shell", path };
}

export async function issueDeepCanary(secret, deviceId, family, now = Date.now()) {
  if (String(secret || "").length < 32 || !/^hpd_[a-f0-9]{32}$/.test(String(deviceId || ""))) return "";
  const day = dayNumber(now);
  const safeFamily = /^[a-z0-9_]{2,32}$/.test(family) ? family : "unknown_probe";
  const signature = await sign(secret, `deep-canary:${day}:${deviceId}:${safeFamily}:${DEEP_TARGET}`);
  return `hp1.${day}.${safeFamily}.${signature}`;
}

export async function verifyDeepCanary(token, secret, deviceId, now = Date.now()) {
  const match = String(token || "").match(TOKEN_PATTERN);
  if (!match || String(secret || "").length < 32 || !/^hpd_[a-f0-9]{32}$/.test(String(deviceId || ""))) {
    return { valid: false, family: "" };
  }
  const tokenDay = Number(match[1]);
  if (Math.abs(dayNumber(now) - tokenDay) > 1) return { valid: false, family: "" };
  const valid = await verify(secret, `deep-canary:${tokenDay}:${deviceId}:${match[2]}:${DEEP_TARGET}`, match[3]);
  return { valid, family: valid ? match[2] : "" };
}

function deepLink(token) {
  return token ? `${DEEP_TARGET}?c=${encodeURIComponent(token)}` : DEEP_TARGET;
}

export function buildDecoyArtifact(trap, token = "") {
  const link = deepLink(token);
  if (trap.profile === "environment_stub") {
    return {
      contentType: "text/plain; charset=utf-8",
      body: ["APP_ENV=production", "APP_DEBUG=false", "DATABASE_URL=redacted://invalid", `CONFIG_ARCHIVE=${link}`, "SECRETS_PROVIDER=external"].join("\n") + "\n"
    };
  }
  if (trap.profile === "ide_stub") {
    return {
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ name: "production-sync", host: "sftp.invalid", protocol: "sftp", remotePath: link, uploadOnSave: false }, null, 2)
    };
  }
  if (trap.profile === "runtime_stub") {
    return {
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ status: "restricted", environment: "production", diagnostics: link, credentials: "not-exported" })
    };
  }
  if (trap.profile === "security_contact") {
    return {
      contentType: "text/plain; charset=utf-8",
      body: `Contact: mailto:security@renvix.app\nCanonical: https://renvix.app/.well-known/security.txt\nExpires: 2027-12-31T23:59:59Z\nPolicy: ${link}\n`
    };
  }
  if (trap.profile === "synthetic_log") {
    return {
      contentType: "text/plain; charset=utf-8",
      body: `[2026-09-27 00:00:00] production.WARNING: archive index unavailable {"manifest":"${link}","credentials":"redacted"}\n`
    };
  }
  if (trap.profile === "archive_index" || trap.profile === "git_metadata") {
    return {
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ state: "offline", encrypted: true, manifest: link, secret_material: "redacted" })
    };
  }
  return {
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify({ state: "sealed", export: "unavailable", canary_verified: false, data: [] })
  };
}
