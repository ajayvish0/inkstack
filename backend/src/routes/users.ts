import { Hono } from "hono";
import { myPostsQuery, updateProfileInput, type PublicUser, type TagCount } from "@inkstack/common";
import { notFound } from "../lib/http";
import { summarySelect, toSummary } from "../lib/posts";
import { requireAuth, validate } from "../middleware";
import { currentUserSelect, toCurrentUser } from "./auth";
import type { AppEnv } from "../types";

// The signed-in user's own data, including drafts.
export const meRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get("/posts", validate("query", myPostsQuery), async (c) => {
    const { status } = c.req.valid("query");
    const rows = await c.var.prisma.post.findMany({
      where: {
        authorId: c.var.userId,
        ...(status !== "all" && { published: status === "published" }),
      },
      select: summarySelect,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 100,
    });
    c.header("Cache-Control", "private, no-store");
    return c.json(rows.map(toSummary));
  })
  .patch("/", validate("json", updateProfileInput), async (c) => {
    const user = await c.var.prisma.user.update({
      where: { id: c.var.userId },
      data: c.req.valid("json"),
      select: currentUserSelect,
    });
    return c.json(toCurrentUser(user));
  });

export const userRoutes = new Hono<AppEnv>().get("/:id", async (c) => {
  const user = await c.var.prisma.user.findUnique({
    where: { id: c.req.param("id") },
    select: {
      id: true,
      name: true,
      bio: true,
      createdAt: true,
      _count: { select: { posts: { where: { published: true } } } },
    },
  });
  if (!user) throw notFound("User");
  const { _count, ...rest } = user;
  return c.json<PublicUser & { postCount: number }>({
    ...rest,
    createdAt: rest.createdAt.toISOString(),
    postCount: _count.posts,
  });
});

// The most-used tags across published posts.
export const tagRoutes = new Hono<AppEnv>().get("/", async (c) => {
  const tags = await c.var.prisma.tag.findMany({
    select: { name: true, _count: { select: { posts: { where: { published: true } } } } },
  });
  const popular: TagCount[] = tags
    .map((t) => ({ name: t.name, count: t._count.posts }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 20);
  c.header("Cache-Control", "public, max-age=60");
  return c.json(popular);
});
