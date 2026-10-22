import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// Tests run inside workerd (the real Workers runtime) against a real Postgres.
// Locally that's the database in .dev.vars / .env; CI sets TEST_DATABASE_URL.
config({ path: ".env", quiet: true });
const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Set TEST_DATABASE_URL (or DATABASE_URL in backend/.env) to run the tests");

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.toml" },
      miniflare: {
        bindings: {
          DATABASE_URL: databaseUrl,
          JWT_SECRET: "test-secret-that-is-at-least-32-bytes-long",
        },
      },
    }),
  ],
  test: {
    // Integration tests share one database, so run files one at a time.
    fileParallelism: false,
    // Each sign-up/sign-in runs a deliberately slow password hash.
    testTimeout: 20_000,
  },
});
