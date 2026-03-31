import { auth } from "../../../../../../auth";
import { prisma } from "../../../../../../lib/prisma";

function escapeCsvCell(value: string): string {
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ offeringId: string }> },
) {
  const session = await auth();

  if (!session?.user || session.user.role !== "STAFF_TEACHER") {
    return new Response("Unauthorized", { status: 401 });
  }

  const { offeringId } = await params;

  const offering = await prisma.eventClassOffering.findFirst({
    where: {
      id: offeringId,
      teacherUserId: session.user.id,
    },
    select: {
      capacity: true,
      classCatalog: { select: { title: true, code: true } },
      event: { select: { name: true } },
      timeslot: { select: { label: true } },
      enrollments: {
        select: {
          attendedAt: true,
          rosterMember: {
            select: {
              firstName: true,
              lastName: true,
              ageAtStart: true,
              memberRole: true,
              clubRosterYear: {
                select: {
                  club: { select: { name: true, code: true } },
                },
              },
            },
          },
        },
        orderBy: [
          { rosterMember: { lastName: "asc" } },
          { rosterMember: { firstName: "asc" } },
        ],
      },
    },
  });

  if (!offering) {
    return new Response("Not Found", { status: 404 });
  }

  const header = [
    "Last Name",
    "First Name",
    "Age",
    "Role",
    "Club",
    "Club Code",
    "Attended",
  ]
    .map(escapeCsvCell)
    .join(",");

  const rows = offering.enrollments.map((e) => {
    const m = e.rosterMember;
    return [
      m.lastName,
      m.firstName,
      m.ageAtStart !== null ? String(m.ageAtStart) : "",
      m.memberRole.replace(/_/g, " "),
      m.clubRosterYear.club.name,
      m.clubRosterYear.club.code,
      e.attendedAt ? "Yes" : "No",
    ]
      .map(escapeCsvCell)
      .join(",");
  });

  const csv = [header, ...rows].join("\n");

  const safeEventName = offering.event.name.replace(/[^a-z0-9]/gi, "_").slice(0, 40);
  const safeCode = offering.classCatalog.code.replace(/[^a-z0-9]/gi, "_");
  const filename = `${safeCode}_${safeEventName}_roster.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
