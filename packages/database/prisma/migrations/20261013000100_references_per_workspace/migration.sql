-- Curated references become per-workspace ("" = read-only global starter seed).
-- DropIndex
DROP INDEX "curated_references_niche_url_key";

-- AlterTable
ALTER TABLE "curated_references" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX "curated_references_workspaceId_niche_url_key" ON "curated_references"("workspaceId", "niche", "url");
