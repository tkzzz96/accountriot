-- DropIndex
DROP INDEX "curated_references_niche_url_key";

-- DropIndex
DROP INDEX "reference_cache_niche_language_key";

-- AlterTable
ALTER TABLE "curated_references" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "reference_cache" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX "curated_references_workspaceId_niche_url_key" ON "curated_references"("workspaceId", "niche", "url");

-- CreateIndex
CREATE UNIQUE INDEX "reference_cache_workspaceId_niche_language_key" ON "reference_cache"("workspaceId", "niche", "language");

