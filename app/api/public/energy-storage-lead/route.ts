import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

type LeadPayload = {
  source?: string;
  contact?: {
    firstName?: string;
    lastName?: string | null;
    postalCode?: string;
    phone?: string;
    email?: string | null;
    turnstileToken?: string | null;
    honeypot?: string | null;
  };
  answers?: {
    hasPv?: "yes" | "no" | null;
    pvPower?: string | null;
    settlementSystem?: "net_billing" | "net_metering" | "unknown" | null;
    billMode?: "monthly" | "yearly";
    billAmount?: string;
    yearlyBill?: number;
    yearlyConsumptionKwh?: number;
    tariff?: string | null;
    priorities?: string[];
  };
  result?: {
    recommendationType?: "recommended" | "consider" | "not_recommended";
    recommendationTitle?: string;
    recommendedStorageKwh?: number;
    suggestedPvKw?: number | null;
    yearlySavingsLow?: number;
    yearlySavingsHigh?: number;
    priceLow?: number;
    priceHigh?: number;
    subsidyEstimate?: number;
    paybackYearsLow?: number;
    paybackYearsHigh?: number;
  };
};

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://magazyny.ideasol.pl",
  "https://www.ideasol.pl",
  "https://ideasol.pl",
];

function getAllowedOrigins() {
  const configuredOrigins =
    process.env.PUBLIC_LEAD_ALLOWED_ORIGINS?.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [];

  return Array.from(new Set([...DEFAULT_ALLOWED_ORIGINS, ...configuredOrigins]));
}

function getCorsHeaders(request: Request) {
  const origin = request.headers.get("origin");
  const allowedOrigins = getAllowedOrigins();
  const allowedOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatMoney(value: unknown) {
  const numberValue = typeof value === "number" ? value : 0;
  return `${Math.round(numberValue).toLocaleString("pl-PL")} zł`;
}

function formatPaybackYears(low: unknown, high: unknown) {
  const lowValue = typeof low === "number" ? low : null;
  const highValue = typeof high === "number" ? high : null;

  if (lowValue === null && highValue === null) return "Brak danych";
  if (lowValue !== null && highValue !== null && lowValue === highValue) return `około ${lowValue} lat`;
  if (lowValue !== null && highValue !== null) return `${lowValue}-${highValue} lat`;
  return `${lowValue ?? highValue} lat`;
}

function formatHasPv(value: "yes" | "no" | null | undefined) {
  if (value === "yes") return "TAK";
  if (value === "no") return "NIE";
  return "Brak danych";
}

function formatSettlementSystem(value: "net_billing" | "net_metering" | "unknown" | null | undefined) {
  if (value === "net_billing") return "Net-billing";
  if (value === "net_metering") return "Net-metering";
  return "Nie wiem / brak danych";
}

async function verifyTurnstileToken(token: string, request: Request) {
  const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim();

  if (!secretKey) {
    console.warn("energy-storage-lead Turnstile skipped - secret key not configured");
    return true;
  }

  if (!token) return false;

  const formData = new FormData();
  formData.append("secret", secretKey);
  formData.append("response", token);

  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  if (ip) formData.append("remoteip", ip);

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) return false;

  const result = (await response.json()) as { success?: boolean };
  return Boolean(result.success);
}

