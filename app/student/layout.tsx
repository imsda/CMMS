import { redirect } from "next/navigation";

import { auth } from "../../auth";
import { StudentNav } from "./_components/student-nav";

export default async function StudentLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (!session?.user || session.user.role !== "STUDENT_PARENT") {
    redirect("/login");
  }

  return (
    <div className="shell-grid">
      <StudentNav />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
