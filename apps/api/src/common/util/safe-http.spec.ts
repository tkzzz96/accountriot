import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as http from "http";
import { AddressInfo } from "net";
import { assertTargetAllowed, BlockedAddressError, DnsFailureError, isPublicIp, safeGet } from "./safe-http";

describe("isPublicIp", () => {
  const blocked = [
    "127.0.0.1", "127.1.2.3", "10.0.0.1", "10.255.255.255", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254",
    "0.0.0.0", "100.64.0.1", "224.0.0.1", "255.255.255.255", "198.18.0.1", "192.0.2.5",
    "::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:10.0.0.1",
    "2001:db8::1", "2002:7f00:1::", "64:ff9b::7f00:1", "not-an-ip", "",
  ];
  for (const ip of blocked) it(`blocks ${ip || "(empty)"}`, () => expect(isPublicIp(ip)).toBe(false));
  const allowed = ["8.8.8.8", "1.1.1.1", "172.15.255.255", "172.32.0.1", "193.0.0.1", "2606:4700:4700::1111", "2a00:1450:4001::200e", "::ffff:8.8.8.8"];
  for (const ip of allowed) it(`allows ${ip}`, () => expect(isPublicIp(ip)).toBe(true));
});

describe("safeGet", () => {
  let server: http.Server;
  let base: string;
  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.url === "/ok") return void res.writeHead(200, { "content-type": "text/html" }).end("<html>hello</html>");
      if (req.url === "/big") return void res.writeHead(200, { "content-type": "text/html" }).end("x".repeat(100_000));
      if (req.url === "/r1") return void res.writeHead(302, { location: "/ok" }).end();
      if (req.url === "/loop") return void res.writeHead(302, { location: "/loop" }).end();
      if (req.url === "/to-metadata") return void res.writeHead(302, { location: "http://169.254.169.254/latest/meta-data" }).end();
      if (req.url === "/slow") return; // never answers
      res.writeHead(404).end("nope");
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it("blocks loopback IP literal by default", async () => {
    await expect(safeGet(`${base}/ok`)).rejects.toBeInstanceOf(BlockedAddressError);
  });
  it("blocks hostnames that resolve to loopback (localhost)", async () => {
    await expect(safeGet("http://localhost:8080/ok", { allowedPorts: [8080] })).rejects.toBeInstanceOf(BlockedAddressError);
  });
  it("blocks cloud metadata address", async () => {
    await expect(safeGet("http://169.254.169.254/latest/meta-data")).rejects.toBeInstanceOf(BlockedAddressError);
  });
  it("blocks non-http protocols", async () => {
    await expect(safeGet("file:///etc/passwd")).rejects.toBeInstanceOf(BlockedAddressError);
    await expect(safeGet("ftp://example.com/x")).rejects.toBeInstanceOf(BlockedAddressError);
  });
  it("blocks unusual ports", async () => {
    await expect(safeGet("http://8.8.8.8:22/")).rejects.toBeInstanceOf(BlockedAddressError);
    await expect(safeGet("http://8.8.8.8:6379/")).rejects.toBeInstanceOf(BlockedAddressError);
  });
  it("reads a normal page (private allowed for tests only)", async () => {
    const r = await safeGet(`${base}/ok`, { allowPrivate: true });
    expect(r.status).toBe(200);
    expect(r.body).toContain("hello");
  });
  it("follows redirects", async () => {
    const r = await safeGet(`${base}/r1`, { allowPrivate: true });
    expect(r.finalUrl.endsWith("/ok")).toBe(true);
  });
  it("every hop is validated: redirect targets pointing at private/metadata/odd ports are rejected", () => {
    for (const target of ["http://169.254.169.254/latest", "http://127.0.0.1/admin", "http://[::1]/", "http://10.0.0.5/", "http://8.8.8.8:6379/", "file:///etc/passwd"]) {
      expect(() => assertTargetAllowed(new URL(target)), target).toThrow(BlockedAddressError);
    }
    expect(() => assertTargetAllowed(new URL("https://example.com/path"))).not.toThrow();
  });
  it("caps redirects", async () => {
    await expect(safeGet(`${base}/loop`, { allowPrivate: true, maxRedirects: 3 })).rejects.toThrow(/redirect/);
  });
  it("caps response size", async () => {
    const r = await safeGet(`${base}/big`, { allowPrivate: true, maxBytes: 1000 });
    expect(r.body.length).toBeLessThanOrEqual(1000);
  });
  it("enforces the deadline", async () => {
    await expect(safeGet(`${base}/slow`, { allowPrivate: true, timeoutMs: 300 })).rejects.toThrow();
  });
  it("reports DNS failure distinctly", async () => {
    await expect(safeGet("http://this-domain-does-not-exist-prospector.invalid/")).rejects.toBeInstanceOf(DnsFailureError);
  });
});
