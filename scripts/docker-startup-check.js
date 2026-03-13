const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();

  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("Database connectivity check passed.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Database connectivity check failed during container startup.");
    console.error(message);

    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    }

    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
