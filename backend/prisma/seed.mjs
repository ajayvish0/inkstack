// Seeds a clearly labelled demo account with a few real articles, so a fresh
// deployment isn't an empty page. Safe to re-run: it replaces the demo
// account's posts each time and leaves every other account alone.
//
//   npm run db:seed -w backend     (uses DATABASE_URL from backend/.env)

import "dotenv/config";
import pg from "pg";
import { webcrypto as crypto, randomUUID } from "node:crypto";

const DEMO_EMAIL = "demo@inkstack.app";
const DEMO_PASSWORD = "inkstack-demo";
const ITERATIONS = 100_000; // must match backend/src/lib/password.ts

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS }, key, 256),
  );
  const b64 = (b) => Buffer.from(b).toString("base64");
  return `pbkdf2_sha256$${ITERATIONS}$${b64(salt)}$${b64(bits)}`;
}

// Same rules as backend/src/lib/posts.ts.
const plain = (md) =>
  md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
const excerpt = (md) => {
  const t = plain(md);
  if (t.length <= 200) return t;
  const cut = t.slice(0, 200);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
};
const minutes = (md) => Math.max(1, Math.ceil(md.trim().split(/\s+/).length / 200));
const slug = (title) =>
  `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60).replace(/^-+|-+$/g, "")}-${randomUUID().slice(0, 8)}`;

