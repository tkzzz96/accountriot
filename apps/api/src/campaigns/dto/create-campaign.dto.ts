import { IsString, IsArray, IsOptional, IsInt, Min, Max, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { CampaignFilterDto } from "./campaign-filter.dto";

export class CreateCampaignDto {
  @ApiProperty() @IsString() name: string;
  // Legacy fields: derived from `filter` when omitted.
  @ApiProperty({ required: false }) @IsOptional() @IsString() industry?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() location?: string;
  @ApiProperty({ type: [String], required: false }) @IsOptional() @IsArray() @IsString({ each: true }) searchQueries?: string[];
  @ApiProperty({ required: false }) @IsOptional() @IsString() yourService?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string;
  @ApiProperty({ default: 20, required: false }) @IsOptional() @IsInt() @Min(1) @Max(200) maxResults?: number;
  @ApiProperty({ default: "balanced" }) @IsOptional() @IsString() contentStyle?: string;
  @ApiProperty({ default: "indonesian" }) @IsOptional() @IsString() language?: string;
  @ApiProperty({ required: false, type: CampaignFilterDto }) @IsOptional() @ValidateNested() @Type(() => CampaignFilterDto) filter?: CampaignFilterDto;
}
