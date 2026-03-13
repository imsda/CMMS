"use server";
import { revalidatePath } from "next/cache";

import { auth } from "../../auth";
import { safeWriteAuditLog } from "../../lib/audit-log";
import { purgeInactiveInsuranceCardFiles } from "../../lib/storage-cleanup";

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

  const result = await purgeInactiveInsuranceCardFiles();

  await safeWriteAuditLog({
    actorUserId: session.user.id,
    actorRole: session.user.role,
    action: "storage.purge_insurance_cards",
    targetType: "RosterMember",
    summary: `Purged ${result.filesDeleted} inactive insurance card file(s).`,
    metadata: {
      filesDeleted: result.filesDeleted,
      megabytesFreed: result.megabytesFreed,
      clearedMemberCount: result.clearedMemberCount,
    },
  });

  revalidatePath("/admin/storage");

  void formatMegabytes(result.megabytesFreed);
}
