import { randomInt } from "node:crypto";

const REGISTRATION_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function generateRegistrationCode() {
  let randomSuffix = "";

  for (let index = 0; index < 6; index += 1) {
    randomSuffix += REGISTRATION_CODE_ALPHABET[randomInt(REGISTRATION_CODE_ALPHABET.length)];
  }

  return `REG-${Date.now().toString(36).toUpperCase()}-${randomSuffix}`;
}
