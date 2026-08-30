const EMAIL_FONT_STACK = "'Helvetica Neue', Helvetica, Arial, sans-serif";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getEmailAssetOrigin() {
  const configured = process.env.IDEASIGN_PUBLIC_URL || "https://sign.ideasol.pl/sign";
  try {
    return new URL(configured).origin;
  } catch {
    return "https://sign.ideasol.pl";
  }
}

type EmailDetail = {
  label: string;
  value: string;
  mono?: boolean;
};

function renderDetails(details: EmailDetail[]) {
  return details.map((detail, index) => `
    <tr>
      <td style="padding:${index === 0 ? "0" : "14px"} 0 0;color:#64748b;font-family:${EMAIL_FONT_STACK};font-size:12px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;vertical-align:top;width:145px;">${escapeHtml(detail.label)}</td>
      <td style="padding:${index === 0 ? "0" : "14px"} 0 0 18px;color:#0f172a;font-family:${detail.mono ? "'SFMono-Regular', Consolas, 'Liberation Mono', monospace" : EMAIL_FONT_STACK};font-size:${detail.mono ? "12px" : "14px"};font-weight:400;line-height:1.55;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(detail.value)}</td>
    </tr>`).join("");
}

function renderEmailLayout(params: {
  preheader: string;
  eyebrow: string;
  title: string;
  contentHtml: string;
  details?: EmailDetail[];
  noticeHtml: string;
  accentColor: string;
  action?: { label: string; url: string };
}) {
  const assetOrigin = getEmailAssetOrigin();
  const ideaSolLogo = `${assetOrigin}/logo.png`;
  const ideaSignLogo = `${assetOrigin}/images/ideasign-logo.png`;
  const action = params.action
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:30px 0 0;">
        <tr>
          <td bgcolor="#071426" style="border-radius:12px;text-align:center;">
            <a href="${escapeHtml(params.action.url)}" style="display:inline-block;padding:16px 26px;color:#ffffff;font-family:${EMAIL_FONT_STACK};font-size:15px;font-weight:500;line-height:20px;text-decoration:none;">${escapeHtml(params.action.label)}&nbsp;&nbsp;→</a>
          </td>
        </tr>
      </table>`
    : "";
  const details = params.details?.length
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:30px 0 0;padding:20px 22px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;">${renderDetails(params.details)}</table>`
    : "";

  return `<!doctype html>
<html lang="pl">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <title>${escapeHtml(params.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#eef3f8;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(params.preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#eef3f8">
      <tr>
        <td align="center" style="padding:28px 12px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;background:#ffffff;border:1px solid #dce5ef;border-radius:22px;overflow:hidden;box-shadow:0 12px 32px rgba(15,23,42,.08);">
            <tr>
              <td bgcolor="#071426" style="padding:24px 30px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td valign="middle" style="width:118px;">
                      <img src="${ideaSolLogo}" width="104" alt="IdeaSol" style="display:block;width:104px;max-width:104px;height:auto;border:0;">
                    </td>
                    <td width="1" bgcolor="#334155" style="width:1px;font-size:1px;line-height:1px;">&nbsp;</td>
                    <td valign="middle" style="padding-left:22px;">
                      <img src="${ideaSignLogo}" width="126" alt="IdeaSign" style="display:block;width:126px;max-width:126px;height:auto;border:0;">
                    </td>
                    <td align="right" valign="middle" style="color:#9fb0c4;font-family:${EMAIL_FONT_STACK};font-size:11px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;">Bezpieczny podpis</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr><td bgcolor="${params.accentColor}" style="height:5px;font-size:1px;line-height:1px;">&nbsp;</td></tr>
            <tr>
              <td style="padding:40px 42px 36px;">
                <p style="margin:0 0 12px;color:${params.accentColor};font-family:${EMAIL_FONT_STACK};font-size:12px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;">${escapeHtml(params.eyebrow)}</p>
                <h1 style="margin:0;color:#071426;font-family:${EMAIL_FONT_STACK};font-size:30px;font-weight:300;letter-spacing:-.02em;line-height:1.2;">${escapeHtml(params.title)}</h1>
                <div style="margin-top:22px;color:#475569;font-family:${EMAIL_FONT_STACK};font-size:16px;font-weight:300;line-height:1.7;">${params.contentHtml}</div>
                ${action}
                ${details}
                <div style="margin-top:26px;padding:17px 18px;background:#fff8e7;border:1px solid #f5d982;border-radius:12px;color:#7c4a03;font-family:${EMAIL_FONT_STACK};font-size:13px;font-weight:300;line-height:1.65;">${params.noticeHtml}</div>
              </td>
            </tr>
            <tr>
              <td bgcolor="#f8fafc" style="padding:22px 30px;border-top:1px solid #e2e8f0;">
                <p style="margin:0;color:#64748b;font-family:${EMAIL_FONT_STACK};font-size:12px;font-weight:300;line-height:1.6;">IdeaSol Sp. z o.o. · Kielce · <a href="https://www.ideasol.pl" style="color:#0b73d8;text-decoration:none;">www.ideasol.pl</a></p>
                <p style="margin:5px 0 0;color:#94a3b8;font-family:${EMAIL_FONT_STACK};font-size:11px;font-weight:300;line-height:1.55;">Wiadomość wygenerowana automatycznie przez IdeaSign. Nie odpowiadaj na nią kodem SMS ani nie przesyłaj nikomu swojego linku.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function renderIdeaSignInvitationEmail(params: {
  signerName: string;
  contractNumber: string;
  signUrl: string;
}) {
  const signerName = escapeHtml(params.signerName);
  const contractNumber = escapeHtml(params.contractNumber);
  return renderEmailLayout({
    preheader: `Umowa ${params.contractNumber} czeka na bezpieczny podpis w IdeaSign.`,
    eyebrow: "Dokumenty gotowe do podpisu",
    title: `Umowa ${params.contractNumber} czeka na Twój podpis`,
    accentColor: "#0b79e5",
    contentHtml: `<p style="margin:0 0 14px;">Dzień dobry, <strong style="color:#0f172a;font-weight:500;">${signerName}</strong>,</p><p style="margin:0;">IdeaSol przygotowało dla Ciebie umowę <strong style="color:#0f172a;font-weight:500;">${contractNumber}</strong>. Otwórz bezpieczny proces IdeaSign, zapoznaj się z dokumentami i potwierdź je kodem SMS.</p>`,
    action: { label: "Otwórz umowę w IdeaSign", url: params.signUrl },
    details: [
      { label: "Ważność linku", value: "7 dni od wysłania wiadomości" },
      { label: "Weryfikacja", value: "Dwa niezależne kody SMS" },
      { label: "Bezpieczeństwo", value: "Jednorazowy link przypisany wyłącznie do Ciebie" },
    ],
    noticeHtml: `<strong style="color:#5f3700;font-weight:500;">Ważne:</strong> każda osoba podpisująca otrzymuje własny link i własne kody SMS. Nie przekazuj tej wiadomości ani kodów drugiej osobie.`,
  });
}

export function renderIdeaSignCompletedEmail(params: {
  signerName: string;
  contractNumber: string;
  concludedAt: string;
  transactionId: string;
  finalPdfSha256: string;
}) {
  const signerName = escapeHtml(params.signerName);
  const contractNumber = escapeHtml(params.contractNumber);
  return renderEmailLayout({
    preheader: `Umowa ${params.contractNumber} została zawarta. Zabezpieczony PDF znajduje się w załączniku.`,
    eyebrow: "Umowa zawarta drogą elektroniczną",
    title: "Dokumenty są gotowe",
    accentColor: "#0b9b6f",
    contentHtml: `<p style="margin:0 0 14px;">Dzień dobry, <strong style="color:#0f172a;font-weight:500;">${signerName}</strong>,</p><p style="margin:0;">Umowa <strong style="color:#0f172a;font-weight:500;">${contractNumber}</strong> została skutecznie zawarta. W załączeniu znajdziesz jeden scalony PDF z umową, załącznikami i potwierdzeniem zawarcia.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:24px;background:#edfdf7;border:1px solid #a7e8d2;border-radius:14px;"><tr><td style="padding:18px 20px;color:#076148;font-family:${EMAIL_FONT_STACK};font-size:14px;font-weight:500;line-height:1.6;"><span style="display:inline-block;margin-right:10px;font-size:20px;vertical-align:middle;">✓</span> Zabezpieczony dokument PDF został dołączony do tej wiadomości.</td></tr></table>`,
    details: [
      { label: "Numer umowy", value: params.contractNumber },
      { label: "Data zawarcia", value: params.concludedAt },
      { label: "ID transakcji", value: params.transactionId, mono: true },
      { label: "SHA-256 PDF", value: params.finalPdfSha256, mono: true },
    ],
    noticeHtml: `<strong style="color:#5f3700;font-weight:500;">Hasło do PDF nie jest wysyłane e-mailem.</strong> Zostało pokazane po złożeniu podpisu w IdeaSign. Użyj zapisanej lub pobranej wcześniej kopii hasła.`,
  });
}
