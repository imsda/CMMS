import { type DocumentProps, renderToBuffer } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { NextResponse } from "next/server";

import { auth } from "../../../../../auth";
import { getEventRegistrationExportDataById } from "../../../../../lib/data/event-registration-export";
import {
  EventRegistrationPdfDocument,
  generateQrDataUrls,
} from "../../../../../lib/pdf/event-registration-pdf";
import { prisma } from "../../../../../lib/prisma";

export const runtime = "nodejs";

function safeFilename(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function canDirectorAccessRegistration(registrationId: string, userId: string) {
  const registration = await prisma.eventRegistration.findUnique({
    where: { id: registrationId },
    select: { clubId: true },
  });

  if (!registration) {
    return false;
  }

  const membership = await prisma.clubMembership.findFirst({
    where: {
      clubId: registration.clubId,
      userId,
    },
    select: { id: true },
  });

  return Boolean(membership);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ registrationId: string }> },
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (session.user.role !== "SUPER_ADMIN" && session.user.role !== "CLUB_DIRECTOR") {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }

  const { registrationId } = await context.params;

  if (session.user.role === "CLUB_DIRECTOR") {
    const hasAccess = await canDirectorAccessRegistration(registrationId, session.user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
  }

  const registration = await getEventRegistrationExportDataById(registrationId);

  if (!registration) {
    return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  }

  const qrDataUrls = registration.attendees.length > 0
    ? await generateQrDataUrls(registration.attendees, registrationId)
    : undefined;

  const documentElement = createElement(EventRegistrationPdfDocument, {
    data: registration,
    qrDataUrls,
  }) as ReactElement<DocumentProps>;

  const buffer = await renderToBuffer(documentElement);

  const filename = `${safeFilename(registration.event.name)}-${safeFilename(registration.club.name)}-registration.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
