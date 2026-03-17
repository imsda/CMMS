"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { LanguageSwitcher } from "../../../components/language-switcher";
import { type AppLocale } from "../../../i18n";
import { signOutAction } from "../../actions/auth-actions";
import { getAdminShellState, isAdminHrefActive } from "./admin-shell-config";

type AdminShellProps = {
  children: React.ReactNode;
  currentLocale: AppLocale;
  user: {
    name?: string | null;
    role: string;
  };
};

export function AdminShell({ children, currentLocale, user }: AdminShellProps) {
  const t = useTranslations("Admin");
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const shellState = getAdminShellState(pathname);

  return (
    <div className="admin-shell space-y-6">
      <div className="admin-topbar glass-panel">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((open) => !open)}
              className="btn-secondary px-3 py-2 xl:hidden"
              aria-expanded={sidebarOpen}
              aria-controls="admin-context-sidebar"
            >
              {t("shell.mobileMenu")}
            </button>

            <Link href="/admin/dashboard" className="admin-logo-lockup">
              <span className="admin-logo-mark">CM</span>
              <span className="min-w-0">
                <span className="block text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-blue-600">
                  {t("shell.brand.eyebrow")}
                </span>
                <span className="block truncate text-base font-semibold text-slate-950">
                  {t("shell.brand.title")}
                </span>
              </span>
            </Link>
          </div>

          <div className="flex flex-1 flex-col gap-3 xl:max-w-3xl xl:flex-row xl:items-center xl:justify-end">
            <form className="admin-search" role="search">
              <label htmlFor="admin-shell-search" className="sr-only">
                {t("shell.searchLabel")}
              </label>
              <input
                id="admin-shell-search"
                type="search"
                placeholder={t("shell.searchPlaceholder")}
                className="input-glass admin-search-input"
              />
            </form>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <LanguageSwitcher currentLocale={currentLocale} />

              <button type="button" className="btn-secondary admin-topbar-button">
                {t("shell.notifications")}
                <span className="admin-badge">3</span>
              </button>

              <details className="admin-topbar-menu">
                <summary className="btn-secondary list-none cursor-pointer admin-topbar-button">
                  {t("shell.quickCreate")}
                </summary>
                <div className="admin-menu-surface">
                  <Link href="/admin/events/new" className="admin-menu-item">
                    {t("shell.quickCreateItems.newEvent")}
                  </Link>
                  <Link href="/admin/clubs" className="admin-menu-item">
                    {t("shell.quickCreateItems.newClub")}
                  </Link>
                  <Link href="/admin/users" className="admin-menu-item">
                    {t("shell.quickCreateItems.newUser")}
                  </Link>
                </div>
              </details>

              <details className="admin-topbar-menu">
                <summary className="btn-secondary list-none cursor-pointer admin-user-chip">
                  <span className="admin-user-avatar">{(user.name ?? "A").slice(0, 1).toUpperCase()}</span>
                  <span className="text-left">
                  <span className="block text-sm font-semibold text-slate-900">{user.name ?? "Admin"}</span>
                  <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {t(`roles.${user.role}`)}
                  </span>
                </span>
              </summary>
              <div className="admin-menu-surface">
                <Link href="/admin/dashboard" className="admin-menu-item">
                    {t("shell.userMenu.dashboard")}
                </Link>
                <Link href="/director/dashboard" className="admin-menu-item">
                    {t("shell.userMenu.directorWorkspace")}
                </Link>
                  <form action={signOutAction}>
                    <button type="submit" className="admin-menu-item w-full text-left">
                      {t("shell.userMenu.signOutHint")}
                    </button>
                  </form>
              </div>
            </details>
            </div>
          </div>
        </div>

        <nav aria-label="Admin sections" className="admin-major-nav">
          <div className="admin-major-nav-scroll">
            {shellState.topSections.map((section) => {
              const active = section.id === shellState.activeSection.id;

              return (
                <Link
                  key={section.id}
                  href={section.href}
                  className={`admin-major-nav-link ${active ? "admin-major-nav-link-active" : ""}`}
                >
                  <span className="block text-sm font-semibold">{t(section.labelKey)}</span>
                  <span className="block text-xs text-slate-500">{t(section.descriptionKey)}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      <div className="admin-shell-grid">
        <aside
          id="admin-context-sidebar"
          className={`glass-sidebar admin-context-sidebar ${sidebarOpen ? "admin-context-sidebar-open" : ""}`}
        >
          <div className="glass-card-soft">
            <p className="hero-kicker">{t(shellState.activeSection.labelKey)}</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">{t(shellState.sidebarHeadingKey)}</h2>
            <p className="mt-1 text-sm text-slate-600">{t(shellState.sidebarDescriptionKey)}</p>
          </div>

          <nav className="mt-4 flex flex-col gap-1.5" aria-label={t("shell.contextNavAriaLabel")}>
            {shellState.sidebarItems.map((item) => {
              const active = isAdminHrefActive(pathname, item);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`nav-link ${active ? "nav-link-active" : "nav-link-idle"}`}
                >
                  <span>{t(item.labelKey)}</span>
                  {item.descriptionKey ? <span className="mt-1 block text-xs font-medium text-slate-500">{t(item.descriptionKey)}</span> : null}
                </Link>
              );
            })}
          </nav>
        </aside>

        {sidebarOpen ? (
          <button
            type="button"
            className="admin-sidebar-backdrop xl:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label={t("shell.closeNavigation")}
          />
        ) : null}

        <div className="min-w-0 space-y-4">
          <section className="glass-card-soft admin-workspace-strip">
            <div>
              <p className="hero-kicker">{t(shellState.activeSection.labelKey)}</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-950">{t(shellState.sidebarHeadingKey)}</h2>
              <p className="mt-1 text-sm text-slate-600">{t(shellState.sidebarDescriptionKey)}</p>
            </div>
            <div className="rounded-2xl bg-white/70 px-4 py-3 text-sm text-slate-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("shell.workspaceActive")}
              </p>
              <p className="mt-1 font-semibold text-slate-900">{t(shellState.activeSection.labelKey)}</p>
            </div>
          </section>

          <div className="admin-main-stage">{children}</div>
        </div>
      </div>
    </div>
  );
}
