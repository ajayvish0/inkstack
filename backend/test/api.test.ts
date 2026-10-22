import { env } from "cloudflare:workers";
import { afterAll, describe, expect, it } from "vitest";
import { call, db, sessionCookie, signUp, uniqueEmail } from "./helpers";

afterAll(() =>
  db(async (prisma) => {
    // Posts cascade with their author.
    await prisma.user.deleteMany({ where: { email: { endsWith: "@test.inkstack.app" } } });
    await prisma.tag.deleteMany({ where: { posts: { none: {} } } });
  }),
);

describe("health", () => {
  it("reports ok when the database answers", async () => {
    const { status, body } = await call("/health");
    expect(status).toBe(200);
    expect(body).toEqual({ status: "ok" });
  });
});

describe("auth", () => {
  it("signs up, sets an HttpOnly session cookie and returns the user", async () => {
    const email = uniqueEmail("signup");
    const { res, status, body } = await call("/auth/signup", {
      method: "POST",
      json: { email: email.toUpperCase(), password: "correct-horse", name: "Ada" },
    });
    expect(status).toBe(201);
    expect(body).toMatchObject({ email, name: "Ada" });
    expect(body).not.toHaveProperty("passwordHash");
    const setCookie = res.headers.get("set-cookie")!;
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");

    const stored = await db((prisma) => prisma.user.findUniqueOrThrow({ where: { email } }));
    expect(stored.passwordHash).toMatch(/^pbkdf2_sha256\$/);
  });

  it("rejects invalid input with field errors", async () => {
    const { status, body } = await call("/auth/signup", {
      method: "POST",
      json: { email: "nope", password: "short", name: "" },
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe("validation_error");
    expect(Object.keys(body.error.fields)).toEqual(expect.arrayContaining(["email", "password", "name"]));
  });

  it("refuses a duplicate email with 409", async () => {
    const { email } = await signUp();
    const { status } = await call("/auth/signup", {
      method: "POST",
      json: { email, password: "another-password", name: "Twin" },
    });
    expect(status).toBe(409);
  });

  it("signs in only with the correct password", async () => {
    const { email, password } = await signUp();
    const ok = await call("/auth/signin", { method: "POST", json: { email, password } });
    expect(ok.status).toBe(200);
    expect(sessionCookie(ok.res)).toBeDefined();

    const wrong = await call("/auth/signin", { method: "POST", json: { email, password: "not-the-password" } });
    expect(wrong.status).toBe(401);
    expect(sessionCookie(wrong.res)).toBeUndefined();
  });

  it("gives the same answer for an unknown email and a wrong password", async () => {
    const { email } = await signUp();
    const wrong = await call("/auth/signin", { method: "POST", json: { email, password: "nope-nope" } });
    const unknown = await call("/auth/signin", {
      method: "POST",
      json: { email: uniqueEmail("ghost"), password: "nope-nope" },
    });
    expect(unknown.status).toBe(wrong.status);
    expect(unknown.body).toEqual(wrong.body);
  });

  it("upgrades a legacy plain-text password on the next sign-in", async () => {
    const email = uniqueEmail("legacy");
    await db((prisma) => prisma.user.create({ data: { email, name: "Legacy", passwordHash: "secret123" } }));

    const { status } = await call("/auth/signin", { method: "POST", json: { email, password: "secret123" } });
    expect(status).toBe(200);
    const row = await db((prisma) => prisma.user.findUniqueOrThrow({ where: { email } }));
    expect(row.passwordHash).toMatch(/^pbkdf2_sha256\$100000\$/);

    // And the new hash still works.
    const again = await call("/auth/signin", { method: "POST", json: { email, password: "secret123" } });
    expect(again.status).toBe(200);
  });

  it("returns the current user for a valid session and 401 otherwise", async () => {
    const { cookie, email } = await signUp();
    expect((await call("/auth/me", { cookie })).body.email).toBe(email);
    expect((await call("/auth/me")).status).toBe(401);
    expect((await call("/auth/me", { cookie: "inkstack_session=not.a.jwt" })).status).toBe(401);
  });

  it("rejects a token signed with a different secret", async () => {
    const { sign } = await import("hono/jwt");
    const now = Math.floor(Date.now() / 1000);
    const forged = await sign({ sub: "anyone", exp: now + 60 }, "attacker-secret", "HS256");
    expect((await call("/auth/me", { cookie: `inkstack_session=${forged}` })).status).toBe(401);
  });

  it("rejects an expired token", async () => {
    const { sign } = await import("hono/jwt");
    const { user } = await signUp();
    const now = Math.floor(Date.now() / 1000);
    const expired = await sign({ sub: user.id, iat: now - 120, exp: now - 60 }, env.JWT_SECRET, "HS256");
    expect((await call("/auth/me", { cookie: `inkstack_session=${expired}` })).status).toBe(401);
  });

  it("clears the cookie on sign-out", async () => {
    const { cookie } = await signUp();
    const { res, status } = await call("/auth/signout", { method: "POST", cookie, json: {} });
    expect(status).toBe(204);
    expect(res.headers.get("set-cookie")).toMatch(/inkstack_session=;.*Max-Age=0/);
  });

  // 10 attempts per minute per account; each allowed attempt runs a full hash.
  it("rate-limits repeated sign-in attempts for one account", { timeout: 60_000 }, async () => {
    const { email } = await signUp();
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      statuses.push((await call("/auth/signin", { method: "POST", json: { email, password: "wrong-guess" } })).status);
    }
    expect(statuses).toContain(429);
  });
});

describe("posts", () => {
  const draft = { title: "Cursor pagination in Postgres", content: "## Why\n\nOffsets **skip** rows.", tags: ["Postgres", "api-design"] };

  it("keeps drafts private to their author", async () => {
    const { cookie } = await signUp("Author");
    const { status, body: post } = await call("/posts", { method: "POST", cookie, json: draft });
    expect(status).toBe(201);
    expect(post).toMatchObject({ published: false, publishedAt: null, tags: ["api-design", "postgres"], readingTime: 1 });
    expect(post.excerpt).toBe("Why Offsets skip rows.");

    expect((await call(`/posts/${post.slug}`)).status).toBe(404);
    expect((await call(`/posts/${post.slug}`, { cookie })).status).toBe(200);

    const feed = await call(`/posts?q=${encodeURIComponent(draft.title)}`);
    expect(feed.body.items.map((p: { id: string }) => p.id)).not.toContain(post.id);
  });

  it("publishes without touching tags or content (regression)", async () => {
    const { cookie } = await signUp();
    const { body: post } = await call("/posts", { method: "POST", cookie, json: draft });
    const { status, body: published } = await call(`/posts/${post.id}`, {
      method: "PATCH",
      cookie,
      json: { published: true },
    });
    expect(status).toBe(200);
    expect(published.published).toBe(true);
    expect(published.publishedAt).not.toBeNull();
    expect(published.tags).toEqual(["api-design", "postgres"]);
    expect(published.content).toBe(draft.content);

    // Editing the title later must not unpublish it.
    const edited = await call(`/posts/${post.id}`, { method: "PATCH", cookie, json: { title: "Renamed" } });
    expect(edited.body).toMatchObject({ title: "Renamed", published: true, slug: post.slug });
    expect(edited.body.publishedAt).toBe(published.publishedAt);
  });

  it("lets only the author edit or delete", async () => {
    const owner = await signUp("Owner");
    const other = await signUp("Other");
    const { body: post } = await call("/posts", { method: "POST", cookie: owner.cookie, json: draft });

    expect((await call(`/posts/${post.id}`, { method: "PATCH", cookie: other.cookie, json: { title: "x" } })).status).toBe(403);
    expect((await call(`/posts/${post.id}`, { method: "DELETE", cookie: other.cookie, json: {} })).status).toBe(403);
    expect((await call(`/posts/${post.id}`, { method: "PATCH", json: { title: "x" } })).status).toBe(401);
    expect((await call(`/posts/${post.id}`, { method: "DELETE", cookie: owner.cookie, json: {} })).status).toBe(204);
    expect((await call(`/posts/${post.slug}`, { cookie: owner.cookie })).status).toBe(404);
  });

  it("paginates the public feed with a stable cursor", async () => {
    const { cookie, user } = await signUp("Prolific");
    for (let i = 0; i < 5; i++) {
      await call("/posts", { method: "POST", cookie, json: { title: `Post ${i}`, content: "body", published: true } });
    }
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const query: string = `/posts?author=${user.id}&limit=2${cursor ? `&cursor=${cursor}` : ""}`;
      const { body } = await call(query);
      expect(body.items.length).toBeLessThanOrEqual(2);
      seen.push(...body.items.map((p: { title: string }) => p.title));
      cursor = body.nextCursor;
    } while (cursor);
    expect(seen).toEqual(["Post 4", "Post 3", "Post 2", "Post 1", "Post 0"]);
  });

  it("filters by tag and searches title and body", async () => {
    const { cookie, user } = await signUp();
    const tag = `t${Date.now()}`;
    await call("/posts", { method: "POST", cookie, json: { title: "Tagged", content: "zebra crossing", tags: [tag], published: true } });
    await call("/posts", { method: "POST", cookie, json: { title: "Untagged", content: "plain", published: true } });

    const byTag = await call(`/posts?tag=${tag}`);
    expect(byTag.body.items.map((p: { title: string }) => p.title)).toEqual(["Tagged"]);
    const bySearch = await call(`/posts?author=${user.id}&q=ZEBRA`);
    expect(bySearch.body.items.map((p: { title: string }) => p.title)).toEqual(["Tagged"]);
    expect((await call("/tags")).body).toEqual(expect.arrayContaining([{ name: tag, count: 1 }]));
  });

  it("lists the author's own drafts and published posts", async () => {
    const { cookie } = await signUp();
    await call("/posts", { method: "POST", cookie, json: { title: "Draft", content: "x" } });
    await call("/posts", { method: "POST", cookie, json: { title: "Live", content: "x", published: true } });
    expect((await call("/me/posts", { cookie })).body).toHaveLength(2);
    expect((await call("/me/posts?status=draft", { cookie })).body.map((p: { title: string }) => p.title)).toEqual(["Draft"]);
    expect((await call("/me/posts")).status).toBe(401);
  });

  it("validates post input", async () => {
    const { cookie } = await signUp();
    const { status, body } = await call("/posts", { method: "POST", cookie, json: { title: "", content: "x", tags: ["a b"] } });
    expect(status).toBe(400);
    expect(Object.keys(body.error.fields)).toEqual(expect.arrayContaining(["title"]));
    expect((await call("/posts?limit=500")).status).toBe(400);
  });
});

