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
    <div className="shell-grid">
      <TeacherNav />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
