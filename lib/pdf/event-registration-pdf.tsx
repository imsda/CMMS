import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import type { EventRegistrationExportData } from "../data/event-registration-export";

type RegistrationData = NonNullable<EventRegistrationExportData>;

type ResponseCategory =
  | "Spiritual Milestones"
  | "Medical Volunteers"
  | "Duty Assignments"
  | "AV Equipment"
  | "Additional Responses";

const styles = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 30,
    fontSize: 10,
    color: "#0f172a",
    lineHeight: 1.35,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#0b1726",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 11,
    color: "#475569",
  },
  headerCard: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    backgroundColor: "#f8fafc",
  },
  headerGrid: {
    marginTop: 8,
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  headerMetaItem: {
    width: "48%",
  },
  headerMetaLabel: {
    fontSize: 9,
    color: "#64748b",
  },
  headerMetaValue: {
    fontSize: 10,
    color: "#0f172a",
    fontWeight: 600,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 6,
  },
  statsGrid: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  statCard: {
    width: "31.5%",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: "#ffffff",
  },
  statLabel: {
    fontSize: 9,
    color: "#64748b",
  },
  statValue: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: 700,
    color: "#0f172a",
  },
  table: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 6,
    overflow: "hidden",
  },
  tableHeader: {
    display: "flex",
    flexDirection: "row",
    backgroundColor: "#e2e8f0",
    borderBottomWidth: 1,
    borderColor: "#cbd5e1",
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tableRow: {
    display: "flex",
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  colName: { width: "28%", paddingRight: 4 },
  colRole: { width: "16%", paddingRight: 4 },
  colAge: { width: "8%", textAlign: "center", paddingRight: 4 },
  colMedical: { width: "14%", paddingRight: 4 },
  colDietary: { width: "14%", paddingRight: 4 },
  colClasses: { width: "20%" },
  tableHeaderText: {
    fontWeight: 700,
    fontSize: 9,
    color: "#0f172a",
  },
  tableCell: {
    fontSize: 9,
    color: "#1e293b",
  },
  noDataText: {
    marginTop: 8,
    fontSize: 9,
    color: "#64748b",
    fontStyle: "italic",
  },
  pageBreakTitle: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 4,
  },
  pageBreakSubtitle: {
    fontSize: 10,
    marginBottom: 10,
    color: "#64748b",
  },
  panel: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    backgroundColor: "#ffffff",
  },
  panelTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 6,
  },
  fieldBlock: {
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
  },
  fieldBlockLast: {
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingBottom: 0,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: 600,
    marginBottom: 2,
  },
  fieldDescription: {
    fontSize: 8,
    color: "#64748b",
    marginBottom: 3,
  },
  responseLine: {
    fontSize: 9,
    marginBottom: 1,
  },
  muted: {
    fontSize: 9,
    color: "#64748b",
    fontStyle: "italic",
  },
});

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(value);
}

function calculateAge(dateOfBirth: Date | null, ageAtStart: number | null) {
  if (typeof ageAtStart === "number") {
    return ageAtStart;
  }

  if (!dateOfBirth) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDifference = today.getMonth() - dateOfBirth.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getDate() < dateOfBirth.getDate())
  ) {
    age -= 1;
  }

  return age;
}

function friendlyRole(role: string) {
  return role.replaceAll("_", " ");
}

function summarizeCounts(data: RegistrationData) {
  const counts: Record<string, number> = {
    PATHFINDER: 0,
    ADVENTURER: 0,
    TLT: 0,
    STAFF: 0,
    CHILD: 0,
    DIRECTOR: 0,
    COUNSELOR: 0,
  };

  let medicalCount = 0;
  let dietaryCount = 0;

  for (const attendee of data.attendees) {
    const role = attendee.rosterMember.memberRole;
    counts[role] = (counts[role] ?? 0) + 1;

    if (attendee.rosterMember.medicalFlags?.trim()) {
      medicalCount += 1;
    }

    if (attendee.rosterMember.dietaryRestrictions?.trim()) {
      dietaryCount += 1;
    }
  }

  return {
    total: data.attendees.length,
    pathfinders: counts.PATHFINDER,
    adventurers: counts.ADVENTURER,
    tlt: counts.TLT,
    staff: counts.STAFF + counts.DIRECTOR + counts.COUNSELOR,
    children: counts.CHILD,
    medicalCount,
    dietaryCount,
  };
}

