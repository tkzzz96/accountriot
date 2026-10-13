import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ReferenceProvider } from "./reference-provider";
import { RefItem } from "../selection";

@Injectable()
export class CuratedProvider implements ReferenceProvider {
  readonly name = "curated";
  constructor(private prisma: PrismaService) {}

  async find(niche: string, language: string, workspaceId = ""): Promise<RefItem[]> {
    const rows = await this.prisma.curatedReference.findMany({
      where: { niche, language: { in: ["any", language] }, workspaceId: { in: ["", workspaceId] } },
      orderBy: [{ workspaceId: "desc" }, { url: "asc" }], // the workspace's own picks first
    });
    return rows.map((r) => ({ url: r.url, thumbUrl: r.thumbUrl, source: r.source, niche: r.niche, title: r.title }));
  }
}
