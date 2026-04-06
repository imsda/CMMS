import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { auth } from "../../auth";
import { getLocaleFromCookie } from "../../lib/locale";
import { AdminShell } from "./_components/admin-shell";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const locale = getLocaleFromCookie((await cookies()).get("NEXT_LOCALE")?.value);

  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  return (
    <AdminShell
      currentLocale={locale}
      user={{
        name: session.user.name,
        role: session.user.role,
      }}
    >
      {children}
    </AdminShell>
  );
}
