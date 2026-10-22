import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";
import type { AppEnv } from "../types";

export const SESSION_COOKIE = "inkstack_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
// Pinned on both sign and verify so a token can never choose its own algorithm.
const ALG = "HS256";

export async function startSession(c: Context<AppEnv>, userId: string) {
  const now = Math.floor(Date.now() / 1000);
  const token = await sign({ sub: userId, iat: now, exp: now + SESSION_TTL_SECONDS }, c.env.JWT_SECRET, ALG);
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    // Browsers drop Secure cookies on plain-http hosts other than localhost;
    // locally the API is reached over http through the Vite proxy.
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function endSession(c: Context<AppEnv>) {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

// Returns the user id from a valid session, or null. Accepts the HttpOnly
// cookie (browsers) or an Authorization: Bearer header (API clients).
export async function readSession(c: Context<AppEnv>): Promise<string | null> {
  const header = c.req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : getCookie(c, SESSION_COOKIE);
  if (!token) return null;
  try {
    const payload = await verify(token, c.env.JWT_SECRET, ALG);
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
