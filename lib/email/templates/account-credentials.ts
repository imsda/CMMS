type BuildAccountCredentialHtmlInput = {
  recipientName: string;
  role: string;
  temporaryPassword: string;
  loginUrl: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildAccountCredentialHtml(input: BuildAccountCredentialHtmlInput) {
  const safeName = escapeHtml(input.recipientName);
  const safeRole = escapeHtml(input.role);
  const safePassword = escapeHtml(input.temporaryPassword);
  const safeLoginUrl = escapeHtml(input.loginUrl);

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a;">
      <p>Hello ${safeName},</p>
      <p>Your account for Club Management & Event Registration is ready.</p>
      <p><strong>Role:</strong> ${safeRole}</p>
      <p><strong>Temporary password:</strong> ${safePassword}</p>
      <p>
        Sign in at:
        <a href="${safeLoginUrl}" target="_blank" rel="noopener noreferrer">${safeLoginUrl}</a>
      </p>
      <p>Please sign in and change your password immediately.</p>
    </div>
  `;
}
