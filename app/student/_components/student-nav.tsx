"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type StudentNavItem = {
  href: string;
  label: string;
};

const navItems: StudentNavItem[] = [
  { href: "/student/dashboard", label: "Dashboard" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function StudentNav() {
  const pathname = usePathname();

  return (
    <aside className="glass-sidebar h-fit lg:sticky lg:top-28">
      <div className="glass-card-soft">
        <p className="hero-kicker">Portal</p>
        <h2 className="mt-2 text-lg font-semibold text-slate-950">
          Student / Parent
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Linked students, honors, and event class summaries.
        </p>
      </div>
      <nav className="mt-4 flex flex-col gap-1.5">
        <p className="px-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Student / Parent
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
