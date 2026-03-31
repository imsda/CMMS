import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "../auth";

export default async function HomePage() {
  const session = await auth();

  if (session?.user?.role === "SUPER_ADMIN") {
    redirect("/admin/dashboard");
  }

  if (session?.user?.role === "CLUB_DIRECTOR") {
    redirect("/director/dashboard");
  }

  if (session?.user?.role === "STAFF_TEACHER") {
    redirect("/teacher/dashboard");
  }

  if (session?.user?.role === "STUDENT_PARENT") {
    redirect("/student/dashboard");
  }

  return (
    <section className="glass-panel mx-auto max-w-3xl text-center">
      <p className="hero-kicker">Iowa-Missouri Conference</p>
      <h2 className="hero-title mt-3">
        Club Management Platform
      </h2>
      <p className="hero-copy mx-auto">
        Register your club for upcoming events or sign in to manage your club roster,
        monthly reports, and class enrollments.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/events"
          className="btn-secondary inline-flex"
        >
          View Upcoming Events
        </Link>
        <Link
          href="/login"
          className="btn-primary inline-flex"
        >
          Sign in
        </Link>
      </div>
    </section>
  );
}
