import { query } from "../db.js";

const METRICS = new Set([
  "uploads_started", "uploads_completed", "uploads_failed", "uploaded_bytes",
  "r2_presign_latency", "r2_head_latency", "r2_delete_latency",
  "image_analysis_success", "image_analysis_failure",
  "audio_transcription_success", "audio_transcription_failure",
  "abandoned_uploads", "quota_rejections", "mime_rejections", "size_rejections"
]);

export async function recordAttachmentMetric(tenantId, metricName, { count = 1, value = 0 } = {}) {
  if (!tenantId || !METRICS.has(metricName)) return;
  await query(
    `INSERT INTO ai_attachment_metrics_daily(tenant_id,metric_date,metric_name,event_count,metric_value)
     VALUES($1,CURRENT_DATE,$2,$3,$4)
     ON CONFLICT(tenant_id,metric_date,metric_name) DO UPDATE SET
       event_count=ai_attachment_metrics_daily.event_count+EXCLUDED.event_count,
       metric_value=ai_attachment_metrics_daily.metric_value+EXCLUDED.metric_value`,
    [tenantId, metricName, Math.max(0, Number(count || 0)), Math.max(0, Math.round(Number(value || 0)))]
  );
}
