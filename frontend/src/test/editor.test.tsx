import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NewPost } from "../pages/Editor";

const me = { id: "u1", email: "ada@example.com", name: "Ada", bio: null, createdAt: "2026-10-01T00:00:00.000Z" };

function setup() {
  const created = {
    ...{ id: "p1", slug: "hello-abc12345", title: "Hello", content: "World", excerpt: "World" },
    readingTime: 1,
    published: true,
    publishedAt: me.createdAt,
    createdAt: me.createdAt,
    updatedAt: me.createdAt,
    tags: [],
    author: { id: me.id, name: me.name },
  };
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = url.endsWith("/auth/me") ? me : url.endsWith("/posts") && init?.method === "POST" ? created : {};
    const status = url.endsWith("/posts") && init?.method === "POST" ? 201 : 200;
    return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
  });
  vi.stubGlobal("fetch", fetchMock);
  const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
  const router = createMemoryRouter(
    [
      { path: "/new", element: <NewPost /> },
      { path: "/p/:slug", element: <p>Post page</p> },
      { path: "/", element: <p>Home</p> },
    ],
    { initialEntries: ["/new"] },
  );
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, confirmSpy, fetchMock };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Editor", () => {
  it("publishes and opens the post without an unsaved-changes prompt", async () => {
    const { router, confirmSpy } = setup();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Hello" } });
    fireEvent.change(screen.getByLabelText("Content (Markdown)"), { target: { value: "World" } });
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/p/hello-abc12345"));
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("asks before leaving with unsaved changes", async () => {
    const { router, confirmSpy } = setup();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Half-written" } });
    await router.navigate("/");
    await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
    // Declined, so we stay on the editor.
    expect(router.state.location.pathname).toBe("/new");
  });

  it("validates before sending anything", async () => {
    const { fetchMock } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(await screen.findByText("Title is required")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("/posts"), expect.objectContaining({ method: "POST" }));
  });
});
