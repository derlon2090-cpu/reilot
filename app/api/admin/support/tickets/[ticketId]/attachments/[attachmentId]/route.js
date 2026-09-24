import { requireAdminPermission } from '../../../../../../../../src/server/admin-auth.js';
import { downloadSupportAttachment } from '../../../../../../../../src/server/support-attachment-storage.js';

export async function GET(request, { params }) {
  const auth = await requireAdminPermission(request, 'support', 'read');
  if (!auth.ok) return auth.response;
  const { ticketId, attachmentId } = await params;
  try { return await downloadSupportAttachment({ ticketId, attachmentId, admin: true }); }
  catch { return Response.json({ ok: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
}
