-- Inkstack v1: timestamps, drafts, slugs, tags, stored excerpts and indexes.
-- Written by hand so existing rows are backfilled instead of rejected.

-- User ----------------------------------------------------------------------
ALTER TABLE "User" ADD COLUMN "bio" TEXT;
ALTER TABLE "User" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "User" SET "name" = split_part("email", '@', 1) WHERE "name" IS NULL OR btrim("name") = '';
ALTER TABLE "User" ALTER COLUMN "name" SET NOT NULL;

-- Post ----------------------------------------------------------------------
ALTER TABLE "Post" ADD COLUMN "slug" TEXT;
ALTER TABLE "Post" ADD COLUMN "excerpt" TEXT;
ALTER TABLE "Post" ADD COLUMN "readingTime" INTEGER;
ALTER TABLE "Post" ADD COLUMN "publishedAt" TIMESTAMP(3);
ALTER TABLE "Post" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Post" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Every post written before drafts existed was visible to readers, so keep it
-- that way. The id suffix guarantees uniqueness for the backfilled slugs.
UPDATE "Post" SET
  "published"   = true,
  "publishedAt" = CURRENT_TIMESTAMP,
  "slug"        = coalesce(nullif(trim(both '-' from left(regexp_replace(lower("title"), '[^a-z0-9]+', '-', 'g'), 60)), ''), 'post')
                  || '-' || left(replace("id", '-', ''), 8),
  "excerpt"     = left(regexp_replace(btrim("content"), '\s+', ' ', 'g'), 200),
  "readingTime" = greatest(1, ceil(coalesce(array_length(regexp_split_to_array(btrim("content"), '\s+'), 1), 0) / 200.0))::int;

ALTER TABLE "Post" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "Post" ALTER COLUMN "excerpt" SET NOT NULL;
ALTER TABLE "Post" ALTER COLUMN "readingTime" SET NOT NULL;
-- updatedAt is maintained by Prisma (@updatedAt), not by a database default.
ALTER TABLE "Post" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- Deleting an account removes its posts instead of failing.
ALTER TABLE "Post" DROP CONSTRAINT "Post_authorId_fkey";
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Post_slug_key" ON "Post"("slug");
CREATE INDEX "Post_authorId_idx" ON "Post"("authorId");
CREATE INDEX "Post_published_publishedAt_id_idx" ON "Post"("published", "publishedAt" DESC, "id");

-- Tags ----------------------------------------------------------------------
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- Implicit many-to-many join table, named the way Prisma expects.
CREATE TABLE "_PostToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PostToTag_AB_pkey" PRIMARY KEY ("A","B")
);
CREATE INDEX "_PostToTag_B_index" ON "_PostToTag"("B");
ALTER TABLE "_PostToTag" ADD CONSTRAINT "_PostToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_PostToTag" ADD CONSTRAINT "_PostToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
