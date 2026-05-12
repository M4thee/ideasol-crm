import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("pl-PL");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const clientEmail = String(body.clientEmail || "").trim();

    if (!clientEmail || !clientEmail.includes("@")) {
      return NextResponse.json(
        { error: "Nieprawidłowy adres e-mail klienta" },
        { status: 400 }
      );
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT || 465);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const mailFrom = process.env.MAIL_FROM || smtpUser;
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const logoUrl = `${appUrl}/logo.png`;

    if (!smtpHost || !smtpUser || !smtpPass || !mailFrom) {
      return NextResponse.json(
        { error: "Brak konfiguracji SMTP" },
        { status: 500 }
      );
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const offerType = String(body.offerType || "pv_storage");
    const isStorageOnly = offerType === "storage";
    const hasEnergyStorage = String(body.energyStorage || "").toLowerCase() !== "brak";
    const vatRate = Number(body.vatRate || 8);
    const finalGross = Number(body.finalGross || body.finalGross8 || 0);

    const subject = isStorageOnly
      ? "Oferta magazynu energii"
      : hasEnergyStorage
        ? "Oferta instalacji fotowoltaicznej z magazynem energii"
        : "Oferta instalacji fotowoltaicznej";

    const offerSubtitle = isStorageOnly
      ? "Magazyn energii"
      : hasEnergyStorage
        ? "Fotowoltaika + magazyn energii"
        : "Fotowoltaika";

    const offerIntro = isStorageOnly
      ? "przesyłam wstępną ofertę magazynu energii."
      : hasEnergyStorage
        ? "przesyłam wstępną ofertę instalacji fotowoltaicznej wraz z magazynem energii."
        : "przesyłam wstępną ofertę instalacji fotowoltaicznej.";

    const hasInverter = String(body.inverter || "").toLowerCase() !== "brak";

    const pvTextLine = isStorageOnly
      ? ""
      : `- instalacja PV: ${body.pvPowerKw} kWp\n`;

    const inverterTextLine = hasInverter
      ? `- falownik: ${body.inverter}\n`
      : "";

    const storageTextLine = hasEnergyStorage
      ? `- magazyn energii: ${body.energyStorage}\n`
      : "";

    const pvTableRows = isStorageOnly
      ? ""
      : `<tr>
                  <td style="border: 1px solid #e5e7eb; padding: 12px; font-weight: bold; background: #f9fafb; width:42%;">Instalacja PV</td>
                  <td style="border: 1px solid #e5e7eb; padding: 12px;">${body.pvPowerKw} kWp</td>
                </tr>`;

    const inverterTableRow = hasInverter
      ? `<tr>
                  <td style="border: 1px solid #e5e7eb; padding: 12px; font-weight: bold; background: #f9fafb;">Falownik</td>
                  <td style="border: 1px solid #e5e7eb; padding: 12px;">${body.inverter}</td>
                </tr>`
      : "";

    const storageTableRow = hasEnergyStorage
      ? `<tr>
                  <td style="border: 1px solid #e5e7eb; padding: 12px; font-weight: bold; background: #f9fafb;">Magazyn energii</td>
                  <td style="border: 1px solid #e5e7eb; padding: 12px;">${body.energyStorage}</td>
                </tr>`
      : "";

    const text = `Dzień dobry,

${offerIntro}

Zakres oferty:
${pvTextLine}${inverterTextLine}${storageTextLine}- montaż instalacji
- podstawowe zabezpieczenia
- dokumentacja i przygotowanie do zgłoszenia

Cena netto: ${formatMoney(body.finalNet)} zł
Cena brutto ${vatRate}%: ${formatMoney(finalGross)} zł

Oferta ma charakter wstępny i wymaga potwierdzenia po analizie warunków montażowych.

Pozdrawiam
IdeaSol`;

    const html = `
      <div style="margin:0; padding:0; background:#f3f4f6; font-family: Arial, sans-serif; color:#111827;">
        <div style="max-width:720px; margin:0 auto; padding:24px 12px;">
          <div style="background:#ffffff; border-radius:18px; overflow:hidden; border:1px solid #e5e7eb;">
            <div style="background:#0f172a; padding:28px 28px 22px; text-align:center;">
              <img src="${logoUrl}" alt="IdeaSol" style="max-width:190px; width:190px; height:auto; display:block; margin:0 auto 18px; background:#ffffff; border-radius:14px; padding:12px;" />
              <h1 style="margin:0; color:#ffffff; font-size:26px; line-height:1.25;">${subject}</h1>
              <p style="margin:10px 0 0; color:#cbd5e1; font-size:15px;">${offerSubtitle}</p>
            </div>

            <div style="padding:28px;">
              <p style="font-size:16px; margin:0 0 14px;">Dzień dobry,</p>

              <p style="font-size:16px; margin:0 0 22px; line-height:1.6;">
                ${offerIntro}
              </p>

              <table style="border-collapse: collapse; width: 100%; margin: 20px 0; font-size:15px;">
                ${pvTableRows}
                ${inverterTableRow}
                ${storageTableRow}
              </table>

              <div style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:16px; padding:20px; margin:24px 0;">
                <p style="margin:0 0 6px; font-size:14px; color:#047857; font-weight:bold;">Cena netto</p>
                <p style="margin:0; font-size:24px; font-weight:800; color:#111827;">${formatMoney(body.finalNet)} zł</p>

                <div style="height:1px; background:#a7f3d0; margin:16px 0;"></div>

                <p style="margin:0 0 6px; font-size:14px; color:#047857; font-weight:bold;">Cena brutto ${vatRate}%</p>
                <p style="margin:0; font-size:34px; font-weight:900; color:#047857;">${formatMoney(finalGross)} zł</p>
              </div>

              <div style="border-left:5px solid #f59e0b; background:#fffbeb; padding:14px 16px; margin:22px 0; border-radius:10px;">
                <p style="margin:0; font-size:14px; color:#92400e; line-height:1.5;">
                  Oferta obejmuje montaż instalacji, podstawowe zabezpieczenia, dokumentację oraz przygotowanie instalacji do zgłoszenia.
                </p>
              </div>

              <p style="color:#6b7280; font-size:13px; line-height:1.5; margin:22px 0;">
                Oferta ma charakter wstępny i wymaga potwierdzenia po analizie warunków montażowych.
              </p>

              <p style="font-size:16px; margin:0; line-height:1.6;">
                Pozdrawiamy,<br />
                <strong>IdeaSol</strong>
              </p>
            </div>
          </div>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: mailFrom,
      to: clientEmail,
      subject,
      text,
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Nie udało się wysłać maila" },
      { status: 500 }
    );
  }
}