function buildAnalysisNote(payload: LeadPayload) {
  const contact = payload.contact ?? {};
  const answers = payload.answers ?? {};
  const result = payload.result ?? {};

  return [
    "Źródło: Kalkulator magazynu energii — magazyny.ideasol.pl",
    "",
    "Dane kontaktowe:",
    `Imię: ${cleanText(contact.firstName) || "brak"}`,
    `Nazwisko: ${cleanText(contact.lastName) || "brak"}`,
    `Telefon: ${cleanText(contact.phone) || "brak"}`,
    `E-mail: ${cleanText(contact.email) || "brak"}`,
    `Kod pocztowy: ${cleanText(contact.postalCode) || "brak"}`,
    "",
    "Odpowiedzi z kalkulatora:",
    `Posiada PV: ${formatHasPv(answers.hasPv)}`,
    `Moc PV: ${answers.pvPower ? `${answers.pvPower} kWp` : "brak / nie dotyczy"}`,
    `System rozliczeń: ${formatSettlementSystem(answers.settlementSystem)}`,
    `Rachunek: ${answers.billAmount || "brak"} ${answers.billMode === "yearly" ? "zł rocznie" : "zł miesięcznie"}`,
    `Szacowany roczny koszt energii: ${formatMoney(answers.yearlyBill)}`,
    `Szacowane roczne zużycie: ${Math.round(answers.yearlyConsumptionKwh ?? 0).toLocaleString("pl-PL")} kWh`,
    `Taryfa: ${answers.tariff || "brak"}`,
    `Priorytety: ${answers.priorities?.length ? answers.priorities.join(", ") : "brak"}`,
    "",
    "Wynik kalkulatora:",
    `Rekomendacja: ${result.recommendationTitle || "brak"}`,
    `Typ rekomendacji: ${result.recommendationType || "brak"}`,
    `Sugerowana moc PV: ${result.suggestedPvKw ? `${result.suggestedPvKw} kWp` : "nie dotyczy"}`,
    `Sugerowany magazyn energii: ${result.recommendedStorageKwh ? `${result.recommendedStorageKwh} kWh` : "brak"}`,
    `Szacowana roczna korzyść: ${formatMoney(result.yearlySavingsLow)} - ${formatMoney(result.yearlySavingsHigh)}`,
    `Orientacyjny koszt inwestycji: ${formatMoney(result.priceLow)} - ${formatMoney(result.priceHigh)}`,
    `Możliwa dotacja: do ${formatMoney(result.subsidyEstimate)}`,
    `Szacowany okres zwrotu: ${formatPaybackYears(result.paybackYearsLow, result.paybackYearsHigh)}`,
  ].join("\n");
}

