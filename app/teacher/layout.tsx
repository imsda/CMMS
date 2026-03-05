import { redirect } from "next/navigation";

import { auth } from "../../auth";
import { TeacherNav } from "./_components/teacher-nav";

export default async function TeacherLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (!session?.user || session.user.role !== "STAFF_TEACHER") {
    redirect("/login");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <TeacherNav />
      <div>{children}</div>
    </div>
  );
}
