import { describe, expect, it } from "vitest";
import { PBKDF2_ITERATIONS, hashPassword, verifyPassword } from "../src/lib/password";
import { makeExcerpt, makeSlug, readingTime, toPlainText } from "../src/lib/posts";
import { createPostInput, updatePostInput } from "@inkstack/common";

describe("password hashing", () => {
  it("verifies the right password and rejects a wrong one", async () => {
    const stored = await hashPassword("correct-horse");
    expect(stored).toMatch(/^pbkdf2_sha256\$100000\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(await verifyPassword("correct-horse", stored)).toEqual({ valid: true, needsRehash: false });
    expect((await verifyPassword("Correct-horse", stored)).valid).toBe(false);
  });

  it("uses a fresh salt for every hash", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("accepts legacy plain-text rows once and asks for a rehash", async () => {
    expect(await verifyPassword("secret123", "secret123")).toEqual({ valid: true, needsRehash: true });
    expect(await verifyPassword("wrong", "secret123")).toEqual({ valid: false, needsRehash: false });
  });

  it("asks for a rehash when a hash used fewer iterations", async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("pw"), "PBKDF2", false, ["deriveBits"]);
    const bits = new Uint8Array(
      await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 1000 }, key, 256),
    );
    const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
    const weak = `pbkdf2_sha256$1000$${b64(salt)}$${b64(bits)}`;
    expect(await verifyPassword("pw", weak)).toEqual({ valid: true, needsRehash: true });
  });

  it("rejects malformed hashes instead of throwing", async () => {
    expect((await verifyPassword("pw", "pbkdf2_sha256$abc$$")).valid).toBe(false);
  });

  // Guard rail: production Workers reject PBKDF2 above 100,000 iterations, but
  // local workerd has no cap, so raising this would pass locally and break
  // every sign-up once deployed. See ADR 0002 before changing it.
  it("stays at the production Workers PBKDF2 ceiling", () => {
    expect(PBKDF2_ITERATIONS).toBe(100_000);
  });
});

describe("post helpers", () => {
  it("strips markdown for previews", () => {
    expect(toPlainText("## Title\n\nSome **bold** and `code` with a [link](https://x.dev).\n\n```js\nhidden()\n```")).toBe(
      "Title Some bold and code with a link.",
    );
  });

  it("cuts long excerpts on a word boundary", () => {
    const excerpt = makeExcerpt("word ".repeat(100));
    expect(excerpt.length).toBeLessThanOrEqual(201);
    expect(excerpt.endsWith("word…")).toBe(true);
  });

  it("estimates reading time at 200 words per minute, minimum one", () => {
    expect(readingTime("hello")).toBe(1);
    expect(readingTime("w ".repeat(401))).toBe(3);
  });

  it("makes unique, URL-safe slugs", () => {
    const a = makeSlug("Hello, Wörld! Edge & Postgres");
    expect(a).toMatch(/^hello-world-edge-postgres-[a-f0-9]{8}$/);
    expect(makeSlug("Hello")).not.toBe(makeSlug("Hello"));
    expect(makeSlug("!!!")).toMatch(/^post-[a-f0-9]{8}$/);
  });
});

describe("shared schemas", () => {
  it("fills defaults when creating a post", () => {
    expect(createPostInput.parse({ title: "t", content: "c" })).toEqual({
      title: "t",
      content: "c",
      tags: [],
      published: false,
    });
  });

  // Regression: defaults leaking into PATCH bodies used to wipe tags and
  // unpublish posts on unrelated edits.
  it("never injects defaults into an update", () => {
    expect(updatePostInput.parse({ published: true })).toEqual({ published: true });
    expect(updatePostInput.parse({ title: "x" })).toEqual({ title: "x" });
    expect(updatePostInput.safeParse({}).success).toBe(false);
  });

  it("normalises tags", () => {
    expect(createPostInput.parse({ title: "t", content: "c", tags: [" Postgres "] }).tags).toEqual(["postgres"]);
    expect(createPostInput.safeParse({ title: "t", content: "c", tags: ["no spaces"] }).success).toBe(false);
  });
});
