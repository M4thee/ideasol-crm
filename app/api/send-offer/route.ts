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
    const smtpPort = Number(process.env.SMTP_PORT || 587);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
    const mailFrom = process.env.MAIL_FROM || process.env.SMTP_FROM || smtpUser;
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
      requireTLS: smtpPort === 587,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const offerType = String(body.offerType || "pv_storage");
    const isStorageOnly = offerType === "storage";
    const hasEnergyStorage = String(body.energyStorage || "").toLowerCase() !== "brak";
    const sendMode = body.sendMode === "public" ? "public" : "anonymous";
    const advisorName = String(body.advisor?.name || body.advisorName || "").trim();
    const advisorPhone = String(body.advisor?.phone || body.advisorPhone || "").trim();
    const advisorEmail = String(body.advisor?.email || body.advisorEmail || "").trim();
    const isPublicSend = sendMode === "public";
    const generalReplyTo = process.env.OFFER_REPLY_TO || "kontakt@ideasol.pl";
    const replyTo = isPublicSend && advisorEmail ? advisorEmail : generalReplyTo;
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

    const hasInverter = String(body.inverter || "").toLowerCase() !== "brak";

    const panelName = String(
      body.panelName ||
        body.panel ||
        body.panelModel ||
        body.selectedPanelName ||
        body.moduleName ||
        ""
    ).trim();
    const panelPowerWp = Number(
      body.panelPowerWp || body.panelPower || body.selectedPanelPowerWp || body.modulePowerWp || 0
    );
    const panelCount = Number(body.panelCount || body.panelsCount || body.modulesCount || 0);
    const hasPanelDetails = !isStorageOnly && Boolean(panelName || panelPowerWp || panelCount);
    const inverterTypeLabel = hasEnergyStorage || isStorageOnly ? "Falownik hybrydowy" : "Falownik sieciowy";
    const includeSubsidy = Boolean(
      body.includeSubsidy || body.subsidyAllocation?.requested
    );

    const subsidyTotal = Number(
      body.subsidyTotal ||
        body.subsidyAllocation?.total ||
        body.subsidyAllocation?.storageSubsidy + body.subsidyAllocation?.emsBonus ||
        0
    );

    const hasSubsidy = includeSubsidy && subsidyTotal > 0;

    const offerProductName = isStorageOnly
      ? "magazynu energii"
      : hasEnergyStorage
        ? "instalacji fotowoltaicznej z magazynem energii"
        : "instalacji fotowoltaicznej";

    const offerIntro = `W nawiązaniu do rozmowy telefonicznej przesyłam wstępną wycenę ${offerProductName} wraz z montażem.`;

    const pvTextLine = isStorageOnly
      ? ""
      : `- instalacja PV: ${body.pvPowerKw} kWp\n`;

    const inverterTextLine = hasInverter
      ? `- falownik: ${body.inverter}\n`
      : "";

    const storageTextLine = hasEnergyStorage
      ? `- magazyn energii: ${body.energyStorage}\n`
      : "";

    const panelDetailsParts = [
      panelCount ? `${panelCount} szt.` : "",
      panelName || "",
      panelPowerWp ? `${panelPowerWp} W` : "",
    ].filter(Boolean);

    const panelDetailsText = hasPanelDetails
      ? panelDetailsParts.join(" | ") || "Panele fotowoltaiczne"
      : "";

    const pvTableRows = isStorageOnly
      ? ""
      : `<tr>
                  <td style="border-bottom:1px solid #e5e7eb; padding:16px 18px; color:#047857; font-weight:800; width:42%;">Instalacja fotowoltaiczna</td>
                  <td style="border-bottom:1px solid #e5e7eb; padding:16px 18px; color:#111827;">${body.pvPowerKw} kWp</td>
                </tr>`;

    const panelTableRow = hasPanelDetails
      ? `<tr>
                  <td style="border-bottom:1px solid #e5e7eb; padding:16px 18px; color:#047857; font-weight:800;">Panele fotowoltaiczne</td>
                  <td style="border-bottom:1px solid #e5e7eb; padding:16px 18px; color:#111827;">${panelDetailsText}</td>
                </tr>`
      : "";

    const inverterTableRow = hasInverter
      ? `<tr>
                  <td style="border-bottom:1px solid #e5e7eb; padding:16px 18px; color:#047857; font-weight:800;">${inverterTypeLabel}</td>
                  <td style="border-bottom:1px solid #e5e7eb; padding:16px 18px; color:#111827;">${body.inverter}</td>
                </tr>`
      : "";

    const storageTableRow = hasEnergyStorage
      ? `<tr>
                  <td style="padding:16px 18px; color:#047857; font-weight:800;">Magazyn energii</td>
                  <td style="padding:16px 18px; color:#111827;">${body.energyStorage}</td>
                </tr>`
      : "";

    const publicSignatureText = [
      "Pozdrawiam,",
      advisorName || "Dział handlowy IdeaSol",
      advisorPhone ? `tel. ${advisorPhone}` : "",
      advisorEmail ? advisorEmail : "",
    ]
      .filter((line) => line !== "")
      .join("\n");

    const anonymousSignatureText = `Pozdrawiamy,
Dział handlowy IdeaSol

www.ideasol.pl`;

    const emailSignatureText = isPublicSend ? publicSignatureText : anonymousSignatureText;

    const publicSignatureHtml = `
              <p style="font-size:16px; margin:0 0 8px; line-height:1.6;">
                Pozdrawiam,<br />
                <strong>${advisorName || "Dział handlowy IdeaSol"}</strong>
              </p>
              ${advisorPhone ? `<p style="font-size:14px; margin:0 0 4px; color:#475569;">tel. ${advisorPhone}</p>` : ""}
              ${advisorEmail ? `<p style="font-size:14px; margin:0 0 24px;"><a href="mailto:${advisorEmail}" style="color:#047857; text-decoration:none; font-weight:700;">${advisorEmail}</a></p>` : ""}`;

    const anonymousSignatureHtml = `
              <p style="font-size:16px; margin:0 0 24px; line-height:1.6;">
                Pozdrawiamy,<br />
                <strong>Dział handlowy IdeaSol</strong>
              </p>`;

    const emailSignatureHtml = isPublicSend ? publicSignatureHtml : anonymousSignatureHtml;

    const text = `Dzień dobry,

${offerIntro}

Zakres wyceny:
${pvTextLine}${hasPanelDetails ? `- panele fotowoltaiczne: ${panelDetailsText}\n` : ""}${inverterTextLine}${storageTextLine}
Cena netto: ${formatMoney(body.finalNet)} zł
Cena brutto ${vatRate}%: ${formatMoney(finalGross)} zł
${hasSubsidy ? `Kwota dotacji z programu Przydomowe Magazyny Energii: ${formatMoney(subsidyTotal)} zł\n` : ""}
Oferta obejmuje projekt, sprzęt, wszelkie materiały składające się na instalację, dokumentację zgłoszeniową do Operatora Sieci Dystrybucyjnej oraz Państwowej Straży Pożarnej (jeżeli będzie to wymagane przepisami).

Oferta ma charakter wstępny i wymaga potwierdzenia po analizie warunków montażowych.

${emailSignatureText}`;

    const html = `
      <div style="margin:0; padding:0; background:#f8faf9; font-family: Arial, Helvetica, sans-serif; color:#111827;">
        <div style="max-width:760px; margin:0 auto; padding:28px 14px;">
          <div style="background:#ffffff; border-radius:18px; overflow:hidden; border:1px solid #e5e7eb; box-shadow:0 8px 24px rgba(15,23,42,0.06);">
            <div style="padding:28px 32px 18px; text-align:center; background:#ffffff;">
              <img src="${logoUrl}" alt="IdeaSol" style="max-width:128px; width:128px; height:auto; display:block; margin:0 auto 18px;" />
              <div style="height:1px; background:#d7eadb; line-height:1px; font-size:1px;">&nbsp;</div>
            </div>

            <div style="padding:18px 32px 32px;">
              <p style="font-size:16px; margin:0 0 18px;">Dzień dobry,</p>

              <p style="font-size:17px; margin:0 0 26px; line-height:1.65; color:#111827;">
                ${offerIntro.replace(offerProductName, `<strong style="color:#047857;">${offerProductName}</strong>`)}
              </p>

              <table style="border-collapse:separate; border-spacing:0; width:100%; margin:20px 0 26px; font-size:15px; border:1px solid #e5e7eb; border-radius:14px; overflow:hidden;">
                ${pvTableRows}
                ${panelTableRow}
                ${inverterTableRow}
                ${storageTableRow}
              </table>

              <table role="presentation" style="border-collapse:separate; border-spacing:12px 0; width:calc(100% + 24px); margin:0 -12px 38px;">
                <tr>
                  <td style="width:${hasSubsidy ? "33.333%" : "50%"}; vertical-align:top;">
                    <div style="border:1px solid #bbf7d0; background:#f0fdf4; border-radius:16px; padding:18px; min-height:92px;">
                      <p style="margin:0 0 10px; font-size:13px; color:#047857; font-weight:800;">Cena netto</p>
                      <p style="margin:0; font-size:26px; line-height:1.1; font-weight:900; color:#047857;">${formatMoney(body.finalNet)} zł</p>
                    </div>
                  </td>
                  <td style="width:${hasSubsidy ? "33.333%" : "50%"}; vertical-align:top;">
                    <div style="border:1px solid #fed7aa; background:#fff7ed; border-radius:16px; padding:18px; min-height:92px;">
                      <p style="margin:0 0 10px; font-size:13px; color:#c2410c; font-weight:800;">Cena brutto ${vatRate}%</p>
                      <p style="margin:0; font-size:26px; line-height:1.1; font-weight:900; color:#ea580c;">${formatMoney(finalGross)} zł</p>
                      <p style="margin:8px 0 0; font-size:11px; line-height:1.35; color:#9a3412; font-weight:600;">Kwota przed dotacją</p>
                    </div>
                  </td>
                  ${hasSubsidy ? `<td style="width:33.333%; vertical-align:top;">
                    <div style="border:1px solid #bfdbfe; background:#eff6ff; border-radius:16px; padding:18px; min-height:92px;">
                      <p style="margin:0 0 12px; font-size:13px; color:#0369a1; font-weight:800;">Kwota dotacji PME</p>
                      <p style="margin:0; font-size:26px; line-height:1.1; font-weight:900; color:#0369a1;">${formatMoney(subsidyTotal)} zł</p>
                      <p style="margin:8px 0 0; font-size:11px; line-height:1.35; color:#075985; font-weight:600;">Koszt po uwzględnieniu dotacji: ${formatMoney(Math.max(0, finalGross - subsidyTotal))} zł</p>
                    </div>
                  </td>` : ""}
                </tr>
              </table>

              <div style="border-left:5px solid #16a34a; background:#f8faf9; border:1px solid #e5e7eb; border-radius:14px; padding:18px 20px; margin:0 0 22px;">
                <p style="margin:0; font-size:15px; color:#111827; line-height:1.65;">
                  Oferta obejmuje projekt, sprzęt, wszelkie materiały składające się na instalację, dokumentację zgłoszeniową do Operatora Sieci Dystrybucyjnej oraz Państwowej Straży Pożarnej (jeżeli będzie to wymagane przepisami).
                </p>
              </div>

              <div style="background:#f8fafc; border:1px solid #e5e7eb; border-radius:12px; padding:14px 16px; margin:0 0 26px;">
                <p style="margin:0; color:#475569; font-size:13px; line-height:1.5;">
                  Oferta ma charakter wstępny i wymaga potwierdzenia po analizie warunków montażowych.
                </p>
              </div>

              ${emailSignatureHtml}

              <div style="height:1px; background:#e5e7eb; line-height:1px; font-size:1px;">&nbsp;</div>

              <p style="text-align:center; margin:18px 0 0; font-size:15px;">
                <a href="https://www.ideasol.pl" style="color:#047857; text-decoration:none; font-weight:800;">www.ideasol.pl</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: mailFrom,
      to: clientEmail,
      replyTo,
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