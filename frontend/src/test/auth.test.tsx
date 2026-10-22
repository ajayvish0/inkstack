import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SignIn } from "../pages/Auth";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function renderSignIn(fetchImpl: typeof fetch) {
  vi.stubGlobal("fetch", vi.fn(fetchImpl));
  const router = createMemoryRouter(
    [
      { path: "/signin", element: <SignIn /> },
      { path: "/drafts", element: <p>Drafts page</p> },
    ],
    { initialEntries: ["/signin?next=/drafts"] },
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

afterEach(() => vi.unstubAllGlobals());

const signedOut = (input: RequestInfo | URL) =>
  Promise.resolve(
    String(input).endsWith("/auth/me")
      ? jsonResponse(401, { error: { code: "unauthorized", message: "Sign in to continue" } })
      : jsonResponse(500, {}),
  );

describe("Sign in", () => {
  it("validates on the client before calling the API", async () => {
    renderSignIn(signedOut);
    fireEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(fetch).not.toHaveBeenCalledWith(expect.stringContaining("/auth/signin"), expect.anything());
  });

  it("shows the API's message when the credentials are wrong", async () => {
    renderSignIn((input) =>
      String(input).endsWith("/auth/signin")
        ? Promise.resolve(jsonResponse(401, { error: { code: "unauthorized", message: "Invalid email or password" } }))
        : signedOut(input),
    );
    fireEvent.change(await screen.findByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
  });

  it("goes back to the page that asked for sign-in", async () => {
    const router = renderSignIn((input) =>
      String(input).endsWith("/auth/signin")
        ? Promise.resolve(
            jsonResponse(200, { id: "u1", email: "ada@example.com", name: "Ada", bio: null, createdAt: new Date().toISOString() }),
          )
        : signedOut(input),
    );
    fireEvent.change(await screen.findByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct-horse" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/drafts"));
  });

  it("ignores an off-site ?next= redirect", async () => {
    vi.stubGlobal("fetch", vi.fn(signedOut));
    const router = createMemoryRouter([{ path: "/signin", element: <SignIn /> }, { path: "/", element: <p>Home</p> }], {
      initialEntries: ["/signin?next=//evil.example"],
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/signup");
  });
});
