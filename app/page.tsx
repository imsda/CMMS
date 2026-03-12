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
      <p className="hero-kicker">System Bootstrap Complete</p>
      <h2 className="hero-title mt-3">
        Club Management Platform
      </h2>
      <p className="hero-copy mx-auto">
        Jump into the Club Director dashboard shell to continue building roster rollover,
        event registration, and class enrollment workflows.
      </p>
      <Link
        href="/login"
        className="btn-primary mt-6 inline-flex"
      >
        Sign in
      </Link>
    </section>
  );
}
