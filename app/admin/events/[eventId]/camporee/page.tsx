import Link from "next/link";
import { notFound } from "next/navigation";
import { RegistrationStatus } from "@prisma/client";

import { getCamporeeDashboardData, saveCamporeeScore } from "../../../../actions/camporee-actions";
import {
  getCamporeeOperationsDashboard,
  updateCamporeeRegistrationStatus,
} from "../../../../actions/camporee-registration-actions";
import { formatCamporeeRegistrationStatus } from "../../../../../lib/camporee-workflow";
import { buildCsvHref, slugifyFilenamePart } from "../../../../../lib/csv";
import { AdminPageHeader } from "../../../_components/admin-page-header";

type CamporeePageProps = {
  params: Promise<{
    eventId: string;
  }>;
};

function formatDateRange(startsAt: Date, endsAt: Date) {
  return `${startsAt.toLocaleDateString()} - ${endsAt.toLocaleDateString()}`;
}

function formatDateTime(value: Date | null) {
  return value ? value.toLocaleString() : "TBD";
}

function getCamporeeStatusTone(status: RegistrationStatus) {
  switch (status) {
    case RegistrationStatus.APPROVED:
      return "status-chip-success";
    case RegistrationStatus.NEEDS_CHANGES:
      return "status-chip-danger";
    case RegistrationStatus.REVIEWED:
      return "status-chip-warning";
    case RegistrationStatus.SUBMITTED:
      return "status-chip-neutral";
    case RegistrationStatus.DRAFT:
    default:
      return "status-chip-neutral";
  }
}

