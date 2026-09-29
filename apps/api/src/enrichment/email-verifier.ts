// E-mail verification: syntax + MX (default) and optional SMTP RCPT probe.
// Approach adapted from leadforge verifier/smtp_verifier.py (MIT) — see THIRD_PARTY_NOTICES.md.
import { promises as dns } from "dns";
import * as net from "net";

export type EmailVerdict = "valid" | "invalid" | "unknown";
export interface EmailVerification {
  email: string;
  syntaxOk: boolean;
  mxOk: boolean | null;
  smtp: EmailVerdict | "skipped";
}

const SYNTAX = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
export type MxResolver = (domain: string) => Promise<Array<{ exchange: string; priority: number }>>;

export async function verifyEmail(
  email: string,
  opts: { resolveMx?: MxResolver; smtp?: boolean; smtpProbe?: (host: string, email: string) => Promise<EmailVerdict> } = {},
): Promise<EmailVerification> {
  const syntaxOk = SYNTAX.test(email);
  if (!syntaxOk) return { email, syntaxOk, mxOk: null, smtp: "skipped" };
  const domain = email.split("@")[1];
  const resolveMx = opts.resolveMx ?? ((d) => dns.resolveMx(d));
  let mx: Array<{ exchange: string; priority: number }> = [];
  try {
    mx = await resolveMx(domain);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOTFOUND" || code === "ENODATA") return { email, syntaxOk, mxOk: false, smtp: "skipped" };
    return { email, syntaxOk, mxOk: null, smtp: "skipped" }; // transient: undetermined
  }
  if (mx.length === 0) return { email, syntaxOk, mxOk: false, smtp: "skipped" };
  if (!opts.smtp) return { email, syntaxOk, mxOk: true, smtp: "skipped" };
  const best = [...mx].sort((a, b) => a.priority - b.priority)[0].exchange;
  const probe = opts.smtpProbe ?? smtpRcptProbe;
  return { email, syntaxOk, mxOk: true, smtp: await probe(best, email) };
}

/** Talks SMTP up to RCPT TO, never sends DATA. Needs outbound port 25. */
export function smtpRcptProbe(host: string, email: string, timeoutMs = 8000): Promise<EmailVerdict> {
  return new Promise((resolve) => {
    const sock = net.connect(25, host);
    const steps = [`HELO prospector.local`, `MAIL FROM:<verify@prospector.local>`, `RCPT TO:<${email}>`, `QUIT`];
    let step = -1;
    let verdict: EmailVerdict = "unknown";
    const done = (v: EmailVerdict) => {
      sock.destroy();
      resolve(v);
    };
    sock.setTimeout(timeoutMs, () => done("unknown"));
    sock.on("error", () => done("unknown"));
    sock.on("data", (buf) => {
      const code = Number(buf.toString().slice(0, 3));
      if (step === 2) verdict = code === 250 || code === 251 ? "valid" : code >= 500 && code < 600 ? "invalid" : "unknown";
      if (step === 2) return done(verdict);
      if (code >= 400) return done("unknown");
      step++;
      sock.write(`${steps[step]}\r\n`);
    });
  });
}
