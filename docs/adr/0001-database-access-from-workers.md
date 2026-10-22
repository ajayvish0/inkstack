# ADR 0001 — Database access from Cloudflare Workers

- **Status:** Accepted (2026-10-22)
- **Supersedes:** the original design, which used Prisma Accelerate

## Context

The API runs on Cloudflare Workers. A Worker isolate can't keep a database
connection pool alive between requests the way a long-running Node server can,
and Postgres is expensive to connect to from many short-lived isolates.

The original version solved this with **Prisma Accelerate**, a hosted
connection pool reached over HTTPS (`prisma://` URLs). Prisma's documentation
now states that *"Prisma Accelerate … will be retired on December 1, 2026"*
([docs](https://www.prisma.io/docs/accelerate)). Staying on it meant the API
would stop reaching its database on that date.

## Decision

- Upgrade to **Prisma ORM 7** with the `prisma-client` generator
  (`runtime = "cloudflare"`) and the **`@prisma/adapter-pg`** driver adapter,
  which talks to Postgres directly over TCP (`nodejs_compat`).
- Create **one Prisma client per request**, with a pool of **one connection**,
  and **close it after the response** with `executionCtx.waitUntil(prisma.$disconnect())`
  (`backend/src/middleware.ts`).
- In production, point `DATABASE_URL` at Postgres directly for now; add
  **Cloudflare Hyperdrive** for edge connection pooling when traffic warrants it
  ([Cloudflare guide](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/prisma-orm/)).
  The code only needs the connection string to change.

## Consequences

- No third-party pooling service and no API key; local development works
  against any Postgres, including `prisma dev`.
- **Found while testing:** creating a client per request without closing it
  leaked one connection per request; the local database dropped connections
  after about a dozen requests. The middleware now always disconnects.
- **Measured locally** (Windows, `prisma dev`, workerd via Vitest): the first
  Prisma client in a fresh isolate took ~820 ms (WebAssembly query compiler
  start-up); subsequent clients ~6 ms; a raw `pg` connect + query ~11 ms. Using
  `localhost` instead of `127.0.0.1` added ~2 s per connection (IPv6 `::1` tried
  first). These are dev-machine numbers, not production latency.
- The Worker bundle grew to ~1.4 MB gzipped (query compiler WASM), within the
  Workers free-plan 3 MB limit.
