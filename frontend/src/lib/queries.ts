import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  CreatePostInput,
  CurrentUser,
  Page,
  PostDetail,
  PostSummary,
  PublicUser,
  SigninInput,
  SignupInput,
  TagCount,
  UpdatePostInput,
  UpdateProfileInput,
} from "@inkstack/common";
import { api, ApiError } from "./api";

export const keys = {
  me: ["me"] as const,
  feed: (filters: FeedFilters) => ["posts", "feed", filters] as const,
  post: (slug: string) => ["posts", "detail", slug] as const,
  myPosts: (status: string) => ["posts", "mine", status] as const,
  user: (id: string) => ["users", id] as const,
  tags: ["tags"] as const,
};

// ---- Session -------------------------------------------------------------

export function useMe() {
  return useQuery({
    queryKey: keys.me,
    // A 401 just means "signed out", not an error worth retrying or showing.
    queryFn: () =>
      api<CurrentUser>("/auth/me").catch((err) => {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }),
    staleTime: 5 * 60_000,
  });
}

export function useSignIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SigninInput) => api<CurrentUser>("/auth/signin", { method: "POST", body: input }),
    onSuccess: (user) => {
      qc.setQueryData(keys.me, user);
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
  });
}

export function useSignUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SignupInput) => api<CurrentUser>("/auth/signup", { method: "POST", body: input }),
    onSuccess: (user) => qc.setQueryData(keys.me, user),
  });
}

export function useSignOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>("/auth/signout", { method: "POST", body: {} }),
    onSuccess: () => {
      qc.setQueryData(keys.me, null);
      qc.removeQueries({ queryKey: ["posts", "mine"] });
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => api<CurrentUser>("/me", { method: "PATCH", body: input }),
    onSuccess: (user) => {
      qc.setQueryData(keys.me, user);
      qc.invalidateQueries({ queryKey: keys.user(user.id) });
    },
  });
}

// ---- Posts ---------------------------------------------------------------

export interface FeedFilters {
  tag?: string;
  q?: string;
  author?: string;
}

export function useFeed(filters: FeedFilters, pageSize = 10) {
  return useInfiniteQuery({
    queryKey: keys.feed(filters),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ limit: String(pageSize) });
      if (pageParam) params.set("cursor", pageParam);
      if (filters.tag) params.set("tag", filters.tag);
      if (filters.q) params.set("q", filters.q);
      if (filters.author) params.set("author", filters.author);
      return api<Page<PostSummary>>(`/posts?${params}`, { signal });
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function usePost(slug: string) {
  return useQuery({
    queryKey: keys.post(slug),
    queryFn: ({ signal }) => api<PostDetail>(`/posts/${encodeURIComponent(slug)}`, { signal }),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });
}

export function useMyPosts(status: "all" | "draft" | "published") {
  return useQuery({
    queryKey: keys.myPosts(status),
    queryFn: ({ signal }) => api<PostSummary[]>(`/me/posts?status=${status}`, { signal }),
  });
}

export function useTags() {
  return useQuery({
    queryKey: keys.tags,
    queryFn: ({ signal }) => api<TagCount[]>("/tags", { signal }),
    staleTime: 60_000,
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: keys.user(id),
    queryFn: ({ signal }) => api<PublicUser & { postCount: number }>(`/users/${id}`, { signal }),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });
}

function useInvalidatePosts() {
  const qc = useQueryClient();
  return (post?: PostDetail) => {
    if (post) qc.setQueryData(keys.post(post.slug), post);
    qc.invalidateQueries({ queryKey: ["posts", "feed"] });
    qc.invalidateQueries({ queryKey: ["posts", "mine"] });
    qc.invalidateQueries({ queryKey: keys.tags });
  };
}

export function useCreatePost() {
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: (input: CreatePostInput) => api<PostDetail>("/posts", { method: "POST", body: input }),
    onSuccess: invalidate,
  });
}

export function useUpdatePost() {
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdatePostInput & { id: string }) =>
      api<PostDetail>(`/posts/${id}`, { method: "PATCH", body: input }),
    onSuccess: invalidate,
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  const invalidate = useInvalidatePosts();
  return useMutation({
    mutationFn: (post: { id: string; slug: string }) => api<void>(`/posts/${post.id}`, { method: "DELETE", body: {} }),
    onSuccess: (_, post) => {
      qc.removeQueries({ queryKey: keys.post(post.slug) });
      invalidate();
    },
  });
}