describe("profiles", () => {
  it("shows a public profile with its published post count, and updates your own", async () => {
    const { cookie, user } = await signUp("Grace");
    await call("/posts", { method: "POST", cookie, json: { title: "Live", content: "x", published: true } });
    await call("/posts", { method: "POST", cookie, json: { title: "Draft", content: "x" } });

    const profile = await call(`/users/${user.id}`);
    expect(profile.body).toMatchObject({ name: "Grace", postCount: 1 });
    expect(profile.body).not.toHaveProperty("email");

    const updated = await call("/me", { method: "PATCH", cookie, json: { bio: "Writes compilers." } });
    expect(updated.body.bio).toBe("Writes compilers.");
  });
});

describe("post pages for link previews", () => {
  const SHELL = `<!doctype html><html><head><title>Inkstack</title><meta name="description" content="generic"></head><body><div id="root"></div><script src="/assets/app.js"></script></body></html>`;
  // Behaves like the real assets binding: the SPA shell is served at "/", and
  // "/index.html" redirects there (fetching it directly once broke the page).
  const ASSETS = {
    fetch: async (input: RequestInfo | URL) =>
      new URL(String(input)).pathname === "/"
        ? new Response(SHELL, { headers: { "Content-Type": "text/html" } })
        : Response.redirect("http://inkstack.test/", 307),
  };
  const page = async (slug: string) => {
    const app = (await import("../src/index")).default;
    const res = await app.request(`http://inkstack.test/p/${slug}`, {}, { ...env, ASSETS });
    return { status: res.status, html: await res.text() };
  };

  it("injects the post's title and description, escaped, and keeps the app shell", async () => {
    const { cookie } = await signUp("Quote Person");
    const { body: post } = await call("/posts", {
      method: "POST",
      cookie,
      json: { title: `Don't "break" <html>`, content: "Body text here.", published: true },
    });
    const { status, html } = await page(post.slug);
    expect(status).toBe(200);
    expect(html).toContain(`<title>Don't "break" &lt;html&gt; · Inkstack</title>`);
    expect(html).toContain(`<meta property="og:title" content="Don&#39;t &quot;break&quot; &lt;html&gt;">`);
    expect(html).toContain(`<meta name="description" content="Body text here.">`);
    expect(html).not.toContain(`content="generic"`);
    // Humans still get the SPA.
    expect(html).toContain(`<div id="root"></div>`);
    expect(html).toContain(`/assets/app.js`);
  });

  it("serves the plain shell for drafts and unknown slugs", async () => {
    const { cookie } = await signUp();
    const { body: draft } = await call("/posts", { method: "POST", cookie, json: { title: "Secret draft", content: "x" } });
    for (const slug of [draft.slug, "no-such-post"]) {
      const { status, html } = await page(slug);
      expect(status).toBe(200);
      expect(html).toContain(`<div id="root"></div>`);
      expect(html).not.toContain("og:title");
      expect(html).not.toContain("Secret draft");
    }
  });
});

describe("security", () => {
  it("blocks cross-site form posts that would ride the session cookie", async () => {
    const { cookie } = await signUp();
    const { status, body } = await call("/posts", {
      method: "POST",
      cookie,
      headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: "https://evil.example" },
    });
    expect(status).toBe(403);
    expect(body.error.code).toBe("forbidden");
  });

  it("sends security headers and never grants CORS", async () => {
    const { res } = await call("/posts", { headers: { Origin: "https://evil.example" } });
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("returns JSON 404s for unknown routes", async () => {
    const { status, body } = await call("/nope");
    expect(status).toBe(404);
    expect(body.error.code).toBe("not_found");
  });
});
