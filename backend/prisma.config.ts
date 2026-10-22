import "dotenv/config";
import { defineConfig } from "prisma/config";

// Used by the Prisma CLI (migrate, generate, studio). The Worker reads its
// connection string from its own bindings at runtime, not from here.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Not env(): that throws when unset, which would break `prisma generate`
    // (run on postinstall) in a fresh clone that has no .env yet.
    url: process.env.DATABASE_URL ?? "",
  },
});
