import { redirect } from "next/navigation";

import { auth } from "../../auth";
import { DirectorNav } from "./_components/director-nav";

export default async function DirectorLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (!session?.user || session.user.role !== "CLUB_DIRECTOR") {
    redirect("/login");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <DirectorNav />
      <div>{children}</div>
    </div>
  );
}
