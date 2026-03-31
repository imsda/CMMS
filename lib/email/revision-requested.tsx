export type RevisionRequestedTemplateProps = {
  eventName: string;
  clubName: string;
  reason: string;
  registrationUrl: string;
  contactEmail: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildRevisionRequestedHtml(props: RevisionRequestedTemplateProps): string {
  const { eventName, clubName, reason, registrationUrl, contactEmail } = props;

  const safeEventName = escapeHtml(eventName);
  const safeClubName = escapeHtml(clubName);
  const safeReason = escapeHtml(reason);
  const safeRegistrationUrl = escapeHtml(registrationUrl);
  const safeContactEmail = contactEmail ? escapeHtml(contactEmail) : null;

  const contactSection = safeContactEmail
    ? `<p style="margin:24px 0 0;color:#6b7280;font-size:14px;border-top:1px solid #e5e7eb;padding-top:16px;">` +
      `Questions? Contact us at <a href="mailto:${safeContactEmail}" style="color:#0f172a;">${safeContactEmail}</a>.` +
      `</p>`
    : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Action Required: Registration Needs Changes</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f6f7fb;font-family:Arial,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:#92400e;color:#ffffff;padding:20px 24px;font-size:20px;font-weight:700;">
                Action Required: Registration Needs Changes
              </td>
            </tr>
            <tr>
              <td style="padding:24px;line-height:1.6;font-size:16px;">
                <p style="margin:0 0 20px;">The registration for <strong>${safeClubName}</strong> for <strong>${safeEventName}</strong> requires changes before it can be approved.</p>

                <h2 style="margin:0 0 8px;font-size:16px;color:#0f172a;">Reason</h2>
                <p style="margin:0 0 20px;padding:12px 16px;background:#fef3c7;border-left:4px solid #d97706;border-radius:4px;">${safeReason}</p>

                <p style="margin:0 0 16px;">Please log in to review your registration and make the necessary corrections.</p>

                <p style="margin:0;">
                  <a href="${safeRegistrationUrl}" style="display:inline-block;background:#92400e;color:#ffffff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">Update Registration</a>
                </p>

                ${contactSection}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
