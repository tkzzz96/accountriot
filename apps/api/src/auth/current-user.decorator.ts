import { createParamDecorator, ExecutionContext, ForbiddenException } from "@nestjs/common";

/** The signed-in user's id. API-key callers have none, so user-only endpoints reject them with 403. */
export const CurrentUserId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest();
  const id: string | undefined = req.user?.sub;
  if (!id) throw new ForbiddenException("This action requires a signed-in user (API keys are not allowed)");
  return id;
});
