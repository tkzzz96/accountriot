-- The external-provider cache is shared across workspaces again (one search per niche/language).
-- Idempotent on purpose: it must also work on databases that never had the per-workspace cache column.
-- Only a cache: safe to empty so the (niche, language) unique index can be rebuilt.
TRUNCATE TABLE "reference_cache";

DROP INDEX IF EXISTS "reference_cache_workspaceId_niche_language_key";

ALTER TABLE "reference_cache" DROP COLUMN IF EXISTS "workspaceId";

CREATE UNIQUE INDEX IF NOT EXISTS "reference_cache_niche_language_key" ON "reference_cache"("niche", "language");
