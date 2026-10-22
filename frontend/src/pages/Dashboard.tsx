import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { CurrentUser } from "@inkstack/common";
import { EmptyState, ErrorState } from "../components/States";
import { Alert, Button, Spinner, TextArea, TextField } from "../components/ui";
import { errorMessage } from "../lib/api";
import { formatDate } from "../lib/format";
import { useDeletePost, useMe, useMyPosts, useUpdatePost, useUpdateProfile } from "../lib/queries";
import { useDocumentTitle } from "../lib/useDocumentTitle";

type Status = "all" | "draft" | "published";

function PostsTable({ status }: { status: Status }) {
  const { data: posts, error, isPending, refetch } = useMyPosts(status);
  const del = useDeletePost();
  const update = useUpdatePost();

  if (isPending) {
    return (
      <div className="flex justify-center py-12 text-slate-400">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (posts.length === 0) {
    return (
      <EmptyState title={status === "draft" ? "No drafts" : "No posts yet"}>
        <Link to="/new" className="font-medium text-ink-700 hover:underline">
          Write something
        </Link>
      </EmptyState>
    );
  }

  return (
    <>
      {(del.isError || update.isError) && (
        <div className="mb-4">
          <Alert>{errorMessage(del.error ?? update.error)}</Alert>
        </div>
      )}
      <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200">
        {posts.map((post) => (
          <li key={post.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
            <div className="min-w-0">
              <Link to={`/p/${post.slug}`} className="font-medium text-slate-900 hover:underline">
                {post.title}
              </Link>
              <p className="mt-1 text-sm text-slate-500">
                <span
                  className={`mr-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                    post.published ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"
                  }`}
                >
                  {post.published ? "Published" : "Draft"}
                </span>
                {post.published ? `Published ${formatDate(post.publishedAt)}` : `Edited ${formatDate(post.updatedAt)}`}
              </p>
            </div>
            <div className="flex gap-2">
              <Link to={`/edit/${post.slug}`} className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
                Edit
              </Link>
              <Button
                variant="ghost"
                onClick={() => update.mutate({ id: post.id, published: !post.published })}
                disabled={update.isPending && update.variables?.id === post.id}
              >
                {post.published ? "Unpublish" : "Publish"}
              </Button>
              <Button
                variant="ghost"
                className="text-red-700 hover:bg-red-50 hover:text-red-800"
                onClick={() => {
                  if (window.confirm(`Delete “${post.title}”? This can't be undone.`)) del.mutate(post);
                }}
                disabled={del.isPending && del.variables?.id === post.id}
              >
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function ProfileForm({ me }: { me: CurrentUser }) {
  const updateProfile = useUpdateProfile();
  const [name, setName] = useState(me.name);
  const [bio, setBio] = useState(me.bio ?? "");
  const fields = updateProfile.error && "fields" in updateProfile.error ? (updateProfile.error.fields as Record<string, string[]> | undefined) : undefined;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    updateProfile.mutate({ name, bio: bio.trim() || null });
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <TextField label="Display name" value={name} onChange={(e) => setName(e.target.value)} error={fields?.name?.[0]} maxLength={60} />
      <TextArea label="Bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} error={fields?.bio?.[0]} maxLength={280} placeholder="What do you build?" />
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" loading={updateProfile.isPending}>
          Save profile
        </Button>
        {updateProfile.isSuccess && (
          <span role="status" className="text-sm text-emerald-700">
            Saved
          </span>
        )}
      </div>
      {updateProfile.isError && !fields && <Alert>{errorMessage(updateProfile.error)}</Alert>}
    </form>
  );
}

export default function Dashboard() {
  const { data: me } = useMe();
  const [status, setStatus] = useState<Status>("all");
  useDocumentTitle("Your posts");
  if (!me) return null;

  const tabs: { value: Status; label: string }[] = [
    { value: "all", label: "All" },
    { value: "draft", label: "Drafts" },
    { value: "published", label: "Published" },
  ];

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[1fr_320px]">
      <section aria-labelledby="posts-heading">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 id="posts-heading" className="font-serif text-3xl text-ink-950">
            Your posts
          </h1>
          <Link to="/new" className="rounded-full bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800">
            New post
          </Link>
        </div>
        <div role="tablist" aria-label="Filter posts" className="mb-4 flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.value}
              role="tab"
              type="button"
              aria-selected={status === t.value}
              onClick={() => setStatus(t.value)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                status === t.value ? "bg-ink-900 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <PostsTable status={status} />
      </section>
      <aside aria-labelledby="profile-heading" className="lg:sticky lg:top-24 lg:self-start">
        <h2 id="profile-heading" className="mb-4 text-lg font-semibold text-slate-900">
          Profile
        </h2>
        <ProfileForm me={me} />
        <Link to={`/u/${me.id}`} className="mt-4 inline-block text-sm text-ink-700 hover:underline">
          View your public profile →
        </Link>
      </aside>
    </div>
  );
}
