import { prisma } from "../prisma";
import {
  buildClubActivityAutoFill,
  buildMonthlyReportFormValues,
  formatMonthInputValue,
  getMonthWindow,
} from "../club-activity";

export async function findRosterYearForClubDate(clubId: string, activityDate: Date) {
  return prisma.clubRosterYear.findFirst({
    where: {
      clubId,
      startsOn: {
        lte: activityDate,
      },
      endsOn: {
        gte: activityDate,
      },
    },
    orderBy: {
      startsOn: "desc",
    },
    select: {
      id: true,
      yearLabel: true,
      startsOn: true,
      endsOn: true,
    },
  });
}

export async function getClubActivityMonthSnapshot(clubId: string, monthStart: Date) {
  const { monthEndExclusive } = getMonthWindow(monthStart);

  const rosterYear = await findRosterYearForClubDate(clubId, monthStart);

  const [activities, existingReport] = await Promise.all([
    rosterYear
      ? prisma.clubActivity.findMany({
          where: {
            clubRosterYearId: rosterYear.id,
            activityDate: {
              gte: monthStart,
              lt: monthEndExclusive,
            },
          },
          orderBy: [{ activityDate: "desc" }, { createdAt: "desc" }],
        })
      : Promise.resolve([]),
    prisma.monthlyReport.findUnique({
      where: {
        clubId_reportMonth: {
          clubId,
          reportMonth: monthStart,
        },
      },
      include: {
        scoreLineItems: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    }),
  ]);

  const autoFill = buildClubActivityAutoFill(activities);

  return {
    rosterYear,
    activities,
    autoFill,
    existingReport,
    formValues: buildMonthlyReportFormValues(existingReport, autoFill),
    selectedMonthInput: formatMonthInputValue(monthStart),
  };
}
