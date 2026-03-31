"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { buildDirectorPath } from "../../../lib/director-path";

type DirectorNavItem = {
  href: string;
  labelKey: string;
};

const navItems: DirectorNavItem[] = [
  { href: "/director/dashboard", labelKey: "nav.sections.dashboard" },
  { href: "/director/events", labelKey: "nav.sections.events" },
  { href: "/director/catalog", labelKey: "nav.sections.catalog" },
  { href: "/director/roster", labelKey: "nav.sections.roster" },
  { href: "/director/nominations", labelKey: "nav.sections.nominations" },
  { href: "/director/tlt", labelKey: "nav.sections.tlt" },
  { href: "/director/reports", labelKey: "nav.sections.reports" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DirectorNav() {
  const t = useTranslations("Director");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const managedClubId = searchParams.get("clubId");
  const isSuperAdminView = managedClubId !== null;

  return (
    <aside className="glass-sidebar h-fit lg:sticky lg:top-28">
      <div className="glass-card-soft">
        <p className="hero-kicker">{t("nav.eyebrow")}</p>
        <h2 className="mt-2 text-lg font-semibold text-slate-950">
          {t("nav.title")}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {t("nav.description")}
        </p>
      </div>
      <nav className="mt-4 flex flex-col gap-1.5">
        <p className="px-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {t("nav.title")}
        </p>
        {navItems.map((item) => {
          const active = isActive(pathname, item.href);
          const href = managedClubId
            ? buildDirectorPath(item.href, managedClubId, isSuperAdminView)
            : item.href;

          return (
            <Link
              key={item.href}
              href={href}
              className={`nav-link ${active ? "nav-link-active" : "nav-link-idle"}`}
            >
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
