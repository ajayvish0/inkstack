import { Link } from "react-router-dom";
import type { PostSummary } from "@inkstack/common";
import { formatDate, readingLabel } from "../lib/format";
import { Avatar } from "./Avatar";
import { TagPill } from "./TagPill";

export function PostCard({ post }: { post: PostSummary }) {
  return (
    <article className="group relative border-b border-slate-200 py-6 last:border-b-0">
      <div className="mb-2 flex items-center gap-2 text-sm text-slate-600">
        <Avatar name={post.author.name} size="sm" />
        <Link to={`/u/${post.author.id}`} className="relative z-10 font-medium text-slate-800 hover:underline">
          {post.author.name}
        </Link>
        <span aria-hidden="true">·</span>
        <time dateTime={post.publishedAt ?? undefined}>{formatDate(post.publishedAt)}</time>
      </div>
      <h2 className="font-serif text-2xl font-semibold leading-snug text-ink-950">
        {/* The title link covers the whole card; author and tag links sit above it. */}
        <Link to={`/p/${post.slug}`} className="after:absolute after:inset-0 group-hover:underline">
          {post.title}
        </Link>
      </h2>
      <p className="mt-2 line-clamp-2 text-slate-600">{post.excerpt}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <span>{readingLabel(post.readingTime)}</span>
        {post.tags.map((tag) => (
          <TagPill key={tag} tag={tag} className="relative z-10" />
        ))}
      </div>
    </article>
  );
}

export function PostCardSkeleton() {
  return (
    <div className="animate-pulse border-b border-slate-200 py-6" aria-hidden="true">
      <div className="mb-3 h-4 w-40 rounded bg-slate-200" />
      <div className="mb-2 h-6 w-3/4 rounded bg-slate-200" />
      <div className="h-4 w-full rounded bg-slate-100" />
      <div className="mt-2 h-4 w-2/3 rounded bg-slate-100" />
    </div>
  );
}
