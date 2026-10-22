# ADR 0004 — One Worker for the app and API, with link previews at the edge

- **Status:** Accepted (2026-10-22)

## Context

The frontend is a client-rendered React SPA. Two problems followed from
hosting it separately from the API:

1. Cross-origin requests force CORS and third-party cookies (see ADR 0003).
2. Link-preview bots (Slack, LinkedIn, X, search crawlers) don't run
   JavaScript, so every shared post showed the same generic title.

## Decision

- Deploy **one Worker** (`wrangler.toml` → `[env.production]`) with
  **Workers Static Assets** serving `frontend/dist`, using
  `not_found_handling = "single-page-application"`.
- `run_worker_first = ["/api/*", "/p/*"]`: the Worker handles the API and post
  pages; every other asset is served directly by the platform without invoking
  the Worker.
- For `/p/:slug`, the Worker loads the post, fetches the SPA shell from the
  assets binding, and streams it through **`HTMLRewriter`**, replacing
  `<title>`/description and appending Open Graph and Twitter tags
  (`backend/src/og.ts`). All values are HTML-escaped. Drafts and unknown slugs
  get the unmodified shell, and the SPA renders its own 404.

## Consequences

- Correct link previews without server-side rendering or a prerender service.
- **Found while testing:** fetching `/index.html` from the assets binding
  returns a 307 redirect to `/`, so the first version produced previews with
  no app in the page. It now fetches `/`, and a regression test uses a fake
  assets binding with the same redirect behaviour.
- The SPA and API deploy together, so a frontend change is a Worker deploy.
