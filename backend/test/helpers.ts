import { env } from "cloudflare:workers";
import app from "../src/index";
import { getPrisma } from "../src/db";
import { SESSION_COOKIE } from "../src/lib/session";

// Direct database access for assertions. Opens and closes a connection each
// time instead of holding one for the whole file: the local `prisma dev`
// server accepts one connection at a time, so a long-lived test connection
// would make every API request under test queue behind it.
export async function db<T>(fn: (prisma: ReturnType<typeof getPrisma>) => Promise<T>): Promise<T> {
  const prisma = getPrisma(env.DATABASE_URL);
  try {
    return await fn(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

let counter = 0;
export const uniqueEmail = (label = "user") =>
  `${label}-${Date.now()}-${++counter}@test.inkstack.app`;

// A distinct client IP per signup, so the signup rate limit (keyed by IP)
// doesn't trip across the whole suite. In production Cloudflare sets this
// header itself, so clients can't spoof it.
const uniqueIp = () => `10.0.${Math.floor(counter / 250)}.${counter % 250}`;

type Init = { method?: string; json?: unknown; cookie?: string; headers?: Record<string, string> };

export async function call(path: string, { method = "GET", json, cookie, headers = {} }: Init = {}) {
  const res = await app.request(
    `http://inkstack.test/api/v1${path}`,
    {
      method,
      headers: {
        ...(json !== undefined && { "Content-Type": "application/json" }),
        ...(cookie && { Cookie: cookie }),
        "cf-connecting-ip": uniqueIp(),
        ...headers,
      },
      body: json === undefined ? undefined : JSON.stringify(json),
    },
    env,
  );
  const text = await res.text();
  return { res, status: res.status, body: text ? JSON.parse(text) : null };
}

export function sessionCookie(res: Response) {
  const header = res.headers.get("set-cookie") ?? "";
  const match = header.match(new RegExp(`${SESSION_COOKIE}=([^;]*)`));
  return match ? `${SESSION_COOKIE}=${match[1]}` : undefined;
}

export async function signUp(name = "Test User") {
  const email = uniqueEmail();
  const password = "correct-horse-battery";
  const { res, body } = await call("/auth/signup", { method: "POST", json: { email, password, name } });
  const cookie = sessionCookie(res);
  if (!cookie) throw new Error(`signup failed: ${JSON.stringify(body)}`);
  return { email, password, cookie, user: body };
}
