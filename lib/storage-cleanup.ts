import { RolloverStatus } from "@prisma/client";

import { bytesToMegabytes, deleteLocalFile } from "./local-storage";
import { prisma } from "./prisma";

export type InsuranceCardCleanupResult = {
  filesDeleted: number;
  megabytesFreed: number;
  clearedMemberCount: number;
};

export async function purgeInactiveInsuranceCardFiles(): Promise<InsuranceCardCleanupResult> {
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
  const memberIdsToClear: string[] = [];

  for (const member of members) {
    if (!member.insuranceCardFilename) {
      continue;
    }

    const deletionResult = await deleteLocalFile(member.insuranceCardFilename);

    if (deletionResult.deleted) {
      filesDeleted += 1;
      bytesFreed += deletionResult.bytesFreed;
    }

    memberIdsToClear.push(member.id);
  }

  if (memberIdsToClear.length > 0) {
    await prisma.rosterMember.updateMany({
      where: {
        id: {
          in: memberIdsToClear,
        },
      },
      data: {
        insuranceCardFilename: null,
      },
    });
  }

  return {
    filesDeleted,
    megabytesFreed: bytesToMegabytes(bytesFreed),
    clearedMemberCount: memberIdsToClear.length,
  };
}
