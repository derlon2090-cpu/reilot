import { describe, it, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('../../src/server/session.js', () => ({ requireSession: async () => ({ ok: true, session: { tenantId: 'owned-tenant' } }) }));
vi.mock('../../src/server/order-links.js', () => ({ ensureOrderLinkProfile: vi.fn(), saveOrderLinkProfile: mocks.save }));
import { POST } from '../../app/api/order-link/profile/route.js';

describe('order profile tenant boundary', () => {
  it('cannot change another tenant by putting tenantId in JSON', async () => {
    mocks.save.mockResolvedValue({ ok: true });
    const response = await POST(new Request('https://api.renvix.app/api/order-link/profile', {
      method: 'POST', body: JSON.stringify({ tenantId: 'victim-tenant', storeName: 'Changed' })
    }));
    expect(response.status).toBe(200);
    expect(mocks.save).toHaveBeenCalledWith({ tenantId: 'owned-tenant', storeName: 'Changed' });
  });
});
