import assert from "node:assert/strict";
import test from "node:test";

import { buildAccountCredentialHtml } from "../lib/email/templates/account-credentials";
import { buildDirectorReadinessReminderHtml } from "../lib/email/templates/director-readiness-reminder";
import { buildRegistrationReceiptHtml } from "../lib/email/templates/registration-receipt";
import { generateRegistrationCode } from "../lib/registration-code";
import { canAccessTeacherPortal } from "../lib/teacher-portal";

test("email templates escape interpolated HTML content", () => {
  const registrationHtml = buildRegistrationReceiptHtml({
    clubName: "<North & West>",
    eventName: "\"Spring\" <Camp>",
    attendeeCount: 4,
  });

  assert.match(registrationHtml, /&lt;North &amp; West&gt;/);
  assert.match(registrationHtml, /&quot;Spring&quot; &lt;Camp&gt;/);
  assert.doesNotMatch(registrationHtml, /<North & West>/);

  const accountHtml = buildAccountCredentialHtml({
    recipientName: "Ava <Admin>",
    role: "SUPER_ADMIN & Reviewer",
    temporaryPassword: "pw\"'><",
    loginUrl: "https://example.org/login?next=<admin>",
  });

  assert.match(accountHtml, /Ava &lt;Admin&gt;/);
  assert.match(accountHtml, /SUPER_ADMIN &amp; Reviewer/);
  assert.match(accountHtml, /pw&quot;&#39;&gt;&lt;/);
  assert.match(accountHtml, /href="https:\/\/example\.org\/login\?next=&lt;admin&gt;"/);

  const readinessHtml = buildDirectorReadinessReminderHtml({
    clubName: "Club <One>",
    monthLabel: "March <2026>",
    items: ["Review <forms>", "Call & confirm"],
  });

  assert.match(readinessHtml, /Club &lt;One&gt; readiness reminder/);
  assert.match(readinessHtml, /March &lt;2026&gt;/);
  assert.match(readinessHtml, /<li>Review &lt;forms&gt;<\/li>/);
  assert.match(readinessHtml, /<li>Call &amp; confirm<\/li>/);
});

test("teacher portal access explicitly includes super admins", () => {
  assert.equal(canAccessTeacherPortal("STAFF_TEACHER"), true);
  assert.equal(canAccessTeacherPortal("SUPER_ADMIN"), true);
  assert.equal(canAccessTeacherPortal("CLUB_DIRECTOR"), false);
});

test("registration codes keep the expected prefix and uppercase suffix", () => {
  const code = generateRegistrationCode();

  assert.match(code, /^REG-[0-9A-Z]+-[0-9A-Z]{6}$/);
});
