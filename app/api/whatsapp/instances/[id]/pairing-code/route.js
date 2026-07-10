import { safeJson, validateTenantRequest } from "../../../_lib/guard";
import { normalizeEvolutionPhone } from "../../../../../../src/lib/evolution";

export async function POST(req, { params }) {
  const auth = validateTenantRequest(req);
  if (!auth.ok) return safeJson({ ok: false, error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => ({}));
  const normalized = normalizeEvolutionPhone(body.phoneNumber);
  if (!normalized.ok) {
    return safeJson({
      ok: false,
      code: "INVALID_WHATSAPP_PHONE",
      message: "رقم واتساب يجب أن يكون بصيغة دولية وبدون + أو مسافات، مثال: 9665XXXXXXXX."
    }, { status: 400 });
  }

  if (process.env.EVOLUTION_PAIRING_CODE_SUPPORTED === "false") {
    return safeJson({
      ok: false,
      code: "PAIRING_CODE_NOT_SUPPORTED",
      message: "رمز الاقتران غير مدعوم حاليا في نسخة Evolution API المثبتة. يمكنك استخدام الربط بالباركود."
    }, { status: 501 });
  }

  return safeJson({
    ok: true,
    instanceId: params.id,
    pairingCode: "ABCD-EFGH",
    expiresIn: 60
  });
}
