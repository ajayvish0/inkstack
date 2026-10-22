import { Hono } from "hono";
import { signinInput, signupInput, type CurrentUser } from "@inkstack/common";
import { conflict, unauthorized } from "../lib/http";
import { burnPasswordCheck, hashPassword, verifyPassword } from "../lib/password";
import { endSession, startSession } from "../lib/session";
import { enforceRateLimit, requireAuth, validate } from "../middleware";
import { Prisma } from "../generated/prisma/client";
import type { AppEnv } from "../types";

export const currentUserSelect = {
  id: true,
  email: true,
  name: true,
  bio: true,
  createdAt: true,
} as const;

export const toCurrentUser = (u: {
  id: string;
  email: string;
  name: string;
  bio: string | null;
  createdAt: Date;
}): CurrentUser => ({
  id: u.id,
  email: u.email,
  name: u.name,
  bio: u.bio,
  createdAt: u.createdAt.toISOString(),
});

const INVALID_CREDENTIALS = "Invalid email or password";

export const authRoutes = new Hono<AppEnv>()
  .post("/signup", validate("json", signupInput), async (c) => {
    await enforceRateLimit(c, `signup:${c.req.header("cf-connecting-ip") ?? "local"}`);
    const { email, password, name } = c.req.valid("json");
    try {
      const user = await c.var.prisma.user.create({
        data: { email, name, passwordHash: await hashPassword(password) },
        select: currentUserSelect,
      });
      await startSession(c, user.id);
      return c.json(toCurrentUser(user), 201);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw conflict("An account with this email already exists");
      }
      throw err;
    }
  })
  .post("/signin", validate("json", signinInput), async (c) => {
    const { email, password } = c.req.valid("json");
    // Keyed by the account being attacked, so one email can't be brute-forced
    // from many IPs, and one shared IP doesn't lock everyone out.
    await enforceRateLimit(c, `signin:${email}`);

    const prisma = c.var.prisma;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      await burnPasswordCheck(password);
      throw unauthorized(INVALID_CREDENTIALS);
    }

    const { valid, needsRehash } = await verifyPassword(password, user.passwordHash);
    if (!valid) throw unauthorized(INVALID_CREDENTIALS);

    if (needsRehash) {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(password) },
      });
    }

    await startSession(c, user.id);
    return c.json(toCurrentUser(user));
  })
  .post("/signout", (c) => {
    endSession(c);
    return c.body(null, 204);
  })
  .get("/me", requireAuth, async (c) => {
    const user = await c.var.prisma.user.findUnique({
      where: { id: c.var.userId },
      select: currentUserSelect,
    });
    // A valid token for an account that no longer exists.
    if (!user) {
      endSession(c);
      throw unauthorized();
    }
    return c.json(toCurrentUser(user));
  });
