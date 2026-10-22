import { z } from "zod";

// ---------------------------------------------------------------------------
// Request schemas. The API validates every body/query with these, and the
// frontend uses the same schemas for form validation and the inferred types.
// ---------------------------------------------------------------------------

export const PASSWORD_MIN = 8;
// PBKDF2 has no input-length limit like bcrypt's 72 bytes; this cap only
// stops absurdly large inputs from being hashed.
export const PASSWORD_MAX = 128;

const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"));

export const signupInput = z.object({
  email,
  password: z
    .string()
    .min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters`)
    .max(PASSWORD_MAX, `Password must be at most ${PASSWORD_MAX} characters`),
  name: z.string().trim().min(1, "Name is required").max(60, "Name is too long"),
});

export const signinInput = z.object({
  email,
  password: z.string().min(1, "Password is required").max(PASSWORD_MAX),
});

export const TAG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const tagSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(30)
  .regex(TAG_PATTERN, "Tags may only contain letters, numbers and dashes");

const postFields = z.object({
  title: z.string().trim().min(1, "Title is required").max(150, "Title is too long"),
  content: z.string().trim().min(1, "Write something first").max(50_000, "Post is too long"),
  tags: z.array(tagSchema).max(5, "Use at most 5 tags"),
  published: z.boolean(),
});

export const createPostInput = postFields.extend({
  tags: postFields.shape.tags.default([]),
  published: postFields.shape.published.default(false),
});

// Built from the default-free fields on purpose: with defaults, a PATCH that
// only sends { published: true } would also reset tags to [].
export const updatePostInput = postFields
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export const listPostsQuery = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  tag: tagSchema.optional(),
  q: z.string().trim().min(1).max(100).optional(),
  author: z.string().uuid().optional(),
});

export const updateProfileInput = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(60, "Name is too long"),
    bio: z.string().trim().max(280, "Keep your bio under 280 characters").nullable(),
  })
  .partial();

export const myPostsQuery = z.object({
  status: z.enum(["all", "draft", "published"]).default("all"),
});

export type SignupInput = z.infer<typeof signupInput>;
export type UpdateProfileInput = z.input<typeof updateProfileInput>;
export type SigninInput = z.infer<typeof signinInput>;
export type CreatePostInput = z.input<typeof createPostInput>;
export type UpdatePostInput = z.input<typeof updatePostInput>;
export type ListPostsQuery = z.input<typeof listPostsQuery>;

// ---------------------------------------------------------------------------
// Response shapes. Dates are ISO strings on the wire.
// ---------------------------------------------------------------------------

export interface AuthorSummary {
  id: string;
  name: string;
}

export interface PublicUser extends AuthorSummary {
  bio: string | null;
  createdAt: string;
}

export interface CurrentUser extends PublicUser {
  email: string;
}

export interface PostSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  readingTime: number;
  published: boolean;
  publishedAt: string | null;
  updatedAt: string;
  tags: string[];
  author: AuthorSummary;
}

export interface PostDetail extends PostSummary {
  content: string;
  createdAt: string;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface TagCount {
  name: string;
  count: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string[]>;
  };
}
