import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

/** `owner` is intentionally absent: ownership is set at registration and can never be granted. */
export const ASSIGNABLE_ROLES = ["admin", "member"] as const;

export class InviteMemberDto {
  @IsEmail() @MaxLength(254) email: string;
  @IsOptional() @IsIn(ASSIGNABLE_ROLES) role?: (typeof ASSIGNABLE_ROLES)[number];
}

export class UpdateRoleDto {
  @IsIn(ASSIGNABLE_ROLES) role: (typeof ASSIGNABLE_ROLES)[number];
}

export class UpdateWorkspaceDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string;
  @IsOptional() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(60) slug?: string;
}
