-- CreateEnum
CREATE TYPE "SiteStatus" AS ENUM ('NONE', 'SOCIAL_ONLY', 'FREE_BUILDER', 'DEAD', 'HAS_SITE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "OwnerContactType" AS ENUM ('OWNER', 'BUSINESS', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PipelineStage" AS ENUM ('DISCOVERED', 'CLASSIFIED', 'ENRICHED', 'SCORED', 'DRAFTED', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "filter" JSONB;

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "budgetScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "budgetSignals" JSONB,
ADD COLUMN     "contactSource" TEXT,
ADD COLUMN     "dedupeKey" TEXT,
ADD COLUMN     "ownerContactType" "OwnerContactType" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "phoneNormalized" TEXT,
ADD COLUMN     "pipelineError" TEXT,
ADD COLUMN     "pipelineStage" "PipelineStage" NOT NULL DEFAULT 'DISCOVERED',
ADD COLUMN     "references" JSONB,
ADD COLUMN     "siteEvidence" JSONB,
ADD COLUMN     "siteStatus" "SiteStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "whatsapp" TEXT;

-- CreateTable
CREATE TABLE "curated_references" (
    "id" TEXT NOT NULL,
    "niche" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'any',
    "url" TEXT NOT NULL,
    "thumbUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'curated',

    CONSTRAINT "curated_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reference_cache" (
    "id" TEXT NOT NULL,
    "niche" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reference_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "curated_references_niche_url_key" ON "curated_references"("niche", "url");

-- CreateIndex
CREATE UNIQUE INDEX "reference_cache_niche_language_key" ON "reference_cache"("niche", "language");

-- CreateIndex
CREATE UNIQUE INDEX "leads_workspaceId_dedupeKey_key" ON "leads"("workspaceId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "leads_workspaceId_phoneNormalized_key" ON "leads"("workspaceId", "phoneNormalized");

