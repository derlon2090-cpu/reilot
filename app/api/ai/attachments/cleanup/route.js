import { sameOriginRequest } from "../../../../../src/server/campaign-contacts.js";
import { requireSession } from "../../../../../src/server/session.js";
import {
  attachmentCleanupPreview,
  createAttachmentCleanupJob,
  getAttachmentCleanupJob,
  processAttachmentCleanupJob
} from "../../../../../src/server/attachments/cleanup-jobs.js";

export const runtime = "nodejs";

function failure(error) {
  return Response.json({
    ok: false,
    code: error?.code || "ATTACHMENT_CLEANUP_FAILED",
    message: error?.status ? error.message : "تعذر تنفيذ تنظيف المرفقات حاليًا."
  }, { status: error?.status || 500 });
}

export async function GET(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  try {
    const jobId = new URL(request.url).searchParams.get("jobId");
    if (jobId) return Response.json({ ok: true, job: await getAttachmentCleanupJob(auth.session, jobId) });
    return Response.json({ ok: true, categories: await attachmentCleanupPreview(auth.session) });
  } catch (error) { return failure(error); }
}

export async function POST(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير صالح." }, { status: 403 });
  try {
    const input = await request.json().catch(() => ({}));
    if (input.confirmation !== "HARD_DELETE_ATTACHMENTS") {
      return Response.json({ ok: false, message: "يلزم تأكيد الحذف النهائي للمرفقات." }, { status: 400 });
    }
    const job = await createAttachmentCleanupJob(auth.session, input);
    // Process one bounded batch now for responsive UI; cron continues larger jobs.
    const progress = job.status === "completed" ? { done: true } : await processAttachmentCleanupJob(job.id);
    return Response.json({ ok: true, job: await getAttachmentCleanupJob(auth.session, job.id), progress }, { status: 202 });
  } catch (error) { return failure(error); }
}
