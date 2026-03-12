import { MemberRole, type Prisma } from "@prisma/client";

export const ADULT_ROLES: MemberRole[] = [
  MemberRole.STAFF,
  MemberRole.DIRECTOR,
  MemberRole.COUNSELOR,
];

export type CsvRecord = {
  rowNumber: number;
  firstName: string;
  lastName: string;
  status: string;
  dateOfBirth: string | null;
  dateOfBirthProvided?: boolean;
  dateOfBirthInvalid?: boolean;
};

export type ComplianceSyncRowPreview = {
  rowNumber: number;
  firstName: string;
  lastName: string;
  status: string;
  dateOfBirth: string | null;
  action: "UPDATE" | "SKIP" | "AMBIGUOUS";
  reason: string;
  matchedRosterMemberId: string | null;
  matchedDisplayName: string | null;
  appliedChange?: ComplianceRowChangeAudit | null;
};

export type ComplianceRowChangeAudit = {
  applied: boolean;
  appliedAt: string;
  changedByUserId: string;
  previousBackgroundCheckCleared: boolean | null;
  previousBackgroundCheckDate: string | null;
  nextBackgroundCheckCleared: boolean | null;
  nextBackgroundCheckDate: string | null;
  result: "UPDATED" | "UNCHANGED" | "SKIPPED";
  resultReason: string;
};

export type SterlingCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  memberRole: MemberRole;
  dateOfBirth: Date | null;
};

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeDateOnly(value: Date | string | null) {
  if (!value) {
    return null;
  }

  const date = typeof value === "string" ? parseCsvDate(value) : value;

  if (!date || Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function parseCsvLine(line: string) {
  const columns: string[] = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      const nextCharacter = line[index + 1];

      if (inQuotes && nextCharacter === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }

      continue;
    }

    if (character === "," && !inQuotes) {
      columns.push(value.trim());
      value = "";
      continue;
    }

    value += character;
  }

  columns.push(value.trim());
  return columns;
}

function getColumnIndex(headers: string[], expected: string[]) {
  return headers.findIndex((header) => {
    const normalizedHeader = header.toLowerCase().replace(/[^a-z]/g, "");
    return expected.some((entry) => entry === normalizedHeader);
  });
}

function parseCsvDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const isoDate = new Date(trimmed);
  if (!Number.isNaN(isoDate.getTime())) {
    return isoDate;
  }

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!slashMatch) {
    return null;
  }

  const [, month, day, year] = slashMatch;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseSterlingCsv(csvText: string) {
  const normalized = csvText.replace(/^\uFEFF/, "");
  const rows = normalized
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter((row) => row.length > 0);

  if (rows.length < 2) {
    throw new Error("CSV must include a header row and at least one data row.");
  }

  const headers = parseCsvLine(rows[0]);
  const firstNameIndex = getColumnIndex(headers, ["firstname", "first"]);
  const lastNameIndex = getColumnIndex(headers, ["lastname", "last"]);
  const statusIndex = getColumnIndex(headers, ["status", "result"]);
  const dateOfBirthIndex = getColumnIndex(headers, ["dateofbirth", "birthdate", "dob"]);

  if (firstNameIndex === -1 || lastNameIndex === -1 || statusIndex === -1) {
    throw new Error("CSV headers must include First Name, Last Name, and Status columns.");
  }

  const records: CsvRecord[] = [];

  rows.slice(1).forEach((row, rowIndex) => {
    const columns = parseCsvLine(row);
    const firstName = columns[firstNameIndex]?.trim() ?? "";
    const lastName = columns[lastNameIndex]?.trim() ?? "";
    const status = columns[statusIndex]?.trim() ?? "";
    const rawDateOfBirth = dateOfBirthIndex === -1 ? null : columns[dateOfBirthIndex]?.trim() ?? null;
    const dateOfBirthProvided = rawDateOfBirth !== null && rawDateOfBirth.length > 0;
    const normalizedDateOfBirth = normalizeDateOnly(rawDateOfBirth);

    if (!firstName || !lastName) {
      return;
    }

    records.push({
      rowNumber: rowIndex + 2,
      firstName,
      lastName,
      status,
      dateOfBirth: normalizedDateOfBirth,
      dateOfBirthProvided,
      dateOfBirthInvalid: dateOfBirthProvided && normalizedDateOfBirth === null,
    });
  });

  return records;
}

