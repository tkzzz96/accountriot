import { EventEmitter } from "events";
import { describe, expect, it } from "vitest";
import { formatLine, pathOnly, requestLogger } from "./request-logger";

function fire(headers: Record<string, string>, url: string, status: number, format: "json" | "text") {
  const lines: string[] = [];
  const res = Object.assign(new EventEmitter(), { statusCode: status, headers: {} as Record<string, string>, setHeader(k: string, v: string) { this.headers[k] = v; } });
  const req = { headers, method: "GET", originalUrl: url, url };
  let called = false;
  requestLogger(format, (l) => lines.push(l))(req as never, res as never, () => { called = true; });
  res.emit("finish");
  return { lines, res, called };
}

describe("requestLogger", () => {
  it("logs one JSON line without the query string and sets X-Request-Id", () => {
    const { lines, res, called } = fire({}, "/api/leads?q=maria%40x.com", 200, "json");
    expect(called).toBe(true);
    const line = JSON.parse(lines[0]);
    expect(line).toMatchObject({ method: "GET", path: "/api/leads", status: 200, level: "info" });
    expect(lines[0]).not.toContain("maria");
    expect(res.headers["X-Request-Id"]).toBe(line.reqId);
  });
  it("reuses a sane incoming request id and ignores a hostile one", () => {
    expect(fire({ "x-request-id": "abc-123" }, "/x", 200, "json").res.headers["X-Request-Id"]).toBe("abc-123");
    expect(fire({ "x-request-id": "a b\nc" }, "/x", 200, "json").res.headers["X-Request-Id"]).not.toBe("a b\nc");
  });
  it("levels follow the status and text format is single-line", () => {
    expect(JSON.parse(fire({}, "/x", 404, "json").lines[0]).level).toBe("warn");
    expect(JSON.parse(fire({}, "/x", 500, "json").lines[0]).level).toBe("error");
    expect(fire({}, "/x", 200, "text").lines[0]).toMatch(/INFO \[.+\] GET \/x 200 \d+ms$/);
  });
  it("helpers", () => {
    expect(pathOnly("/a/b?x=1")).toBe("/a/b");
    expect(formatLine({ ts: "t", level: "info", reqId: "r", method: "GET", path: "/p", status: 200, ms: 1 }, "text")).toContain("GET /p 200");
  });
});
