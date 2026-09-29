import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { PipelineService } from "./pipeline.service";
import { PipelineProcessor } from "./pipeline.processor";
import { CampaignsModule } from "../campaigns/campaigns.module";
import { DiscoveryModule } from "../discovery/discovery.module";
import { OutreachModule } from "../outreach/outreach.module";
import { EnrichmentModule } from "../enrichment/enrichment.module";

@Module({
  imports: [BullModule.registerQueue({ name: "pipeline" }), CampaignsModule, DiscoveryModule, EnrichmentModule, OutreachModule],
  providers: [PipelineService, PipelineProcessor],
  exports: [PipelineService, BullModule],
})
export class PipelineModule {}
