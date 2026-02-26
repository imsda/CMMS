"use server";

import { RegistrationStatus } from "@prisma/client";

import { auth } from "../../auth";
import { prisma } from "../../lib/prisma";

type ReportClubRow = {
  clubName: string;
  clubCode: string;
};

export type SpiritualReportRow = ReportClubRow & {
  sourceKey: string;
  sourceLabel: string;
  response: string;
};

export type DutyReportRow = {
  assignment: string;
  clubs: ReportClubRow[];
};

export type AvReportRow = ReportClubRow & {
  requestedItems: string;
};

export type OperationalReportsData = {
  event: {
    id: string;
    name: string;
    startsAt: Date;
    endsAt: Date;
  };
  spiritualRows: SpiritualReportRow[];
  dutyRows: DutyReportRow[];
  avRows: AvReportRow[];
};

const SPIRITUAL_KEYS = new Set(["baptism_names", "bible_names"]);
const DUTY_KEYS = ["duty_first", "duty_second", "special_activity"] as const;
const AV_DETAIL_KEYS = new Set(["av_equipment", "av_request", "av_needs"]);

function ensureSuperAdmin(session: Awaited<ReturnType<typeof auth>>) {
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    throw new Error("Only super admins can access operational reports.");
  }
}

function formatDateRange(startsAt: Date, endsAt: Date) {
  return `${startsAt.toLocaleDateString()}-${endsAt.toLocaleDateString()}`;
}

function flattenJsonStrings(value: unknown): string[] {
  if (value === null || typeof value === "undefined") {
    return [];
  }

  if (typeof value === "string") {
    return value
      .split(/[,\n]/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => flattenJsonStrings(entry));
  }

  if (typeof value === "object") {
    return [JSON.stringify(value)];
  }

  return [];
}

function isTruthyAvRequest(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value > 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized.length === 0) {
      return false;
    }

    return !["false", "none", "no", "n/a", "na"].includes(normalized);
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return Boolean(value);
}

function quoteCsv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function toCsv(rows: string[][]) {
  return rows.map((row) => row.map((cell) => quoteCsv(cell)).join(",")).join("\n");
}

export async function getOperationalReports(eventId: string): Promise<OperationalReportsData | null> {
  const session = await auth();
  ensureSuperAdmin(session);

  const event = await prisma.event.findUnique({
    where: {
      id: eventId,
    },
    select: {
      id: true,
      name: true,
      startsAt: true,
      endsAt: true,
      registrations: {
        where: {
          status: {
            in: [RegistrationStatus.SUBMITTED, RegistrationStatus.APPROVED],
          },
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          club: {
            select: {
              name: true,
              code: true,
            },
          },
          formResponses: {
            where: {
              attendeeId: null,
            },
            select: {
              value: true,
              field: {
                select: {
                  key: true,
                  label: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!event) {
    return null;
  }

  const spiritualRows: SpiritualReportRow[] = [];
  const dutyMap = new Map<string, { assignment: string; clubs: Map<string, ReportClubRow> }>();
  const avRows: AvReportRow[] = [];

  for (const registration of event.registrations) {
    const club = {
      clubName: registration.club.name,
      clubCode: registration.club.code,
    };

    const avDetails = new Set<string>();
    let avRequested = false;

    for (const response of registration.formResponses) {
      const key = response.field.key;
      const valueItems = flattenJsonStrings(response.value);

      if (SPIRITUAL_KEYS.has(key)) {
        for (const item of valueItems) {
          spiritualRows.push({
            ...club,
            sourceKey: key,
            sourceLabel: response.field.label,
            response: item,
          });
        }
      }

      if (DUTY_KEYS.includes(key as (typeof DUTY_KEYS)[number])) {
        for (const item of valueItems) {
          const assignmentKey = item.toLowerCase();
          if (!dutyMap.has(assignmentKey)) {
            dutyMap.set(assignmentKey, {
              assignment: item,
              clubs: new Map(),
            });
          }

          dutyMap.get(assignmentKey)?.clubs.set(registration.id, club);
        }
      }

      if (key.startsWith("av_") || AV_DETAIL_KEYS.has(key)) {
        if (isTruthyAvRequest(response.value)) {
          avRequested = true;
        }

        for (const item of valueItems) {
          avDetails.add(`${response.field.label}: ${item}`);
        }
      }
    }

    if (avRequested || avDetails.size > 0) {
      avRows.push({
        ...club,
        requestedItems: avDetails.size > 0 ? Array.from(avDetails).join("; ") : "Requested AV support",
      });
    }
  }

  const dutyRows: DutyReportRow[] = Array.from(dutyMap.values())
    .map((entry) => ({
      assignment: entry.assignment,
      clubs: Array.from(entry.clubs.values()).sort((a, b) => a.clubName.localeCompare(b.clubName)),
    }))
    .sort((a, b) => a.assignment.localeCompare(b.assignment));

  return {
    event: {
      id: event.id,
      name: event.name,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
    },
    spiritualRows: spiritualRows.sort((a, b) => {
      const byClub = a.clubName.localeCompare(b.clubName);
      if (byClub !== 0) {
        return byClub;
      }

      return a.response.localeCompare(b.response);
    }),
    dutyRows,
    avRows: avRows.sort((a, b) => a.clubName.localeCompare(b.clubName)),
  };
}

export async function getOperationalSpiritualCsv(eventId: string) {
  const report = await getOperationalReports(eventId);
  if (!report) {
    throw new Error("Event not found.");
  }

  return {
    fileName: `${report.event.name.toLowerCase().replace(/\s+/g, "-")}-spiritual-${formatDateRange(report.event.startsAt, report.event.endsAt)}.csv`,
    content: toCsv([
      ["Club", "Club Code", "Field", "Response"],
      ...report.spiritualRows.map((row) => [row.clubName, row.clubCode, row.sourceLabel, row.response]),
    ]),
  };
}

export async function getOperationalDutyCsv(eventId: string) {
  const report = await getOperationalReports(eventId);
  if (!report) {
    throw new Error("Event not found.");
  }

  return {
    fileName: `${report.event.name.toLowerCase().replace(/\s+/g, "-")}-duties-${formatDateRange(report.event.startsAt, report.event.endsAt)}.csv`,
    content: toCsv([
      ["Assignment", "Club", "Club Code"],
      ...report.dutyRows.flatMap((row) =>
        row.clubs.map((club) => [row.assignment, club.clubName, club.clubCode]),
      ),
    ]),
  };
}

export async function getOperationalAvCsv(eventId: string) {
  const report = await getOperationalReports(eventId);
  if (!report) {
    throw new Error("Event not found.");
  }

  return {
    fileName: `${report.event.name.toLowerCase().replace(/\s+/g, "-")}-av-${formatDateRange(report.event.startsAt, report.event.endsAt)}.csv`,
    content: toCsv([
      ["Club", "Club Code", "Requested Items"],
      ...report.avRows.map((row) => [row.clubName, row.clubCode, row.requestedItems]),
    ]),
  };
}
