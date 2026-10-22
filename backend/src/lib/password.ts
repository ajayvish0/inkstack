// Password hashing with PBKDF2-HMAC-SHA256 from the Web Crypto API, which is
// built into the Workers runtime (no WASM, no native addon).
//
// Iterations: OWASP recommends 600,000 for PBKDF2-SHA256, but Cloudflare's
// production runtime caps PBKDF2 (reported at 100,000) and throws
// "Pbkdf2 failed: iteration counts above … are not supported" past it. The cap
// comes from the host's limit enforcer, so local workerd/wrangler dev does NOT
// enforce it: a higher count would pass every local test and then break every
// sign-up in production. The count is stored inside every hash, so it can be
// raised later (or the algorithm swapped for Argon2id via WASM) and old hashes
// upgraded on the next sign-in. See docs/adr/0002-password-hashing-on-workers.md.

export const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;
const PREFIX = "pbkdf2_sha256";

const encoder = new TextEncoder();

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (value: string) => Uint8Array.from(atob(value), (ch) => ch.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    KEY_BITS,
  );
  return new Uint8Array(bits);
}

// Compares in time that depends only on the length, not on where the first
// mismatch is.
function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, PBKDF2_ITERATIONS);
  return `${PREFIX}$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

export const isHashed = (stored: string) => stored.startsWith(`${PREFIX}$`);

export interface VerifyResult {
  valid: boolean;
  // True when the stored value should be replaced with a fresh hash: it was
  // stored in plain text by the original app, or with fewer iterations.
  needsRehash: boolean;
}

export async function verifyPassword(password: string, stored: string): Promise<VerifyResult> {
  if (!isHashed(stored)) {
    // Accounts created before hashing existed. Compare without leaking timing,
    // then let the caller upgrade the row.
    const valid = timingSafeEqual(encoder.encode(password), encoder.encode(stored));
    return { valid, needsRehash: valid };
  }

  const [, iterationsRaw, saltB64, hashB64] = stored.split("$");
  const iterations = Number(iterationsRaw);
  if (!Number.isInteger(iterations) || !saltB64 || !hashB64) {
    return { valid: false, needsRehash: false };
  }

  const expected = fromBase64(hashB64);
  const actual = await derive(password, fromBase64(saltB64), iterations);
  const valid = timingSafeEqual(actual, expected);
  return { valid, needsRehash: valid && iterations < PBKDF2_ITERATIONS };
}

// Used when the email doesn't exist, so a failed sign-in takes about as long
// whether or not the account is real.
let dummyHash: Promise<string> | undefined;
export async function burnPasswordCheck(password: string) {
  dummyHash ??= hashPassword("inkstack-timing-equaliser");
  await verifyPassword(password, await dummyHash);
}
