import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { InviteMemberDto, UpdateRoleDto, UpdateWorkspaceDto } from "./dto";
import { CreateCampaignDto } from "../campaigns/dto/create-campaign.dto";

const ok = async (cls: new () => object, body: object) => (await validate(plainToInstance(cls, body))).length === 0;

describe("role escalation is impossible", () => {
  it("cannot invite as owner", async () => expect(await ok(InviteMemberDto, { email: "a@b.com", role: "owner" })).toBe(false));
  it("cannot promote to owner", async () => expect(await ok(UpdateRoleDto, { role: "owner" })).toBe(false));
  it("cannot set arbitrary role", async () => expect(await ok(UpdateRoleDto, { role: "superadmin" })).toBe(false));
  it("admin and member are fine", async () => {
    expect(await ok(UpdateRoleDto, { role: "admin" })).toBe(true);
    expect(await ok(InviteMemberDto, { email: "a@b.com" })).toBe(true);
  });
  it("invalid email rejected", async () => expect(await ok(InviteMemberDto, { email: "nope" })).toBe(false));
  it("slug must be url-safe", async () => {
    expect(await ok(UpdateWorkspaceDto, { slug: "Bad Slug!" })).toBe(false);
    expect(await ok(UpdateWorkspaceDto, { slug: "good-slug" })).toBe(true);
  });
});

describe("campaign DTO", () => {
  const filter = { niche: "barbearia", country: "Brasil", city: "Curitiba", language: "pt-BR", channel: "whatsapp", requireNoSite: true };
  it("accepts a valid filter", async () => expect(await ok(CreateCampaignDto, { name: "X", filter })).toBe(true));
  it("filter is required", async () => expect(await ok(CreateCampaignDto, { name: "X" })).toBe(false));
  it("rejects absurdly long fields (prompt-stuffing)", async () => {
    expect(await ok(CreateCampaignDto, { name: "X", filter: { ...filter, niche: "a".repeat(500) } })).toBe(false);
    expect(await ok(CreateCampaignDto, { name: "X", filter: { ...filter, service: "a".repeat(5000) } })).toBe(false);
  });
  it("rejects bad language/channel/coordinates", async () => {
    expect(await ok(CreateCampaignDto, { name: "X", filter: { ...filter, language: "xx" } })).toBe(false);
    expect(await ok(CreateCampaignDto, { name: "X", filter: { ...filter, channel: "sms" } })).toBe(false);
    expect(await ok(CreateCampaignDto, { name: "X", filter: { ...filter, lat: 999 } })).toBe(false);
  });
});
