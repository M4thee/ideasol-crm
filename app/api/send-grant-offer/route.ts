import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const runtime = "nodejs";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatMoney(value: unknown) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
  }).format(Number(value || 0));
}

function formatNumber(value: unknown, maximumFractionDigits = 0) {
  return Number(value || 0).toLocaleString("pl-PL", { maximumFractionDigits });
}

function getScopeLabel(scope: unknown) {
  if (scope === "heat_pump") return "Pompa ciepła";
  if (scope === "pv_heat_pump") return "Fotowoltaika + pompa ciepła";
  return "Fotowoltaika";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const clientEmail = String(body.clientEmail || "").trim();

    if (!clientEmail || !clientEmail.includes("@")) {
      return NextResponse.json(
        { error: "Nieprawidłowy adres e-mail klienta" },
        { status: 400 },
      );
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT || 587);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
    const mailFrom = process.env.MAIL_FROM || process.env.SMTP_FROM || smtpUser;

    if (!smtpHost || !smtpUser || !smtpPass || !mailFrom) {
      return NextResponse.json({ error: "Brak konfiguracji SMTP" }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      requireTLS: smtpPort === 587,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const programName = String(body.programName || "Grant OZE — Radzionków");
    const scopeLabel = getScopeLabel(body.scope);
    const clientName = String(body.clientName || "").trim();
    const advisorName = String(body.advisor?.name || "IdeaSol").trim();
    const advisorPhone = String(body.advisor?.phone || "").trim();
    const advisorEmail = String(body.advisor?.email || "").trim();
    const replyTo = advisorEmail || process.env.OFFER_REPLY_TO || "kontakt@ideasol.pl";
    const includesPv = body.scope !== "heat_pump";
    const includesHeatPump = body.scope !== "pv";
    const vatRate = Number(body.vatRate || 8);

    const pvRows = includesPv
      ? `
        <tr><td style="padding:13px 16px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#5300EB;">Moc instalacji PV</td><td style="padding:13px 16px;border-bottom:1px solid #e2e8f0;">${escapeHtml(formatNumber(body.pvPowerKw, 3))} kWp</td></tr>
        <tr><td style="padding:13px 16px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#5300EB;">Panele</td><td style="padding:13px 16px;border-bottom:1px solid #e2e8f0;">${escapeHtml(body.panelCount)} × ${escapeHtml(body.panelName)}${body.panelPowerWp ? ` (${escapeHtml(body.panelPowerWp)} Wp)` : ""}</td></tr>
        <tr><td style="padding:13px 16px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#5300EB;">Falownik hybrydowy</td><td style="padding:13px 16px;border-bottom:1px solid #e2e8f0;">${escapeHtml(body.inverter)}</td></tr>
        <tr><td style="padding:13px 16px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#5300EB;">Orientacja</td><td style="padding:13px 16px;border-bottom:1px solid #e2e8f0;">${escapeHtml(body.orientation)}</td></tr>
        <tr><td style="padding:13px 16px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#5300EB;">Prognozowana produkcja</td><td style="padding:13px 16px;border-bottom:1px solid #e2e8f0;">${escapeHtml(formatNumber(body.forecastAnnualProduction))} kWh/rok</td></tr>`
      : "";

    const heatPumpRow = includesHeatPump
      ? `<tr><td style="padding:13px 16px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#5300EB;">Pompa ciepła</td><td style="padding:13px 16px;border-bottom:1px solid #e2e8f0;">${escapeHtml(body.heatPump)}</td></tr>`
      : "";

    const greeting = clientName ? `Dzień dobry ${escapeHtml(clientName)},` : "Dzień dobry,";
    const subject = `Oferta — ${programName}`;
    const html = `<!doctype html>
<html lang="pl"><body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
  <div style="max-width:720px;margin:0 auto;padding:28px 14px;">
    <div style="overflow:hidden;border:1px solid #e2e8f0;border-radius:24px;background:#ffffff;box-shadow:0 12px 32px rgba(15,23,42,.08);">
      <div style="height:7px;background:linear-gradient(90deg,#5300EB,#00C0EB);"></div>
      <div style="padding:28px 28px 12px;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#5300EB;">${escapeHtml(programName)}</p>
        <h1 style="margin:0;font-size:28px;line-height:1.2;">Wstępna oferta instalacji OZE</h1>
        <p style="margin:18px 0 0;line-height:1.65;color:#475569;">${greeting}<br>przesyłamy przygotowaną wycenę wariantu <strong>${escapeHtml(scopeLabel)}</strong>.</p>
      </div>
      <div style="padding:16px 28px;">
        <table role="presentation" style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;font-size:14px;">
          <tr><td style="padding:13px 16px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#5300EB;">Zakres oferty</td><td style="padding:13px 16px;border-bottom:1px solid #e2e8f0;">${escapeHtml(scopeLabel)}</td></tr>
          ${pvRows}
          ${heatPumpRow}
        </table>
      </div>
      <div style="padding:8px 28px 4px;">
        <div style="display:inline-block;width:47%;min-width:230px;margin:0 2% 12px 0;padding:17px;box-sizing:border-box;border-radius:16px;background:#f4f0ff;"><div style="font-size:12px;color:#64748b;">Cena netto</div><div style="margin-top:5px;font-size:21px;font-weight:800;color:#5300EB;">${escapeHtml(formatMoney(body.finalNet))}</div></div>
        <div style="display:inline-block;width:47%;min-width:230px;margin:0 0 12px;padding:17px;box-sizing:border-box;border-radius:16px;background:#e6faff;"><div style="font-size:12px;color:#64748b;">Cena brutto (${escapeHtml(vatRate)}% VAT)</div><div style="margin-top:5px;font-size:21px;font-weight:800;color:#00677d;">${escapeHtml(formatMoney(body.finalGross))}</div></div>
        <div style="display:inline-block;width:47%;min-width:230px;margin:0 2% 12px 0;padding:17px;box-sizing:border-box;border-radius:16px;background:#e6faff;"><div style="font-size:12px;color:#64748b;">Szacowana wartość grantu</div><div style="margin-top:5px;font-size:21px;font-weight:800;color:#00677d;">${escapeHtml(formatMoney(body.grantAmount))}</div></div>
        <div style="display:inline-block;width:47%;min-width:230px;margin:0 0 12px;padding:17px;box-sizing:border-box;border-radius:16px;background:#fff7ed;"><div style="font-size:12px;color:#9a3412;">Wkład własny</div><div style="margin-top:5px;font-size:21px;font-weight:800;color:#c2410c;">${escapeHtml(formatMoney(body.ownContribution))}</div></div>
      </div>
      <div style="padding:8px 28px 28px;">
        <p style="margin:0;padding:14px 16px;border-radius:14px;background:#f8fafc;font-size:12px;line-height:1.55;color:#64748b;">Oferta ma charakter wstępny. Ostateczna moc instalacji oraz wysokość kosztów kwalifikowanych wymagają potwierdzenia w audycie energetycznym lub OZC i dokumentacji programu.</p>
        <p style="margin:22px 0 0;line-height:1.6;">Pozdrawiamy,<br><strong>${escapeHtml(advisorName)}</strong>${advisorPhone ? `<br>${escapeHtml(advisorPhone)}` : ""}${advisorEmail ? `<br>${escapeHtml(advisorEmail)}` : ""}</p>
      </div>
    </div>
  </div>
</body></html>`;

    const text = [
      clientName ? `Dzień dobry ${clientName},` : "Dzień dobry,",
      "",
      `${programName} — ${scopeLabel}`,
      includesPv ? `Instalacja PV: ${formatNumber(body.pvPowerKw, 3)} kWp` : null,
      includesPv ? `Panele: ${body.panelCount} × ${body.panelName}` : null,
      includesPv ? `Falownik: ${body.inverter}` : null,
      includesPv ? `Prognozowana produkcja: ${formatNumber(body.forecastAnnualProduction)} kWh/rok` : null,
      includesHeatPump ? `Pompa ciepła: ${body.heatPump}` : null,
      "",
      `Cena netto: ${formatMoney(body.finalNet)}`,
      `Cena brutto: ${formatMoney(body.finalGross)}`,
      `Szacowana wartość grantu: ${formatMoney(body.grantAmount)}`,
      `Wkład własny: ${formatMoney(body.ownContribution)}`,
      "",
      "Oferta ma charakter wstępny i wymaga potwierdzenia w audycie energetycznym lub OZC.",
      "",
      `Pozdrawiamy, ${advisorName}`,
      advisorPhone || null,
      advisorEmail || null,
    ].filter((line) => line !== null).join("\n");

    await transporter.sendMail({
      from: mailFrom,
      to: clientEmail,
      replyTo,
      subject,
      text,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Błąd wysyłki oferty grantowej", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nie udało się wysłać oferty" },
      { status: 500 },
    );
  }
}
