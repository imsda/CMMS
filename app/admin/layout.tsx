import { redirect } from "next/navigation";

import { auth } from "../../auth";
import { AdminNav } from "./_components/admin-nav";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  return (
    <div className="shell-grid">
      <AdminNav />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
