import { buildRegistrationConfirmationHtml, type RegistrationConfirmationAttendee } from "./registration-confirmation";
import { buildRegistrationReceiptHtml } from "./templates/registration-receipt";
import { buildAccountCredentialHtml } from "./templates/account-credentials";

type SendRegistrationReceiptInput = {
  to: string;
  clubName: string;
  eventName: string;
  attendeeCount: number;
};

type SendAccountCredentialInput = {
  to: string;
  recipientName: string;
  role: string;
  temporaryPassword: string;
  loginUrl: string;
};

type SendRegistrationConfirmationInput = {
  to: string;
  eventName: string;
  eventStartsAt: Date;
  eventEndsAt: Date;
  locationName: string | null;
  locationAddress: string | null;
  attendees: RegistrationConfirmationAttendee[];
  totalDue: number;
  paymentStatus: string;
  eventId: string;
  pdfAttachment?: { filename: string; content: string } | null;
};

type SendDirectorReadinessReminderInput = {
  to: string;
  clubName: string;
  monthLabel: string;
  items: string[];
};

function normalizeEnvValue(value: string | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    const unquoted = trimmed.slice(1, -1).trim();
    return unquoted.length > 0 ? unquoted : null;
  }

  return trimmed;
}

export function getResendConfig() {
  const apiKey = normalizeEnvValue(process.env.RESEND_API_KEY);
  const from = normalizeEnvValue(process.env.RESEND_FROM_EMAIL);

  if (!apiKey || !from) {
    return null;
  }

  return { apiKey, from };
}

export async function sendRegistrationReceiptEmail(input: SendRegistrationReceiptInput) {
  const config = getResendConfig();

  if (!config) {
    console.warn("Skipping registration receipt email because RESEND_API_KEY or RESEND_FROM_EMAIL is not configured.");
    return;
  }

  const html = buildRegistrationReceiptHtml({
    clubName: input.clubName,
    eventName: input.eventName,
    attendeeCount: input.attendeeCount,
  });

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.from,
      to: [input.to],
      subject: `Registration receipt: ${input.eventName}`,
      html,
    }),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Failed to send registration receipt email: ${response.status} ${payload}`);
  }
}

export async function sendRegistrationConfirmationEmail(input: SendRegistrationConfirmationInput) {
  const config = getResendConfig();

  if (!config) {
    console.warn("Skipping registration confirmation email because RESEND_API_KEY or RESEND_FROM_EMAIL is not configured.");
    return;
  }

  const contactEmail = normalizeEnvValue(process.env.CONFERENCE_CONTACT_EMAIL);
  const appUrl = normalizeEnvValue(process.env.NEXT_PUBLIC_APP_URL) ?? "http://localhost:3000";

  const html = buildRegistrationConfirmationHtml({
    eventName: input.eventName,
    eventStartsAt: input.eventStartsAt,
    eventEndsAt: input.eventEndsAt,
    locationName: input.locationName,
    locationAddress: input.locationAddress,
    attendees: input.attendees,
    totalDue: input.totalDue,
    paymentStatus: input.paymentStatus,
    eventId: input.eventId,
    appUrl,
    contactEmail,
  });

  const body: Record<string, unknown> = {
    from: config.from,
    to: [input.to],
    subject: `Registration confirmed: ${input.eventName}`,
    html,
  };

  if (input.pdfAttachment) {
    body.attachments = [
      {
        filename: input.pdfAttachment.filename,
        content: input.pdfAttachment.content,
      },
    ];
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Failed to send registration confirmation email: ${response.status} ${payload}`);
  }
}

export async function sendAccountCredentialEmail(input: SendAccountCredentialInput) {
  const config = getResendConfig();

  if (!config) {
    return {
      sent: false,
      error: "RESEND_API_KEY or RESEND_FROM_EMAIL is not configured.",
    };
  }

  const html = buildAccountCredentialHtml({
    recipientName: input.recipientName,
    role: input.role,
    temporaryPassword: input.temporaryPassword,
    loginUrl: input.loginUrl,
  });

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.from,
      to: [input.to],
      subject: "Your account access details",
      html,
    }),
  });

  if (!response.ok) {
    const payload = await response.text();
    return {
      sent: false,
      error: `Failed to send credential email: ${response.status} ${payload}`.slice(0, 500),
    };
  }

  return {
    sent: true,
    error: null,
  };
}

export async function sendDirectorReadinessReminderEmail(input: SendDirectorReadinessReminderInput) {
  const config = getResendConfig();

  if (!config) {
    return {
      sent: false,
      error: "RESEND_API_KEY or RESEND_FROM_EMAIL is not configured.",
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.from,
      to: [input.to],
      subject: `${input.clubName} readiness reminder`,
      html: `
        <h1>${input.clubName} readiness reminder</h1>
        <p>Here are the current items needing attention for ${input.monthLabel}:</p>
        <ul>${input.items.map((item) => `<li>${item}</li>`).join("")}</ul>
      `,
    }),
  });

  if (!response.ok) {
    const payload = await response.text();
    return {
      sent: false,
      error: `Failed to send readiness reminder email: ${response.status} ${payload}`.slice(0, 500),
    };
  }

  return {
    sent: true,
    error: null,
  };
}
