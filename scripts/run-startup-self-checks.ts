import { prisma } from "../lib/prisma";
import { getSystemHealthSummary, runStartupSelfChecks } from "../lib/system-health";

async function main() {
  await runStartupSelfChecks();

  const summary = await getSystemHealthSummary();

  console.log("Startup self-check summary");
  console.log("==========================");
  console.log(`Pending migrations: ${summary.pendingMigrationNames.length}`);
  console.log(`Legacy medical rows: ${summary.legacyMedicalRowCount}`);
  console.log(`Student/parent users without links: ${summary.studentParentUsersWithoutLinks}`);
  console.log(`Expired auth buckets: ${summary.expiredAuthRateLimitBucketCount}`);

  if (summary.warnings.length > 0) {
    console.log("Warnings:");
    summary.warnings.forEach((warning) => {
      console.log(`- [${warning.level}] ${warning.code}: ${warning.message}`);
    });
  } else {
    console.log("No warnings detected.");
  }
}

main()
  .catch((error) => {
    console.error("Startup self-checks failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
