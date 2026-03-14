type AdminTopSectionId = "dashboard" | "clubs" | "events" | "reports" | "admin";

export type AdminTopSection = {
  id: AdminTopSectionId;
  labelKey: string;
  href: string;
  descriptionKey: string;
};

export type AdminSidebarItem = {
  href: string;
  labelKey: string;
  descriptionKey?: string;
  matchPrefixes?: string[];
};

export type AdminShellState = {
  activeSection: AdminTopSection;
  topSections: AdminTopSection[];
  sidebarHeadingKey: string;
  sidebarDescriptionKey: string;
  sidebarItems: AdminSidebarItem[];
};

const ADMIN_TOP_SECTIONS: AdminTopSection[] = [
  {
    id: "dashboard",
    labelKey: "shell.sections.dashboard.label",
    href: "/admin/dashboard",
    descriptionKey: "shell.sections.dashboard.description",
  },
  {
    id: "clubs",
    labelKey: "shell.sections.clubs.label",
    href: "/admin/clubs",
    descriptionKey: "shell.sections.clubs.description",
  },
  {
    id: "events",
    labelKey: "shell.sections.events.label",
    href: "/admin/events",
    descriptionKey: "shell.sections.events.description",
  },
  {
    id: "reports",
    labelKey: "shell.sections.reports.label",
    href: "/admin/reports",
    descriptionKey: "shell.sections.reports.description",
  },
  {
    id: "admin",
    labelKey: "shell.sections.admin.label",
    href: "/admin/compliance",
    descriptionKey: "shell.sections.admin.description",
  },
];

const SECTION_SIDEBARS: Record<AdminTopSectionId, { headingKey: string; descriptionKey: string; items: AdminSidebarItem[] }> = {
  dashboard: {
    headingKey: "shell.sidebar.dashboard.heading",
    descriptionKey: "shell.sidebar.dashboard.description",
    items: [
      {
        href: "/admin/dashboard",
        labelKey: "shell.sidebar.dashboard.items.overview.label",
        descriptionKey: "shell.sidebar.dashboard.items.overview.description",
      },
    ],
  },
  clubs: {
    headingKey: "shell.sidebar.clubs.heading",
    descriptionKey: "shell.sidebar.clubs.description",
    items: [
      {
        href: "/admin/clubs",
        labelKey: "shell.sidebar.clubs.items.directory.label",
        descriptionKey: "shell.sidebar.clubs.items.directory.description",
      },
      {
        href: "/admin/users",
        labelKey: "shell.sidebar.clubs.items.users.label",
        descriptionKey: "shell.sidebar.clubs.items.users.description",
      },
      {
        href: "/admin/nominations",
        labelKey: "shell.sidebar.clubs.items.nominations.label",
        descriptionKey: "shell.sidebar.clubs.items.nominations.description",
      },
    ],
  },
  events: {
    headingKey: "shell.sidebar.events.heading",
    descriptionKey: "shell.sidebar.events.description",
    items: [
      {
        href: "/admin/events",
        labelKey: "shell.sidebar.events.items.allEvents.label",
        descriptionKey: "shell.sidebar.events.items.allEvents.description",
      },
      {
        href: "/admin/events/new",
        labelKey: "shell.sidebar.events.items.createEvent.label",
        descriptionKey: "shell.sidebar.events.items.createEvent.description",
      },
      {
        href: "/admin/events/templates",
        labelKey: "shell.sidebar.events.items.templates.label",
        descriptionKey: "shell.sidebar.events.items.templates.description",
      },
      {
        href: "/admin/catalog",
        labelKey: "shell.sidebar.events.items.catalog.label",
        descriptionKey: "shell.sidebar.events.items.catalog.description",
      },
    ],
  },
  reports: {
    headingKey: "shell.sidebar.reports.heading",
    descriptionKey: "shell.sidebar.reports.description",
    items: [
      {
        href: "/admin/reports",
        labelKey: "shell.sidebar.reports.items.submitted.label",
        descriptionKey: "shell.sidebar.reports.items.submitted.description",
      },
    ],
  },
  admin: {
    headingKey: "shell.sidebar.admin.heading",
    descriptionKey: "shell.sidebar.admin.description",
    items: [
      {
        href: "/admin/compliance",
        labelKey: "shell.sidebar.admin.items.compliance.label",
        descriptionKey: "shell.sidebar.admin.items.compliance.description",
      },
      {
        href: "/admin/audit",
        labelKey: "shell.sidebar.admin.items.audit.label",
        descriptionKey: "shell.sidebar.admin.items.audit.description",
      },
      {
        href: "/admin/storage",
        labelKey: "shell.sidebar.admin.items.storage.label",
        descriptionKey: "shell.sidebar.admin.items.storage.description",
      },
    ],
  },
};

