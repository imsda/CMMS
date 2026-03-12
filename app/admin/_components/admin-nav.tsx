"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type AdminNavItem = {
  href: string;
  label: string;
};

const navItems: AdminNavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/clubs", label: "Clubs" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/catalog", label: "Class Catalog" },
  { href: "/admin/compliance", label: "Compliance" },
  { href: "/admin/nominations", label: "Nominations" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/storage", label: "Storage" },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav() {
  const pathname = usePathname();

  return (
    <aside className="glass-sidebar h-fit lg:sticky lg:top-28">
      <div className="glass-card-soft">
        <p className="hero-kicker">Operations</p>
        <h2 className="mt-2 text-lg font-semibold text-slate-950">
          Super Admin
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Conference controls, compliance, and reporting.
        </p>
      </div>
      <nav className="mt-4 flex flex-col gap-1.5">
        <p className="px-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Super Admin
        </p>
        {navItems.map((item) => {
          const active = isActivePath(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link ${active ? "nav-link-active" : "nav-link-idle"}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