export function buildCompliancePreview(
  records: CsvRecord[],
  candidates: SterlingCandidate[],
) {
  const rowResults: ComplianceSyncRowPreview[] = records.map((record) => {
    const passed = record.status.trim().toUpperCase() === "Y";

    if (!passed) {
      return {
        ...record,
        action: "SKIP",
        reason: "Status is not a passing Sterling result.",
        matchedRosterMemberId: null,
        matchedDisplayName: null,
      };
    }

    if (record.dateOfBirthInvalid) {
      return {
        ...record,
        action: "AMBIGUOUS",
        reason: "DOB was provided in the CSV but could not be parsed safely for matching.",
        matchedRosterMemberId: null,
        matchedDisplayName: null,
      };
    }

    const nameMatches = candidates.filter(
      (candidate) =>
        normalizeName(candidate.firstName) === normalizeName(record.firstName) &&
        normalizeName(candidate.lastName) === normalizeName(record.lastName),
    );

    const dobMatches =
      record.dateOfBirth === null
        ? nameMatches
        : nameMatches.filter(
            (candidate) => normalizeDateOnly(candidate.dateOfBirth) === record.dateOfBirth,
          );

    if (dobMatches.length === 1) {
      const match = dobMatches[0];

      return {
        ...record,
        action: "UPDATE",
        reason: record.dateOfBirth
          ? "Matched by selected roster year scope, name, and DOB."
          : "Matched by selected roster year scope and unique name.",
        matchedRosterMemberId: match.id,
        matchedDisplayName: `${match.firstName} ${match.lastName} (${match.memberRole})`,
      };
    }

    if (dobMatches.length > 1) {
      return {
        ...record,
        action: "AMBIGUOUS",
        reason: "Multiple roster members match this row within the selected roster year.",
        matchedRosterMemberId: null,
        matchedDisplayName: null,
      };
    }

    if (nameMatches.length > 1 && record.dateOfBirth === null) {
      return {
        ...record,
        action: "AMBIGUOUS",
        reason: "Multiple roster members share this name and the CSV row has no DOB to disambiguate.",
        matchedRosterMemberId: null,
        matchedDisplayName: null,
      };
    }

    return {
      ...record,
      action: "SKIP",
      reason: "No confident roster-member match was found within the selected roster year.",
      matchedRosterMemberId: null,
      matchedDisplayName: null,
    };
  });

  return {
    rowResults,
    processedRows: rowResults.length,
    passedRows: rowResults.filter((row) => row.status.trim().toUpperCase() === "Y").length,
    updateCount: rowResults.filter((row) => row.action === "UPDATE").length,
    skippedCount: rowResults.filter((row) => row.action === "SKIP").length,
    ambiguousCount: rowResults.filter((row) => row.action === "AMBIGUOUS").length,
  };
}

export function getCompliancePreviewRowsEligibleForApply(rows: ComplianceSyncRowPreview[]) {
  return rows.filter(
    (row) => row.action === "UPDATE" && typeof row.matchedRosterMemberId === "string",
  );
}

export function serializeComplianceRowResults(rows: ComplianceSyncRowPreview[]): Prisma.InputJsonValue {
  return rows.map((row) => ({
    rowNumber: row.rowNumber,
    firstName: row.firstName,
    lastName: row.lastName,
    status: row.status,
    dateOfBirth: row.dateOfBirth,
    action: row.action,
    reason: row.reason,
    matchedRosterMemberId: row.matchedRosterMemberId,
    matchedDisplayName: row.matchedDisplayName,
    appliedChange: row.appliedChange ?? null,
  }));
}
