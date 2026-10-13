import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CampaignFilterDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(80) niche: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(80) country: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(80) city: string;
  @ApiProperty({ required: false, default: 10 }) @IsOptional() @IsNumber() @Min(1) @Max(100) radiusKm?: number;
  @ApiProperty({ required: false, enum: ["micro", "small", "medium"] }) @IsOptional() @IsIn(["micro", "small", "medium"]) sizeHint?: string;
  @ApiProperty({ required: false, default: 500 }) @IsOptional() @IsNumber() @Min(0) @Max(1_000_000) budgetUsd?: number;
  @ApiProperty({ enum: ["pt-BR", "en"], default: "pt-BR" }) @IsIn(["pt-BR", "en"]) language: string;
  @ApiProperty({ enum: ["whatsapp", "email"], default: "whatsapp" }) @IsIn(["whatsapp", "email"]) channel: string;
  @ApiProperty({ default: true }) @IsBoolean() requireNoSite: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(-90) @Max(90) lat?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(-180) @Max(180) lng?: number;
  // Seller offer profile used to draft messages
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(200) service?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(200) priceAnchor?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(200) deadline?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(200) sellerName?: string;
  @ApiProperty({ required: false, default: 50 }) @IsOptional() @IsInt() @Min(1) @Max(200) maxResults?: number;
}

export type CampaignFilter = CampaignFilterDto;
