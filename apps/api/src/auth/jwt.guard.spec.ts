import { createHash } from "crypto";
import { describe, expect, it, vi } from "vitest";
import { ForbiddenException, UnauthorizedException, ExecutionContext } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { JwtGuard } from "./jwt.guard";
import type { PrismaService } from "../prisma/prisma.service";

const SECRET = "test-secret-test-secret";
const jwt = new JwtService({ secret: SECRET });
const config = { get: (k: string, d?: string) => (k === "JWT_SECRET" ? SECRET : d) } as unknown as ConfigService;

function setup(opts: { member?: boolean; apiKey?: object | null } = {}) {
  const prisma = {
    workspaceMember: { findUnique: vi.fn(async () => (opts.member === false ? null : { id: "m" })) },
    apiKey: { findUnique: vi.fn(async () => opts.apiKey ?? null), update: vi.fn(async () => ({})) },
  } as unknown as PrismaService;
  const guard = new JwtGuard(jwt, config, prisma);
  const cookies: string[] = [];
  const run = async (req: Record<string, unknown>) => {
    const request = { method: "GET", headers: {}, ...req } as Record<string, unknown>;
    const res = { cookie: (n: string) => cookies.push(n), clearCookie: () => undefined };
    const ctx = { switchToHttp: () => ({ getRequest: () => request, getResponse: () => res }) } as unknown as ExecutionContext;
    await guard.canActivate(ctx);
    return request;
  };
  return { run, cookies, prisma };
}
const token = (extra: object = {}, signOpts = {}) => jwt.sign({ sub: "u1", workspaceId: "w1", ...extra }, signOpts);

describe("JwtGuard", () => {
  it("accepts a Bearer token without CSRF", async () => {
    const { run } = setup();
    const req = await run({ method: "POST", headers: { authorization: `Bearer ${token()}` } });
    expect(req.user).toEqual({ sub: "u1", workspaceId: "w1" });
  });

  it("rejects missing, invalid and malformed tokens", async () => {
    const { run } = setup();
    await expect(run({})).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(run({ headers: { authorization: "Bearer nope" } })).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(run({ headers: { authorization: `Bearer ${jwt.sign({ sub: "u" })}` } })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("cookie auth: GET works without CSRF, POST needs a matching header", async () => {
    const { run } = setup();
    const cookie = `prospector_session=${token()}; prospector_csrf=abc`;
    await expect(run({ headers: { cookie } })).resolves.toBeTruthy();
    await expect(run({ method: "POST", headers: { cookie } })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(run({ method: "POST", headers: { cookie, "x-csrf-token": "zzz" } })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(run({ method: "DELETE", headers: { cookie, "x-csrf-token": "abc" } })).resolves.toBeTruthy();
  });

  it("re-checks membership on every request", async () => {
    const { run } = setup({ member: false });
    await expect(run({ headers: { authorization: `Bearer ${token()}` } })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("renews old cookie sessions (sliding) but not fresh ones", async () => {
    const old = setup();
    const iat = Math.floor(Date.now() / 1000) - 2 * 86400;
    await old.run({ headers: { cookie: `prospector_session=${token({ iat })}` } });
    expect(old.cookies).toContain("prospector_session");
    const fresh = setup();
    await fresh.run({ headers: { cookie: `prospector_session=${token()}` } });
    expect(fresh.cookies).toEqual([]);
  });

  it("ApiKey: workspace-scoped, no user id; bad/expired keys rejected", async () => {
    const key = "px_secret";
    const row = { id: "k1", workspaceId: "w9", keyHash: createHash("sha256").update(key).digest("hex"), expiresAt: null };
    const ok = setup({ apiKey: row });
    const req = await ok.run({ headers: { authorization: `ApiKey ${key}` } });
    expect(req.user).toEqual({ workspaceId: "w9", apiKeyId: "k1" });
    expect((req.user as Record<string, unknown>).sub).toBeUndefined();
    await expect(setup({ apiKey: null }).run({ headers: { authorization: `ApiKey ${key}` } })).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(ok.run({ headers: { authorization: "ApiKey wrong" } })).rejects.toBeInstanceOf(UnauthorizedException);
    const expired = setup({ apiKey: { ...row, expiresAt: new Date(Date.now() - 1000) } });
    await expect(expired.run({ headers: { authorization: `ApiKey ${key}` } })).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