function categorizeField(label: string, key: string): ResponseCategory {
  const normalized = `${label} ${key}`.toLowerCase();

  if (normalized.includes("spiritual") || normalized.includes("milestone")) {
    return "Spiritual Milestones";
  }

  if (normalized.includes("medical") || normalized.includes("nurse") || normalized.includes("first aid")) {
    return "Medical Volunteers";
  }

  if (normalized.includes("duty") || normalized.includes("assignment") || normalized.includes("volunteer")) {
    return "Duty Assignments";
  }

  if (normalized.includes("av") || normalized.includes("audio") || normalized.includes("visual") || normalized.includes("equipment")) {
    return "AV Equipment";
  }

  return "Additional Responses";
}

function formatResponseValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return value.toString();
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join(", ");
  }

  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }

  return "No response provided";
}

export function EventRegistrationPdfDocument({ data }: { data: RegistrationData }) {
  const stats = summarizeCounts(data);
  const sortedAttendees = [...data.attendees].sort((a, b) => {
    const byLast = a.rosterMember.lastName.localeCompare(b.rosterMember.lastName);
    if (byLast !== 0) {
      return byLast;
    }

    return a.rosterMember.firstName.localeCompare(b.rosterMember.firstName);
  });

  const attendeeNameById = new Map(
    data.attendees.map((attendee) => [
      attendee.rosterMemberId,
      `${attendee.rosterMember.firstName} ${attendee.rosterMember.lastName}`,
    ]),
  );

  const groupedResponses = data.formResponses.reduce(
    (accumulator, response) => {
      const category = categorizeField(
        response.eventFormField.label,
        response.eventFormField.key,
      );
      const list = accumulator.get(category) ?? [];
      list.push(response);
      accumulator.set(category, list);
      return accumulator;
    },
    new Map<ResponseCategory, RegistrationData["formResponses"]>(),
  );

  const categoryOrder: ResponseCategory[] = [
    "Spiritual Milestones",
    "Medical Volunteers",
    "Duty Assignments",
    "AV Equipment",
    "Additional Responses",
  ];

  return (
    <Document title={`${data.event.name} - ${data.club.name} Registration`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerCard}>
          <Text style={styles.pageTitle}>{data.event.name}</Text>
          <Text style={styles.subtitle}>{data.club.name} Conference Registration Summary</Text>

          <View style={styles.headerGrid}>
            <View style={styles.headerMetaItem}>
              <Text style={styles.headerMetaLabel}>Event Dates</Text>
              <Text style={styles.headerMetaValue}>
                {formatDate(data.event.startsAt)} - {formatDate(data.event.endsAt)}
              </Text>
            </View>
            <View style={styles.headerMetaItem}>
              <Text style={styles.headerMetaLabel}>Registration Status</Text>
              <Text style={styles.headerMetaValue}>{friendlyRole(data.status)}</Text>
            </View>
            <View style={styles.headerMetaItem}>
              <Text style={styles.headerMetaLabel}>Location</Text>
              <Text style={styles.headerMetaValue}>{data.event.locationName ?? "TBD"}</Text>
            </View>
            <View style={styles.headerMetaItem}>
              <Text style={styles.headerMetaLabel}>Exported At</Text>
              <Text style={styles.headerMetaValue}>{formatDateTime(new Date())}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Attendance Breakdown</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Attendees</Text>
            <Text style={styles.statValue}>{stats.total}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>PF</Text>
            <Text style={styles.statValue}>{stats.pathfinders}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Adventurers</Text>
            <Text style={styles.statValue}>{stats.adventurers}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>TLT</Text>
            <Text style={styles.statValue}>{stats.tlt}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Staff / Leadership</Text>
            <Text style={styles.statValue}>{stats.staff}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Children</Text>
            <Text style={styles.statValue}>{stats.children}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Medical Flags ⚕</Text>
            <Text style={styles.statValue}>{stats.medicalCount}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Dietary Restrictions 🥗</Text>
            <Text style={styles.statValue}>{stats.dietaryCount}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Attendee Manifest</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.colName]}>Name</Text>
            <Text style={[styles.tableHeaderText, styles.colRole]}>Role</Text>
            <Text style={[styles.tableHeaderText, styles.colAge]}>Age</Text>
            <Text style={[styles.tableHeaderText, styles.colMedical]}>Medical ⚕</Text>
            <Text style={[styles.tableHeaderText, styles.colDietary]}>Dietary 🥗</Text>
            <Text style={[styles.tableHeaderText, styles.colClasses]}>Class Enrollments</Text>
          </View>

          {sortedAttendees.length === 0 ? (
            <View style={[styles.tableRow, styles.tableRowLast]}>
              <Text style={styles.noDataText}>No attendees were registered for this club yet.</Text>
            </View>
          ) : (
            sortedAttendees.map((attendee, index) => {
              const isLast = index === sortedAttendees.length - 1;
              const age = calculateAge(
                attendee.rosterMember.dateOfBirth,
                attendee.rosterMember.ageAtStart,
              );
              const medical = attendee.rosterMember.medicalFlags?.trim();
              const dietary = attendee.rosterMember.dietaryRestrictions?.trim();
              const classTitles = attendee.rosterMember.classEnrollments
                .map((enrollment) => enrollment.eventClassOffering.classCatalog.title)
                .join(", ");

              return (
                <View
                  key={attendee.id}
                  style={[styles.tableRow, isLast ? styles.tableRowLast : undefined]}
                >
                  <Text style={[styles.tableCell, styles.colName]}>
                    {attendee.rosterMember.firstName} {attendee.rosterMember.lastName}
                  </Text>
                  <Text style={[styles.tableCell, styles.colRole]}>
                    {friendlyRole(attendee.rosterMember.memberRole)}
                  </Text>
                  <Text style={[styles.tableCell, styles.colAge]}>{age ?? "-"}</Text>
                  <Text style={[styles.tableCell, styles.colMedical]}>{medical ? `⚕ ${medical}` : "-"}</Text>
                  <Text style={[styles.tableCell, styles.colDietary]}>{dietary ? `🥗 ${dietary}` : "-"}</Text>
                  <Text style={[styles.tableCell, styles.colClasses]}>{classTitles || "-"}</Text>
                </View>
              );
            })
          )}
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.pageBreakTitle}>Dynamic Form Responses</Text>
        <Text style={styles.pageBreakSubtitle}>
          Organized by response categories for quick review and event operations planning.
        </Text>

        {categoryOrder.map((category) => {
          const responses = groupedResponses.get(category) ?? [];

          return (
            <View key={category} style={styles.panel}>
              <Text style={styles.panelTitle}>{category}</Text>

              {responses.length === 0 ? (
                <Text style={styles.muted}>No responses captured for this section.</Text>
              ) : (
                responses.map((response, index) => {
                  const isLast = index === responses.length - 1;
                  const valueText = formatResponseValue(response.value);
                  const attendeeName = response.attendeeId
                    ? attendeeNameById.get(response.attendeeId) ?? response.attendeeId
                    : null;

                  return (
                    <View
                      key={response.id}
                      style={[styles.fieldBlock, isLast ? styles.fieldBlockLast : undefined]}
                    >
                      <Text style={styles.fieldLabel}>{response.eventFormField.label}</Text>
                      {response.eventFormField.description ? (
                        <Text style={styles.fieldDescription}>
                          {response.eventFormField.description}
                        </Text>
                      ) : null}
                      <Text style={styles.responseLine}>Response: {valueText}</Text>
                      {attendeeName ? (
                        <Text style={styles.responseLine}>Attendee: {attendeeName}</Text>
                      ) : (
                        <Text style={styles.responseLine}>Scope: Club-wide response</Text>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          );
        })}
      </Page>
    </Document>
  );
}
