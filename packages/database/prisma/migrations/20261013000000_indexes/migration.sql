-- CreateIndex
CREATE INDEX "campaigns_workspaceId_createdAt_idx" ON "campaigns"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "leads_campaignId_pipelineStage_idx" ON "leads"("campaignId", "pipelineStage");

-- CreateIndex
CREATE INDEX "leads_workspaceId_siteStatus_idx" ON "leads"("workspaceId", "siteStatus");

-- CreateIndex
CREATE INDEX "leads_workspaceId_score_idx" ON "leads"("workspaceId", "score" DESC);

-- CreateIndex
CREATE INDEX "leads_workspaceId_crmStatus_idx" ON "leads"("workspaceId", "crmStatus");

-- CreateIndex
CREATE INDEX "lead_activities_leadId_createdAt_idx" ON "lead_activities"("leadId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "follow_ups_leadId_done_idx" ON "follow_ups"("leadId", "done");

