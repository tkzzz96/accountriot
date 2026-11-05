import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export const CRM_STATUSES = ["new", "contacted", "replied", "meeting", "proposal", "won", "lost"] as const;

export class BulkLeadsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @ArrayUnique() @IsString({ each: true })
  ids!: string[];

  @IsIn(["crm", "delete"])
  action!: "crm" | "delete";

  @IsOptional() @IsIn(CRM_STATUSES as unknown as string[])
  crmStatus?: (typeof CRM_STATUSES)[number];

  @IsOptional() @IsString() @MaxLength(2000)
  crmNotes?: string;
}
