import type { Context } from "hono";
import type { AppEnv } from "./types";

// Inkstack is a client-rendered SPA, so crawlers and link-preview bots (Slack,
// LinkedIn, X) would otherwise see the same generic <head> for every post.
// In production the Worker runs first for /p/:slug, looks the post up, and
// rewrites the built index.html's <head> on the fly with HTMLRewriter, so the
// page still loads the normal SPA for humans.

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

export async function renderPostShell(c: Context<AppEnv>) {
  const assets = c.env.ASSETS;
  if (!assets) return c.notFound();

  // "/" rather than "/index.html": the assets layer redirects the latter to "/".
  const asset = await assets.fetch(new URL("/", c.req.url));
  // Asset responses have immutable headers; copy so middleware can add its own.
  const shell = new Response(asset.body, asset);
  const post = await c.var.prisma.post.findUnique({
    where: { slug: c.req.param("slug") },
    select: { title: true, excerpt: true, published: true, author: { select: { name: true } } },
  });
  // Unknown or draft posts get the plain shell; the SPA shows its own 404.
  if (!post?.published) return shell;

  const title = `${post.title} · Inkstack`;
  const url = new URL(c.req.path, c.req.url).toString();
  const tags = [
    ["og:type", "article"],
    ["og:title", post.title],
    ["og:description", post.excerpt],
    ["og:url", url],
    ["og:site_name", "Inkstack"],
    ["article:author", post.author.name],
  ]
    .map(([property, content]) => `<meta property="${property}" content="${escape(content)}">`)
    .concat(
      `<meta name="twitter:card" content="summary">`,
      `<meta name="description" content="${escape(post.excerpt)}">`,
      `<link rel="canonical" href="${escape(url)}">`,
    )
    .join("");

  return new HTMLRewriter()
    .on("title", { element: (el) => void el.setInnerContent(title) })
    .on('meta[name="description"]', { element: (el) => void el.remove() })
    .on("head", { element: (el) => void el.append(tags, { html: true }) })
    .transform(shell);
}
