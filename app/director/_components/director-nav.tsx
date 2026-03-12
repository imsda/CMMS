"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type DirectorNavItem = {
  href: string;
  label: string;
};

const navItems: DirectorNavItem[] = [
  { href: "/director/dashboard", label: "Dashboard" },
  { href: "/director/events", label: "Events" },
  { href: "/director/roster", label: "Roster" },
  { href: "/director/nominations", label: "Nominations" },
  { href: "/director/tlt", label: "TLT" },
  { href: "/director/reports", label: "Reports" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DirectorNav() {
  const pathname = usePathname();

  return (
    <aside className="glass-sidebar h-fit lg:sticky lg:top-28">
      <div className="glass-card-soft">
        <p className="hero-kicker">Club Control</p>
        <h2 className="mt-2 text-lg font-semibold text-slate-950">
          Club Director
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Roster readiness, event workflows, and class coordination.
        </p>
      </div>
      <nav className="mt-4 flex flex-col gap-1.5">
        <p className="px-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Club Director
        </p>
        {navItems.map((item) => {
          const active = isActive(pathname, item.href);

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
