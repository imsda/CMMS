"use server";

import { RolloverStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "../../auth";
import { bytesToMegabytes, deleteLocalFile } from "../../lib/local-storage";
import { prisma } from "../../lib/prisma";

export type PurgeStorageResult = {
  success: boolean;
  message: string;
  filesDeleted: number;
  megabytesFreed: number;
};

function formatMegabytes(value: number) {
  return value.toFixed(2);
}

export async function purgeInactiveInsuranceCards(): Promise<void> {
  const session = await auth();

  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    throw new Error("Only super admins can purge storage.");
  }

  const members = await prisma.rosterMember.findMany({
    where: {
      rolloverStatus: {
        in: [RolloverStatus.ARCHIVED, RolloverStatus.GRADUATED],
      },
      insuranceCardFilename: {
        not: null,
      },
    },
    select: {
      id: true,
      insuranceCardFilename: true,
    },
  });

  let filesDeleted = 0;
  let bytesFreed = 0;

  for (const member of members) {
    if (!member.insuranceCardFilename) {
      continue;
    }

    const deletionResult = await deleteLocalFile(member.insuranceCardFilename);

    if (deletionResult.deleted) {
      filesDeleted += 1;
      bytesFreed += deletionResult.bytesFreed;
    }

    await prisma.rosterMember.update({
      where: {
        id: member.id,
      },
      data: {
        insuranceCardFilename: null,
      },
    });
  }

  const megabytesFreed = bytesToMegabytes(bytesFreed);

  revalidatePath("/admin/storage");

  void formatMegabytes(megabytesFreed);
}
