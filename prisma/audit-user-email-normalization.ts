import { prisma } from "../lib/prisma";

type DuplicateEmailRow = {
  normalized_email: string;
  user_ids: string[];
  emails: string[];
  count: bigint;
};

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const nonNormalizedUsers = users.filter((user) => user.email !== user.email.trim().toLowerCase());

  const duplicateRows = await prisma.$queryRaw<DuplicateEmailRow[]>`
    SELECT
      lower(trim(email)) AS normalized_email,
      array_agg(id ORDER BY "createdAt" ASC) AS user_ids,
      array_agg(email ORDER BY "createdAt" ASC) AS emails,
      COUNT(*) AS count
    FROM "User"
    GROUP BY lower(trim(email))
    HAVING COUNT(*) > 1
    ORDER BY lower(trim(email)) ASC
  `;

  console.log("Email normalization audit");
  console.log("=========================");
  console.log(`Users requiring normalization: ${nonNormalizedUsers.length}`);

  if (nonNormalizedUsers.length > 0) {
    for (const user of nonNormalizedUsers) {
      console.log(
        `- ${user.id}: "${user.email}" -> "${user.email.trim().toLowerCase()}"`,
      );
    }
  }

  console.log(`Case-insensitive duplicate groups: ${duplicateRows.length}`);

  if (duplicateRows.length > 0) {
    for (const row of duplicateRows) {
      console.log(`- ${row.normalized_email} (${Number(row.count)} records)`);
      row.emails.forEach((email, index) => {
        console.log(`  • ${row.user_ids[index]} => ${email}`);
      });
    }
  }
}

main()
  .catch((error) => {
    console.error("Email normalization audit failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
