export function assertRegistrationWindow(
  now: Date,
  registrationOpensAt: Date,
  registrationClosesAt: Date,
): void {
  if (now < registrationOpensAt) {
    throw new Error("Registration is not open yet.");
  }

  if (now > registrationClosesAt) {
    throw new Error("Registration is closed for this event.");
  }
}
