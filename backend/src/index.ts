import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { requestId } from "hono/request-id";
import { HTTPException } from "hono/http-exception";
import { ApiError } from "./lib/http";
import { csrfProtection, withPrisma } from "./middleware";
import { renderPostShell } from "./og";
import { authRoutes } from "./routes/auth";
import { postRoutes } from "./routes/posts";
import { meRoutes, tagRoutes, userRoutes } from "./routes/users";
import type { AppEnv } from "./types";

const api = new Hono<AppEnv>()
  .get("/health", async (c) => {
    await c.var.prisma.$queryRaw`SELECT 1`;
    return c.json({ status: "ok" });
  })
  .route("/auth", authRoutes)
  .route("/posts", postRoutes)
  .route("/me", meRoutes)
  .route("/users", userRoutes)
  .route("/tags", tagRoutes);

const app = new Hono<AppEnv>();

app.use(requestId());
app.use(secureHeaders());
app.use(withPrisma);
app.use("/api/*", csrfProtection);

app.route("/api/v1", api);
app.get("/p/:slug", renderPostShell);

app.notFound((c) => c.json({ error: { code: "not_found", message: "Route not found" } }, 404));

app.onError((err, c) => {
  if (err instanceof ApiError) return c.json(err.toBody(), err.status);
  // Thrown by Hono middleware, e.g. the CSRF check. Reshape into our format.
  if (err instanceof HTTPException) {
    const message = err.status === 403 ? "Cross-site request blocked" : err.message || "Request failed";
    return c.json({ error: { code: err.status === 403 ? "forbidden" : "http_error", message } }, err.status);
  }
  console.error(JSON.stringify({ requestId: c.get("requestId"), path: c.req.path, error: String(err) }));
  return c.json(
    { error: { code: "internal_error", message: "Something went wrong. Please try again." } },
    500,
  );
});

export type AppType = typeof api;
export default app;
