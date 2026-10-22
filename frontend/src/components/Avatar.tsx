import { initials } from "../lib/format";

// Deterministic colour per name, so the same author always looks the same.
const palette = ["bg-ink-100 text-ink-800", "bg-amber-100 text-amber-900", "bg-emerald-100 text-emerald-900", "bg-rose-100 text-rose-900", "bg-sky-100 text-sky-900"];

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const hash = [...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 0);
  const sizes = { sm: "h-6 w-6 text-[10px]", md: "h-9 w-9 text-xs", lg: "h-16 w-16 text-xl" };
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${sizes[size]} ${palette[hash % palette.length]}`}
    >
      {initials(name)}
    </span>
  );
}