const posts = [
  {
    title: "Why your local tests can't catch a Workers PBKDF2 limit",
    tags: ["cloudflare-workers", "security", "testing"],
    daysAgo: 1,
    content: `OWASP's current guidance for PBKDF2-HMAC-SHA256 is **600,000 iterations**. So the obvious move when hashing passwords on Cloudflare Workers is to use that number. Here's why that would have broken every sign-up on Inkstack — and why no local test would have noticed.

## The limit lives in the host, not the runtime

Workers expose Web Crypto, so PBKDF2 is one call:

\`\`\`ts
const bits = await crypto.subtle.deriveBits(
  { name: "PBKDF2", hash: "SHA-256", salt, iterations },
  key,
  256,
);
\`\`\`

In workerd's source, the iteration check calls the isolate's *limit enforcer*. Cloudflare's production enforcer caps the count and throws \`Pbkdf2 failed: iteration counts above … are not supported\`. The open-source workerd that \`wrangler dev\` and the Vitest pool run locally has no such cap.

So 600,000 iterations passes every local test, then fails in production.

## What I did instead

- Hash at **100,000** iterations, the production ceiling.
- Store the parameters *inside* the hash: \`pbkdf2_sha256$100000$<salt>$<hash>\`.
- On sign-in, if a stored hash used fewer iterations (or is a legacy plain-text value), re-hash it with the current parameters.

That last point means the cost can be raised later — or the algorithm swapped for Argon2id compiled to WebAssembly — without forcing anyone to reset their password.

## The takeaway

When a runtime is "the same locally and in production", check where its limits come from. A guard-rail test that pins the constant, with a comment pointing at the reason, is cheap insurance against someone "fixing" it to match OWASP.`,
  },
  {
    title: "Cursor pagination in Postgres, and why OFFSET quietly breaks feeds",
    tags: ["postgres", "api-design"],
    daysAgo: 3,
    content: `\`LIMIT 10 OFFSET 20\` is the first pagination most of us write. It has two problems that show up as soon as a feed is busy.

## 1. It gets slower the deeper you go

Postgres still has to walk past every skipped row. Page 1,000 reads 10,000 rows to return 10.

## 2. It shows duplicates and skips posts

If a new post is published while someone is reading page 1, every row shifts down by one. Page 2 now starts with the last post they already saw.

## Use the last row as the cursor

Instead of "skip N", say "give me the posts *after this one*":

\`\`\`ts
const rows = await prisma.post.findMany({
  where: { published: true },
  orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
  take: limit + 1,
  ...(cursor && { cursor: { id: cursor }, skip: 1 }),
});
const hasMore = rows.length > limit;
\`\`\`

Two details matter:

- **A unique tie-breaker.** Two posts can share a \`publishedAt\`. Ordering by \`id\` as well makes the order total, so the cursor is unambiguous.
- **Fetch one extra row.** If you get \`limit + 1\` rows back, there's another page — no separate \`COUNT(*)\` needed.

Back it with an index that matches the query:

\`\`\`sql
CREATE INDEX ON "Post" ("published", "publishedAt" DESC, "id");
\`\`\`

The trade-off: you can't jump to "page 37". For a reading feed with a *Load more* button, nobody wants to.`,
  },
  {
    title: "Giving a client-rendered SPA real link previews with HTMLRewriter",
    tags: ["cloudflare-workers", "seo", "react"],
    daysAgo: 6,
    content: `Paste a link to a single-page app into Slack or LinkedIn and you usually get the same generic title and description for every page. Link-preview bots don't run JavaScript, so they only ever see the static \`index.html\`.

The usual fixes are server-side rendering or a prerendering service. On Cloudflare Workers there's a lighter option.

## Rewrite the HTML on the way out

Inkstack serves the built SPA as static assets from the same Worker as the API. For \`/p/:slug\` only, the Worker runs first:

\`\`\`toml
[env.production.assets]
not_found_handling = "single-page-application"
run_worker_first = ["/api/*", "/p/*"]
\`\`\`

It looks the post up, fetches the normal \`index.html\`, and streams it through \`HTMLRewriter\`, appending Open Graph tags to \`<head>\`:

\`\`\`ts
return new HTMLRewriter()
  .on("title", { element: (el) => void el.setInnerContent(title) })
  .on("head", { element: (el) => void el.append(metaTags, { html: true }) })
  .transform(shell);
\`\`\`

Humans still get the exact same SPA. Crawlers get a page whose \`<head>\` describes the post.

## Things to get right

- **Escape everything** you put into an attribute. Post titles are user input.
- **Only for published posts.** Drafts and unknown slugs get the plain shell, and the SPA renders its own 404.
- It streams, so it doesn't buffer the whole document.`,
  },
  {
    title: "Database connections in serverless: the leak I almost shipped",
    tags: ["postgres", "cloudflare-workers", "debugging"],
    daysAgo: 9,
    content: `Workers can't keep a database pool alive between requests, so the advice is to create a client per request. I did that — and after a dozen requests in the test suite, Postgres started answering with \`Connection terminated unexpectedly\`.

## The bug

Creating a client per request is only half of it. Each client opened a connection and **nothing closed it**. Locally, every test request leaked one connection until the database gave up.

## The fix: close after the response

\`\`\`ts
export const withPrisma = createMiddleware(async (c, next) => {
  const prisma = getPrisma(c.env.DATABASE_URL);
  c.set("prisma", prisma);
  try {
    await next();
  } finally {
    // Don't make the user wait for the disconnect.
    c.executionCtx.waitUntil(prisma.$disconnect());
  }
});
\`\`\`

\`waitUntil\` lets the response go out immediately while the connection closes in the background. Each client also gets a pool of exactly one connection, because a request runs its queries one after another anyway.

## The second surprise: \`localhost\`

While measuring, the first query of every request took **2.8 seconds**. On Windows, \`localhost\` resolved to IPv6 \`::1\` first; the local database only listened on IPv4, so every connection waited for a fallback. Using \`127.0.0.1\` cut it to under a second, and the whole test suite went from 156 seconds to under 10.

Measure before you optimise — the slow part was nowhere near where I expected.`,
  },
];

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("BEGIN");
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const { rows } = await client.query(
    `INSERT INTO "User" (id, email, name, bio, password)
     VALUES ($1, $2, 'Inkstack Demo', 'Demo account with sample articles about building Inkstack.', $3)
     ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, name = EXCLUDED.name, bio = EXCLUDED.bio
     RETURNING id`,
    [randomUUID(), DEMO_EMAIL, passwordHash],
  );
  const authorId = rows[0].id;
  await client.query(`DELETE FROM "Post" WHERE "authorId" = $1`, [authorId]);

  for (const post of posts) {
    const id = randomUUID();
    const at = new Date(Date.now() - post.daysAgo * 86_400_000);
    await client.query(
      `INSERT INTO "Post" (id, slug, title, content, excerpt, "readingTime", published, "publishedAt", "createdAt", "updatedAt", "authorId")
       VALUES ($1, $2, $3, $4, $5, $6, true, $7, $7, $7, $8)`,
      [id, slug(post.title), post.title, post.content, excerpt(post.content), minutes(post.content), at, authorId],
    );
    for (const name of post.tags) {
      const tag = await client.query(
        `INSERT INTO "Tag" (id, name) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [randomUUID(), name],
      );
      await client.query(`INSERT INTO "_PostToTag" ("A", "B") VALUES ($1, $2)`, [id, tag.rows[0].id]);
    }
  }
  await client.query("COMMIT");
  console.log(`Seeded ${posts.length} posts for ${DEMO_EMAIL} (password: ${DEMO_PASSWORD})`);
} catch (err) {
  await client.query("ROLLBACK");
  throw err;
} finally {
  await client.end();
}
