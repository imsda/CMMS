import { redirect } from "next/navigation";

import { auth } from "../../auth";
import { canAccessTeacherPortal } from "../../lib/teacher-portal";
import { TeacherNav } from "./_components/teacher-nav";

export default async function TeacherLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (!session?.user || !canAccessTeacherPortal(session.user.role)) {
    redirect("/login");
  }

  return (
    <div className="shell-grid">
      <TeacherNav />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
