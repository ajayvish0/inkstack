import { Link } from "react-router-dom";

export function TagPill({ tag, active, className = "" }: { tag: string; active?: boolean; className?: string }) {
  return (
    <Link
      to={active ? "/" : `/?tag=${encodeURIComponent(tag)}`}
      aria-current={active ? "true" : undefined}
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
        active ? "bg-ink-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      } ${className}`}
    >
      #{tag}
    </Link>
  );
}
