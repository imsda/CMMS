import { randomBytes } from "node:crypto";

export function generateRegistrationCode() {
  return `REG-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}`;
}
