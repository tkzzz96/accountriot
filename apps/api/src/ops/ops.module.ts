import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { OpsController } from "./ops.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule, BullModule.registerQueue({ name: "pipeline" }, { name: "scraper" })],
  controllers: [OpsController],
})
export class OpsModule {}
