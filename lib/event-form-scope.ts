export type EventFieldOptionsMetadata = {
  attendeeSpecific?: boolean;
  scope?: "ATTENDEE" | "GLOBAL";
};

function isOptionsMetadata(value: unknown): value is EventFieldOptionsMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.attendeeSpecific !== "undefined" && typeof record.attendeeSpecific !== "boolean") {
    return false;
  }

  if (typeof record.scope !== "undefined" && record.scope !== "ATTENDEE" && record.scope !== "GLOBAL") {
    return false;
  }

  return true;
}

export function isAttendeeSpecificField(field: { key: string; description: string | null; options: unknown }) {
  if (field.key.startsWith("attendee_") || field.key.startsWith("member_")) {
    return true;
  }

  if (typeof field.description === "string" && field.description.toLowerCase().includes("[attendee]")) {
    return true;
  }

  if (field.options && typeof field.options === "object" && !Array.isArray(field.options)) {
    if (!isOptionsMetadata(field.options)) {
      return false;
    }

    return field.options.attendeeSpecific === true || field.options.scope === "ATTENDEE";
  }

  if (Array.isArray(field.options)) {
    return field.options.includes("__ATTENDEE_LIST__");
  }

  return false;
}
