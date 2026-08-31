-- Rename the `member` platform role to `teammate` (owner|admin|teammate).
-- RENAME VALUE preserves existing rows and the column default's binding,
-- unlike drizzle-kit's default drop/recreate (which would reject any
-- pre-existing `member` row on the recast). Same end state as the snapshot.
ALTER TYPE "public"."user_role" RENAME VALUE 'member' TO 'teammate';--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'teammate';
