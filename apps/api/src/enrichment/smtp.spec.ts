import * as net from "net";
import { AddressInfo } from "net";
import { describe, expect, it } from "vitest";
import { smtpRcptProbe } from "./email-verifier";

/** Fake SMTP server answering RCPT with the given code. Records every command; fails the test if DATA is ever received. */
function fakeSmtp(rcptCode: number) {
  const commands: string[] = [];
  const server = net.createServer((sock) => {
    sock.write("220 fake ESMTP\r\n");
    sock.on("data", (buf) => {
      for (const line of buf.toString().split("\r\n").filter(Boolean)) {
        commands.push(line);
        if (/^HELO|^EHLO/i.test(line)) sock.write("250 hi\r\n");
        else if (/^MAIL FROM/i.test(line)) sock.write("250 ok\r\n");
        else if (/^RCPT TO/i.test(line)) sock.write(`${rcptCode} reply\r\n`);
        else if (/^QUIT/i.test(line)) sock.end("221 bye\r\n");
      }
    });
    sock.on("error", () => undefined);
  });
  return new Promise<{ port: number; commands: string[]; close: () => Promise<void> }>((resolve) =>
    server.listen(0, "127.0.0.1", () =>
      resolve({ port: (server.address() as AddressInfo).port, commands, close: () => new Promise((r) => server.close(() => r())) }),
    ),
  );
}

describe("smtpRcptProbe", () => {
  it.each([
    [250, "valid"],
    [550, "invalid"],
    [451, "unknown"],
  ])("RCPT %i => %s, and never sends DATA", async (code, verdict) => {
    const s = await fakeSmtp(code);
    try {
      expect(await smtpRcptProbe("127.0.0.1", "a@b.com", 2000, s.port)).toBe(verdict);
      expect(s.commands.some((c) => /^DATA/i.test(c))).toBe(false);
      expect(s.commands.some((c) => /^RCPT TO:<a@b.com>/i.test(c))).toBe(true);
    } finally {
      await s.close();
    }
  });

  it("unreachable server => unknown (never a false 'invalid')", async () => {
    expect(await smtpRcptProbe("127.0.0.1", "a@b.com", 500, 1)).toBe("unknown");
  });
});
