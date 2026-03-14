import { EventTemplateCategory, EventTemplateSource, FormFieldScope, FormFieldType } from "@prisma/client";

import { type EventTemplateSnapshot } from "./event-templates";

export type TemplateLibraryFilter =
  | "ALL"
  | EventTemplateCategory
  | "SYSTEM_TEMPLATES"
  | "USER_TEMPLATES";

export function getTemplateCategoryLabel(category: EventTemplateCategory) {
  switch (category) {
    case EventTemplateCategory.BASIC_EVENTS:
      return "Basic Events";
    case EventTemplateCategory.CLUB_REGISTRATION:
      return "Club Registration";
    case EventTemplateCategory.CLASS_ASSIGNMENT:
      return "Class Assignment";
    case EventTemplateCategory.MONTHLY_REPORTS:
      return "Monthly Reports";
  }
}

export function getTemplateSourceLabel(source: EventTemplateSource) {
  return source === EventTemplateSource.SYSTEM ? "System" : "User";
}

export function getTemplateLibraryFilters(): Array<{
  value: TemplateLibraryFilter;
  label: string;
}> {
  return [
    { value: "ALL", label: "All Templates" },
    { value: EventTemplateCategory.BASIC_EVENTS, label: "Basic Events" },
    { value: EventTemplateCategory.CLUB_REGISTRATION, label: "Club Registration" },
    { value: EventTemplateCategory.CLASS_ASSIGNMENT, label: "Class Assignment" },
    { value: EventTemplateCategory.MONTHLY_REPORTS, label: "Monthly Reports" },
    { value: "SYSTEM_TEMPLATES", label: "System Templates" },
    { value: "USER_TEMPLATES", label: "User Templates" },
  ];
}

export function matchesTemplateFilter(
  filter: TemplateLibraryFilter,
  template: {
    category: EventTemplateCategory;
    source: EventTemplateSource;
  },
) {
  if (filter === "ALL") {
    return true;
  }

  if (filter === "SYSTEM_TEMPLATES") {
    return template.source === EventTemplateSource.SYSTEM;
  }

  if (filter === "USER_TEMPLATES") {
    return template.source === EventTemplateSource.USER;
  }

  return template.category === filter;
}

export function getTemplateSectionSummaries(snapshot: EventTemplateSnapshot) {
  const groups = snapshot.dynamicFields
    .filter((field) => field.type === FormFieldType.FIELD_GROUP)
    .map((field) => field.label.trim())
    .filter((label) => label.length > 0);

  if (groups.length > 0) {
    return groups;
  }

  return snapshot.dynamicFields
    .filter((field) => field.type !== FormFieldType.FIELD_GROUP)
    .slice(0, 4)
    .map((field) => field.label.trim())
    .filter((label) => label.length > 0);
}

export function getTemplateCoverageSummary(snapshot: EventTemplateSnapshot) {
  const visibleFields = snapshot.dynamicFields.filter((field) => field.type !== FormFieldType.FIELD_GROUP);
  const attendeeFields = visibleFields.filter((field) => field.fieldScope === FormFieldScope.ATTENDEE);
  const globalFields = visibleFields.length - attendeeFields.length;

  return {
    sectionCount: getTemplateSectionSummaries(snapshot).length,
    fieldCount: visibleFields.length,
    globalFieldCount: globalFields,
    attendeeFieldCount: attendeeFields.length,
  };
}
