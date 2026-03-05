"use server";

import { ReportStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { type Session } from "next-auth";

import { auth } from "../../auth";
import { prisma } from "../../lib/prisma";

type SortField = "club" | "month";
type SortDirection = "asc" | "desc";

const POINTS_PER_MEETING = 25;
const POINTS_PER_PATHFINDER_ATTENDEE = 2;
const POINTS_PER_STAFF_ATTENDEE = 1;
const MAX_UNIFORM_POINTS = 100;

function requireNumber(value: FormDataEntryValue | null, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative whole number.`);
  }

  return parsed;
}

function requireMonthStart(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("Report month is required.");
  }

  const parsedDate = new Date(`${value}-01T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error("Report month is invalid.");
  }

  return parsedDate;
}

function ensureRole(session: Session | null, role: UserRole, message: string) {
  if (!session?.user || session.user.role !== role) {
    throw new Error(message);
  }
}

function calculateMonthlyPoints(
  meetingCount: number,
  averagePathfinderAttendance: number,
  averageStaffAttendance: number,
  uniformCompliance: number,
) {
  const uniformPoints = Math.round((Math.min(uniformCompliance, 100) / 100) * MAX_UNIFORM_POINTS);

  return (
    meetingCount * POINTS_PER_MEETING +
    averagePathfinderAttendance * POINTS_PER_PATHFINDER_ATTENDEE +
    averageStaffAttendance * POINTS_PER_STAFF_ATTENDEE +
    uniformPoints
  );
}

async function getDirectorClubId(userId: string) {
  const membership = await prisma.clubMembership.findFirst({
    where: {
      userId,
    },
    orderBy: {
      isPrimary: "desc",
    },
    select: {
      clubId: true,
    },
  });

  if (!membership) {
    throw new Error("Director is not assigned to a club.");
  }

  return membership.clubId;
}

export async function createMonthlyReport(formData: FormData) {
  const session = await auth();
  ensureRole(session, UserRole.CLUB_DIRECTOR, "Only club directors can submit monthly reports.");

  const meetingCount = requireNumber(formData.get("meetingCount"), "Meeting count");
  const averagePathfinderAttendance = requireNumber(
    formData.get("averagePathfinderAttendance"),
    "Average Pathfinder attendance",
  );
  const averageStaffAttendance = requireNumber(
    formData.get("averageStaffAttendance"),
    "Average staff attendance",
  );
  const uniformCompliance = requireNumber(formData.get("uniformCompliance"), "Uniform compliance");

  if (uniformCompliance > 100) {
    throw new Error("Uniform compliance must be between 0 and 100.");
  }

  const reportMonth = requireMonthStart(formData.get("reportMonth"));
  const clubId = await getDirectorClubId(session.user.id);
  const pointsCalculated = calculateMonthlyPoints(
    meetingCount,
    averagePathfinderAttendance,
    averageStaffAttendance,
    uniformCompliance,
  );

  await prisma.monthlyReport.upsert({
    where: {
      clubId_reportMonth: {
        clubId,
        reportMonth,
      },
    },
    update: {
      meetingCount,
      averagePathfinderAttendance,
      averageStaffAttendance,
      uniformCompliance,
      pointsCalculated,
      status: ReportStatus.SUBMITTED,
      submittedAt: new Date(),
    },
    create: {
      clubId,
      reportMonth,
      meetingCount,
      averagePathfinderAttendance,
      averageStaffAttendance,
      uniformCompliance,
      pointsCalculated,
      status: ReportStatus.SUBMITTED,
      submittedAt: new Date(),
    },
  });

  revalidatePath("/director/reports");
  revalidatePath("/admin/reports");
}

export async function getDirectorReportsDashboardData() {
  const session = await auth();
  ensureRole(session, UserRole.CLUB_DIRECTOR, "Only club directors can view this page.");

  const clubId = await getDirectorClubId(session.user.id);

  const [club, recentReports] = await Promise.all([
    prisma.club.findUnique({
      where: {
        id: clubId,
      },
      select: {
        name: true,
      },
    }),
    prisma.monthlyReport.findMany({
      where: {
        clubId,
      },
      orderBy: {
        reportMonth: "desc",
      },
      take: 6,
    }),
  ]);

  return {
    clubName: club?.name ?? "Your Club",
    recentReports,
    rubric: {
      pointsPerMeeting: POINTS_PER_MEETING,
      pointsPerPathfinderAttendance: POINTS_PER_PATHFINDER_ATTENDEE,
      pointsPerStaffAttendance: POINTS_PER_STAFF_ATTENDEE,
      maxUniformPoints: MAX_UNIFORM_POINTS,
    },
  };
}

export async function getAdminReportsData(sortBy: SortField = "month", direction: SortDirection = "desc") {
  const session = await auth();
  ensureRole(session, UserRole.SUPER_ADMIN, "Only super admins can view conference reports.");

  const monthlyOrderBy =
    sortBy === "club"
      ? [{ club: { name: direction } }, { reportMonth: "desc" as const }]
      : [{ reportMonth: direction }, { club: { name: "asc" as const } }];

  const yearEndOrderBy =
    sortBy === "club"
      ? [{ club: { name: direction } }, { reportYear: "desc" as const }]
      : [{ reportYear: direction }, { club: { name: "asc" as const } }];

  const [monthlyReports, yearEndReports] = await Promise.all([
    prisma.monthlyReport.findMany({
      where: {
        status: ReportStatus.SUBMITTED,
      },
      orderBy: monthlyOrderBy,
      include: {
        club: {
          select: {
            name: true,
            code: true,
          },
        },
      },
    }),
    prisma.yearEndReport.findMany({
      where: {
        status: ReportStatus.SUBMITTED,
      },
      orderBy: yearEndOrderBy,
      include: {
        club: {
          select: {
            name: true,
            code: true,
          },
        },
      },
    }),
  ]);

  return {
    monthlyReports,
    yearEndReports,
  };
}
