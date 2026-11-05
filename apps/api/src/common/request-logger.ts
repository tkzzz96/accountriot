import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";

export interface AccessLogLine {
  ts: string;
  level: "info" | "warn" | "error";
  reqId: string;
  method: string;
  path: string;
  status: number;
  ms: number;
}

/** Strips the query string (it can carry search terms/PII) from a URL before logging. */
export const pathOnly = (url: string): string => url.split("?")[0].slice(0, 200);

export function formatLine(line: AccessLogLine, format: "json" | "text"): string {
  if (format === "json") return JSON.stringify(line);
  return `${line.ts} ${line.level.toUpperCase()} [${line.reqId}] ${line.method} ${line.path} ${line.status} ${line.ms}ms`;
}

/** Express middleware: assigns/propagates X-Request-Id and writes one access-log line per response (no bodies, headers or queries). */
export function requestLogger(format: "json" | "text", write: (line: string) => void = (l) => process.stdout.write(`${l}\n`)) {
  return (req: Request, res: Response, next: NextFunction) => {
    const incoming = req.headers["x-request-id"];
    const reqId = typeof incoming === "string" && /^[\w.-]{1,64}$/.test(incoming) ? incoming : randomUUID();
    res.setHeader("X-Request-Id", reqId);
    const started = process.hrtime.bigint();
    res.on("finish", () => {
      const ms = Math.round(Number(process.hrtime.bigint() - started) / 1e6);
      const status = res.statusCode;
      write(
        formatLine(
          { ts: new Date().toISOString(), level: status >= 500 ? "error" : status >= 400 ? "warn" : "info", reqId, method: req.method, path: pathOnly(req.originalUrl ?? req.url), status, ms },
          format,
        ),
      );
    });
    next();
  };
}
