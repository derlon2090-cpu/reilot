import { describe, it, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn(), transaction: vi.fn(), idempotency: vi.fn() }));
vi.mock('../../src/server/db.js', () => ({ query: mocks.query, transaction: mocks.transaction }));
vi.mock('../../src/server/custom-integrations.js', () => ({
  authenticateCustomApi: async () => ({ ok: true, tenantId: 'owned-tenant', requestId: 'request1' }),
  customApiError: result => Response.json({ error: result.code }, { status: result.status }),
  publishCustomEvent: vi.fn(), withIdempotency: mocks.idempotency
}));
import { POST } from '../../app/api/v1/payments/route.js';
describe('external payment tenant references', () => {
  it('rejects foreign customer IDs before creating a payment or side effects', async () => {
    mocks.query.mockResolvedValue({ rows: [] });
    const customerId = '11111111-1111-4111-8111-111111111111';
    const response = await POST(new Request('https://api.renvix.app/api/v1/payments', { method: 'POST',
      body: JSON.stringify({ external_id: 'payment1', amount: 10, status: 'SUCCEEDED', customer_id: customerId }) }));
    expect(response.status).toBe(404);
    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining('tenant_id=$2'), [customerId, 'owned-tenant']);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.idempotency).not.toHaveBeenCalled();
  });
});
