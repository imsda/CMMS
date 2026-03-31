import test from "node:test";
import assert from "node:assert/strict";

import { buildRegistrationApprovedHtml } from "../lib/email/registration-approved";
import { buildRevisionRequestedHtml } from "../lib/email/revision-requested";
import { buildClassAssignmentHtml } from "../lib/email/class-assignment";

// --- Registration Approved ---

const approvedBase = {
  eventName: "Spring Camporee",
  clubName: "Central Club",
  eventStartsAt: new Date("2026-04-10T12:00:00.000Z"),
  eventEndsAt: new Date("2026-04-12T18:00:00.000Z"),
  locationName: "Pine Grove Camp",
  locationAddress: "123 Forest Rd, Springfield, CA 90210",
  registrationUrl: "https://cmms.example.org/director/events/event-123",
  contactEmail: "conference@example.org",
};

test("registration approved email includes event name and club name", () => {
  const html = buildRegistrationApprovedHtml(approvedBase);
  assert.ok(html.includes("Spring Camporee"), "should include event name");
  assert.ok(html.includes("Central Club"), "should include club name");
});

test("registration approved email includes formatted dates", () => {
  const html = buildRegistrationApprovedHtml(approvedBase);
  assert.ok(html.includes("2026"), "should include year in dates");
  assert.ok(html.includes("April"), "should include month in dates");
});

test("registration approved email includes location", () => {
  const html = buildRegistrationApprovedHtml(approvedBase);
  assert.ok(html.includes("Pine Grove Camp"), "should include location name");
  assert.ok(html.includes("123 Forest Rd"), "should include location address");
});

test("registration approved email includes link to registration page", () => {
  const html = buildRegistrationApprovedHtml(approvedBase);
  assert.ok(
    html.includes("https://cmms.example.org/director/events/event-123"),
    "should include registration URL",
  );
});

test("registration approved email includes contact email", () => {
  const html = buildRegistrationApprovedHtml(approvedBase);
  assert.ok(html.includes("conference@example.org"), "should include contact email");
});

test("registration approved email handles missing location gracefully", () => {
  const html = buildRegistrationApprovedHtml({
    ...approvedBase,
    locationName: null,
    locationAddress: null,
  });
  assert.ok(html.includes("Spring Camporee"), "should still render event name");
});

test("registration approved email handles missing contact email gracefully", () => {
  const html = buildRegistrationApprovedHtml({
    ...approvedBase,
    contactEmail: null,
  });
  assert.ok(!html.includes("Questions?"), "should omit contact section when not configured");
});

test("registration approved email escapes HTML in event name", () => {
  const html = buildRegistrationApprovedHtml({
    ...approvedBase,
    eventName: "<script>alert('xss')</script>",
  });
  assert.ok(!html.includes("<script>"), "should not contain raw script tag");
  assert.ok(html.includes("&lt;script&gt;"), "should escape angle brackets");
});

test("registration approved email escapes HTML in club name", () => {
  const html = buildRegistrationApprovedHtml({
    ...approvedBase,
    clubName: "<b>Bad Club</b>",
  });
  assert.ok(!html.includes("<b>"), "should escape club name HTML");
});

// --- Revision Requested ---

const revisionBase = {
  eventName: "Spring Camporee",
  clubName: "Central Club",
  reason: "Missing medical consent forms for 2 attendees.",
  registrationUrl: "https://cmms.example.org/director/events/event-123",
  contactEmail: "conference@example.org",
};

test("revision requested email includes event name and club name", () => {
  const html = buildRevisionRequestedHtml(revisionBase);
  assert.ok(html.includes("Spring Camporee"), "should include event name");
  assert.ok(html.includes("Central Club"), "should include club name");
});

test("revision requested email includes the revision reason", () => {
  const html = buildRevisionRequestedHtml(revisionBase);
  assert.ok(
    html.includes("Missing medical consent forms for 2 attendees."),
    "should include revision reason",
  );
});

test("revision requested email includes link to registration page", () => {
  const html = buildRevisionRequestedHtml(revisionBase);
  assert.ok(
    html.includes("https://cmms.example.org/director/events/event-123"),
    "should include registration URL",
  );
});

test("revision requested email includes contact email", () => {
  const html = buildRevisionRequestedHtml(revisionBase);
  assert.ok(html.includes("conference@example.org"), "should include contact email");
});

test("revision requested email omits contact section when not configured", () => {
  const html = buildRevisionRequestedHtml({ ...revisionBase, contactEmail: null });
  assert.ok(!html.includes("Questions?"), "should omit contact section");
});

test("revision requested email escapes HTML in reason", () => {
  const html = buildRevisionRequestedHtml({
    ...revisionBase,
    reason: "<script>alert('xss')</script>",
  });
  assert.ok(!html.includes("<script>"), "should not contain raw script tag");
  assert.ok(html.includes("&lt;script&gt;"), "should escape angle brackets in reason");
});

// --- Class Assignment ---

const assignmentBase = {
  eventName: "Spring Camporee",
  clubName: "Central Club",
  members: [
    { name: "Alice Adventurer", className: "Cooking Honor" },
    { name: "Bob Builder", className: "Camping Honor" },
  ],
  classesUrl: "https://cmms.example.org/director/events/event-123/classes",
  contactEmail: "conference@example.org",
};

test("class assignment email includes event name and club name", () => {
  const html = buildClassAssignmentHtml(assignmentBase);
  assert.ok(html.includes("Spring Camporee"), "should include event name");
  assert.ok(html.includes("Central Club"), "should include club name");
});

test("class assignment email includes member names and class names", () => {
  const html = buildClassAssignmentHtml(assignmentBase);
  assert.ok(html.includes("Alice Adventurer"), "should include member name");
  assert.ok(html.includes("Bob Builder"), "should include member name");
  assert.ok(html.includes("Cooking Honor"), "should include class name");
  assert.ok(html.includes("Camping Honor"), "should include class name");
});

test("class assignment email includes correct member count", () => {
  const html = buildClassAssignmentHtml(assignmentBase);
  assert.ok(html.includes("2"), "should include member count");
});

test("class assignment email includes link to class assignments page", () => {
  const html = buildClassAssignmentHtml(assignmentBase);
  assert.ok(
    html.includes("https://cmms.example.org/director/events/event-123/classes"),
    "should include classes URL",
  );
});

test("class assignment email includes contact email", () => {
  const html = buildClassAssignmentHtml(assignmentBase);
  assert.ok(html.includes("conference@example.org"), "should include contact email");
});

test("class assignment email omits contact section when not configured", () => {
  const html = buildClassAssignmentHtml({ ...assignmentBase, contactEmail: null });
  assert.ok(!html.includes("Questions?"), "should omit contact section");
});

test("class assignment email escapes HTML in member name", () => {
  const html = buildClassAssignmentHtml({
    ...assignmentBase,
    members: [{ name: "<script>xss</script>", className: "Honor" }],
  });
  assert.ok(!html.includes("<script>"), "should escape member name HTML");
});

test("class assignment email escapes HTML in class name", () => {
  const html = buildClassAssignmentHtml({
    ...assignmentBase,
    members: [{ name: "Alice", className: "<b>Bold Class</b>" }],
  });
  assert.ok(!html.includes("<b>Bold Class</b>"), "should escape class name HTML");
});
