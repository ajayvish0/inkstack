import { useEffect } from "react";

export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · Inkstack` : "Inkstack — write about what you build";
  }, [title]);
}
