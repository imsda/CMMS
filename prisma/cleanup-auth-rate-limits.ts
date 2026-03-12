import { prisma } from "../lib/prisma";
import { buildExpiredAuthRateLimitBucketWhere } from "../lib/auth-rate-limit";

async function main() {
  const result = await prisma.authRateLimitBucket.deleteMany({
    where: buildExpiredAuthRateLimitBucketWhere(),
  });

  console.log(`Deleted ${result.count} expired auth rate-limit bucket(s).`);
}

main()
  .catch((error) => {
    console.error("Failed to clean up auth rate-limit buckets.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
