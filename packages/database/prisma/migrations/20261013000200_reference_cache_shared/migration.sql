-- The external-provider cache is shared across workspaces again (one search per niche/language).
-- Only a cache: safe to empty so the (niche, language) unique index can be rebuilt.
TRUNCATE TABLE "reference_cache";

-- DropIndex
DROP INDEX "reference_cache_workspaceId_niche_language_key";

-- AlterTable
ALTER TABLE "reference_cache" DROP COLUMN "workspaceId";

-- CreateIndex
CREATE UNIQUE INDEX "reference_cache_niche_language_key" ON "reference_cache"("niche", "language");
