import { Suspense, lazy, useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams, useBlocker } from "react-router-dom";
import { createPostInput } from "@inkstack/common";
import { NotFoundState, ErrorState } from "../components/States";
import { Alert, Button, Spinner, TextField } from "../components/ui";
import { ApiError, errorMessage } from "../lib/api";
import { parseTags } from "../lib/format";
import { useCreatePost, useMe, usePost, useUpdatePost } from "../lib/queries";
import { useDocumentTitle } from "../lib/useDocumentTitle";

const Markdown = lazy(() => import("../components/Markdown"));

const STARTER = `Start with why this matters to the reader.

## A heading

Markdown works here — **bold**, *italics*, [links](https://example.com), lists, tables and code:

\`\`\`ts
export const greet = (name: string) => \`Hello, \${name}\`;
\`\`\`
`;

type Errors = Partial<Record<"title" | "content" | "tags", string>>;

interface Draft {
  title: string;
  content: string;
  tags: string;
}

function EditorForm({
  initial,
  postId,
  isPublished,
}: {
  initial: Draft;
  postId?: string;
  isPublished: boolean;
}) {
  const navigate = useNavigate();
  const create = useCreatePost();
  const update = useUpdatePost();
  const [draft, setDraft] = useState(initial);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [errors, setErrors] = useState<Errors>({});
  const [saved, setSaved] = useState(false);
  const dirty = !saved && (draft.title !== initial.title || draft.content !== initial.content || draft.tags !== initial.tags);
  const pending = create.isPending || update.isPending;
  const mutationError = create.error ?? update.error;

  // Warn before losing unsaved work, both on in-app navigation and tab close.
  const blocker = useBlocker(dirty && !pending);
  useEffect(() => {
    if (blocker.state === "blocked") {
      if (window.confirm("You have unsaved changes. Leave anyway?")) blocker.proceed();
      else blocker.reset();
    }
  }, [blocker]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = (field: keyof Draft) => (value: string) => {
    setDraft((d) => ({ ...d, [field]: value }));
    setSaved(false);
  };

  const save = (publish: boolean) => {
    const parsed = createPostInput.safeParse({
      title: draft.title,
      content: draft.content,
      tags: parseTags(draft.tags),
      published: publish,
    });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof Errors;
        next[key] ??= issue.message;
      }
      setErrors(next);
      if (next.content) setTab("write");
      return;
    }
    setErrors({});
    const onSuccess = (post: { slug: string }) => {
      setSaved(true);
      navigate(`/p/${post.slug}`);
    };
    if (postId) update.mutate({ id: postId, ...parsed.data }, { onSuccess });
    else create.mutate(parsed.data, { onSuccess });
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    save(true);
  };

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-4xl px-4 py-10" noValidate>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {postId ? (isPublished ? "Editing published post" : "Editing draft") : "New post"}
        </h1>
        <div className="flex gap-2">
          {!isPublished && (
            <Button type="button" variant="secondary" loading={pending} onClick={() => save(false)}>
              Save draft
            </Button>
          )}
          <Button type="submit" loading={pending}>
            {isPublished ? "Update" : "Publish"}
          </Button>
        </div>
      </div>

      {mutationError && (
        <div className="mb-6">
          <Alert>{errorMessage(mutationError)}</Alert>
        </div>
      )}

      <label htmlFor="post-title" className="sr-only">
        Title
      </label>
      <input
        id="post-title"
        value={draft.title}
        onChange={(e) => set("title")(e.target.value)}
        placeholder="Title"
        aria-invalid={errors.title ? true : undefined}
        aria-describedby={errors.title ? "title-error" : undefined}
        className="w-full border-0 bg-transparent font-serif text-4xl text-ink-950 placeholder:text-slate-300 focus:ring-0"
        autoFocus={!postId}
      />
      {errors.title && (
        <p id="title-error" className="mt-1 text-sm text-red-600">
          {errors.title}
        </p>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
        <div role="tablist" aria-label="Editor mode" className="flex border-b border-slate-200 bg-slate-50 text-sm">
          {(["write", "preview"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 font-medium capitalize ${tab === t ? "bg-white text-ink-950" : "text-slate-500 hover:text-slate-800"}`}
            >
              {t}
            </button>
          ))}
          <span className="ml-auto self-center px-4 text-xs text-slate-400">Markdown supported</span>
        </div>
        {tab === "write" ? (
          <>
            <label htmlFor="post-content" className="sr-only">
              Content (Markdown)
            </label>
            <textarea
              id="post-content"
              value={draft.content}
              onChange={(e) => set("content")(e.target.value)}
              placeholder={STARTER}
              aria-invalid={errors.content ? true : undefined}
              className="block min-h-[50vh] w-full resize-y border-0 p-4 font-mono text-sm leading-relaxed focus:ring-0"
            />
          </>
        ) : (
          <div className="min-h-[50vh] p-6">
            {draft.content.trim() ? (
              <Suspense fallback={<Spinner />}>
                <Markdown>{draft.content}</Markdown>
              </Suspense>
            ) : (
              <p className="text-slate-400">Nothing to preview yet.</p>
            )}
          </div>
        )}
      </div>
      {errors.content && <p className="mt-1 text-sm text-red-600">{errors.content}</p>}

      <TextField
        className="mt-6"
        label="Tags"
        value={draft.tags}
        onChange={(e) => set("tags")(e.target.value)}
        placeholder="postgres, cloudflare-workers, react"
        hint="Up to 5, separated by commas."
        error={errors.tags}
      />
    </form>
  );
}

export function NewPost() {
  useDocumentTitle("New post");
  return <EditorForm initial={{ title: "", content: "", tags: "" }} isPublished={false} />;
}

export function EditPost() {
  const { slug = "" } = useParams();
  const { data: post, error, isPending, refetch } = usePost(slug);
  const { data: me } = useMe();
  useDocumentTitle(post ? `Edit: ${post.title}` : "Edit post");

  if (isPending) {
    return (
      <div className="flex justify-center py-24 text-slate-400">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  if (error) {
    if (error instanceof ApiError && error.status === 404) return <NotFoundState what="post" />;
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <ErrorState error={error} onRetry={() => refetch()} />
      </div>
    );
  }
  if (post.author.id !== me?.id) return <NotFoundState what="post" />;

  return (
    <EditorForm
      key={post.id}
      postId={post.id}
      isPublished={post.published}
      initial={{ title: post.title, content: post.content, tags: post.tags.join(", ") }}
    />
  );
}
