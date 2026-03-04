const progressSteps = [
  { label: "Rollover roster", status: "Complete" },
  { label: "Select event attendees", status: "In progress" },
  { label: "Assign honors/classes", status: "Pending" },
  { label: "Review + submit", status: "Pending" },
];

const quickStats = [
  { label: "Active members", value: "61", detail: "+4 since last year" },
  { label: "Camporee attendees", value: "47", detail: "14 not yet selected" },
  { label: "Class seats left", value: "32", detail: "Across 8 sessions" },
  { label: "Forms completion", value: "78%", detail: "Spiritual Milestones left" },
];

const alerts = [
  "2 students are double-booked Saturday 10:00 AM.",
  "Medical flags missing for 3 newly added members.",
  "Meal sponsorship form closes in 2 days.",
];

const upcomingItems = [
  {
    title: "Spring Camporee 2026",
    window: "Registration closes Mar 21, 2026",
    status: "Open",
  },
  {
    title: "Honors Weekend",
    window: "Opens Apr 10, 2026",
    status: "Upcoming",
  },
];

export default function ClubDirectorDashboardPage() {
  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Club Director Dashboard</p>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
            Cedar Rapids Pathfinders
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Welcome back! Continue your event setup with the guided workflow.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-indigo-300 hover:text-indigo-700">
            View roster
          </button>
          <button className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500">
            Continue registration
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {quickStats.map((stat) => (
          <article
            key={stat.label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-slate-500">{stat.label}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{stat.value}</p>
            <p className="mt-2 text-xs font-medium text-emerald-600">{stat.detail}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Registration Progress</h3>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              2 / 4 complete
            </span>
          </div>
          <ol className="space-y-3">
            {progressSteps.map((step, index) => (
              <li
                key={step.label}
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium text-slate-700">{step.label}</span>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    step.status === "Complete"
                      ? "bg-emerald-50 text-emerald-700"
                      : step.status === "In progress"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {step.status}
                </span>
              </li>
            ))}
          </ol>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Action Alerts</h3>
          <ul className="mt-4 space-y-3">
            {alerts.map((alert) => (
              <li
                key={alert}
                className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
              >
                {alert}
              </li>
            ))}
          </ul>
        </article>
      </div>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Event Timeline</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {upcomingItems.map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-slate-800">{item.title}</h4>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {item.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{item.window}</p>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
