import { useParams } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { Feed, NoPostsYet } from "../components/Feed";
import { ErrorState, NotFoundState } from "../components/States";
import { Spinner } from "../components/ui";
import { ApiError } from "../lib/api";
import { formatDate } from "../lib/format";
import { useUser } from "../lib/queries";
import { useDocumentTitle } from "../lib/useDocumentTitle";

export default function Profile() {
  const { id = "" } = useParams();
  const { data: user, error, isPending, refetch } = useUser(id);
  useDocumentTitle(user?.name);

  if (isPending) {
    return (
      <div className="flex justify-center py-24 text-slate-400">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  if (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return <NotFoundState what="profile" />;
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <ErrorState error={error} onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <header className="flex items-center gap-5 border-b border-slate-200 pb-8">
        <Avatar name={user.name} size="lg" />
        <div>
          <h1 className="font-serif text-3xl text-ink-950">{user.name}</h1>
          {user.bio && <p className="mt-1 text-slate-600">{user.bio}</p>}
          <p className="mt-2 text-sm text-slate-500">
            {user.postCount} {user.postCount === 1 ? "post" : "posts"} · Joined {formatDate(user.createdAt)}
          </p>
        </div>
      </header>
      <Feed filters={{ author: user.id }} empty={<div className="pt-6"><NoPostsYet>{user.name} hasn't published anything yet.</NoPostsYet></div>} />
    </div>
  );
}
