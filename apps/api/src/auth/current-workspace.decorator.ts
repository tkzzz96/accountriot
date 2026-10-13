import { createParamDecorator, ExecutionContext, UnauthorizedException } from "@nestjs/common";

/** Workspace of the authenticated caller. Never falls back to a shared workspace (tenant isolation). */
export const WorkspaceId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest();
  const id: string | undefined = req.user?.workspaceId;
  if (!id) throw new UnauthorizedException("No workspace in session");
  return id;
});
