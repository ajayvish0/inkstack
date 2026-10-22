# ADR 0003 — Sessions: HttpOnly cookie on a single origin

- **Status:** Accepted (2026-10-22)

## Context

The original app kept a never-expiring JWT in `localStorage` and sent it as an
`Authorization` header. Any script running on the page (an XSS bug or a
compromised dependency) could read and exfiltrate it, and there was no logout.
The OWASP HTML5 Security Cheat Sheet advises against keeping session
identifiers in `localStorage`.

## Decision

- The session is an **HS256 JWT** (`sub`, `iat`, `exp` = 7 days) with the
  algorithm **pinned** on both sign and verify, stored in an
  **`HttpOnly; SameSite=Lax; Path=/`** cookie that is `Secure` whenever the
  request is HTTPS (`backend/src/lib/session.ts`). JavaScript never sees it.
- **One origin everywhere.** In production a single Worker serves the SPA and
  the API (ADR 0004). In development, Vite proxies `/api` to `wrangler dev`.
  The cookie is always first-party, and the API sends **no CORS headers at all**.
- **CSRF defence in depth:**
  1. `SameSite=Lax` — browsers don't attach the cookie to cross-site POSTs.
  2. Hono's `csrf()` middleware rejects form-encoded writes whose `Origin`
     isn't ours (or explicitly allowed, like the Vite dev server).
  3. JSON writes from another site need a CORS preflight, which is never granted.
- `Authorization: Bearer` is still accepted for API clients; those requests
  carry no ambient credentials, so they skip the CSRF check.

## Consequences

- Logging out clears the cookie, but a stolen token stays valid until it
  expires (no server-side revocation list). Short-lived access tokens plus a
  rotating refresh token would close that gap; not needed at this scale.
- Hono's JWT advisory GHSA-f67f-6cw9-8mq4 (algorithm confusion) doesn't apply:
  the algorithm is pinned and Hono is upgraded past the fix (4.11.4).
