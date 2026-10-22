import type { ReactNode } from "react";
import { useFeed, type FeedFilters } from "../lib/queries";
import { PostCard, PostCardSkeleton } from "./PostCard";
import { EmptyState, ErrorState } from "./States";
import { Button } from "./ui";

export function Feed({ filters, empty }: { filters: FeedFilters; empty: ReactNode }) {
  const feed = useFeed(filters);

  if (feed.isPending) {
    return (
      <div aria-busy="true" aria-label="Loading posts">
        {Array.from({ length: 4 }, (_, i) => (
          <PostCardSkeleton key={i} />
        ))}
      </div>
    );
  }
  if (feed.isError) return <ErrorState error={feed.error} onRetry={() => feed.refetch()} />;

  const posts = feed.data.pages.flatMap((page) => page.items);
  if (posts.length === 0) return <>{empty}</>;

  return (
    <div>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      {feed.hasNextPage ? (
        <div className="py-6 text-center">
          <Button variant="secondary" loading={feed.isFetchingNextPage} onClick={() => feed.fetchNextPage()}>
            Load more
          </Button>
        </div>
      ) : (
        posts.length > 5 && <p className="py-6 text-center text-sm text-slate-500">You've reached the end.</p>
      )}
    </div>
  );
}

export const NoPostsYet = ({ children }: { children?: ReactNode }) => (
  <EmptyState title="Nothing here yet">{children}</EmptyState>
);
