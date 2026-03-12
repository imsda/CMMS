"use server";

import { revalidatePath } from "next/cache";

import { initialComplianceSyncState, type ComplianceSyncState } from "./compliance-state";
import { auth } from "../../auth";
import {
  ADULT_ROLES,
  buildCompliancePreview,
  getCompliancePreviewRowsEligibleForApply,
  parseSterlingCsv,
  serializeComplianceRowResults,
  type ComplianceRowChangeAudit,
  type ComplianceSyncRowPreview,
} from "../../lib/compliance-sync";
import { prisma } from "../../lib/prisma";

function isPreviewRow(value: unknown): value is ComplianceSyncRowPreview {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const row = value as Record<string, unknown>;

  return (
    typeof row.rowNumber === "number" &&
    typeof row.firstName === "string" &&
    typeof row.lastName === "string" &&
    typeof row.status === "string" &&
    (row.dateOfBirth === null || typeof row.dateOfBirth === "string") &&
    (row.action === "UPDATE" || row.action === "SKIP" || row.action === "AMBIGUOUS") &&
    typeof row.reason === "string" &&
    (row.matchedRosterMemberId === null || typeof row.matchedRosterMemberId === "string") &&
    (row.matchedDisplayName === null || typeof row.matchedDisplayName === "string")
  );
}

async function requireSuperAdmin() {
  const session = await auth();

  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    throw new Error("Only Super Admins can run this sync.");
  }

  return session.user.id;
}