export default async function CamporeePage({ params }: CamporeePageProps) {
  const { eventId } = await params;
  const operations = await getCamporeeOperationsDashboard(eventId);
  const scoring = await getCamporeeDashboardData(eventId);

  if (!operations || !scoring) {
    notFound();
  }

  const fileBase = `${slugifyFilenamePart(operations.event.name)}-camporee`;
  const summaryCsvHref = buildCsvHref([
    ["Club", "Code", "Status", "Attendees", "Primary Contact", "Primary Phone", "Reviewer Notes", "Revision Reason"],
    ...operations.registrations.map((registration) => [
      registration.club.name,
      registration.club.code,
      formatCamporeeRegistrationStatus(registration.status),
      registration.attendees.length,
      registration.camporeeRegistration?.primaryContactName ?? "",
      registration.camporeeRegistration?.primaryContactPhone ?? "",
      registration.reviewerNotes ?? "",
      registration.revisionRequestedReason ?? "",
    ]),
  ]);
  const campsiteCsvHref = buildCsvHref([
    ["Club", "Code", "District", "Type", "Square Footage", "Tent Summary", "Trailers", "Kitchen Canopies", "Camp Near", "Notes"],
    ...operations.registrations.map((registration) => [
      registration.club.name,
      registration.club.code,
      registration.club.district ?? "",
      registration.camporeeRegistration?.campsiteType ?? "",
      registration.camporeeRegistration?.squareFootageNeeded ?? 0,
      registration.camporeeRegistration?.tentSummary ?? "",
      registration.camporeeRegistration?.trailerCount ?? 0,
      registration.camporeeRegistration?.kitchenCanopyCount ?? 0,
      registration.camporeeRegistration?.campNearRequest ?? "",
      registration.camporeeRegistration?.campsiteNotes ?? "",
    ]),
  ]);
  const arrivalCsvHref = buildCsvHref([
    ["Club", "Code", "Arrival", "Departure", "Vehicles", "Transport Summary", "Arrival Notes"],
    ...operations.registrations.map((registration) => [
      registration.club.name,
      registration.club.code,
      registration.camporeeRegistration?.arrivalDateTime?.toISOString() ?? "",
      registration.camporeeRegistration?.departureDateTime?.toISOString() ?? "",
      registration.camporeeRegistration?.vehicleCount ?? 0,
      registration.camporeeRegistration?.transportSummary ?? "",
      registration.camporeeRegistration?.arrivalNotes ?? "",
    ]),
  ]);
  const mealCsvHref = buildCsvHref([
    ["Club", "Code", "Meal Plan", "Sabbath Supper", "Sunday Breakfast", "Water Service", "Food Notes", "Dietary Notes"],
    ...operations.registrations.map((registration) => [
      registration.club.name,
      registration.club.code,
      registration.camporeeRegistration?.mealPlan ?? "",
      registration.camporeeRegistration?.sabbathSupperCount ?? 0,
      registration.camporeeRegistration?.sundayBreakfastCount ?? 0,
      registration.camporeeRegistration?.waterServiceNeeded ? "Yes" : "No",
      registration.camporeeRegistration?.foodPlanningNotes ?? "",
      registration.camporeeRegistration?.dietaryNotes ?? "",
    ]),
  ]);
  const emergencyCsvHref = buildCsvHref([
    ["Club", "Code", "Emergency Contact", "Phone", "Meeting Point", "Medication Notes", "Emergency Notes"],
    ...operations.registrations.map((registration) => [
      registration.club.name,
      registration.club.code,
      registration.camporeeRegistration?.emergencyContactName ?? "",
      registration.camporeeRegistration?.emergencyContactPhone ?? "",
      registration.camporeeRegistration?.emergencyMeetingPoint ?? "",
      registration.camporeeRegistration?.medicationStorageNotes ?? "",
      registration.camporeeRegistration?.emergencyNotes ?? "",
    ]),
  ]);

  return (
    <section className="space-y-6">
      <AdminPageHeader
        eyebrow="Camporee Operations"
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Events", href: "/admin/events" },
          { label: operations.event.name, href: `/admin/events/${operations.event.id}` },
          { label: "Camporee" },
        ]}
        title={operations.event.name}
        description={`Operational registration dashboard for ${formatDateRange(scoring.event.startsAt, scoring.event.endsAt)}.`}
        secondaryActions={
          <>
            <Link href={`/admin/events/${operations.event.id}`} className="btn-secondary">
              Event Overview
            </Link>
            <Link href={`/admin/events/${operations.event.id}/checkin`} className="btn-secondary">
              Open Check-in
            </Link>
          </>
        }
      />

      <article className="workflow-studio">
        <div className="workflow-header">
          <div>
            <p className="hero-kicker">Operations Packet</p>
            <h2 className="section-title">Camporee summaries and exports</h2>
            <p className="section-copy">Download field-ready summaries for planning, campsite allocation, meals, arrival, and emergency coordination.</p>
          </div>
          <div className="workflow-actions">
            <a href={summaryCsvHref} download={`${fileBase}-summary.csv`} className="btn-secondary">Registration Summary CSV</a>
            <a href={campsiteCsvHref} download={`${fileBase}-campsites.csv`} className="btn-secondary">Campsite CSV</a>
            <a href={arrivalCsvHref} download={`${fileBase}-arrivals.csv`} className="btn-secondary">Arrival CSV</a>
            <a href={mealCsvHref} download={`${fileBase}-meals.csv`} className="btn-secondary">Meal CSV</a>
            <a href={emergencyCsvHref} download={`${fileBase}-emergency.csv`} className="btn-secondary">Emergency CSV</a>
          </div>
        </div>
      </article>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Clubs Registered</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{operations.totals.clubs}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Attendees</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{operations.totals.attendees}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Awaiting Review</p>
          <p className="mt-2 text-3xl font-semibold text-amber-700">{operations.totals.waitForReview}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Approved</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-700">{operations.totals.approved}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Square Footage</p>
          <p className="mt-2 text-3xl font-semibold text-indigo-700">{operations.totals.squareFootage}</p>
        </article>
      </div>

      <section className="workflow-studio">
        <div className="workflow-header">
          <div>
            <p className="hero-kicker">Review Studio</p>
            <h2 className="section-title">Registration review queue</h2>
            <p className="section-copy">Review submissions, request changes, or approve Camporee registration packages for operational planning.</p>
          </div>
          <div className="workflow-actions">
            <span className="status-chip-warning">{operations.totals.waitForReview} awaiting review</span>
            <span className="status-chip-success">{operations.totals.approved} approved</span>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
          {operations.registrations.length === 0 ? (
            <div className="workflow-card-muted xl:col-span-2">
              <p className="text-sm text-slate-600">No Camporee registrations have been started yet.</p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {operations.registrations.map((registration) => (
                  <article key={registration.id} className="workflow-card-muted">
                    <div className="workflow-header">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-slate-900">{registration.club.name}</h3>
                          <span className={getCamporeeStatusTone(registration.status)}>
                            {formatCamporeeRegistrationStatus(registration.status)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {registration.club.code} • {registration.registrationCode} • {registration.attendees.length} attendee{registration.attendees.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="text-right text-sm text-slate-600">
                        <p>{registration.camporeeRegistration?.primaryContactName ?? "No contact set"}</p>
                        <p className="text-xs text-slate-500">{registration.camporeeRegistration?.primaryContactPhone ?? "No phone"}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Campsite</p>
                        <p className="mt-2 text-sm text-slate-900">{registration.camporeeRegistration?.campsiteType ?? "Pending"}</p>
                        <p className="mt-1 text-xs text-slate-500">{registration.camporeeRegistration?.squareFootageNeeded ?? 0} sq ft requested</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Arrival</p>
                        <p className="mt-2 text-sm text-slate-900">{formatDateTime(registration.camporeeRegistration?.arrivalDateTime ?? null)}</p>
                        <p className="mt-1 text-xs text-slate-500">{registration.camporeeRegistration?.vehicleCount ?? 0} vehicle(s)</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Emergency Contact</p>
                        <p className="mt-2 text-sm text-slate-900">{registration.camporeeRegistration?.emergencyContactName ?? "Pending"}</p>
                        <p className="mt-1 text-xs text-slate-500">{registration.camporeeRegistration?.emergencyContactPhone ?? "No phone"}</p>
                      </div>
                    </div>

                    <form action={updateCamporeeRegistrationStatus} className="mt-4 space-y-3">
                      <input type="hidden" name="eventId" value={eventId} readOnly />
                      <input type="hidden" name="eventRegistrationId" value={registration.id} readOnly />
                      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
                        <textarea
                          name="reviewerNotes"
                          rows={3}
                          defaultValue={registration.reviewerNotes ?? ""}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          placeholder="Reviewer notes"
                        />
                        <textarea
                          name="revisionRequestedReason"
                          rows={3}
                          defaultValue={registration.revisionRequestedReason ?? ""}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          placeholder="Revision reason when sending back for changes"
                        />
                        <div className="flex flex-col gap-2">
                          {registration.status !== RegistrationStatus.REVIEWED ? (
                            <button type="submit" name="nextStatus" value={RegistrationStatus.REVIEWED} className="btn-secondary">Mark Reviewed</button>
                          ) : null}
                          {registration.status !== RegistrationStatus.NEEDS_CHANGES ? (
                            <button type="submit" name="nextStatus" value={RegistrationStatus.NEEDS_CHANGES} className="btn-secondary">Needs Changes</button>
                          ) : null}
                          {registration.status !== RegistrationStatus.APPROVED ? (
                            <button type="submit" name="nextStatus" value={RegistrationStatus.APPROVED} className="btn-primary">Approve</button>
                          ) : null}
                        </div>
                      </div>
                    </form>
                  </article>
                ))}
              </div>

              <aside className="space-y-4">
                <article className="workflow-card">
                  <h3 className="text-base font-semibold text-slate-900">Review guide</h3>
                  <p className="mt-2 text-sm text-slate-600">Use reviewer notes for operational feedback and revision reasons only when sending a club back for changes.</p>
                  <div className="mt-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                      <span>Submitted / Draft</span>
                      <span className="status-chip-neutral">Initial intake</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                      <span>Reviewed</span>
                      <span className="status-chip-warning">Ops checked</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                      <span>Needs Changes</span>
                      <span className="status-chip-danger">Director action</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                      <span>Approved</span>
                      <span className="status-chip-success">Ready for planning</span>
                    </div>
                  </div>
                </article>

                <article className="workflow-card">
                  <h3 className="text-base font-semibold text-slate-900">Operational focus</h3>
                  <ul className="mt-3 space-y-2 text-sm text-slate-600">
                    <li>Confirm campsite footprint before assigning adjacent clubs.</li>
                    <li>Verify arrival plans and vehicle counts for gate and parking prep.</li>
                    <li>Use meal and emergency exports as printable planning references.</li>
                  </ul>
                </article>
              </aside>
            </>
          )}
        </div>
      </section>

      <section className="workflow-studio">
        <div className="workflow-header">
          <div>
            <p className="hero-kicker">Planning Views</p>
            <h2 className="section-title">Operational planning reports</h2>
            <p className="section-copy">Keep all the dense planning tables, but organize them by operational use so admins can move quickly between campsite, travel, meals, participation, and safety.</p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
        <article className="workflow-card-muted">
          <h2 className="text-xl font-semibold text-slate-900">Campsite Needs</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">Club</th>
                  <th className="px-4 py-3">District</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Sq Ft</th>
                  <th className="px-4 py-3">Trailers</th>
                  <th className="px-4 py-3">Camp Near</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {operations.registrations.map((registration) => (
                  <tr key={`${registration.id}-campsite`}>
                    <td className="px-4 py-3 text-slate-900">{registration.club.name}</td>
                    <td className="px-4 py-3 text-slate-700">{registration.club.district ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{registration.camporeeRegistration?.campsiteType}</td>
                    <td className="px-4 py-3 text-slate-700">{registration.camporeeRegistration?.squareFootageNeeded}</td>
                    <td className="px-4 py-3 text-slate-700">{registration.camporeeRegistration?.trailerCount}</td>
                    <td className="px-4 py-3 text-slate-700">{registration.camporeeRegistration?.campNearRequest ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="workflow-card-muted">
          <h2 className="text-xl font-semibold text-slate-900">Arrival Planning</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">Club</th>
                  <th className="px-4 py-3">Arrival</th>
                  <th className="px-4 py-3">Departure</th>
                  <th className="px-4 py-3">Vehicles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {operations.registrations.map((registration) => (
                  <tr key={`${registration.id}-arrival`}>
                    <td className="px-4 py-3 text-slate-900">{registration.club.name}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDateTime(registration.camporeeRegistration?.arrivalDateTime ?? null)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDateTime(registration.camporeeRegistration?.departureDateTime ?? null)}</td>
                    <td className="px-4 py-3 text-slate-700">{registration.camporeeRegistration?.vehicleCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="workflow-card-muted">
          <h2 className="text-xl font-semibold text-slate-900">Meal Planning</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">Club</th>
                  <th className="px-4 py-3">Meal Plan</th>
                  <th className="px-4 py-3">Sabbath Supper</th>
                  <th className="px-4 py-3">Sunday Breakfast</th>
                  <th className="px-4 py-3">Water</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {operations.registrations.map((registration) => (
                  <tr key={`${registration.id}-meals`}>
                    <td className="px-4 py-3 text-slate-900">{registration.club.name}</td>
                    <td className="px-4 py-3 text-slate-700">{registration.camporeeRegistration?.mealPlan ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{registration.camporeeRegistration?.sabbathSupperCount ?? 0}</td>
                    <td className="px-4 py-3 text-slate-700">{registration.camporeeRegistration?.sundayBreakfastCount ?? 0}</td>
                    <td className="px-4 py-3 text-slate-700">{registration.camporeeRegistration?.waterServiceNeeded ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="workflow-card-muted">
          <h2 className="text-xl font-semibold text-slate-900">Participation Planning</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">Club</th>
                  <th className="px-4 py-3">Duty Preferences</th>
                  <th className="px-4 py-3">Highlights</th>
                  <th className="px-4 py-3">First Aid / Staff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {operations.registrations.map((registration) => (
                  <tr key={`${registration.id}-participation`}>
                    <td className="px-4 py-3 text-slate-900">{registration.club.name}</td>
                    <td className="px-4 py-3 text-slate-700">{registration.camporeeRegistration?.dutyPreferences.join(", ") || "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{registration.camporeeRegistration?.participationHighlights.join(", ") || "—"}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {registration.camporeeRegistration?.firstAidCertifiedCount} / {registration.camporeeRegistration?.leadershipStaffCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="workflow-card-muted">
          <h2 className="text-xl font-semibold text-slate-900">Emergency Contacts</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">Club</th>
                  <th className="px-4 py-3">Emergency Contact</th>
                  <th className="px-4 py-3">Meeting Point</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {operations.registrations.map((registration) => (
                  <tr key={`${registration.id}-emergency`}>
                    <td className="px-4 py-3 text-slate-900">{registration.club.name}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <p>{registration.camporeeRegistration?.emergencyContactName}</p>
                      <p className="text-xs text-slate-500">{registration.camporeeRegistration?.emergencyContactPhone}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{registration.camporeeRegistration?.emergencyMeetingPoint ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{registration.camporeeRegistration?.emergencyNotes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
        </div>
      </section>

      <article className="workflow-studio">
        <div className="workflow-header">
          <div>
            <p className="hero-kicker">Competition Add-On</p>
            <h2 className="section-title">Competition scoring</h2>
            <p className="section-copy">
              Scoring remains additive and separate from operational registration review.
            </p>
          </div>
        </div>

        {scoring.event.registrations.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No submitted or approved registrations are available for Camporee scoring yet.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {scoring.event.registrations.map((registration) => (
              <div key={registration.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-4">
                  <p className="text-base font-semibold text-slate-900">{registration.club.name}</p>
                  <p className="text-xs text-slate-500">
                    {registration.club.code} • {registration.registrationCode} • {registration.attendees.length} attendee
                    {registration.attendees.length === 1 ? "" : "s"} • {registration.status}
                  </p>
                </div>

                <form action={saveCamporeeScore} className="grid gap-3 md:grid-cols-4">
                  <input type="hidden" name="eventId" value={scoring.event.id} />
                  <input type="hidden" name="registrationId" value={registration.id} />
                  <label className="space-y-1 text-sm text-slate-700">
                    <span>Category</span>
                    <input name="category" type="text" list="camporee-category-suggestions" required className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Drill, Inspection, Pioneering..." />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span>Score</span>
                    <input name="score" type="number" min="0" step="0.1" required className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="95" />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
                    <span>Notes</span>
                    <input name="notes" type="text" className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Optional scoring note" />
                  </label>
                  <div className="md:col-span-4">
                    <button type="submit" className="btn-secondary">Save Score</button>
                  </div>
                </form>
              </div>
            ))}
          </div>
        )}

        <datalist id="camporee-category-suggestions">
          {scoring.categories.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>
      </article>
    </section>
  );
}
