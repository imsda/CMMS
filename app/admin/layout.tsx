import { redirect } from "next/navigation";

import { auth } from "../../auth";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  return <>{children}</>;
}
