import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ApiErrorBody } from "@inkstack/common";

// Every error leaves the API as { error: { code, message, fields? } }.
export class ApiError extends HTTPException {
  constructor(
    status: ContentfulStatusCode,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(status, { message });
  }

  toBody(): ApiErrorBody {
    return { error: { code: this.code, message: this.message, fields: this.fields } };
  }
}

export const badRequest = (message: string, fields?: Record<string, string[]>) =>
  new ApiError(400, "validation_error", message, fields);
export const unauthorized = (message = "Sign in to continue") =>
  new ApiError(401, "unauthorized", message);
export const forbidden = (message = "You can't do that") => new ApiError(403, "forbidden", message);
export const notFound = (what = "Resource") => new ApiError(404, "not_found", `${what} not found`);
export const conflict = (message: string) => new ApiError(409, "conflict", message);
export const tooManyRequests = () =>
  new ApiError(429, "rate_limited", "Too many attempts. Try again in a minute.");
