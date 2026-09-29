import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsOptional, IsString, IsUrl } from "class-validator";
import { JwtGuard } from "../auth/jwt.guard";
import { ReferencesService } from "./references.service";

class AddReferenceDto {
  @IsString() niche: string;
  @IsUrl() url: string;
  @IsString() title: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsUrl() thumbUrl?: string;
}

@ApiTags("References")
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller("references")
export class ReferencesController {
  constructor(private refs: ReferencesService) {}

  @Get()
  list(@Query("niche") niche?: string) {
    return this.refs.list(niche);
  }

  @Post()
  add(@Body() dto: AddReferenceDto) {
    return this.refs.addCurated(dto);
  }
}
