// One shared Prisma client for the whole app – same pattern as Soloverk.
//
// - Uses Neon's POOLED connection (DATABASE_URL, host with "-pooler"),
//   which handles many short connections from serverless functions.
// - In development, Next.js reloads files often; storing the client on
//   `global` stops a new database connection being opened on every reload.
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
};

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;