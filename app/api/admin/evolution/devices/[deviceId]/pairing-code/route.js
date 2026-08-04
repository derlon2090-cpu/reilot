import { POST as deviceAction } from "../action/route.js";

export async function POST(request, context) {
  const body = await request.json().catch(() => ({}));
  return deviceAction(new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify({ action: "pairing_code", phoneNumber: body.phoneNumber || "" })
  }), context);
}
