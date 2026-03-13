import { redirect } from "next/navigation";

import { auth } from "../../auth";
import { DirectorNav } from "./_components/director-nav";
import { UserRole } from "@prisma/client";

export default async function DirectorLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== UserRole.CLUB_DIRECTOR && session.user.role !== UserRole.SUPER_ADMIN)
  ) {
    redirect("/login");
  }

  return (
    <div className="shell-grid">
      <DirectorNav />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