function buildHtmlEmail(payload: LeadPayload) {
  const contact = payload.contact ?? {};
  const result = payload.result ?? {};
  const firstName = cleanText(contact.firstName);
  const greeting = firstName ? `Dzień dobry, ${escapeHtml(firstName)}.` : "Dzień dobry.";

  return `
<!doctype html>
<html lang="pl">
  <body style="margin:0;padding:0;background:#F1F5F9;font-family:Arial,Helvetica,sans-serif;color:#0F172A;">
    <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="background:#F1F5F9;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="max-width:720px;background:#FFFFFF;border-radius:24px;overflow:hidden;border:1px solid #E2E8F0;">
            <tr>
              <td style="padding:28px;background:#0F172A;color:#FFFFFF;">
                <h1 style="margin:0;font-size:28px;line-height:1.2;">Twój wynik z kalkulatora jest gotowy</h1>
                <p style="margin:14px 0 0 0;color:#CBD5E1;font-size:16px;line-height:1.6;">${greeting} Poniżej znajduje się podsumowanie wstępnej analizy magazynu energii.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <div style="border-radius:20px;background:linear-gradient(135deg,#ECFEFF 0%,#F7FEE7 100%);border:1px solid #BAE6FD;padding:22px;">
                  <div style="font-size:12px;font-weight:800;color:#0369A1;text-transform:uppercase;letter-spacing:0.10em;">Rekomendacja</div>
                  <div style="margin-top:10px;font-size:26px;font-weight:900;line-height:1.15;color:#0F172A;">${escapeHtml(result.recommendationTitle || "Wynik kalkulatora")}</div>
                  <div style="margin-top:16px;color:#475569;font-size:14px;line-height:1.6;">
                    <strong>Szacowany okres zwrotu:</strong> ${escapeHtml(formatPaybackYears(result.paybackYearsLow, result.paybackYearsHigh))}
                  </div>
                </div>

                <pre style="margin-top:22px;white-space:pre-wrap;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:16px;padding:18px;font-size:13px;line-height:1.55;color:#0F172A;">${escapeHtml(buildAnalysisNote(payload))}</pre>

                <p style="margin:24px 0 0 0;color:#64748B;font-size:12px;line-height:1.6;text-align:center;">
                  Wynik ma charakter orientacyjny i nie stanowi oferty handlowej.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function createTransporter() {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;

  if (!smtpHost || !smtpUser || !smtpPass) return null;

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    requireTLS: smtpPort === 587,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
}

async function sendLeadResultEmail(payload: LeadPayload) {
  const email = cleanText(payload.contact?.email);
  const transporter = createTransporter();

  if (!email || !transporter) return;

  const smtpFrom = process.env.MAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER;

  await transporter.sendMail({
    from: smtpFrom,
    to: email,
    subject: "Twój wynik z kalkulatora magazynu energii",
    html: buildHtmlEmail(payload),
  });
}

async function sendInternalLeadEmail(payload: LeadPayload) {
  const transporter = createTransporter();

  if (!transporter) return;

  const smtpFrom = process.env.MAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER;

  await transporter.sendMail({
    from: smtpFrom,
    to: process.env.LEAD_NOTIFICATION_EMAIL || smtpFrom,
    subject: "Nowy lead z kalkulatora magazynu energii",
    text: buildAnalysisNote(payload),
  });
}

async function sendTeamsNotification(payload: LeadPayload) {
  const webhookUrl = process.env.TEAMS_WEBHOOK_URL?.trim();

  if (!webhookUrl) {
    console.warn("TEAMS_WEBHOOK_URL is not configured. Skipping Teams notification.");
    return;
  }

  const contact = payload.contact ?? {};
  const answers = payload.answers ?? {};
  const result = payload.result ?? {};
  const name = [cleanText(contact.firstName), cleanText(contact.lastName)].filter(Boolean).join(" ") || cleanText(contact.firstName) || "Brak imienia";

  const message = [
    "🚨 Nowy lead z kalkulatora magazynu energii",
    "",
    `Klient: ${name}`,
    `Telefon: ${cleanText(contact.phone) || "brak"}`,
    `E-mail: ${cleanText(contact.email) || "brak"}`,
    `Kod pocztowy: ${cleanText(contact.postalCode) || "brak"}`,
    `Rekomendacja: ${result.recommendationTitle || "brak"}`,
    `Rachunek: ${answers.billAmount || "brak"} ${answers.billMode === "yearly" ? "zł rocznie" : "zł miesięcznie"}`,
    `PV: ${formatHasPv(answers.hasPv)}${answers.pvPower ? `, ${answers.pvPower} kWp` : ""}`,
    `Magazyn: ${result.recommendedStorageKwh ? `${result.recommendedStorageKwh} kWh` : "brak"}`,
    `Zwrot: ${formatPaybackYears(result.paybackYearsLow, result.paybackYearsHigh)}`,
    "",
    "Źródło: magazyny.ideasol.pl",
  ].join("\n");

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Teams webhook failed: ${response.status} ${text}`);
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as LeadPayload;
    const contact = payload.contact ?? {};
    const firstName = cleanText(contact.firstName);
    const phone = cleanText(contact.phone);
    const postalCode = cleanText(contact.postalCode);
    const turnstileToken = cleanText(contact.turnstileToken);
    const honeypot = cleanText(contact.honeypot);

    if (honeypot) {
      return NextResponse.json({ ok: true, skipped: true }, { headers: getCorsHeaders(request) });
    }

    if (!firstName || phone.replace(/\D/g, "").length < 9 || !/^\d{2}-\d{3}$/.test(postalCode)) {
      return NextResponse.json(
        { error: "Nieprawidłowe dane kontaktowe." },
        { status: 400, headers: getCorsHeaders(request) }
      );
    }

    const isTurnstileValid = await verifyTurnstileToken(turnstileToken, request);

    if (!isTurnstileValid) {
      return NextResponse.json(
        { error: "Nie udało się zweryfikować zabezpieczenia formularza." },
        { status: 403, headers: getCorsHeaders(request) }
      );
    }

    const results = await Promise.allSettled([
      sendInternalLeadEmail(payload),
      sendLeadResultEmail(payload),
      sendTeamsNotification(payload),
    ]);

    results.forEach((result) => {
      if (result.status === "rejected") {
        console.error("energy-storage-lead notification failed", result.reason);
      }
    });

    return NextResponse.json({ ok: true }, { headers: getCorsHeaders(request) });
  } catch (error) {
    console.error("energy-storage-lead error", error);
    return NextResponse.json(
      { error: "Nie udało się zapisać zgłoszenia." },
      { status: 500, headers: getCorsHeaders(request) }
    );
  }
}