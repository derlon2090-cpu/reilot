import tls from "node:tls";

const DEFAULT_HOSTS = [
  "renvix.app",
  "www.renvix.app",
  "accounts.renvix.app",
  "dash.renvix.app",
  "api.renvix.app",
  "wa-admin.renvix.app"
];

const hosts = String(process.env.TLS_HOSTS || DEFAULT_HOSTS.join(","))
  .split(",")
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);
const minimumDays = Math.max(1, Number(process.env.TLS_MINIMUM_DAYS || 21));
const timeoutMs = Math.max(1_000, Number(process.env.TLS_CHECK_TIMEOUT_MS || 10_000));

function inspectCertificate(host) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({
      host,
      port: 443,
      servername: host,
      minVersion: "TLSv1.2",
      rejectUnauthorized: true,
      ALPNProtocols: ["h2", "http/1.1"]
    });
    const timer = setTimeout(() => socket.destroy(new Error("TLS check timed out")), timeoutMs);
    socket.once("secureConnect", () => {
      try {
        if (!socket.authorized) throw new Error(socket.authorizationError || "certificate is not trusted");
        const certificate = socket.getPeerCertificate();
        const expiresAt = Date.parse(certificate.valid_to || "");
        if (!Number.isFinite(expiresAt)) throw new Error("certificate expiry is unavailable");
        const daysRemaining = Math.floor((expiresAt - Date.now()) / 86_400_000);
        if (daysRemaining < minimumDays) throw new Error(`certificate expires in ${daysRemaining} days`);
        resolve({
          host,
          protocol: socket.getProtocol(),
          alpn: socket.alpnProtocol || "none",
          cipher: socket.getCipher()?.standardName || socket.getCipher()?.name || "unknown",
          daysRemaining,
          expiresAt: new Date(expiresAt).toISOString()
        });
      } catch (error) {
        reject(error);
      } finally {
        clearTimeout(timer);
        socket.end();
      }
    });
    socket.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function verifyHttpRedirect(host) {
  const response = await fetch(`http://${host}/`, {
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs)
  });
  const location = response.headers.get("location") || "";
  if (![301, 302, 307, 308].includes(response.status) || !location.startsWith("https://")) {
    throw new Error(`HTTP did not redirect to HTTPS (status ${response.status})`);
  }
  return response.status;
}

if (hosts.length === 0) throw new Error("TLS_HOSTS must contain at least one hostname");

let failed = false;
for (const host of hosts) {
  try {
    const [certificate, redirectStatus] = await Promise.all([
      inspectCertificate(host),
      verifyHttpRedirect(host)
    ]);
    console.log(JSON.stringify({ ok: true, ...certificate, redirectStatus }));
  } catch (error) {
    failed = true;
    console.error(JSON.stringify({ ok: false, host, error: String(error?.message || error) }));
  }
}

if (failed) process.exitCode = 1;
