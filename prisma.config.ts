// Prisma configuration (Prisma 7) – same pattern as Soloverk.
// Reads .env, tells Prisma where the schema and migrations are, and which
// database URL to use for migrations.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // `npm run db:seed` runs this (copies lib/locations.ts into the database)
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations use Neon's DIRECT connection (no "-pooler" in the host).
    // The app itself uses the pooled DATABASE_URL (see lib/prisma.ts).
    url: process.env["DIRECT_URL"],
  },
});