import { GET as getTemplate, POST as saveTemplate } from "../../order-link/templates/route.js";

export const GET = getTemplate;
export async function PUT(req) {
  return saveTemplate(req);
}
