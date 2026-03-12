# HOW-TO: Conference Super Admin Guide

This guide is for Conference Super Admins who configure events, forms, honors, reports, compliance sync, and portal access in CMMS.

---

## 1) Sign in as Super Admin

1. Open the CMMS login page.
2. Enter your Super Admin credentials.
3. After login, navigate to **Admin Dashboard**.

If access is denied, confirm your account role is `SUPER_ADMIN`.

---

## 2) Create a new event

Go to **Admin → Events → New Event** and complete all required fields.

### Event details you must configure

- Event Name
- Description (optional but recommended)
- Start and End dates
- Registration open and close dates
- Base price
- Late fee amount and late-fee start date
- Location name and address

### Practical setup sequence

1. Create event shell with dates and pricing.
2. Save event.
3. Add dynamic fields (next section).
4. Return to event page and verify status/timelines.

### Best practices

- Keep registration close date at least a few days before event start.
- Use clear event naming conventions (e.g., `Camporee 2027`).
- Ensure late fee window starts after normal registration opens.

---

## 3) Build dynamic registration forms

Dynamic fields let you collect event-specific data without deploying code changes.

Go to **Admin → Events → [Event]** and use the dynamic form builder.

### Supported field types

- `SHORT_TEXT` – free text answers
- `NUMBER` – numeric value
- `MULTI_SELECT` – list of options from JSON array
- `BOOLEAN` – yes/no
- `ROSTER_SELECT` – single member from club roster
- `ROSTER_MULTI_SELECT` – multiple members from roster
- `FIELD_GROUP` – section container for child questions

### Creating a good form structure

1. Add high-level `FIELD_GROUP` sections (e.g., Transport, Meals, Staffing).
2. Add child fields under each group.
3. Set the correct scope for each question:
   - registration/global for one answer per club registration
   - attendee-scoped for one answer per selected attendee
4. Mark required fields carefully.
5. For `MULTI_SELECT`, provide valid JSON options (e.g., `["Breakfast", "Lunch"]`).

### Validation notes

- Every field needs a unique key per event.
- `FIELD_GROUP` fields cannot be nested inside another group.
- `MULTI_SELECT` options must be a JSON array of non-empty strings.
- Required attendee-scoped fields must be answered for every selected attendee before submit/check-in approval.

---

## 4) Manage the master honors/class catalog

Go to **Admin → Catalog**.

The catalog defines classes/honors that can be offered at events.

### Typical catalog workflow

1. Add a class/honor title and unique code.
2. Set class type and active status.
3. Define requirement rules where needed.

### Requirement patterns to maintain

- Minimum age
- Required member role
- Prerequisite honor completion

### Catalog governance recommendations

- Use consistent code format (e.g., `HONOR-FIRSTAID-001`).
- Deactivate outdated items instead of deleting historical records.
- Review prerequisites annually before event season.

---

## 5) Pull operational reports

Go to **Admin → Events → [Event] → Reports → Operational**.

Operational reporting provides event-wide visibility such as:

- Clubs with submitted registrations
- Attendee totals and category breakdowns
- AV/equipment request summaries
- Exportable CSV data for planning teams

### Recommended usage cadence

- Weekly during early registration
- Daily during final registration week
- Final export before event operations briefing

---

## 6) Pull medical and dietary reports

Go to **Admin → Events → [Event] → Reports → Medical**.

This page produces event-wide manifests used by:

- Kitchen team (dietary restrictions)
- Medical staff (medical flags)
- Operations (emergency contact details)

### Output includes

- Attendee name, age, role, club
- Emergency contact information
- Medical flag or dietary details
- Print-friendly manifest format

### Handling guidance

- Treat these reports as sensitive data.
- Print only what is required.
- Collect and secure printed copies after event use.

---

## 7) Event oversight checklist (recommended)

Before registration opens:

- Event dates/pricing verified
- Dynamic form complete and tested
- Required fields reviewed for clarity
- Catalog offerings ready for assignment

Before registration closes:

- Operational reports reviewed
- Medical manifest reviewed for completeness
- Follow-up sent to clubs with missing submissions

Pre-event final:

- Export final operational CSVs
- Print or save final medical/dietary manifests
- Confirm check-in team has latest data

---

## 8) Compliance and portal management

### Compliance sync

Go to **Admin → Compliance**.

1. Select the exact club roster year.
2. Upload the Sterling CSV.
3. Review the preview buckets:
   - `Will Update`
   - `Skipped`
   - `Ambiguous`
4. Apply only after review.

Important:

- Ambiguous rows are blocked and require manual resolution.
- Matching is scoped to the selected roster year.
- Stored run history includes row-level audit details.

### Student/parent portal links

Go to **Admin → Users**.

- `STUDENT_PARENT` users only see students linked through explicit portal-link records.
- After yearly rollover, review and relink portal access as needed.
- Users without links will see an empty portal state.

## 9) Common admin mistakes to avoid

- Publishing event with missing registration window dates
- Using duplicate or unclear dynamic field keys
- Choosing the wrong scope for attendee questions
- Invalid `MULTI_SELECT` JSON option formatting
- Pulling reports before clubs submit registrations
- Sharing medical exports outside authorized staff
- Applying a compliance sync without reviewing ambiguous rows

## 10) Handover tips for incoming admin staff

- Document naming conventions for event fields and catalog codes.
- Keep one “template event” from prior year for cloning decisions.
- Maintain a shared SOP calendar for report pull deadlines.
- Store this guide with setup docs in your conference knowledge base.
