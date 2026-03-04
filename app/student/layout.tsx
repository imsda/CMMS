import { redirect } from "next/navigation";

import { auth } from "../../auth";

export default async function StudentLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (!session?.user || session.user.role !== "STUDENT_PARENT") {
    redirect("/login");
  }

  return <>{children}</>;
}
