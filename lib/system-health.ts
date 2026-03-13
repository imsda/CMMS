import { ensureDatabaseConnectivity } from "./db-healthcheck";
import { prisma } from "./prisma";
import { REQUIRED_MIGRATION_NAMES } from "./required-migrations";
import { validateRequiredServerConfigOnStartup } from "./server-config";

const ENCRYPTED_PAYLOAD_PATTERN =
  "^[A-Za-z0-9+/]+={0,2}:[A-Za-z0-9+/]+={0,2}:[A-Za-z0-9+/]+={0,2}$";

type PendingMigrationRow = {
  migration_name: string;
};

type LegacyMedicalRow = {
  id: string;
};

export type SystemHealthWarning = {
  level: "warning" | "critical";
  code: string;
  message: string;
};

export type SystemHealthSummary = {
  warnings: SystemHealthWarning[];
  pendingMigrationNames: string[];
  legacyMedicalRowCount: number;
  studentParentUsersWithoutLinks: number;
  expiredAuthRateLimitBucketCount: number;
};

async function getAppliedMigrationNames() {
  const rows = await prisma.$queryRaw<PendingMigrationRow[]>`
    SELECT migration_name
    FROM "_prisma_migrations"
    WHERE finished_at IS NOT NULL
  `;

  return new Set(rows.map((row) => row.migration_name));
}

export async function getPendingMigrationNames() {
  const appliedMigrationNames = await getAppliedMigrationNames();
  return REQUIRED_MIGRATION_NAMES.filter((migrationName) => !appliedMigrationNames.has(migrationName));
}

export async function getLegacyMedicalRowCount() {
  const rows = await prisma.$queryRaw<LegacyMedicalRow[]>`
    SELECT id
    FROM "RosterMember"
    WHERE "lastTetanusDate" IS NOT NULL
      OR ("medicalFlags" IS NOT NULL AND "medicalFlags" !~ ${ENCRYPTED_PAYLOAD_PATTERN})
      OR ("dietaryRestrictions" IS NOT NULL AND "dietaryRestrictions" !~ ${ENCRYPTED_PAYLOAD_PATTERN})
      OR ("insuranceCompany" IS NOT NULL AND "insuranceCompany" !~ ${ENCRYPTED_PAYLOAD_PATTERN})
      OR ("insurancePolicyNumber" IS NOT NULL AND "insurancePolicyNumber" !~ ${ENCRYPTED_PAYLOAD_PATTERN})
    LIMIT 1000
  `;

  return rows.length;
}

export async function getExpiredAuthRateLimitBucketCount() {
  const staleWindowStart = new Date(Date.now() - 15 * 60 * 1000);

  return prisma.authRateLimitBucket.count({
    where: {
      OR: [
        {
          blockedUntil: {
            not: null,
            lt: new Date(),
          },
        },
        {
          blockedUntil: null,
          windowStartedAt: {
            lt: staleWindowStart,
          },
        },
      ],
    },
  });
}

export async function getSystemHealthSummary(): Promise<SystemHealthSummary> {
  const [pendingMigrationNames, legacyMedicalRowCount, studentParentUsersWithoutLinks, expiredAuthRateLimitBucketCount] =
    await Promise.all([
      getPendingMigrationNames(),
      getLegacyMedicalRowCount(),
      prisma.user.count({
        where: {
          role: "STUDENT_PARENT",
          rosterMemberLinks: {
            none: {},
          },
        },
      }),
      getExpiredAuthRateLimitBucketCount(),
    ]);

  const warnings: SystemHealthWarning[] = [];

  if (pendingMigrationNames.length > 0) {
    warnings.push({
      level: "critical",
      code: "pending_migrations",
      message: `${pendingMigrationNames.length} database migration(s) have not been applied.`,
    });
  }

  if (legacyMedicalRowCount > 0) {
    warnings.push({
      level: "critical",
      code: "medical_backfill_incomplete",
      message: `${legacyMedicalRowCount} roster member record(s) still appear to contain legacy medical plaintext or unbackfilled tetanus data.`,
    });
  }

  if (studentParentUsersWithoutLinks > 0) {
    warnings.push({
      level: "warning",
      code: "portal_links_missing",
      message: `${studentParentUsersWithoutLinks} student/parent portal account(s) have no explicit student links.`,
    });
  }

  if (expiredAuthRateLimitBucketCount > 0) {
    warnings.push({
      level: "warning",
      code: "auth_bucket_cleanup_due",
      message: `${expiredAuthRateLimitBucketCount} expired auth rate-limit bucket(s) are ready for cleanup.`,
    });
  }

  return {
    warnings,
    pendingMigrationNames,
    legacyMedicalRowCount,
    studentParentUsersWithoutLinks,
    expiredAuthRateLimitBucketCount,
  };
}

export async function runStartupSelfChecks() {
  validateRequiredServerConfigOnStartup();

  if (process.env.NODE_ENV !== "production") {
    return;
  }

  await ensureDatabaseConnectivity();

  const summary = await getSystemHealthSummary();

  if (summary.pendingMigrationNames.length > 0) {
    throw new Error(
      `Pending Prisma migrations detected: ${summary.pendingMigrationNames.join(", ")}.`,
    );
  }

  if (summary.legacyMedicalRowCount > 0) {
    throw new Error(
      `Medical encryption backfill is incomplete. ${summary.legacyMedicalRowCount} legacy roster member record(s) still need remediation.`,
    );
  }
}
