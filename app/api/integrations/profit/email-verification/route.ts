import { timingSafeEqual } from "node:crypto";
import nodemailer from "nodemailer";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EmailVerificationPayload = {
  email?: unknown;
  firstName?: unknown;
  code?: unknown;
};

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character] || character);
}

function isAuthorized(request: Request) {
  const configuredToken = process.env.PROFIT_API_TOKEN?.trim();
  const authorization = request.headers.get("authorization") || "";
  const suppliedToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!configuredToken || !suppliedToken) return false;

  const configured = Buffer.from(configuredToken);
  const supplied = Buffer.from(suppliedToken);
  return configured.length === supplied.length && timingSafeEqual(configured, supplied);
}

function emailHtml(firstName: string, code: string) {
  const safeFirstName = escapeHtml(firstName);
  return `<!doctype html>
<html lang="pl">
  <body style="margin:0;background:#f4f8f7;font-family:Arial,sans-serif;color:#0b2037">
    <div style="padding:32px 16px">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dfe9e7;border-radius:24px;overflow:hidden">
        <div style="background:#0e6b7b;padding:24px 28px;color:#ffffff">
          <div style="font-size:22px;font-weight:800">IdeaSol <span style="color:#ff8a00">Profit</span></div>
        </div>
        <div style="padding:30px 28px">
          <p style="margin:0 0 18px;font-size:17px;line-height:1.6">Dzień dobry${safeFirstName ? `, ${safeFirstName}` : ""}.</p>
          <p style="margin:0 0 22px;font-size:16px;line-height:1.6;color:#536b6b">Wpisz poniższy kod w panelu IdeaSol Profit, aby potwierdzić swój adres e-mail:</p>
          <div style="margin:0 0 22px;padding:18px;border-radius:16px;background:#eef8f6;text-align:center;font-size:32px;font-weight:800;letter-spacing:8px;color:#0e6b7b">${code}</div>
          <p style="margin:0;font-size:14px;line-height:1.6;color:#718482">Kod jest ważny przez 10 minut. Jeśli nie logujesz się do IdeaSol Profit, zignoruj tę wiadomość.</p>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as EmailVerificationPayload;
  const email = cleanText(payload.email, 320).toLowerCase();
  const firstName = cleanText(payload.firstName, 80);
  const code = cleanText(payload.code, 6);

  if (!/^\S+@\S+\.\S+$/.test(email) || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
  const mailFrom = process.env.MAIL_FROM || process.env.SMTP_FROM || smtpUser;

  if (!smtpHost || !smtpUser || !smtpPass || !mailFrom) {
    return NextResponse.json({ ok: false, error: "Email service unavailable" }, { status: 503 });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      requireTLS: smtpPort === 587,
      auth: { user: smtpUser, pass: smtpPass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });

    await transporter.sendMail({
      from: mailFrom,
      to: email,
      replyTo: process.env.OFFER_REPLY_TO || "kontakt@ideasol.pl",
      subject: "Kod potwierdzający e-mail — IdeaSol Profit",
      text: `Dzień dobry${firstName ? `, ${firstName}` : ""}. Twój kod potwierdzający e-mail w IdeaSol Profit to: ${code}. Kod jest ważny przez 10 minut.`,
      html: emailHtml(firstName, code),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Profit email verification delivery failed", error);
    return NextResponse.json({ ok: false, error: "Email delivery failed" }, { status: 502 });
  }
}
