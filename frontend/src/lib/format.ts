const dateFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" });

export const formatDate = (iso: string | null) => (iso ? dateFormat.format(new Date(iso)) : "");

export const readingLabel = (minutes: number) => `${minutes} min read`;

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

// Splits "postgres, Edge workers ,api" into valid-looking tag slugs.
export const parseTags = (raw: string) =>
  [
    ...new Set(
      raw
        .split(",")
        .map((t) => t.trim().toLowerCase().replace(/\s+/g, "-"))
        .filter(Boolean),
    ),
  ];
