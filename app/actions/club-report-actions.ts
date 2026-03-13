"use server";

import { ReportStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { type Session } from "next-auth";

import { auth } from "../../auth";
import { safeWriteAuditLog } from "../../lib/audit-log";
import { parseMonthInput } from "../../lib/club-activity";
import { getManagedClubContext } from "../../lib/club-management";
import { getClubActivityMonthSnapshot, findRosterYearForClubDate } from "../../lib/data/club-activity";
import { readManagedClubId } from "../../lib/director-path";
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

function requireDate(value: FormDataEntryValue | null, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }

  const parsedDate = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error(`${label} is invalid.`);
  }

  return parsedDate;
}

function requireText(value: FormDataEntryValue | null, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }

  return value.trim();
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

export async function createMonthlyReport(formData: FormData) {
  const managedClub = await getManagedClubContext(readManagedClubId(formData.get("clubId")));
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
  const clubId = managedClub.clubId;
  const rosterYear = await findRosterYearForClubDate(clubId, reportMonth);

  if (!rosterYear) {
    throw new Error("No roster year covers the selected report month.");
  }

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

  await safeWriteAuditLog({
    actorUserId: managedClub.userId,
    action: "monthly_report.submit",
    targetType: "MonthlyReport",
    targetId: `${clubId}:${reportMonth.toISOString()}`,
    clubId,
    summary: `Submitted monthly report for ${reportMonth.toISOString().slice(0, 7)}.`,
    metadata: {
      rosterYearId: rosterYear.id,
      rosterYearLabel: rosterYear.yearLabel,
      meetingCount,
      averagePathfinderAttendance,
      averageStaffAttendance,
      uniformCompliance,
      pointsCalculated,
    },
  });

  revalidatePath("/director/reports");
  revalidatePath("/director/dashboard");
  revalidatePath("/admin/reports");
}

export async function saveClubActivity(formData: FormData) {
  const managedClub = await getManagedClubContext(readManagedClubId(formData.get("clubId")));
  const activityIdValue = formData.get("activityId");
  const activityId = typeof activityIdValue === "string" && activityIdValue.trim().length > 0 ? activityIdValue.trim() : null;
  const activityDate = requireDate(formData.get("activityDate"), "Activity date");
  const title = requireText(formData.get("title"), "Activity title");
  const pathfinderAttendance = requireNumber(formData.get("pathfinderAttendance"), "Pathfinder attendance");
  const staffAttendance = requireNumber(formData.get("staffAttendance"), "Staff attendance");
  const uniformCompliance = requireNumber(formData.get("uniformCompliance"), "Uniform compliance");
  const notesValue = formData.get("notes");
  const notes = typeof notesValue === "string" && notesValue.trim().length > 0 ? notesValue.trim() : null;

  if (uniformCompliance > 100) {
    throw new Error("Uniform compliance must be between 0 and 100.");
  }

  const rosterYear = await findRosterYearForClubDate(managedClub.clubId, activityDate);

  if (!rosterYear) {
    throw new Error("No roster year covers the selected activity date.");
  }

  if (activityId) {
    const existingActivity = await prisma.clubActivity.findFirst({
      where: {
        id: activityId,
        clubRosterYear: {
          clubId: managedClub.clubId,
        },
      },
      select: {
        id: true,
      },
    });

    if (!existingActivity) {
      throw new Error("Activity not found for this club.");
    }

    await prisma.clubActivity.update({
      where: {
        id: activityId,
      },
      data: {
        clubRosterYearId: rosterYear.id,
        activityDate,
        title,
        pathfinderAttendance,
        staffAttendance,
        uniformCompliance,
        notes,
      },
    });
  } else {
    await prisma.clubActivity.create({
      data: {
        clubRosterYearId: rosterYear.id,
        activityDate,
        title,
        pathfinderAttendance,
        staffAttendance,
        uniformCompliance,
        notes,
      },
    });
  }

  revalidatePath("/director/reports");
  revalidatePath("/director/dashboard");
}

export async function deleteClubActivity(formData: FormData) {
  const managedClub = await getManagedClubContext(readManagedClubId(formData.get("clubId")));
  const activityId = requireText(formData.get("activityId"), "Activity");

  const existingActivity = await prisma.clubActivity.findFirst({
    where: {
      id: activityId,
      clubRosterYear: {
        clubId: managedClub.clubId,
      },
    },
    select: {
      id: true,
    },
  });

  if (!existingActivity) {
    throw new Error("Activity not found for this club.");
  }

  await prisma.clubActivity.delete({
    where: {
      id: activityId,
    },
  });

  revalidatePath("/director/reports");
  revalidatePath("/director/dashboard");
}

export async function getDirectorReportsDashboardData(clubIdOverride?: string | null, monthInput?: string | null) {
  const managedClub = await getManagedClubContext(clubIdOverride);
  const clubId = managedClub.clubId;
  const selectedMonth = parseMonthInput(monthInput);

  const [club, recentReports, monthSnapshot] = await Promise.all([
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
    getClubActivityMonthSnapshot(clubId, selectedMonth),
  ]);

  return {
    clubName: club?.name ?? "Your Club",
    recentReports,
    selectedMonthInput: monthSnapshot.selectedMonthInput,
    selectedMonth: selectedMonth,
    selectedRosterYear: monthSnapshot.rosterYear,
    selectedMonthActivities: monthSnapshot.activities,
    selectedMonthAutoFill: monthSnapshot.autoFill,
    selectedMonthExistingReport: monthSnapshot.existingReport,
    selectedMonthFormValues: monthSnapshot.formValues,
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
