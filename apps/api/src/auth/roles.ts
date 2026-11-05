import { ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export const ADMIN_ROLES = ["owner", "admin"];

/** Throws unless `userId` is an owner/admin of the workspace. API-key callers (no user) are rejected. */
export async function requireAdmin(prisma: PrismaService, workspaceId: string, userId: string | undefined): Promise<void> {
  if (!userId) throw new ForbiddenException("This action requires a signed-in user (API keys are not allowed)");
  const m = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } });
  if (!m || !ADMIN_ROLES.includes(m.role)) throw new ForbiddenException("Only workspace owners and admins can do this");
}
