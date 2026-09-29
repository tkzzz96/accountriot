import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CampaignFilterDto {
  @ApiProperty() @IsString() niche: string;
  @ApiProperty() @IsString() country: string;
  @ApiProperty() @IsString() city: string;
  @ApiProperty({ required: false, default: 10 }) @IsOptional() @IsNumber() @Min(1) @Max(100) radiusKm?: number;
  @ApiProperty({ required: false, enum: ["micro", "small", "medium"] }) @IsOptional() @IsIn(["micro", "small", "medium"]) sizeHint?: string;
  @ApiProperty({ required: false, default: 500 }) @IsOptional() @IsNumber() @Min(0) budgetUsd?: number;
  @ApiProperty({ enum: ["pt-BR", "en"], default: "pt-BR" }) @IsIn(["pt-BR", "en"]) language: string;
  @ApiProperty({ enum: ["whatsapp", "email"], default: "whatsapp" }) @IsIn(["whatsapp", "email"]) channel: string;
  @ApiProperty({ default: true }) @IsBoolean() requireNoSite: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() lat?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() lng?: number;
  // Seller offer profile used to draft messages
  @ApiProperty({ required: false }) @IsOptional() @IsString() service?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() priceAnchor?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() deadline?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() sellerName?: string;
  @ApiProperty({ required: false, default: 50 }) @IsOptional() @IsInt() @Min(1) @Max(200) maxResults?: number;
}

export type CampaignFilter = CampaignFilterDto;
