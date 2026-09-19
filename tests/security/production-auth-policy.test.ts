import { afterEach, describe, it, expect, vi } from 'vitest';
vi.mock('../../src/server/trusted-browser.js', () => ({ validateTrustedBrowser: async () => ({ trusted: false, reason: 'unknown' }) }));
import { resolveSecondFactor } from '../../src/server/second-factor-router.js';

afterEach(() => vi.unstubAllEnvs());
describe('production second-factor policy', () => {
  it('cannot disable verification by omitting the production factor flag', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AUTH_SECOND_FACTOR_REQUIRED', 'false');
    vi.stubEnv('EMAIL_OTP_FALLBACK_ENABLED', 'false');
    vi.stubEnv('EMAIL_OTP_ENFORCE_ALL', 'false');
    const factor = await resolveSecondFactor({ user: { id: 'user1', mfaEnabled: false } });
    expect(factor.method).toBe('unavailable');
    expect(factor.requiresChallenge).toBe(true);
  });
});
