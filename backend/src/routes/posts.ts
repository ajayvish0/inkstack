import { Hono } from "hono";
import { createPostInput, listPostsQuery, updatePostInput, type Page, type PostSummary } from "@inkstack/common";
import { forbidden, notFound } from "../lib/http";
import {
  detailSelect,
  makeExcerpt,
  makeSlug,
  readingTime,
  summarySelect,
  tagLinks,
  toDetail,
  toSummary,
} from "../lib/posts";
import { optionalAuth, requireAuth, validate } from "../middleware";
import type { Prisma } from "../generated/prisma/client";
import type { AppEnv } from "../types";

export const postRoutes = new Hono<AppEnv>()
  // Public, cursor-paginated feed of published posts.
  .get("/", validate("query", listPostsQuery), async (c) => {
    const { cursor, limit, tag, q, author } = c.req.valid("query");

    const where: Prisma.PostWhereInput = {
      published: true,
      ...(tag && { tags: { some: { name: tag } } }),
      ...(author && { authorId: author }),
      ...(q && {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { content: { contains: q, mode: "insensitive" } },
        ],
      }),
    };

    const rows = await c.var.prisma.post.findMany({
      where,
      select: summarySelect,
      // id breaks ties so the order (and therefore the cursor) is stable.
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map(toSummary);
    c.header("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
    return c.json<Page<PostSummary>>({
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    });
  })
  // A published post is public; a draft is visible only to its author.
  .get("/:slug", optionalAuth, async (c) => {
    const post = await c.var.prisma.post.findUnique({
      where: { slug: c.req.param("slug") },
      select: detailSelect,
    });
    if (!post || (!post.published && post.author.id !== c.var.userId)) {
      throw notFound("Post");
    }
    c.header("Cache-Control", post.published ? "public, max-age=30" : "private, no-store");
    return c.json(toDetail(post));
  })
  .post("/", requireAuth, validate("json", createPostInput), async (c) => {
    const { title, content, tags, published } = c.req.valid("json");
    const post = await c.var.prisma.post.create({
      data: {
        slug: makeSlug(title),
        title,
        content,
        excerpt: makeExcerpt(content),
        readingTime: readingTime(content),
        published,
        publishedAt: published ? new Date() : null,
        author: { connect: { id: c.var.userId } },
        tags: { connectOrCreate: tagLinks(tags) },
      },
      select: detailSelect,
    });
    return c.json(toDetail(post), 201);
  })
  .patch("/:id", requireAuth, validate("json", updatePostInput), async (c) => {
    const id = c.req.param("id");
    const input = c.req.valid("json");
    const existing = await c.var.prisma.post.findUnique({
      where: { id },
      select: { authorId: true, publishedAt: true },
    });
    if (!existing) throw notFound("Post");
    if (existing.authorId !== c.var.userId) throw forbidden("You can only edit your own posts");

    const post = await c.var.prisma.post.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.content !== undefined && {
          content: input.content,
          excerpt: makeExcerpt(input.content),
          readingTime: readingTime(input.content),
        }),
        ...(input.published !== undefined && {
          published: input.published,
          // Keep the original date when an already-published post is re-published.
          publishedAt: input.published ? (existing.publishedAt ?? new Date()) : null,
        }),
        ...(input.tags !== undefined && {
          tags: { set: [], connectOrCreate: tagLinks(input.tags) },
        }),
      },
      select: detailSelect,
    });
    return c.json(toDetail(post));
  })
  .delete("/:id", requireAuth, async (c) => {
    const id = c.req.param("id");
    const existing = await c.var.prisma.post.findUnique({ where: { id }, select: { authorId: true } });
    if (!existing) throw notFound("Post");
    if (existing.authorId !== c.var.userId) throw forbidden("You can only delete your own posts");
    await c.var.prisma.post.delete({ where: { id } });
    return c.body(null, 204);
  });
