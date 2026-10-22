# ADR 0002 — Password hashing on Workers

- **Status:** Accepted (2026-10-22)

## Context

The original app stored passwords in plain text and its sign-in endpoint never
compared the password at all, so any account could be taken over with any
password. Existing rows in the database still hold plain-text passwords.

Options on Workers:

| Option | Notes |
|---|---|
| Argon2id (OWASP's first choice) | Not in Web Crypto; needs a WASM build and more CPU/memory per request. |
| bcrypt | Needs a library; 72-byte input limit. OWASP: legacy systems only. |
| **PBKDF2-HMAC-SHA256** | Built into the runtime's Web Crypto. OWASP recommends **600,000** iterations. |

## The limit that local tests can't see

workerd's PBKDF2 implementation asks the isolate's *limit enforcer* whether an
iteration count is allowed, and throws
`Pbkdf2 failed: iteration counts above <max> are not supported` if not
([source](https://github.com/cloudflare/workerd/blob/main/src/workerd/api/crypto/pbkdf2.c%2B%2B)).
Cloudflare's production enforcer caps it (reported at 100,000); the open-source
workerd used by `wrangler dev` and the test pool has **no cap**. A local test
confirmed 600,000 iterations succeed locally. Choosing OWASP's number would
therefore pass every test and break every sign-up once deployed.

## Decision

- PBKDF2-HMAC-SHA256, **100,000 iterations**, 16-byte random salt, 256-bit key
  (`backend/src/lib/password.ts`).
- Self-describing format: `pbkdf2_sha256$<iterations>$<salt>$<hash>`.
- **Upgrade on sign-in:** if the stored value is legacy plain text, or used
  fewer iterations, re-hash it after a successful sign-in. No forced resets.
- Constant-time comparison; an unknown email still runs a hash, and both cases
  return the same `401 Invalid email or password`.
- Sign-in attempts are rate-limited per account (Workers Rate Limiting binding).
- A unit test pins the iteration count, with a comment explaining why.

## Consequences

- Below OWASP's PBKDF2 recommendation, a deliberate trade-off forced by the
  platform and compensated by rate limiting and the upgrade path.
- Moving to Argon2id later needs no data migration: new hashes get the new
  prefix and old ones are upgraded on the next sign-in.
