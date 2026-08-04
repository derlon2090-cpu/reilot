import { POST as deviceAction } from "../action/route.js";

export async function POST(request, context) {
  return deviceAction(new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify({ action: "reconnect" })
  }), context);
}
