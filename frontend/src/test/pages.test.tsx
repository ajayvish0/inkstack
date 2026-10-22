import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PostDetail } from "@inkstack/common";
import { Layout } from "../components/Layout";
import Home from "../pages/Home";
import PostPage from "../pages/PostPage";

const author = { id: "a1", name: "Ada Lovelace" };
const post: PostDetail = {
  id: "p1",
  slug: "notes-on-the-engine-abc12345",
  title: "Notes on the Analytical Engine",
  excerpt: "It weaves algebraic patterns.",
  content: "## Note G\n\n```js\nconst bernoulli = () => 1;\n```",
  readingTime: 3,
  published: true,
  publishedAt: "2026-10-01T10:00:00.000Z",
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z",
  tags: ["history"],
  author,
};

function json(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

function renderAt(path: string, routes: Record<string, (url: string) => Promise<Response>>) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const match = Object.keys(routes).find((prefix) => url.startsWith(prefix));
      return match ? routes[match](url) : json(404, { error: { code: "not_found", message: "Not found" } });
    }),
  );
  const router = createMemoryRouter(
    [{ element: <Layout />, children: [{ path: "/", element: <Home /> }, { path: "/p/:slug", element: <PostPage /> }] }],
    { initialEntries: [path] },
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const signedOut = () => json(401, { error: { code: "unauthorized", message: "Sign in" } });

afterEach(() => vi.unstubAllGlobals());

describe("pages", () => {
  it("shows the hero, the feed and popular tags to a signed-out visitor", async () => {
    renderAt("/", {
      "/api/v1/auth/me": signedOut,
      "/api/v1/posts": () => json(200, { items: [post], nextCursor: null }),
      "/api/v1/tags": () => json(200, [{ name: "history", count: 1 }]),
    });
    expect(await screen.findByRole("heading", { name: "Write about what you build." })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: post.title })).toHaveAttribute("href", `/p/${post.slug}`);
    expect(screen.getAllByRole("link", { name: "#history" }).length).toBeGreaterThan(0);
  });

  it("shows an empty state when a search has no results", async () => {
    renderAt("/?q=nothing", {
      "/api/v1/auth/me": signedOut,
      "/api/v1/posts": () => json(200, { items: [], nextCursor: null }),
      "/api/v1/tags": () => json(200, []),
    });
    expect(await screen.findByText("Nothing here yet")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Results for “nothing”" })).toBeInTheDocument();
  });

  it("renders a post with its markdown body", async () => {
    renderAt(`/p/${post.slug}`, {
      "/api/v1/auth/me": signedOut,
      [`/api/v1/posts/${post.slug}`]: () => json(200, post),
    });
    expect(await screen.findByRole("heading", { level: 1, name: post.title })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 2, name: "Note G" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("shows owner controls only to the author", async () => {
    renderAt(`/p/${post.slug}`, {
      "/api/v1/auth/me": () => json(200, { ...author, email: "ada@example.com", bio: null, createdAt: post.createdAt }),
      [`/api/v1/posts/${post.slug}`]: () => json(200, post),
    });
    expect(await screen.findByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute("href", `/edit/${post.slug}`);
  });

  it("shows a 404 page for a missing post", async () => {
    renderAt("/p/missing", { "/api/v1/auth/me": signedOut });
    expect(await screen.findByRole("heading", { name: "This post doesn't exist" })).toBeInTheDocument();
  });

  it("shows a retryable error when the API is down", async () => {
    renderAt("/", {
      "/api/v1/auth/me": signedOut,
      "/api/v1/posts": () => json(500, { error: { code: "internal_error", message: "Something went wrong. Please try again." } }),
      "/api/v1/tags": () => json(200, []),
    });
    expect(await screen.findByText("Couldn't load this")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
