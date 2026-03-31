export type ClassAssignmentMember = {
  name: string;
  className: string;
};

export type ClassAssignmentTemplateProps = {
  eventName: string;
  clubName: string;
  members: ClassAssignmentMember[];
  classesUrl: string;
  contactEmail: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildClassAssignmentHtml(props: ClassAssignmentTemplateProps): string {
  const { eventName, clubName, members, classesUrl, contactEmail } = props;

  const safeEventName = escapeHtml(eventName);
  const safeClubName = escapeHtml(clubName);
  const safeClassesUrl = escapeHtml(classesUrl);
  const safeContactEmail = contactEmail ? escapeHtml(contactEmail) : null;

  const memberRows = members
    .map(
      (m) =>
        `<tr><td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;">${escapeHtml(m.name)}</td>` +
        `<td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;">${escapeHtml(m.className)}</td></tr>`,
    )
    .join("");

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
    <title>Class Assignments Ready</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f6f7fb;font-family:Arial,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:#0f172a;color:#ffffff;padding:20px 24px;font-size:20px;font-weight:700;">
                Class Assignments Ready
              </td>
            </tr>
            <tr>
              <td style="padding:24px;line-height:1.6;font-size:16px;">
                <p style="margin:0 0 20px;">Class assignments are ready for <strong>${safeClubName}</strong> at <strong>${safeEventName}</strong>.</p>

                <h2 style="margin:0 0 8px;font-size:16px;color:#0f172a;">Member Assignments (${members.length})</h2>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:20px;">
                  <thead>
                    <tr style="background:#f1f5f9;">
                      <th style="padding:6px 8px;text-align:left;font-weight:600;font-size:14px;">Member</th>
                      <th style="padding:6px 8px;text-align:left;font-weight:600;font-size:14px;">Class</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${memberRows}
                  </tbody>
                </table>

                <p style="margin:0;">
                  <a href="${safeClassesUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">View Class Assignments</a>
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
