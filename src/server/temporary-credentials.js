import crypto from "node:crypto";
import { isStrongPassword } from "./security.js";

export function generateTemporaryPassword() {
  let password = "";
  do password = `Rv!${crypto.randomBytes(18).toString("base64url")}9a`;
  while (password.length < 20 || !isStrongPassword(password));
  return password;
}
