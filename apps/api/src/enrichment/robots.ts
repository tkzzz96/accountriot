/** Minimal robots.txt evaluation for a single user-agent group ("*" or ours). */
export interface RobotsRules {
  disallow: string[];
  allow: string[];
  crawlDelaySec: number | null;
}

export function parseRobots(text: string, agent = "prospectorbot"): RobotsRules {
  const groups: Array<{ agents: string[]; disallow: string[]; allow: string[]; delay: number | null }> = [];
  let cur: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const val = line.slice(idx + 1).trim();
    if (key === "user-agent") {
      if (!cur || !lastWasAgent) {
        cur = { agents: [], disallow: [], allow: [], delay: null };
        groups.push(cur);
      }
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!cur) continue;
    if (key === "disallow" && val) cur.disallow.push(val);
    else if (key === "allow" && val) cur.allow.push(val);
    else if (key === "crawl-delay") cur.delay = Number(val) || null;
  }
  const specific = groups.find((g) => g.agents.some((a) => a !== "*" && agent.includes(a)));
  const star = groups.find((g) => g.agents.includes("*"));
  const g = specific ?? star;
  return { disallow: g?.disallow ?? [], allow: g?.allow ?? [], crawlDelaySec: g?.delay ?? null };
}

function matches(path: string, rule: string): boolean {
  const escaped = rule.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$");
  return new RegExp(`^${escaped}`).test(path);
}

/** Longest-match wins; Allow beats Disallow on ties (RFC 9309). */
export function isAllowed(rules: RobotsRules, path: string): boolean {
  let best = { len: -1, allow: true };
  for (const r of rules.disallow) if (matches(path, r) && r.length > best.len) best = { len: r.length, allow: false };
  for (const r of rules.allow) if (matches(path, r) && r.length >= best.len) best = { len: r.length, allow: true };
  return best.allow;
}
