import { Suspense, lazy, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { ErrorState, NotFoundState } from "../components/States";
import { TagPill } from "../components/TagPill";
import { Alert, Button, Spinner } from "../components/ui";
import { ApiError, errorMessage } from "../lib/api";
import { formatDate, readingLabel } from "../lib/format";
import { useDeletePost, useMe, usePost } from "../lib/queries";
import { useDocumentTitle } from "../lib/useDocumentTitle";

const Markdown = lazy(() => import("../components/Markdown"));

function ArticleSkeleton() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse px-4 py-12" aria-busy="true" aria-label="Loading post">
      <div className="h-10 w-3/4 rounded bg-slate-200" />
      <div className="mt-6 h-5 w-48 rounded bg-slate-200" />
      <div className="mt-10 space-y-3">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-4 rounded bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

export default function PostPage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { data: post, error, isPending, refetch } = usePost(slug);
  const { data: me } = useMe();
  const del = useDeletePost();
  const [copied, setCopied] = useState(false);
  useDocumentTitle(post?.title);

  if (isPending) return <ArticleSkeleton />;
  if (error) {
    if (error instanceof ApiError && error.status === 404) return <NotFoundState what="post" />;
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <ErrorState error={error} onRetry={() => refetch()} />
      </div>
    );
  }

  const isOwner = me?.id === post.author.id;

  const remove = () => {
    if (!window.confirm(`Delete “${post.title}”? This can't be undone.`)) return;
    del.mutate(post, { onSuccess: () => navigate("/me") });
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      {!post.published && (
        <div className="mb-6">
          <Alert tone="info">This is a draft. Only you can see it.</Alert>
        </div>
      )}
      <header>
        <h1 className="font-serif text-4xl leading-tight text-ink-950 sm:text-5xl">{post.title}</h1>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-y border-slate-200 py-4">
          <div className="flex items-center gap-3">
            <Avatar name={post.author.name} />
            <div className="text-sm">
              <Link to={`/u/${post.author.id}`} className="font-medium text-slate-900 hover:underline">
                {post.author.name}
              </Link>
              <p className="text-slate-500">
                {readingLabel(post.readingTime)}
                {post.publishedAt && (
                  <>
                    {" · "}
                    <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {post.published && (
              <Button variant="ghost" onClick={copyLink} aria-live="polite">
                {copied ? "Link copied" : "Copy link"}
              </Button>
            )}
            {isOwner && (
              <>
                <Link
                  to={`/edit/${post.slug}`}
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                >
                  Edit
                </Link>
                <Button variant="danger" onClick={remove} loading={del.isPending}>
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>
        {del.isError && (
          <div className="mt-4">
            <Alert>{errorMessage(del.error)}</Alert>
          </div>
        )}
      </header>

      <div className="mt-10">
        <Suspense
          fallback={
            <div className="flex justify-center py-12 text-slate-400">
              <Spinner className="h-6 w-6" />
            </div>
          }
        >
          <Markdown>{post.content}</Markdown>
        </Suspense>
      </div>

      {post.tags.length > 0 && (
        <footer className="mt-12 flex flex-wrap gap-2 border-t border-slate-200 pt-6">
          {post.tags.map((tag) => (
            <TagPill key={tag} tag={tag} />
          ))}
        </footer>
      )}
    </article>
  );
}
