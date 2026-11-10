import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    // Opening a fresh connection to the remote database can take several seconds
    // (TLS + cold start), longer than Prisma's 2s default wait to start a transaction.
    transactionOptions: { maxWait: 10_000 },
  });
}

// Reuse one client across hot reloads in development (otherwise every reload opens a new pool).
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
