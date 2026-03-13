import { prisma } from "./prisma";

export async function ensureDatabaseConnectivity() {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown database connectivity error.";
    console.error("Database health check failed.");
    console.error(message);

    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    }

    throw error;
  }
}
