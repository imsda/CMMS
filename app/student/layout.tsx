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
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <StudentNav />
      <div>{children}</div>
    </div>
  );
}
