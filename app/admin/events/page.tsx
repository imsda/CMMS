import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { getAdminEventsIndexData } from "../../actions/admin-actions";
import { AdminPageHeader } from "../_components/admin-page-header";
import { getEventModeConfig } from "../../../lib/event-modes";

function formatDateRange(startsAt: Date, endsAt: Date, locale: string) {
  return `${startsAt.toLocaleDateString(locale)} - ${endsAt.toLocaleDateString(locale)}`;
}

export default async function AdminEventsPage() {
  const t = await getTranslations("Admin");
  const locale = await getLocale();
  const events = await getAdminEventsIndexData();

  return (
    <section className="space-y-6">
      <AdminPageHeader
        eyebrow={t("pages.events.eyebrow")}
        breadcrumbs={[{ label: t("breadcrumbs.admin"), href: "/admin/dashboard" }, { label: t("breadcrumbs.events") }]}
        title={t("pages.events.title")}
        description={t("pages.events.description")}
        primaryAction={
          <Link href="/admin/events/templates" className="btn-primary inline-flex">
            Template Library
          </Link>
        }
        secondaryActions={
          <>
            <Link href="/admin/events/new" className="btn-secondary inline-flex">
              {t("actions.createEvent")}
            </Link>
            <Link href="/admin/events/templates/new" className="btn-secondary inline-flex">
              Create Template
            </Link>
          </>
        }
      />

      <article className="glass-table table-shell overflow-hidden">
        {events.length === 0 ? (
          <p className="empty-state m-4 text-sm text-slate-600">{t("pages.events.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-3">{t("pages.events.columns.event")}</th>
                  <th className="px-4 py-3">{t("pages.events.columns.mode")}</th>
                  <th className="px-4 py-3">{t("pages.events.columns.dates")}</th>
                  <th className="px-4 py-3">{t("pages.events.columns.registration")}</th>
                  <th className="px-4 py-3">{t("pages.events.columns.location")}</th>
                  <th className="px-4 py-3">{t("pages.events.columns.clubs")}</th>
                  <th className="px-4 py-3">{t("pages.events.columns.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td className="px-4 py-3 text-slate-900">
                      <p className="font-semibold">{event.name}</p>
                      <p className="text-xs text-slate-500">{event.slug}</p>
                      <p className="mt-1 text-xs">
                        <span
                          className={`rounded-full px-2 py-0.5 font-semibold ${
                            event.eventStatus === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {t(`status.${event.eventStatus}`)}
                        </span>
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        {getEventModeConfig(event.eventMode).label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{formatDateRange(event.startsAt, event.endsAt, locale)}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <p>{formatDateRange(event.registrationOpensAt, event.registrationClosesAt, locale)}</p>
                      <p className="mt-1 text-xs">
                        <span
                          className={`rounded-full px-2 py-0.5 font-semibold ${
                            event.registrationWindowStatus === "OPEN"
                              ? "bg-emerald-100 text-emerald-700"
                              : event.registrationWindowStatus === "UPCOMING"
                                ? "bg-sky-100 text-sky-700"
                                : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {t(`status.${event.registrationWindowStatus}`)}
                        </span>
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{event.locationName ?? t("pages.events.tbd")}</td>
                    <td className="px-4 py-3 text-slate-700">{event._count.registrations}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Link
                          href={`/admin/events/${event.id}`}
                          className="btn-secondary px-3 py-1.5 text-xs"
                        >
                          {t("pages.events.buttons.openOverseer")}
                        </Link>
                        <Link
                          href={`/admin/events/${event.id}/edit`}
                          className="btn-secondary px-3 py-1.5 text-xs"
                        >
                          {t("pages.events.buttons.edit")}
                        </Link>
                        {event.eventMode === "CLASS_ASSIGNMENT" ? (
                          <Link
                            href={`/admin/events/${event.id}/classes`}
                            className="btn-secondary px-3 py-1.5 text-xs"
                          >
                            {t("pages.events.buttons.classes")}
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}
