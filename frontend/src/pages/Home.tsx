import { Link, useSearchParams } from "react-router-dom";
import { Feed, NoPostsYet } from "../components/Feed";
import { TagPill } from "../components/TagPill";
import { useMe, useTags } from "../lib/queries";
import { useDocumentTitle } from "../lib/useDocumentTitle";

function Hero() {
  return (
    <section className="border-b border-slate-200 bg-gradient-to-b from-ink-50 to-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <p className="text-sm font-semibold uppercase tracking-wider text-ink-600">For developers who write</p>
        <h1 className="mt-3 max-w-3xl font-serif text-4xl leading-tight text-ink-950 sm:text-6xl">
          Write about what you build.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-slate-600">
          Inkstack is a fast, focused place to publish technical writing: Markdown with real code highlighting,
          drafts until you're ready, and tags so readers find you. No paywall, no clutter.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/signup" className="rounded-full bg-ink-900 px-6 py-3 font-medium text-white hover:bg-ink-800">
            Start writing — it's free
          </Link>
          <a href="#feed" className="rounded-full border border-slate-300 bg-white px-6 py-3 font-medium text-slate-800 hover:bg-slate-50">
            Read the latest
          </a>
        </div>
      </div>
    </section>
  );
}

function TagSidebar({ activeTag }: { activeTag?: string }) {
  const { data: tags } = useTags();
  if (!tags?.length) return null;
  return (
    <section aria-labelledby="topics-heading">
      <h2 id="topics-heading" className="mb-3 text-sm font-semibold text-slate-900">
        Popular topics
      </h2>
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => (
          <TagPill key={t.name} tag={t.name} active={t.name === activeTag} />
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  const [params] = useSearchParams();
  const { data: me } = useMe();
  const tag = params.get("tag") ?? undefined;
  const q = params.get("q") ?? undefined;
  useDocumentTitle(tag ? `#${tag}` : q ? `Search: ${q}` : undefined);

  const heading = tag ? `Posts tagged #${tag}` : q ? `Results for “${q}”` : "Latest posts";

  return (
    <>
      {!me && !tag && !q && <Hero />}
      <div id="feed" className="mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[1fr_280px]">
        <section aria-labelledby="feed-heading">
          <div className="flex items-baseline justify-between border-b border-slate-200 pb-3">
            <h2 id="feed-heading" className="text-lg font-semibold text-slate-900">
              {heading}
            </h2>
            {(tag || q) && (
              <Link to="/" className="text-sm text-ink-700 hover:underline">
                Clear filter
              </Link>
            )}
          </div>
          <Feed
            filters={{ tag, q }}
            empty={
              <div className="pt-6">
                <NoPostsYet>
                  {tag || q ? (
                    "Try another tag or search term."
                  ) : (
                    <>
                      Be the first to <Link to="/new" className="font-medium text-ink-700 hover:underline">publish a post</Link>.
                    </>
                  )}
                </NoPostsYet>
              </div>
            }
          />
        </section>
        <aside className="space-y-8 lg:sticky lg:top-24 lg:self-start">
          <TagSidebar activeTag={tag} />
          {!me && (
            <section className="rounded-xl bg-ink-950 p-5 text-white">
              <h2 className="font-serif text-xl">Share what you learn</h2>
              <p className="mt-2 text-sm text-ink-200">
                Write in Markdown, keep drafts private, publish when it's ready.
              </p>
              <Link to="/signup" className="mt-4 inline-block rounded-full bg-white px-4 py-2 text-sm font-medium text-ink-950 hover:bg-ink-100">
                Create an account
              </Link>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
