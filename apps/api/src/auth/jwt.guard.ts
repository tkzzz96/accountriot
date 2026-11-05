import { createHash } from "crypto";
import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { CSRF_COOKIE, CSRF_HEADER, SAFE_METHODS, SESSION_COOKIE, csrfMatches, durationToMs, parseCookies, setSessionCookies } from "./session";

const RENEW_AFTER_MS = 24 * 3600_000; // sliding session: re-issue the cookie when it is older than a day

/**
 * Authenticates a request in one of three ways:
 *  1. `Authorization: Bearer <jwt>`      — scripts/tests (no CSRF: the browser never attaches it on its own)
 *  2. `Authorization: ApiKey px_…`       — integrations/MCP (workspace-scoped, no user identity)
 *  3. httpOnly session cookie            — the web app (state-changing calls must echo the CSRF cookie in a header)
 */
@Injectable()
export class JwtGuard implements CanActivate {
  private readonly logger = new Logger(JwtGuard.name);

  constructor(
    private jwtService: JwtService,
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const http = ctx.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();
    const authHeader: string | undefined = req.headers.authorization;

    if (authHeader?.startsWith("ApiKey ")) {
      req.user = await this.fromApiKey(authHeader.slice(7).trim());
      return true;
    }

    let token: string | undefined;
    let viaCookie = false;
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    } else {
      const cookies = parseCookies(req.headers.cookie);
      token = cookies[SESSION_COOKIE];
      viaCookie = Boolean(token);
      if (viaCookie && !SAFE_METHODS.has(String(req.method).toUpperCase()) && !csrfMatches(cookies[CSRF_COOKIE], req.headers[CSRF_HEADER] as string | undefined)) {
        throw new ForbiddenException("Missing or invalid CSRF token");
      }
    }
    if (!token) throw new UnauthorizedException("Missing token");

    let payload: { sub?: string; workspaceId?: string; iat?: number };
    try {
      payload = await this.jwtService.verifyAsync(token, { secret: this.config.get<string>("JWT_SECRET") });
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
    if (!payload.sub || !payload.workspaceId) throw new UnauthorizedException("Malformed token");

    // Sessions are long-lived: re-check membership so removed members lose access immediately.
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: payload.workspaceId, userId: payload.sub } },
      select: { id: true },
    });
    if (!member) throw new ForbiddenException("You no longer belong to this workspace");

    if (viaCookie && payload.iat && Date.now() - payload.iat * 1000 > RENEW_AFTER_MS) {
      const ttl = durationToMs(this.config.get<string>("JWT_EXPIRES_IN", "7d"));
      const fresh = this.jwtService.sign({ sub: payload.sub, workspaceId: payload.workspaceId });
      setSessionCookies(res, fresh, ttl);
    }

    req.user = { sub: payload.sub, workspaceId: payload.workspaceId };
    return true;
  }

  private async fromApiKey(plaintext: string) {
    if (!plaintext.startsWith("px_")) throw new UnauthorizedException("Invalid API key format");
    const keyHash = createHash("sha256").update(plaintext).digest("hex");
    const key = await this.prisma.apiKey.findUnique({ where: { keyHash } });
    if (!key) throw new UnauthorizedException("API key not found or revoked");
    if (key.expiresAt && key.expiresAt < new Date()) throw new UnauthorizedException("API key has expired");
    this.prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch((err: unknown) => this.logger.warn(`could not record API key usage: ${err instanceof Error ? err.message : String(err)}`));
    return { workspaceId: key.workspaceId, apiKeyId: key.id }; // deliberately no `sub`: not a user
  }
}
