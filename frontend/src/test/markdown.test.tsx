import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Markdown from "../components/Markdown";

describe("Markdown rendering is safe for user content", () => {
  it("does not render raw HTML from a post", () => {
    const { container } = render(
      <Markdown>{`Hello <img src=x onerror="alert(1)"> <script>alert(2)</script>`}</Markdown>,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelectorAll("[onerror]")).toHaveLength(0);
    // It is shown as inert, escaped text instead.
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
  });

  it("drops javascript: links but keeps normal ones, opened safely", () => {
    const { getByText } = render(<Markdown>{"[bad](javascript:alert(1)) and [good](https://example.com)"}</Markdown>);
    expect(getByText("bad").getAttribute("href") ?? "").not.toMatch(/^javascript:/i);
    const good = getByText("good");
    expect(good).toHaveAttribute("href", "https://example.com");
    expect(good).toHaveAttribute("rel", "noopener noreferrer nofollow");
  });

  it("renders GitHub-flavoured markdown and highlights code", () => {
    const { container } = render(
      <Markdown>{"| a | b |\n|---|---|\n| 1 | 2 |\n\n```ts\nconst x: number = 1;\n```"}</Markdown>,
    );
    expect(container.querySelector("table")).not.toBeNull();
    expect(container.querySelector("code.hljs")).not.toBeNull();
    expect(container.querySelector(".hljs-keyword")?.textContent).toBe("const");
  });
});
