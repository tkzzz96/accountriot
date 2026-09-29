import { Module } from "@nestjs/common";
import { ReferencesService } from "./references.service";
import { ReferencesController } from "./references.controller";
import { CuratedProvider } from "./providers/curated.provider";
import { PinterestProvider } from "./providers/pinterest.provider";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [ReferencesController],
  providers: [ReferencesService, CuratedProvider, PinterestProvider],
  exports: [ReferencesService],
})
export class ReferencesModule {}
