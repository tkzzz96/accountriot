import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const authHeader: string | undefined = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) throw new UnauthorizedException("Missing token");

    const token = authHeader.slice(7);
    let payload: { sub?: string; workspaceId?: string };
    try {
      payload = await this.jwtService.verifyAsync(token, { secret: this.config.get<string>("JWT_SECRET") });
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
    if (!payload.sub || !payload.workspaceId) throw new UnauthorizedException("Malformed token");

    // Tokens live 30 days: re-check membership so removed members lose access immediately.
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: payload.workspaceId, userId: payload.sub } },
      select: { id: true },
    });
    if (!member) throw new ForbiddenException("You no longer belong to this workspace");

    req.user = payload;
    return true;
  }
}
