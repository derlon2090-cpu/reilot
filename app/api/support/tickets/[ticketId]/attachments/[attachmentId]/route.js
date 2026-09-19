import { requireSession } from '../../../../../../../src/server/session.js';
import { downloadSupportAttachment } from '../../../../../../../src/server/support-attachment-storage.js';

export async function GET(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  const { ticketId, attachmentId } = await params;
  try { return await downloadSupportAttachment({ ticketId, attachmentId, session: auth.session }); }
  catch { return Response.json({ ok: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
}
