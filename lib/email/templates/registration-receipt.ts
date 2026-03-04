export type RegistrationReceiptTemplateProps = {
  clubName: string;
  eventName: string;
  attendeeCount: number;
};

export function buildRegistrationReceiptHtml({
  clubName,
  eventName,
  attendeeCount,
}: RegistrationReceiptTemplateProps) {
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Event Registration Receipt</title>
      </head>
      <body style="margin:0;padding:0;background-color:#f6f7fb;font-family:Arial,sans-serif;color:#1f2937;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px;">
          <tr>
            <td align="center">
              <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="background:#0f172a;color:#ffffff;padding:20px 24px;font-size:20px;font-weight:700;">
                    Registration Confirmation
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px;line-height:1.6;font-size:16px;">
                    <p style="margin:0 0 16px;">Thank you for registering <strong>${clubName}</strong> for <strong>${eventName}</strong>.</p>
                    <p style="margin:0 0 12px;">Registration summary:</p>
                    <ul style="padding-left:20px;margin:0 0 24px;">
                      <li>Total attendees registered: <strong>${attendeeCount}</strong></li>
                    </ul>
                    <p style="margin:0;">If you need to make changes, return to the registration portal and resubmit your form.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}
