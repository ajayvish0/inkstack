import { describe, expect, it } from "vitest";
import { initials, parseTags, readingLabel } from "../lib/format";

describe("format helpers", () => {
  it("builds initials safely, including for odd names", () => {
    expect(initials("Ada Lovelace")).toBe("AL");
    expect(initials("grace")).toBe("G");
    expect(initials("  Mary  Ann  Jones ")).toBe("MJ");
    // The original app rendered "undefinedundefined" for whitespace names.
    expect(initials("   ")).toBe("?");
  });

  it("parses a comma-separated tag list into unique slugs", () => {
    expect(parseTags("Postgres, edge workers , ,postgres")).toEqual(["postgres", "edge-workers"]);
  });

  it("labels reading time", () => {
    expect(readingLabel(4)).toBe("4 min read");
  });
});
