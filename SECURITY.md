# Security

## Reporting a vulnerability

Please don't open a public issue. Email the maintainer (see the GitHub
profile) with steps to reproduce, and allow a reasonable time for a fix before
disclosing.

## What Inkstack does today

| Area | Measure | Where |
|---|---|---|
| Passwords | PBKDF2-HMAC-SHA256, 100k iterations, per-user salt; legacy plain-text rows upgraded on sign-in ([ADR 0002](docs/adr/0002-password-hashing-on-workers.md)) | `backend/src/lib/password.ts` |
| Sign-in | Constant-time compare; same response for unknown email and wrong password; dummy hash for unknown emails | `backend/src/routes/auth.ts` |
| Brute force | Workers Rate Limiting: 10 sign-ins per minute per account, 10 sign-ups per minute per IP (approximate, per location) | `wrangler.toml`, `middleware.ts` |
| Sessions | HS256 JWT, algorithm pinned, 7-day expiry, `HttpOnly` + `SameSite=Lax` (+ `Secure` on HTTPS) cookie ([ADR 0003](docs/adr/0003-sessions-and-csrf.md)) | `backend/src/lib/session.ts` |
| CSRF | SameSite cookie, Origin check on cookie-authenticated writes, no CORS | `backend/src/middleware.ts` |
| Authorization | Ownership checks on every write; drafts readable only by their author | `backend/src/routes/posts.ts` |
| Input | Every body and query validated with shared zod schemas, with length limits | `common/src/index.ts` |
| XSS | Markdown rendered without raw HTML; `javascript:` URLs dropped; external links `rel="noopener noreferrer nofollow"`; values injected into HTML at the edge are escaped | `frontend/src/components/Markdown.tsx`, `backend/src/og.ts` |
| Headers | `secureHeaders()` (nosniff, frame options, HSTS, referrer policy, …) | `backend/src/index.ts` |
| Secrets | Never in the repo: `wrangler secret put` in production, git-ignored `.dev.vars` locally | `backend/wrangler.toml` |
| Dependencies | `npm audit --omit=dev --audit-level=high` in CI | `.github/workflows/ci.yml` |

Most of these have regression tests in `backend/test/api.test.ts` and
`frontend/src/test/`.

## Known gaps

- No server-side session revocation: a stolen token is valid until it expires.
- No email verification or password reset flow.
- PBKDF2 runs below OWASP's 600k recommendation because of the Workers limit
  (see ADR 0002).
- No Content-Security-Policy on the HTML yet.
- `npm audit` (including dev dependencies) reports advisories in local tooling
  only (Tailwind 3's file watcher, Wrangler's local simulator); none ship to
  production.
