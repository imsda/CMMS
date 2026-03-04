"use server";

import { MemberRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "../../auth";
import { prisma } from "../../lib/prisma";

export type ComplianceSyncState = {
  status: "idle" | "success" | "error";
  message: string;
  processedRows: number;
  passedRows: number;
  updatedCount: number;
  unmatchedCount: number;
  skippedCount: number;
};

export const initialComplianceSyncState: ComplianceSyncState = {
  status: "idle",
  message: "Upload a Sterling Volunteers CSV to sync adult background check status.",
  processedRows: 0,
  passedRows: 0,
  updatedCount: 0,
  unmatchedCount: 0,
  skippedCount: 0,
};

type CsvRecord = {
  firstName: string;
  lastName: string;
  status: string;
};

const ADULT_ROLES: MemberRole[] = [
  MemberRole.STAFF,
  MemberRole.DIRECTOR,
  MemberRole.COUNSELOR,
];

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

function parseSterlingCsv(csvText: string) {
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

  if (firstNameIndex === -1 || lastNameIndex === -1 || statusIndex === -1) {
    throw new Error("CSV headers must include First Name, Last Name, and Status columns.");
  }

  const records: CsvRecord[] = [];

  for (const row of rows.slice(1)) {
    const columns = parseCsvLine(row);
    const firstName = columns[firstNameIndex]?.trim() ?? "";
    const lastName = columns[lastNameIndex]?.trim() ?? "";
    const status = columns[statusIndex]?.trim() ?? "";

    if (!firstName || !lastName) {
      continue;
    }

    records.push({
      firstName,
      lastName,
      status,
    });
  }

  return records;
}

export async function syncSterlingBackgroundChecks(
  _previousState: ComplianceSyncState,
  formData: FormData,
): Promise<ComplianceSyncState> {
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      return {
        ...initialComplianceSyncState,
        status: "error",
        message: "Only Super Admins can run this sync.",
      };
    }

    const file = formData.get("sterlingCsv");

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

    const csvText = await file.text();
    const records = parseSterlingCsv(csvText);

    let updatedCount = 0;
    let unmatchedCount = 0;
    let passedRows = 0;
    let skippedCount = 0;

    for (const record of records) {
      const passed = record.status.toUpperCase() === "Y";

      if (!passed) {
        skippedCount += 1;
        continue;
      }

      passedRows += 1;

      const updateResult = await prisma.rosterMember.updateMany({
        where: {
          firstName: {
            equals: record.firstName,
            mode: "insensitive",
          },
          lastName: {
            equals: record.lastName,
            mode: "insensitive",
          },
          memberRole: {
            in: ADULT_ROLES,
          },
        },
        data: {
          backgroundCheckCleared: true,
          backgroundCheckDate: new Date(),
        },
      });

      if (updateResult.count > 0) {
        updatedCount += updateResult.count;
      } else {
        unmatchedCount += 1;
      }
    }

    revalidatePath("/admin/compliance");

    return {
      status: "success",
      message: "Sterling Volunteers sync completed.",
      processedRows: records.length,
      passedRows,
      updatedCount,
      unmatchedCount,
      skippedCount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Background check sync failed.";

    return {
      ...initialComplianceSyncState,
      status: "error",
      message,
    };
  }
}
