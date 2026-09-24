import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn(), sendEmail: vi.fn(), transaction: vi.fn() }));
vi.mock('../../src/server/db.js', () => ({ query: mocks.query, transaction: mocks.transaction }));
vi.mock('../../src/lib/email/send-email.js', () => ({ sendEmail: mocks.sendEmail }));
import { processSecurityDailyDigest } from '../../src/server/security-daily-digest.js';

describe('daily honeypot notification hygiene', () => {
  it('sends one bounded daily summary and does not resend a claimed delivery', async () => {
    vi.stubEnv('SECURITY_ALERT_RECIPIENTS', 'security@example.com');
    let claimed = false;
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('count(DISTINCT source_key)')) return { rows: [{ hits: 9, sources: 2, high_hits: 1 }] };
      if (sql.includes('SELECT DISTINCT u.email')) return { rows: [] };
      return { rows: [] };
    });
    mocks.transaction.mockImplementation(async (callback: (client: unknown) => Promise<unknown>) => callback({
      query: async (sql: string) => {
        if (sql.includes('SELECT day,recipient')) {
          if (claimed) return { rows: [] };
          claimed = true;
          return { rows: [{ day: '2026-09-18', recipient: 'security@example.com' }] };
        }
        return { rows: [] };
      }
    }));
    mocks.sendEmail.mockResolvedValue({ ok: true });
    const now = new Date('2026-09-19T12:00:00.000Z');
    expect(await processSecurityDailyDigest(now)).toMatchObject({ day: '2026-09-18', sent: 1 });
    expect(await processSecurityDailyDigest(now)).toMatchObject({ sent: 0 });
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
    expect(mocks.sendEmail.mock.calls[0][0].text).toContain('Decoy requests: 9');
    vi.unstubAllEnvs();
  });
});
