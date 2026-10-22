export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#1b2340" />
        <rect x="8" y="9" width="16" height="3.2" rx="1.6" fill="#a2b3db" />
        <rect x="8" y="14.4" width="12" height="3.2" rx="1.6" fill="#cdd6ec" />
        <rect x="8" y="19.8" width="16" height="3.2" rx="1.6" fill="#fff" />
      </svg>
      <span className="text-lg font-semibold tracking-tight text-ink-950">inkstack</span>
    </span>
  );
}
