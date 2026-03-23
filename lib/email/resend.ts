import { buildRegistrationConfirmationHtml, type RegistrationConfirmationAttendee } from "./registration-confirmation";
import { buildRegistrationReceiptHtml } from "./templates/registration-receipt";
import { buildAccountCredentialHtml } from "./templates/account-credentials";
import { buildRegistrationApprovedHtml } from "./registration-approved";
import { buildRevisionRequestedHtml } from "./revision-requested";
import { buildClassAssignmentHtml, type ClassAssignmentMember } from "./class-assignment";

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
};

type SendRegistrationApprovedInput = {
  to: string;
  eventName: string;
  clubName: string;
  eventStartsAt: Date;
  eventEndsAt: Date;
  locationName: string | null;
  locationAddress: string | null;
  registrationUrl: string;
};

type SendRevisionRequestedInput = {
  to: string;
  eventName: string;
  clubName: string;
  reason: string;
  registrationUrl: string;
};

type SendClassAssignmentInput = {
  to: string;
  eventName: string;
  clubName: string;
  members: ClassAssignmentMember[];
  classesUrl: string;
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

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.from,
      to: [input.to],
      subject: `Registration confirmed: ${input.eventName}`,
      html,
    }),
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

export async function sendRegistrationApprovedEmail(input: SendRegistrationApprovedInput) {
  const config = getResendConfig();

  if (!config) {
    console.warn("Skipping registration approved email because RESEND_API_KEY or RESEND_FROM_EMAIL is not configured.");
    return;
  }

  const contactEmail = normalizeEnvValue(process.env.CONFERENCE_CONTACT_EMAIL);
  const appUrl = normalizeEnvValue(process.env.NEXT_PUBLIC_APP_URL) ?? "http://localhost:3000";

  const html = buildRegistrationApprovedHtml({
    eventName: input.eventName,
    clubName: input.clubName,
    eventStartsAt: input.eventStartsAt,
    eventEndsAt: input.eventEndsAt,
    locationName: input.locationName,
    locationAddress: input.locationAddress,
    registrationUrl: input.registrationUrl.startsWith("http") ? input.registrationUrl : `${appUrl}${input.registrationUrl}`,
    contactEmail,
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
      subject: `Registration approved: ${input.eventName}`,
      html,
    }),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Failed to send registration approved email: ${response.status} ${payload}`);
  }
}

export async function sendRevisionRequestedEmail(input: SendRevisionRequestedInput) {
  const config = getResendConfig();

  if (!config) {
    console.warn("Skipping revision requested email because RESEND_API_KEY or RESEND_FROM_EMAIL is not configured.");
    return;
  }

  const contactEmail = normalizeEnvValue(process.env.CONFERENCE_CONTACT_EMAIL);
  const appUrl = normalizeEnvValue(process.env.NEXT_PUBLIC_APP_URL) ?? "http://localhost:3000";

  const html = buildRevisionRequestedHtml({
    eventName: input.eventName,
    clubName: input.clubName,
    reason: input.reason,
    registrationUrl: input.registrationUrl.startsWith("http") ? input.registrationUrl : `${appUrl}${input.registrationUrl}`,
    contactEmail,
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
      subject: `Action required: ${input.eventName} registration needs changes`,
      html,
    }),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Failed to send revision requested email: ${response.status} ${payload}`);
  }
}

export async function sendClassAssignmentEmail(input: SendClassAssignmentInput) {
  const config = getResendConfig();

  if (!config) {
    console.warn("Skipping class assignment email because RESEND_API_KEY or RESEND_FROM_EMAIL is not configured.");
    return;
  }

  const contactEmail = normalizeEnvValue(process.env.CONFERENCE_CONTACT_EMAIL);
  const appUrl = normalizeEnvValue(process.env.NEXT_PUBLIC_APP_URL) ?? "http://localhost:3000";

  const html = buildClassAssignmentHtml({
    eventName: input.eventName,
    clubName: input.clubName,
    members: input.members,
    classesUrl: input.classesUrl.startsWith("http") ? input.classesUrl : `${appUrl}${input.classesUrl}`,
    contactEmail,
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
      subject: `Class assignments ready: ${input.eventName}`,
      html,
    }),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Failed to send class assignment email: ${response.status} ${payload}`);
  }
}

type SendTltApplicationDecisionInput = {
  to: string;
  directorName: string;
  clubName: string;
  applicantName: string;
  decision: "APPROVED" | "REJECTED";
};

export async function sendTltApplicationDecisionEmail(input: SendTltApplicationDecisionInput) {
  const config = getResendConfig();

  if (!config) {
    console.warn("Skipping TLT decision email because RESEND_API_KEY or RESEND_FROM_EMAIL is not configured.");
    return;
  }

  const appUrl = normalizeEnvValue(process.env.NEXT_PUBLIC_APP_URL) ?? "http://localhost:3000";
  const isApproved = input.decision === "APPROVED";
  const decisionLabel = isApproved ? "Approved" : "Denied";
  const accentColor = isApproved ? "#16a34a" : "#dc2626";

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>TLT Application ${decisionLabel}</title>
      </head>
      <body style="margin:0;padding:0;background-color:#f6f7fb;font-family:Arial,sans-serif;color:#1f2937;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px;">
          <tr>
            <td align="center">
              <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="background:#0f172a;color:#ffffff;padding:20px 24px;font-size:20px;font-weight:700;">
                    TLT Application ${decisionLabel}
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px;line-height:1.6;font-size:16px;">
                    <p style="margin:0 0 16px;">Hi ${input.directorName},</p>
                    <p style="margin:0 0 16px;">
                      The TLT application for <strong>${input.applicantName}</strong> from <strong>${input.clubName}</strong>
                      has been <span style="color:${accentColor};font-weight:700;">${decisionLabel.toUpperCase()}</span>.
                    </p>
                    <p style="margin:0 0 24px;">
                      You can view the updated application status in the director portal.
                    </p>
                    <a href="${appUrl}/director/tlt" style="display:inline-block;background:#0f172a;color:#ffffff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
                      View TLT Applications
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.from,
      to: [input.to],
      subject: `TLT application ${decisionLabel.toLowerCase()}: ${input.applicantName}`,
      html,
    }),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Failed to send TLT decision email: ${response.status} ${payload}`);
  }
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
