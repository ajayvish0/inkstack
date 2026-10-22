import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { csrf } from "hono/csrf";
import { zValidator } from "@hono/zod-validator";
import { z, type ZodType } from "zod";
import { getPrisma } from "./db";
import { badRequest, tooManyRequests, unauthorized } from "./lib/http";
import { readSession } from "./lib/session";
import type { AppEnv } from "./types";

// One Prisma client per request: Workers can't keep a pool across requests.
// The connection is closed once the response is sent; leaving it open leaks a
// database connection per request.
export const withPrisma = createMiddleware<AppEnv>(async (c, next) => {
  const prisma = getPrisma(c.env.DATABASE_URL);
  c.set("prisma", prisma);
  try {
    await next();
  } finally {
    const closing = prisma.$disconnect();
    try {
      c.executionCtx.waitUntil(closing);
    } catch {
      // No ExecutionContext (e.g. app.request() in tests): wait inline.
      await closing;
    }
  }
});

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const userId = await readSession(c);
  if (!userId) throw unauthorized();
  c.set("userId", userId);
  await next();
});

// Sets userId when a valid session exists, but lets anonymous readers through.
export const optionalAuth = createMiddleware<AppEnv>(async (c, next) => {
  const userId = await readSession(c);
  if (userId) c.set("userId", userId);
  await next();
});

// Cookie-authenticated writes must come from our own origin (or an explicitly
// allowed one, like the Vite dev server). Bearer-token clients carry no ambient
// credentials, so they are exempt.
export const csrfProtection = createMiddleware<AppEnv>(async (c, next) => {
  if (c.req.header("authorization")?.startsWith("Bearer ")) return next();
  const allowed = (c.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return csrf({
    origin: (origin, ctx) => origin === new URL(ctx.req.url).origin || allowed.includes(origin),
  })(c, next);
});

// Applies the Workers Rate Limiting binding when it's configured. The key
// should identify the actor (e.g. the email being signed into), not just an IP.
export async function enforceRateLimit(c: Context<AppEnv>, key: string) {
  const limiter = c.env.AUTH_RATE_LIMITER;
  if (!limiter) return;
  const { success } = await limiter.limit({ key });
  if (!success) throw tooManyRequests();
}

// zod validation that fails with the API's standard error body.
export const validate = <T extends ZodType, Target extends "json" | "query" | "param">(
  target: Target,
  schema: T,
) =>
  zValidator(target, schema, (result) => {
    if (!result.success) {
      const { fieldErrors, formErrors } = z.flattenError(result.error);
      throw badRequest(formErrors[0] ?? "Some fields are invalid", fieldErrors as Record<string, string[]>);
    }
  });
