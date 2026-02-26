import { buildRegistrationReceiptHtml } from "./templates/registration-receipt";

type SendRegistrationReceiptInput = {
  to: string;
  clubName: string;
  eventName: string;
  attendeeCount: number;
};

function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

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
