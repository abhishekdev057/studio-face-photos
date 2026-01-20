import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasourceUrl: process.env.POSTGRES_PRISMA_URL
      ? process.env.POSTGRES_PRISMA_URL + (process.env.POSTGRES_PRISMA_URL.includes("?") ? "&" : "?") + "connection_limit=10&pool_timeout=30"
      : undefined,
    log: ["query"],
  });



if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
