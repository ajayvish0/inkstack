import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { errorMessage } from "../lib/api";
import { Button } from "./ui";

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center">
      <p className="font-serif text-xl text-ink-950">{title}</p>
      {children && <div className="mt-2 text-sm text-slate-600">{children}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center">
      <p className="font-medium text-red-900">Couldn't load this</p>
      <p className="mt-1 text-sm text-red-800">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function NotFoundState({ what = "page" }: { what?: string }) {
  return (
    <div className="py-24 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-ink-600">404</p>
      <h1 className="mt-2 font-serif text-4xl text-ink-950">This {what} doesn't exist</h1>
      <p className="mt-3 text-slate-600">It may have been unpublished or deleted.</p>
      <Link to="/" className="mt-6 inline-block font-medium text-ink-700 hover:underline">
        ← Back to the feed
      </Link>
    </div>
  );
}
