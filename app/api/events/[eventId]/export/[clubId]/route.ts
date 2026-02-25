import { renderToStream } from "@react-pdf/renderer";
import { createElement } from "react";
import { NextResponse } from "next/server";
import { Readable } from "node:stream";

import { auth } from "../../../../../../auth";
import { getEventRegistrationExportData } from "../../../../../../lib/data/event-registration-export";
import { EventRegistrationPdfDocument } from "../../../../../../lib/pdf/event-registration-pdf";
import { prisma } from "../../../../../../lib/prisma";

export const runtime = "nodejs";

function safeFilename(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function canDirectorAccessClub(clubId: string, userId: string) {
  const membership = await prisma.clubMembership.findFirst({
    where: {
      clubId,
      userId,
    },
    select: {
      id: true,
    },
  });

  return Boolean(membership);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ eventId: string; clubId: string }> },
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (session.user.role !== "SUPER_ADMIN" && session.user.role !== "CLUB_DIRECTOR") {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }

  const { eventId, clubId } = await context.params;

  if (session.user.role === "CLUB_DIRECTOR") {
    const hasAccess = await canDirectorAccessClub(clubId, session.user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
  }

  const registration = await getEventRegistrationExportData(eventId, clubId);

  if (!registration) {
    return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  }

  const stream = await renderToStream(
    createElement(EventRegistrationPdfDocument, { data: registration }),
  );

  const filename = `${safeFilename(registration.event.name)}-${safeFilename(registration.club.name)}-registration.pdf`;

  return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