function getEventContextSidebar(pathname: string): { headingKey: string; descriptionKey: string; items: AdminSidebarItem[] } | null {
  const match = pathname.match(/^\/admin\/events\/([^/]+)/);

  if (!match || match[1] === "new" || match[1] === "templates") {
    return null;
  }

  const eventId = match[1];
  const eventBaseHref = `/admin/events/${eventId}`;

  return {
    headingKey: "shell.sidebar.eventContext.heading",
    descriptionKey: "shell.sidebar.eventContext.description",
    items: [
      {
        href: "/admin/events",
        labelKey: "shell.sidebar.eventContext.items.allEvents.label",
        descriptionKey: "shell.sidebar.eventContext.items.allEvents.description",
      },
      {
        href: eventBaseHref,
        labelKey: "shell.sidebar.eventContext.items.overview.label",
        descriptionKey: "shell.sidebar.eventContext.items.overview.description",
      },
      {
        href: `${eventBaseHref}/edit`,
        labelKey: "shell.sidebar.eventContext.items.edit.label",
        descriptionKey: "shell.sidebar.eventContext.items.edit.description",
      },
      {
        href: `${eventBaseHref}/classes`,
        labelKey: "shell.sidebar.eventContext.items.classes.label",
        descriptionKey: "shell.sidebar.eventContext.items.classes.description",
      },
      {
        href: `${eventBaseHref}/checkin`,
        labelKey: "shell.sidebar.eventContext.items.checkin.label",
        descriptionKey: "shell.sidebar.eventContext.items.checkin.description",
      },
      {
        href: `${eventBaseHref}/camporee`,
        labelKey: "shell.sidebar.eventContext.items.camporee.label",
        descriptionKey: "shell.sidebar.eventContext.items.camporee.description",
      },
      {
        href: `${eventBaseHref}/reports/operational`,
        labelKey: "shell.sidebar.eventContext.items.operational.label",
        descriptionKey: "shell.sidebar.eventContext.items.operational.description",
      },
      {
        href: `${eventBaseHref}/reports/compliance`,
        labelKey: "shell.sidebar.eventContext.items.compliance.label",
        descriptionKey: "shell.sidebar.eventContext.items.compliance.description",
      },
      {
        href: `${eventBaseHref}/reports/medical`,
        labelKey: "shell.sidebar.eventContext.items.medical.label",
        descriptionKey: "shell.sidebar.eventContext.items.medical.description",
      },
    ],
  };
}

function resolveTopSection(pathname: string): AdminTopSection {
  if (pathname.startsWith("/admin/clubs") || pathname.startsWith("/admin/users") || pathname.startsWith("/admin/nominations")) {
    return ADMIN_TOP_SECTIONS.find((section) => section.id === "clubs") ?? ADMIN_TOP_SECTIONS[0];
  }

  if (pathname.startsWith("/admin/events") || pathname.startsWith("/admin/catalog")) {
    return ADMIN_TOP_SECTIONS.find((section) => section.id === "events") ?? ADMIN_TOP_SECTIONS[0];
  }

  if (pathname.startsWith("/admin/reports")) {
    return ADMIN_TOP_SECTIONS.find((section) => section.id === "reports") ?? ADMIN_TOP_SECTIONS[0];
  }

  if (pathname.startsWith("/admin/compliance") || pathname.startsWith("/admin/audit") || pathname.startsWith("/admin/storage")) {
    return ADMIN_TOP_SECTIONS.find((section) => section.id === "admin") ?? ADMIN_TOP_SECTIONS[0];
  }

  return ADMIN_TOP_SECTIONS[0];
}

export function isAdminHrefActive(pathname: string, item: AdminSidebarItem) {
  const matchPrefixes = item.matchPrefixes ?? [item.href];

  return matchPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function getAdminShellState(pathname: string): AdminShellState {
  const activeSection = resolveTopSection(pathname);
  const eventContext = getEventContextSidebar(pathname);
  const sectionSidebar = SECTION_SIDEBARS[activeSection.id];
  const sidebar = eventContext ?? sectionSidebar;

  return {
    activeSection,
    topSections: ADMIN_TOP_SECTIONS,
    sidebarHeadingKey: sidebar.headingKey,
    sidebarDescriptionKey: sidebar.descriptionKey,
    sidebarItems: sidebar.items,
  };
}
