import { describe, expect, it } from "vitest";
import { ForbiddenException } from "@nestjs/common";
import { requireAdmin } from "./roles";
import type { PrismaService } from "../prisma/prisma.service";

const prismaWith = (role: string | null) => ({ workspaceMember: { findUnique: async () => (role ? { role } : null) } }) as unknown as PrismaService;

describe("requireAdmin", () => {
  it("allows owner and admin", async () => {
    await expect(requireAdmin(prismaWith("owner"), "w", "u")).resolves.toBeUndefined();
    await expect(requireAdmin(prismaWith("admin"), "w", "u")).resolves.toBeUndefined();
  });
  it("rejects members, strangers and API keys (no user)", async () => {
    await expect(requireAdmin(prismaWith("member"), "w", "u")).rejects.toBeInstanceOf(ForbiddenException);
    await expect(requireAdmin(prismaWith(null), "w", "u")).rejects.toBeInstanceOf(ForbiddenException);
    await expect(requireAdmin(prismaWith("owner"), "w", undefined)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
