export function checkRateLimit({ attempts, key, limit, windowMs, now = Date.now() }) {
  const recentAttempts = attempts.filter((attempt) => (
    attempt.key === key && now - attempt.createdAt <= windowMs
  ));

  if (recentAttempts.length >= limit) {
    return { ok: false, status: 429, retryAfterMs: windowMs - (now - recentAttempts[0].createdAt) };
  }

  return { ok: true };
}
