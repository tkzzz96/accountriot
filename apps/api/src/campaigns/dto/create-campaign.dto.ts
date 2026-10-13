import { IsDefined, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { CampaignFilterDto } from "./campaign-filter.dto";

export class CreateCampaignDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(120) name: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(500) description?: string;
  @ApiProperty({ type: CampaignFilterDto }) @IsDefined() @ValidateNested() @Type(() => CampaignFilterDto) filter: CampaignFilterDto;
}
