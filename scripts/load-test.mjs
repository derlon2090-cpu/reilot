import { performance } from "node:perf_hooks";

const target = new URL(process.env.LOAD_TEST_URL || "http://127.0.0.1:3000/api/health");
const requests = Math.min(10_000, Math.max(1, Number(process.env.LOAD_TEST_REQUESTS || 500)));
const concurrency = Math.min(500, Math.max(1, Number(process.env.LOAD_TEST_CONCURRENCY || 50)));
const timeoutMs = Math.max(250, Number(process.env.LOAD_TEST_TIMEOUT_MS || 5_000));
const allowedErrorRate = Math.min(1, Math.max(0, Number(process.env.LOAD_TEST_MAX_ERROR_RATE || 0.01)));
const allowedP95Ms = Math.max(1, Number(process.env.LOAD_TEST_MAX_P95_MS || 1_000));
const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);

if (!localHosts.has(target.hostname) && process.env.LOAD_TEST_ALLOW_REMOTE !== "true") {
  throw new Error("Remote load testing is disabled. Set LOAD_TEST_ALLOW_REMOTE=true only for infrastructure you own.");
}
if (target.protocol !== "http:" && target.protocol !== "https:") throw new Error("LOAD_TEST_URL must use HTTP or HTTPS");

const durations = [];
const statusCounts = new Map();
let cursor = 0;
let failures = 0;

async function worker() {
  while (true) {
    const requestNumber = cursor++;
    if (requestNumber >= requests) return;
    const startedAt = performance.now();
    try {
      const response = await fetch(target, {
        method: "GET",
        redirect: "manual",
        headers: { Accept: "application/json", "User-Agent": "Renvix-Load-Check/1.0" },
        signal: AbortSignal.timeout(timeoutMs)
      });
      statusCounts.set(response.status, (statusCounts.get(response.status) || 0) + 1);
      if (response.status < 200 || response.status >= 400) failures += 1;
      await response.body?.cancel();
    } catch {
      failures += 1;
      statusCounts.set("network_error", (statusCounts.get("network_error") || 0) + 1);
    } finally {
      durations.push(performance.now() - startedAt);
    }
  }
}

const startedAt = performance.now();
await Promise.all(Array.from({ length: Math.min(concurrency, requests) }, () => worker()));
const elapsedMs = performance.now() - startedAt;
durations.sort((a, b) => a - b);
const percentile = (value) => durations[Math.min(durations.length - 1, Math.ceil(durations.length * value) - 1)] || 0;
const errorRate = failures / requests;
const summary = {
  target: target.origin + target.pathname,
  requests,
  concurrency,
  elapsedMs: Math.round(elapsedMs),
  requestsPerSecond: Number((requests / (elapsedMs / 1_000)).toFixed(2)),
  latencyMs: {
    p50: Number(percentile(0.5).toFixed(2)),
    p95: Number(percentile(0.95).toFixed(2)),
    p99: Number(percentile(0.99).toFixed(2))
  },
  failures,
  errorRate: Number(errorRate.toFixed(4)),
  statuses: Object.fromEntries([...statusCounts].map(([key, value]) => [String(key), value]))
};

console.log(JSON.stringify(summary, null, 2));
if (errorRate > allowedErrorRate || percentile(0.95) > allowedP95Ms) process.exitCode = 1;
