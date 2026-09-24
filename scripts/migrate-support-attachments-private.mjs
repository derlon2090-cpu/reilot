import crypto from 'node:crypto';
import { mkdir, readFile, appendFile, chmod } from 'node:fs/promises';
import path from 'node:path';
import { del } from '@vercel/blob';
import { query, getPool } from '../src/server/db.js';
import { objectStorageConfigured, putPrivateObject, readPrivateObject } from '../src/server/attachments/object-storage.js';
import { readLegacySupportBlob } from '../src/server/support-attachment-storage.js';

if (!objectStorageConfigured() || !process.env.BLOB_READ_WRITE_TOKEN) throw new Error('Private R2 storage and legacy Blob deletion credentials are required');
const journal = path.resolve(process.env.SUPPORT_BLOB_MIGRATION_JOURNAL || '.local/support-attachment-migration.jsonl');
await mkdir(path.dirname(journal), { recursive: true, mode: 0o700 });
await appendFile(journal, '', { mode: 0o600 });
await chmod(journal, 0o600);
async function removeUnreferencedPublicBlob(url) {
  const references = await query('SELECT 1 FROM support_ticket_attachments WHERE storage_url=$1 LIMIT 1', [url]);
  if (!references.rows.length) await del(url);
}

let migrated = 0;
try {
  // Recover deletion failures after a successful DB update. Journal contains
  // sensitive old URLs: owner-only, never publish or commit it.
  const previous = await readFile(journal, 'utf8');
  for (const line of previous.split('\n').filter(Boolean)) await removeUnreferencedPublicBlob(JSON.parse(line).oldUrl);
  while (true) {
    const batch = await query(`SELECT id,tenant_id AS "tenantId",ticket_id AS "ticketId",storage_url AS url,
      content_type AS type,size_bytes AS size,sha256 FROM support_ticket_attachments
      WHERE storage_url LIKE 'https://%' ORDER BY created_at LIMIT 25`);
    if (!batch.rows.length) break;
    for (const file of batch.rows) {
      const bytes = await readLegacySupportBlob(file.url);
      const digest = crypto.createHash('sha256').update(bytes).digest('hex');
      if (bytes.length !== Number(file.size) || (file.sha256 && digest !== file.sha256)) throw new Error('Legacy attachment integrity check failed');
      const key = `support/${file.tenantId}/${file.ticketId}/${file.id}`;
      await putPrivateObject({ objectKey: key, bytes, contentType: file.type });
      const copied = await readPrivateObject(key);
      if (crypto.createHash('sha256').update(copied).digest('hex') !== digest) throw new Error('Private attachment verification failed');
      await appendFile(journal, JSON.stringify({ attachmentId: file.id, oldUrl: file.url, key }) + '\n');
      await query(`UPDATE support_ticket_attachments SET storage_url=$1,storage_path=$2
        WHERE id=$3 AND storage_url=$4`, [`r2:${key}`, key, file.id, file.url]);
      await removeUnreferencedPublicBlob(file.url);
      migrated += 1;
    }
  }
  console.log(JSON.stringify({ event: 'support_attachments_migrated', count: migrated }));
} finally { await getPool().end(); }
