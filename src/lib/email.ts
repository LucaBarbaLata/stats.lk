import nodemailer, { type Transporter } from "nodemailer";
import { env } from "./env";

export type Email = {
  to: string;
  subject: string;
  text: string;
  // For emails people subscribe to: mail apps show an "Unsubscribe" button
  // that POSTs to this address (RFC 8058)
  unsubscribeUrl?: string;
};

// Without SMTP settings, outside production, emails aren't sent: they're
// printed in the dev server's terminal and kept here, for tests.
export const outbox: Email[] = [];

let transport: Transporter | null = null;

function smtpTransport(): Transporter | null {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  const port = Number(process.env.SMTP_PORT || 587);
  transport ??= nodemailer.createTransport({
    host,
    port,
    // 465 speaks TLS from the start; 587 upgrades with STARTTLS
    secure: port === 465,
    requireTLS: port !== 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: env("SMTP_PASSWORD") } : undefined,
  });
  return transport;
}

export async function sendEmail(email: Email): Promise<void> {
  const smtp = smtpTransport();
  if (!smtp) {
    if (process.env.NODE_ENV === "production") throw new Error("Can't send email: SMTP_HOST isn't set");
    outbox.push(email);
    if (process.env.NODE_ENV === "development") {
      console.log(`\n--- Email to ${email.to}: ${email.subject}\n${email.text}\n---\n`);
    }
    return;
  }
  await smtp.sendMail({
    from: env("EMAIL_FROM"),
    to: email.to,
    subject: email.subject,
    text: email.text,
    headers: email.unsubscribeUrl
      ? { "List-Unsubscribe": `<${email.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
      : undefined,
  });
}
