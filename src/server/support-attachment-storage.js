import { query } from './db.js';
import { readPrivateObject } from './attachments/object-storage.js';

export function supportAttachmentUrl(ticketId, attachmentId, admin = false) {
  return `/api/${admin ? 'admin/' : ''}support/tickets/${encodeURIComponent(ticketId)}/attachments/${encodeURIComponent(attachmentId)}`;
}

export async function readLegacySupportBlob(url) {
  const target = new URL(url);
  if (target.protocol !== 'https:' || target.username || target.password || target.port
    || !target.hostname.endsWith('.blob.vercel-storage.com')) throw new Error('Invalid legacy attachment destination');
  const response = await fetch(target, { redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok || Number(response.headers.get('content-length') || 0) > 10 * 1024 * 1024) throw new Error('Legacy attachment unavailable');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 10 * 1024 * 1024) throw new Error('Legacy attachment too large');
      chunks.push(Buffer.from(chunk.value));
    }
  } finally { await reader.cancel().catch(() => null); }
  return Buffer.concat(chunks);
}

export async function downloadSupportAttachment({ ticketId, attachmentId, session, admin = false }) {
  const values = [attachmentId, ticketId];
  let owner = '';
  if (!admin) {
    values.push(session.tenantId, session.userId);
    owner = 'AND t.tenant_id=$3 AND t.created_by_user_id=$4 AND (a.message_id IS NULL OR m.is_internal_note=false)';
  }
  const result = await query(`SELECT a.storage_url AS url,a.original_name AS name,
    a.content_type AS type,a.size_bytes AS size,t.tenant_id AS "tenantId"
    FROM support_ticket_attachments a JOIN support_tickets t ON t.id=a.ticket_id AND t.tenant_id=a.tenant_id
    LEFT JOIN support_ticket_messages m ON m.id=a.message_id AND m.ticket_id=t.id AND m.tenant_id=t.tenant_id
    WHERE a.id=$1 AND t.id=$2 ${owner} LIMIT 1`, values);
  const file = result.rows[0];
  if (!file || Number(file.size) > 10 * 1024 * 1024) return new Response(null, { status: 404 });
  let bytes;
  if (String(file.url).startsWith('r2:')) {
    const key = file.url.slice(3);
    if (!key.startsWith(`support/${file.tenantId}/${ticketId}/`)) return new Response(null, { status: 404 });
    bytes = await readPrivateObject(key);
  } else {
    // Temporary compatibility only: migrate and DELETE legacy public blobs.
    bytes = await readLegacySupportBlob(file.url);
  }
  const name = String(file.name || 'attachment').replace(/[\r\n"\\]/g, '_').slice(0, 160);
  return new Response(bytes, { headers: {
    'Content-Type': file.type || 'application/octet-stream',
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
    'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox"
  } });
}
