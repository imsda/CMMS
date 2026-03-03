import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "../../../../auth";
import { privateUploadsDirectory } from "../../../../lib/local-storage";
import { prisma } from "../../../../lib/prisma";

const contentTypeByExtension: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
};

function resolveContentType(filename: string) {
  const extension = path.extname(filename).toLowerCase();
  return contentTypeByExtension[extension] ?? "application/octet-stream";
}

export async function GET(
  _request: Request,
  { params }: { params: { filename: string } },
) {
  const session = await auth();

  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { filename } = params;
  const safeFilename = path.basename(filename);

  if (!safeFilename || safeFilename !== filename) {
    return new NextResponse("Invalid file name.", { status: 400 });
  }

  const rosterMember = await prisma.rosterMember.findFirst({
    where: {
      insuranceCardFilename: safeFilename,
    },
    select: {
      id: true,
      clubRosterYear: {
        select: {
          clubId: true,
        },
      },
    },
  });

  if (!rosterMember) {
    return new NextResponse("File not found.", { status: 404 });
  }

  let hasAccess = session.user.role === UserRole.SUPER_ADMIN;

  if (!hasAccess && session.user.role === UserRole.CLUB_DIRECTOR) {
    const membership = await prisma.clubMembership.findFirst({
      where: {
        userId: session.user.id,
        clubId: rosterMember.clubRosterYear.clubId,
      },
      select: {
        id: true,
      },
    });

    hasAccess = Boolean(membership);
  }

  if (!hasAccess) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const filePath = path.join(privateUploadsDirectory, safeFilename);

  try {
    await access(filePath);

    const nodeStream = createReadStream(filePath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": resolveContentType(safeFilename),
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse("File not found.", { status: 404 });
  }
}
