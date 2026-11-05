import { Controller, Post, Get, Body, HttpCode, HttpStatus, Res, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { ConfigService } from "@nestjs/config";
import type { Response } from "express";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { JwtGuard } from "./jwt.guard";
import { CurrentUserId } from "./current-user.decorator";
import { WorkspaceId } from "./current-workspace.decorator";
import { clearSessionCookies, durationToMs, setSessionCookies } from "./session";

@ApiTags("Auth")
@Throttle({
  default: {
    ttl: Number(process.env.THROTTLE_TTL_MS) || 60000,
    limit: Number(process.env.AUTH_THROTTLE_LIMIT) || 10,
  },
})
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  private get ttlMs(): number {
    return durationToMs(this.config.get<string>("JWT_EXPIRES_IN", "7d"));
  }

  @Post("register")
  @ApiOperation({ summary: "Register new user + workspace (sets the session cookie)" })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const out = await this.authService.register(dto);
    setSessionCookies(res, out.token, this.ttlMs);
    return out;
  }

  @Post("login")
  @ApiOperation({ summary: "Login with email + password (sets the session cookie)" })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const out = await this.authService.login(dto);
    setSessionCookies(res, out.token, this.ttlMs);
    return out;
  }

  @Get("me")
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user info (cookie, Bearer or user session)" })
  me(@CurrentUserId() userId: string, @WorkspaceId() workspaceId: string) {
    return this.authService.me(userId, workspaceId);
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Logout — clears the session cookies" })
  logout(@Res({ passthrough: true }) res: Response) {
    // Stateless JWT: the cookie is cleared here. Server-side revocation would need a token blocklist (Redis).
    clearSessionCookies(res);
  }
}
