import type { PrismaClient } from "./generated/prisma/client";

export interface Bindings {
  DATABASE_URL: string;
  // At least 32 random bytes. Set with `wrangler secret put JWT_SECRET`.
  JWT_SECRET: string;
  // Comma-separated extra origins allowed to make cookie-authenticated writes,
  // e.g. the Vite dev server. Same-origin requests are always allowed.
  ALLOWED_ORIGINS?: string;
  // Optional Workers Rate Limiting binding; requests aren't limited without it.
  AUTH_RATE_LIMITER?: RateLimit;
  // Static assets (the built frontend). Only bound in production.
  ASSETS?: Fetcher;
  // Cloudflare Hyperdrive: pooled, warm connections near the database.
  // Only bound in production; local dev and tests use DATABASE_URL directly.
  HYPERDRIVE?: Hyperdrive;
}

export interface Variables {
  prisma: PrismaClient;
  userId: string;
}

export type AppEnv = { Bindings: Bindings; Variables: Variables };
