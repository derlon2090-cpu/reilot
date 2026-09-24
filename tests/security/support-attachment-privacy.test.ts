import { describe, it, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn(), read: vi.fn() }));
vi.mock('../../src/server/db.js', () => ({ query: mocks.query }));
vi.mock('../../src/server/attachments/object-storage.js', () => ({ readPrivateObject: mocks.read }));
import { downloadSupportAttachment, supportAttachmentUrl } from '../../src/server/support-attachment-storage.js';

describe('private support attachments', () => {
  const input = { ticketId: 'ticket1', attachmentId: 'attachment1', session: { tenantId: 'tenant1', userId: 'user1' } };
  it('checks tenant, requester and internal-note visibility before reading storage', async () => {
    mocks.query.mockResolvedValue({ rows: [] });
    mocks.read.mockClear();
    expect((await downloadSupportAttachment(input)).status).toBe(404);
    expect(mocks.query.mock.calls.at(-1)[1]).toEqual(['attachment1', 'ticket1', 'tenant1', 'user1']);
    expect(mocks.query.mock.calls.at(-1)[0]).toContain('m.is_internal_note=false');
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it('serves owned private bytes with no caching or inline execution', async () => {
    mocks.query.mockResolvedValue({ rows: [{ tenantId: 'tenant1', url: 'r2:support/tenant1/ticket1/file1', name: 'private.pdf', size: 3, type: 'application/pdf' }] });
    mocks.read.mockResolvedValue(Buffer.from('pdf'));
    const response = await downloadSupportAttachment(input);
    expect(await response.text()).toBe('pdf');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('content-disposition')).toContain('attachment;');
    expect(supportAttachmentUrl('ticket1', 'attachment1', true)).toBe('/api/admin/support/tickets/ticket1/attachments/attachment1');
  });
  it('rejects a corrupt reference to another tenant private object', async () => {
    mocks.query.mockResolvedValue({ rows: [{ tenantId: 'tenant1', url: 'r2:support/tenant2/ticket1/file1', size: 3 }] });
    mocks.read.mockClear();
    expect((await downloadSupportAttachment(input)).status).toBe(404);
    expect(mocks.read).not.toHaveBeenCalled();
  });
});
