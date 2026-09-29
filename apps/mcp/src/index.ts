#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ProspectorClient, configFromEnv } from "./client";
import { createCampaign, createCampaignShape, getLead, getLeadShape, listLeads, listLeadsShape, regenerateDraft, regenerateShape } from "./tools";

async function main() {
  const client = new ProspectorClient(configFromEnv());
  const server = new McpServer({ name: "prospector", version: "0.1.0" });
  const text = (v: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(v, null, 2) }] });

  server.tool("create_campaign", "Create and start a prospecting campaign (niche + city). Leads arrive asynchronously.", createCampaignShape, async (a) => text(await createCampaign(client, a)));
  server.tool("list_leads", "List leads (summary) with optional campaign/priority/text filters.", listLeadsShape, async (a) => text(await listLeads(client, a)));
  server.tool("get_lead", "Full lead: site evidence, contacts with source, score breakdown, budget estimate, draft, references.", getLeadShape, async (a) => text(await getLead(client, a)));
  server.tool("regenerate_draft", "Regenerate the follow-up DRAFT for a lead. Nothing is ever sent.", regenerateShape, async (a) => text(await regenerateDraft(client, a)));

  await server.connect(new StdioServerTransport());
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
