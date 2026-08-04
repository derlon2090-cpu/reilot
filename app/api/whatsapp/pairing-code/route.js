import { evolutionUnavailableToUsers } from "../../../../src/server/user-evolution-guard.js";

export async function POST(req) {
  return evolutionUnavailableToUsers(req);
}
