export function normalizeReviewerText(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function requireRevisionReason(value: FormDataEntryValue | null, label = "Revision reason") {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }

  return value.trim();
}