function toIsoDateString(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

export async function applyComplianceSyncRun(runId: string, appliedByUserId: string) {
  const run = await prisma.complianceSyncRun.findUnique({
    where: {
      id: runId,
    },
    select: {
      id: true,
      status: true,
      fileName: true,
      processedRows: true,
      passedRows: true,
      updateCount: true,
      skippedCount: true,
      ambiguousCount: true,
      rowResults: true,
      club: {
        select: {
          name: true,
        },
      },
      clubRosterYear: {
        select: {
          id: true,
          yearLabel: true,
        },
      },
    },
  });

  if (!run) {
    throw new Error("Preview run was not found.");
  }

  const rows = Array.isArray(run.rowResults)
    ? run.rowResults.filter(isPreviewRow)
    : [];

  if (run.status === "APPLIED") {
    return {
      run,
      rows,
      updatedCount: rows.filter((row) => row.appliedChange?.result === "UPDATED").length,
      alreadyApplied: true,
    };
  }

  const updateRows = getCompliancePreviewRowsEligibleForApply(rows);

  const appliedAt = new Date();

  const { updatedCount, auditedRows } = await prisma.$transaction(async (tx) => {
    let count = 0;
    const auditByRowNumber = new Map<number, ComplianceRowChangeAudit>();

    for (const row of updateRows) {
      const rosterMember = await tx.rosterMember.findFirst({
        where: {
          id: row.matchedRosterMemberId ?? undefined,
          clubRosterYearId: run.clubRosterYear.id,
          memberRole: {
            in: ADULT_ROLES,
          },
        },
        select: {
          id: true,
          backgroundCheckCleared: true,
          backgroundCheckDate: true,
        },
      });

      if (!rosterMember) {
        auditByRowNumber.set(row.rowNumber, {
          applied: false,
          appliedAt: appliedAt.toISOString(),
          changedByUserId: appliedByUserId,
          previousBackgroundCheckCleared: null,
          previousBackgroundCheckDate: null,
          nextBackgroundCheckCleared: null,
          nextBackgroundCheckDate: null,
          result: "SKIPPED",
          resultReason: "Roster member no longer matched the scoped apply criteria.",
        });
        continue;
      }

      const nextBackgroundCheckCleared = true;
      const nextBackgroundCheckDate = rosterMember.backgroundCheckDate ?? appliedAt;
      const alreadyCleared = rosterMember.backgroundCheckCleared && rosterMember.backgroundCheckDate !== null;

      if (!alreadyCleared) {
        await tx.rosterMember.update({
          where: {
            id: rosterMember.id,
          },
          data: {
            backgroundCheckCleared: nextBackgroundCheckCleared,
            backgroundCheckDate: nextBackgroundCheckDate,
          },
        });

        count += 1;
      }

      auditByRowNumber.set(row.rowNumber, {
        applied: !alreadyCleared,
        appliedAt: appliedAt.toISOString(),
        changedByUserId: appliedByUserId,
        previousBackgroundCheckCleared: rosterMember.backgroundCheckCleared,
        previousBackgroundCheckDate: toIsoDateString(rosterMember.backgroundCheckDate),
        nextBackgroundCheckCleared,
        nextBackgroundCheckDate: toIsoDateString(nextBackgroundCheckDate),
        result: alreadyCleared ? "UNCHANGED" : "UPDATED",
        resultReason: alreadyCleared
          ? "Roster member was already marked cleared before apply."
          : "Background check status was updated from the approved preview row.",
      });
    }

    const nextRows = rows.map((row) => ({
      ...row,
      appliedChange: auditByRowNumber.get(row.rowNumber) ?? row.appliedChange ?? null,
    }));

    await tx.complianceSyncRun.update({
      where: {
        id: run.id,
      },
      data: {
        status: "APPLIED",
        appliedAt,
        appliedByUserId,
        rowResults: serializeComplianceRowResults(nextRows),
      },
    });

    return {
      updatedCount: count,
      auditedRows: nextRows,
    };
  });

  return {
    run,
    rows: auditedRows,
    updatedCount,
    alreadyApplied: false,
  };
}

function buildScopeLabel(clubName: string, yearLabel: string) {
  return `${clubName} — ${yearLabel}`;
}

function toStateFromPreview(input: {
  message: string;
  status: "success" | "error";
  runId: string | null;
  fileName: string | null;
  scopeLabel: string | null;
  processedRows: number;
  passedRows: number;
  updateCount: number;
  skippedCount: number;
  ambiguousCount: number;
  appliedCount?: number;
  rows: ComplianceSyncRowPreview[];
  phase: "preview" | "applied";
}): ComplianceSyncState {
  return {
    status: input.status,
    phase: input.phase,
    message: input.message,
    runId: input.runId,
    fileName: input.fileName,
    scopeLabel: input.scopeLabel,
    processedRows: input.processedRows,
    passedRows: input.passedRows,
    updateCount: input.updateCount,
    skippedCount: input.skippedCount,
    ambiguousCount: input.ambiguousCount,
    appliedCount: input.appliedCount ?? 0,
    updates: input.rows.filter((row) => row.action === "UPDATE"),
    skipped: input.rows.filter((row) => row.action === "SKIP"),
    ambiguous: input.rows.filter((row) => row.action === "AMBIGUOUS"),
  };
}

export async function previewSterlingBackgroundChecks(
  _previousState: ComplianceSyncState,
  formData: FormData,
): Promise<ComplianceSyncState> {
  try {
    const uploadedByUserId = await requireSuperAdmin();
    const clubRosterYearIdEntry = formData.get("clubRosterYearId");
    const file = formData.get("sterlingCsv");

    if (typeof clubRosterYearIdEntry !== "string" || clubRosterYearIdEntry.trim().length === 0) {
      return {
        ...initialComplianceSyncState,
        status: "error",
        message: "Select a club roster year before previewing the CSV.",
      };
    }

    if (!(file instanceof File)) {
      return {
        ...initialComplianceSyncState,
        status: "error",
        message: "Please choose a CSV file to upload.",
      };
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      return {
        ...initialComplianceSyncState,
        status: "error",
        message: "Only .csv files are supported.",
      };
    }

    const rosterYear = await prisma.clubRosterYear.findUnique({
      where: {
        id: clubRosterYearIdEntry.trim(),
      },
      select: {
        id: true,
        yearLabel: true,
        clubId: true,
        club: {
          select: {
            name: true,
          },
        },
        members: {
          where: {
            memberRole: {
              in: ADULT_ROLES,
            },
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            memberRole: true,
            dateOfBirth: true,
            backgroundCheckCleared: true,
          },
        },
      },
    });

    if (!rosterYear) {
      return {
        ...initialComplianceSyncState,
        status: "error",
        message: "Selected club roster year was not found.",
      };
    }

    const csvText = await file.text();
    const records = parseSterlingCsv(csvText);
    const preview = buildCompliancePreview(records, rosterYear.members);
    const rows = preview.rowResults.map((row) => {
      if (row.action !== "UPDATE") {
        return row;
      }

      const matchedMember = rosterYear.members.find((member) => member.id === row.matchedRosterMemberId);

      if (matchedMember?.backgroundCheckCleared) {
        return {
          ...row,
          action: "SKIP" as const,
          reason: "Background check is already marked cleared for this roster member.",
          matchedRosterMemberId: matchedMember.id,
          matchedDisplayName: `${matchedMember.firstName} ${matchedMember.lastName} (${matchedMember.memberRole})`,
        };
      }

      return row;
    });

    const updateCount = rows.filter((row) => row.action === "UPDATE").length;
    const skippedCount = rows.filter((row) => row.action === "SKIP").length;
    const ambiguousCount = rows.filter((row) => row.action === "AMBIGUOUS").length;

    const run = await prisma.complianceSyncRun.create({
      data: {
        uploadedByUserId,
        clubId: rosterYear.clubId,
        clubRosterYearId: rosterYear.id,
        fileName: file.name,
        processedRows: preview.processedRows,
        passedRows: preview.passedRows,
        updateCount,
        skippedCount,
        ambiguousCount,
        rowResults: serializeComplianceRowResults(rows),
      },
      select: {
        id: true,
      },
    });

    return toStateFromPreview({
      status: "success",
      phase: "preview",
      message: updateCount > 0
        ? "Preview generated. Review updates, skipped rows, and ambiguous rows before applying."
        : "Preview generated. No safe updates were found in this file.",
      runId: run.id,
      fileName: file.name,
      scopeLabel: buildScopeLabel(rosterYear.club.name, rosterYear.yearLabel),
      processedRows: preview.processedRows,
      passedRows: preview.passedRows,
      updateCount,
      skippedCount,
      ambiguousCount,
      rows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Background check preview failed.";

    return {
      ...initialComplianceSyncState,
      status: "error",
      message,
    };
  }
}

export async function applySterlingBackgroundChecksPreview(
  _previousState: ComplianceSyncState,
  formData: FormData,
): Promise<ComplianceSyncState> {
  try {
    const appliedByUserId = await requireSuperAdmin();

    const runIdEntry = formData.get("runId");
    if (typeof runIdEntry !== "string" || runIdEntry.trim().length === 0) {
      return {
        ...initialComplianceSyncState,
        status: "error",
        message: "A preview run is required before applying updates.",
      };
    }

    const result = await applyComplianceSyncRun(runIdEntry.trim(), appliedByUserId);

    if (result.alreadyApplied) {
      return toStateFromPreview({
        status: "success",
        phase: "applied",
        message: "This preview run was already applied.",
        runId: result.run.id,
        fileName: result.run.fileName,
        scopeLabel: buildScopeLabel(result.run.club.name, result.run.clubRosterYear.yearLabel),
        processedRows: result.run.processedRows,
        passedRows: result.run.passedRows,
        updateCount: result.run.updateCount,
        skippedCount: result.run.skippedCount,
        ambiguousCount: result.run.ambiguousCount,
        appliedCount: result.updatedCount,
        rows: result.rows,
      });
    }

    revalidatePath("/admin/compliance");

    return toStateFromPreview({
      status: "success",
      phase: "applied",
      message: `Applied ${result.updatedCount} background-check update(s). Ambiguous rows were left unchanged for manual review.`,
      runId: result.run.id,
      fileName: result.run.fileName,
      scopeLabel: buildScopeLabel(result.run.club.name, result.run.clubRosterYear.yearLabel),
      processedRows: result.run.processedRows,
      passedRows: result.run.passedRows,
      updateCount: result.run.updateCount,
      skippedCount: result.run.skippedCount,
      ambiguousCount: result.run.ambiguousCount,
      appliedCount: result.updatedCount,
      rows: result.rows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Background check apply failed.";

    return {
      ...initialComplianceSyncState,
      status: "error",
      message,
    };
  }
}
