import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Workers can't share a connection pool across requests, so each request gets
// its own small client and closes it when the response is done (see the
// withPrisma middleware). In production DATABASE_URL can point at a Hyperdrive
// binding's connectionString to get pooling at the edge.
export const getPrisma = (databaseUrl: string) => {
  // A request runs its queries one after another, so one connection is enough.
  const adapter = new PrismaPg({ connectionString: databaseUrl, max: 1 });
  return new PrismaClient({ adapter });
};
