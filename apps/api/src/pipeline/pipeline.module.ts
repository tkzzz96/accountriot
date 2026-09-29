import { Module } from "@nestjs/common";
import { PipelineService } from "./pipeline.service";
import { CampaignsModule } from "../campaigns/campaigns.module";
import { DiscoveryModule } from "../discovery/discovery.module";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [CampaignsModule, DiscoveryModule, PrismaModule],
  providers: [PipelineService],
  exports: [PipelineService],
})
export class PipelineModule {}
