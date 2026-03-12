import { prisma } from "../../../lib/prisma";
import { ComplianceSyncDashboard } from "./_components/compliance-sync-dashboard";

export const dynamic = "force-dynamic";

export default async function ComplianceDashboardPage() {
  const rosterYears = await prisma.clubRosterYear.findMany({
    select: {
      id: true,
      yearLabel: true,
      isActive: true,
      club: {
        select: {
          name: true,
          code: true,
        },
      },
    },
    orderBy: [
      {
        isActive: "desc",
      },
      {
        club: {
          name: "asc",
        },
      },
      {
        yearLabel: "desc",
      },
    ],
  });

  return <ComplianceSyncDashboard rosterYears={rosterYears} />;
}
