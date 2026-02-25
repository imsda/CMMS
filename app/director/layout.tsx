import { redirect } from "next/navigation";

import { auth } from "../../auth";

export default async function DirectorLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (!session?.user || session.user.role !== "CLUB_DIRECTOR") {
    redirect("/login");
  }

  return <>{children}</>;
}
