import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Migrations need a direct connection. If DATABASE_URL goes through a connection
    // pooler (e.g. a Neon "-pooler" host), set DIRECT_URL to the direct connection string.
    url: process.env.DIRECT_URL || env("DATABASE_URL"),
  },
});