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
    <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Student / Parent
      </h2>
      <nav className="mt-2 flex flex-col gap-1">
        {navItems.map((item) => {
          const active = isActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
