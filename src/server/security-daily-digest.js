import { query, transaction } from './db.js';
import { sendEmail } from '../lib/email/send-email.js';

export async function processSecurityDailyDigest(now = new Date()) {
  const day = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
  const from = `${day}T00:00:00.000Z`;
  const until = new Date(Date.parse(from) + 86400000).toISOString();
  const stats = await query(`SELECT count(*)::int AS hits,count(DISTINCT source_key)::int AS sources,
      count(*) FILTER (WHERE severity IN ('HIGH','CRITICAL'))::int AS high_hits
    FROM security_source_events
    WHERE event_type='ADMIN_HONEYPOT_ACCESS' AND last_seen >= $1 AND last_seen < $2`, [from, until]);
  const counts = stats.rows[0];
  if (counts?.hits) {
    const admins = await query(`SELECT DISTINCT u.email FROM admin_users au JOIN users u ON u.id=au.user_id
      WHERE au.status='active' AND au.role IN ('super_admin','security_admin') AND u.email IS NOT NULL`);
    const configured = String(process.env.SECURITY_ALERT_RECIPIENTS || '').split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
    const recipients = [...new Set([...admins.rows.map(item => String(item.email).toLowerCase()), ...configured])];
    for (const recipient of recipients) {
      await query(`INSERT INTO security_daily_digest_deliveries (day,recipient) VALUES ($1,$2)
        ON CONFLICT (day,recipient) DO NOTHING`, [day, recipient]);
    }
  }
  const rows = await transaction(async client => {
    const selected = await client.query(`SELECT day,recipient FROM security_daily_digest_deliveries
      WHERE day<= $1 AND (status='pending' AND available_at<=now()
        OR status='processing' AND available_at<now()-interval '30 minutes')
      ORDER BY day,recipient FOR UPDATE SKIP LOCKED LIMIT 50`, [day]);
    for (const row of selected.rows) await client.query(`UPDATE security_daily_digest_deliveries
      SET status='processing',attempts=attempts+1,available_at=now()
      WHERE day=$1 AND recipient=$2`, [row.day, row.recipient]);
    return selected.rows;
  });
  let sent = 0;
  let failed = 0;
  for (const item of rows) {
    try {
      const itemDay = new Date(item.day).toISOString().slice(0, 10);
      const itemFrom = `${itemDay}T00:00:00.000Z`;
      const itemUntil = new Date(Date.parse(itemFrom) + 86400000).toISOString();
      const itemStats = itemDay === day ? counts : (await query(`SELECT count(*)::int AS hits,
        count(DISTINCT source_key)::int AS sources,
        count(*) FILTER (WHERE severity IN ('HIGH','CRITICAL'))::int AS high_hits
        FROM security_source_events WHERE event_type='ADMIN_HONEYPOT_ACCESS'
        AND last_seen >= $1 AND last_seen < $2`, [itemFrom, itemUntil])).rows[0];
      const text = `Renvix honeypot report ${itemDay}\nDecoy requests: ${itemStats.hits}\nDistinct sources: ${itemStats.sources}\nHigh/Critical classified requests: ${itemStats.high_hits}\nReview the security center for details.`;
      await sendEmail({ to: item.recipient, subject: `Renvix security digest ${itemDay}`,
        text, html: `<pre>${text}</pre>`, tags: [{ name: 'purpose', value: 'security_digest' }],
        idempotencyKey: `security-digest:${item.day}:${item.recipient}` });
      await query(`UPDATE security_daily_digest_deliveries SET status='sent',sent_at=now()
        WHERE day=$1 AND recipient=$2`, [item.day, item.recipient]);
      sent += 1;
    } catch {
      await query(`UPDATE security_daily_digest_deliveries SET status='pending',
        available_at=now()+interval '30 minutes' WHERE day=$1 AND recipient=$2`, [item.day, item.recipient]);
      failed += 1;
    }
  }
  return { day, queued: rows.length, sent, failed };
}
