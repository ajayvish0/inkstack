import type { PostDetail, PostSummary } from "@inkstack/common";

const WORDS_PER_MINUTE = 200;
const EXCERPT_LENGTH = 200;

// Strips the markdown syntax that would look odd in a plain-text preview.
export function toPlainText(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function makeExcerpt(markdown: string) {
  const text = toPlainText(markdown);
  if (text.length <= EXCERPT_LENGTH) return text;
  const cut = text.slice(0, EXCERPT_LENGTH);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : EXCERPT_LENGTH)}…`;
}

export function readingTime(markdown: string) {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

// Readable, unique and stable: the random suffix means two posts with the
// same title never collide, and the slug doesn't change when the title does.
export function makeSlug(title: string) {
  const base =
    title
      .toLowerCase()
      .normalize("NFKD")
      // NFKD splits "ö" into "o" + a combining mark; drop the mark.
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 60)
      .replace(/^-+|-+$/g, "") || "post";
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return `${base}-${suffix}`;
}

// Prisma `select` for list views: everything except the post body.
export const summarySelect = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  readingTime: true,
  published: true,
  publishedAt: true,
  updatedAt: true,
  tags: { select: { name: true }, orderBy: { name: "asc" } },
  author: { select: { id: true, name: true } },
} as const;

export const detailSelect = { ...summarySelect, content: true, createdAt: true } as const;

type SummaryRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  readingTime: number;
  published: boolean;
  publishedAt: Date | null;
  updatedAt: Date;
  tags: { name: string }[];
  author: { id: string; name: string };
};

export const toSummary = (row: SummaryRow): PostSummary => ({
  ...row,
  publishedAt: row.publishedAt?.toISOString() ?? null,
  updatedAt: row.updatedAt.toISOString(),
  tags: row.tags.map((t) => t.name),
});

export const toDetail = (row: SummaryRow & { content: string; createdAt: Date }): PostDetail => ({
  ...toSummary(row),
  content: row.content,
  createdAt: row.createdAt.toISOString(),
});

// connectOrCreate for a list of tag names (already validated and lowercased).
export const tagLinks = (tags: string[]) =>
  [...new Set(tags)].map((name) => ({ where: { name }, create: { name } }));
