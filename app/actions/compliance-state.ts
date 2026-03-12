export type ComplianceSyncState = {
  status: "idle" | "success" | "error";
  phase: "idle" | "preview" | "applied";
  message: string;
  runId: string | null;
  fileName: string | null;
  scopeLabel: string | null;
  processedRows: number;
  passedRows: number;
  updateCount: number;
  skippedCount: number;
  ambiguousCount: number;
  appliedCount: number;
  updates: ComplianceSyncRowPreview[];
  skipped: ComplianceSyncRowPreview[];
  ambiguous: ComplianceSyncRowPreview[];
};

type ComplianceSyncRowPreview = {
  rowNumber: number;
  firstName: string;
  lastName: string;
  status: string;
  dateOfBirth: string | null;
  action: "UPDATE" | "SKIP" | "AMBIGUOUS";
  reason: string;
  matchedRosterMemberId: string | null;
  matchedDisplayName: string | null;
  appliedChange?: {
    applied: boolean;
    appliedAt: string;
    changedByUserId: string;
    previousBackgroundCheckCleared: boolean | null;
    previousBackgroundCheckDate: string | null;
    nextBackgroundCheckCleared: boolean | null;
    nextBackgroundCheckDate: string | null;
    result: "UPDATED" | "UNCHANGED" | "SKIPPED";
    resultReason: string;
  } | null;
};

export const initialComplianceSyncState: ComplianceSyncState = {
  status: "idle",
  phase: "idle",
  message: "Upload a Sterling Volunteers CSV and preview the roster-year scoped matches before applying any updates.",
  runId: null,
  fileName: null,
  scopeLabel: null,
  processedRows: 0,
  passedRows: 0,
  updateCount: 0,
  skippedCount: 0,
  ambiguousCount: 0,
  appliedCount: 0,
  updates: [],
  skipped: [],
  ambiguous: [],
};
