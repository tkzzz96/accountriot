import { IsObject, IsString, MaxLength, MinLength } from "class-validator";

export class UpsertIntegrationDto {
  @IsString() @MinLength(1) @MaxLength(40) type: string;
  @IsString() @MinLength(1) @MaxLength(80) name: string;
  @IsObject() config: Record<string, string>;
}

export class CreateApiKeyDto {
  @IsString() @MinLength(1) @MaxLength(80) name: string;
}
