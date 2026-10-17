import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";

export type IdeaSignCertificateSigner = {
  signerOrder: number;
  name: string;
  phone: string;
  signedAt: string;
};

export type IdeaSignCertificateParams = {
  heading: string;
  documentTitle: string;
  concludedAt: string;
  offeredAt: string;
  transactionId: string;
  contractNumber: string;
  clientAddress: string;
  contractPlace: string;
  offerorName: string;
  offerorCapacity: string;
  offerorPhone: string | null;
  offerorAuthorizedAt: string | null;
  manifestSha256: string;
  documentSha256?: string;
  signers: IdeaSignCertificateSigner[];
};

export type IdeaSignVisualSignatureDocument = {
  kind: string;
  title: string;
  fileName: string;
};

export type IdeaSignAttachmentFivePersonalization = {
  contractNumber: string;
  contractDate: string;
  clientName: string;
  secondClientName?: string;
  contractAddress: string;
  installationAddress: string;
};

type CertificateAssets = {
  font: PDFFont;
  logo: PDFImage;
};

type AuthorizationCard = {
  label: string;
  name: string;
  role: string;
  authorizedAt: string;
  phone: string;
  smsVerified: boolean;
};

const NAVY = rgb(0.015, 0.07, 0.16);
const BLUE = rgb(0.015, 0.37, 0.78);
const LIGHT_BLUE = rgb(0.94, 0.97, 1);
const MID_BLUE = rgb(0.75, 0.86, 0.98);
const MUTED = rgb(0.31, 0.39, 0.5);
const WHITE = rgb(1, 1, 1);

export async function loadIdeaSignCertificateAssets(
  pdf: PDFDocument
): Promise<CertificateAssets> {
  pdf.registerFontkit(fontkit);
  const [fontBytes, logoBytes] = await Promise.all([
    readFile(path.join(process.cwd(), "public", "fonts", "NotoSans-Regular.ttf")),
    readFile(path.join(process.cwd(), "public", "images", "ideasign-logo.png")),
  ]);

  return {
    // Pełny font usuwa błąd częściowego osadzania znaków widoczny po szyfrowaniu PDF.
    font: await pdf.embedFont(fontBytes, { subset: false }),
    logo: await pdf.embedPng(logoBytes),
  };
}

function maskPhone(value: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("48") ? digits.slice(2) : digits;
  if (local.length !== 9) return "numer zapisany w śladzie audytowym";
  return `+48 ••• ••• ${local.slice(-3)}`;
}

function formatWarsawParts(value: string) {
  const date = new Date(value);
  return {
    date: new Intl.DateTimeFormat("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Europe/Warsaw",
    }).format(date),
    time: new Intl.DateTimeFormat("pl-PL", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "Europe/Warsaw",
    }).format(date),
  };
}

function fitText(font: PDFFont, value: string, maxWidth: number, size: number) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (font.widthOfTextAtSize(normalized, size) <= maxWidth) return normalized;
  let result = normalized;
  while (result.length > 1 && font.widthOfTextAtSize(`${result}…`, size) > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result.trimEnd()}…`;
}

function normalizePdfLabel(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isPme2AttachmentFive(document: IdeaSignVisualSignatureDocument) {
  const label = normalizePdfLabel(`${document.title} ${document.fileName}`);
  return label.includes("zalacznik nr 5") && label.includes("pme2");
}

function formatPolishDocumentDate(value: string) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00+02:00`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Warsaw",
  }).format(date);
}

function drawPersonalizedValue(
  page: PDFPage,
  font: PDFFont,
  value: string,
  box: { x: number; y: number; width: number; height?: number; size?: number }
) {
  const size = box.size || 8.2;
  page.drawRectangle({
    x: box.x,
    y: box.y - 2,
    width: box.width,
    height: box.height || 14,
    color: WHITE,
  });
  page.drawText(fitText(font, value || "—", box.width - 2, size), {
    x: box.x + 1,
    y: box.y + 1,
    size,
    font,
    color: NAVY,
  });
}

function drawPersonalizedTwoLineValue(
  page: PDFPage,
  font: PDFFont,
  value: string,
  first: { x: number; y: number; width: number },
  second: { x: number; y: number; width: number },
  size: number
) {
  const words = value.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  const firstLine: string[] = [];
  while (words.length) {
    const candidate = [...firstLine, words[0]].join(" ");
    if (firstLine.length && font.widthOfTextAtSize(candidate, size) > first.width - 2) break;
    firstLine.push(words.shift()!);
  }
  const remaining = words.join(" ");
  drawPersonalizedValue(page, font, firstLine.join(" ") || "—", {
    ...first,
    size,
  });
  page.drawRectangle({
    x: second.x,
    y: second.y - 2,
    width: second.width,
    height: 14,
    color: WHITE,
  });
  if (remaining) {
    page.drawText(fitText(font, remaining, second.width - 2, size), {
      x: second.x + 1,
      y: second.y + 1,
      size,
      font,
      color: NAVY,
    });
  }
}

export async function personalizeIdeaSignAttachmentFive(
  bytes: Buffer,
  document: IdeaSignVisualSignatureDocument,
  values: IdeaSignAttachmentFivePersonalization
) {
  if (!isPme2AttachmentFive(document)) return bytes;
  const pdf = await PDFDocument.load(bytes);
  pdf.registerFontkit(fontkit);
  const fontBytes = await readFile(
    path.join(process.cwd(), "public", "fonts", "NotoSans-Regular.ttf")
  );
  const font = await pdf.embedFont(fontBytes, { subset: false });
  const page = pdf.getPages()[0];
  if (!page) return bytes;

  drawPersonalizedValue(page, font, values.contractNumber, {
    x: 112,
    y: 721,
    width: 146,
  });
  drawPersonalizedValue(page, font, formatPolishDocumentDate(values.contractDate), {
    x: 366,
    y: 721,
    width: 80,
  });
  drawPersonalizedValue(page, font, values.clientName, {
    x: 151,
    y: 700,
    width: 292,
  });
  drawPersonalizedValue(page, font, values.secondClientName || "nie dotyczy", {
    x: 213,
    y: 680,
    width: 231,
  });
  drawPersonalizedTwoLineValue(
    page,
    font,
    values.contractAddress,
    { x: 203, y: 659, width: 241 },
    { x: 42, y: 646, width: 402 },
    7.7
  );
  drawPersonalizedValue(page, font, values.installationAddress, {
    x: 112,
    y: 626,
    width: 335,
    size: 7.7,
  });

  return Buffer.from(await pdf.save());
}

function drawCheckSeal(page: PDFPage, x: number, y: number, verified: boolean) {
  const color = verified ? BLUE : MUTED;
  page.drawCircle({ x, y, size: 22, borderColor: color, borderWidth: 2 });
  if (verified) {
    page.drawLine({
      start: { x: x - 10, y: y },
      end: { x: x - 2, y: y - 8 },
      color,
      thickness: 3,
    });
    page.drawLine({
      start: { x: x - 2, y: y - 8 },
      end: { x: x + 12, y: y + 10 },
      color,
      thickness: 3,
    });
  }
}

function drawMiniAuthorizationStamp(
  page: PDFPage,
  assets: CertificateAssets,
  record: AuthorizationCard,
  box: { x: number; y: number; width: number; height: number }
) {
  const { font, logo } = assets;
  const compact = box.height < 38;
  const time = formatWarsawParts(record.authorizedAt);
  page.drawRectangle({
    ...box,
    color: WHITE,
    opacity: 0.97,
    borderColor: MID_BLUE,
    borderWidth: 0.55,
  });
  const logoSize = Math.max(18, Math.min(box.height - 4, box.width * 0.24));
  page.drawImage(logo, {
    x: box.x + 3,
    y: box.y + (box.height - logoSize) / 2,
    width: logoSize,
    height: logoSize,
  });
  const separatorX = box.x + logoSize + 8;
  page.drawLine({
    start: { x: separatorX, y: box.y + 3 },
    end: { x: separatorX, y: box.y + box.height - 3 },
    color: BLUE,
    thickness: 0.8,
  });
  const textX = separatorX + 6;
  const textWidth = box.x + box.width - textX - 4;

  page.drawText(fitText(font, "Autoryzowano elektronicznie", textWidth, compact ? 4.4 : 5.2), {
    x: textX,
    y: box.y + box.height - (compact ? 7 : 8),
    size: compact ? 4.4 : 5.2,
    font,
    color: BLUE,
  });
  if (!compact) {
    page.drawText("w systemie IdeaSign", {
      x: textX,
      y: box.y + box.height - 16,
      size: 4.5,
      font,
      color: BLUE,
    });
  }
  page.drawText(fitText(font, `${time.date} | ${time.time}`, textWidth, compact ? 4.2 : 4.8), {
    x: textX,
    y: box.y + box.height - (compact ? 14 : 25),
    size: compact ? 4.2 : 4.8,
    font,
    color: BLUE,
  });
  page.drawText(fitText(font, `przez ${record.name}`, textWidth, compact ? 5.3 : 6.5), {
    x: textX,
    y: box.y + box.height - (compact ? 22 : 36),
    size: compact ? 5.3 : 6.5,
    font,
    color: BLUE,
  });
  page.drawText(fitText(font, `kodem SMS na ${maskPhone(record.phone)}`, textWidth, compact ? 3.8 : 4.4), {
    x: textX,
    y: box.y + (compact ? 3 : 5),
    size: compact ? 3.8 : 4.4,
    font,
    color: BLUE,
  });
}

function drawPlaceAndDate(
  page: PDFPage,
  font: PDFFont,
  place: string,
  authorizedAt: string,
  box: { x: number; y: number; width: number; size?: number }
) {
  const normalizedPlace = place.trim().replace(/\s+/g, " ");
  if (!normalizedPlace || !authorizedAt) return;
  const { date } = formatWarsawParts(authorizedAt);
  const size = box.size || 6.4;
  page.drawText(fitText(font, `${normalizedPlace}, ${date}`, box.width, size), {
    x: box.x,
    y: box.y,
    size,
    font,
    color: NAVY,
  });
}

function clientCard(
  signer: IdeaSignCertificateSigner,
  role = `Klient ${signer.signerOrder}`
): AuthorizationCard {
  return {
    label: `KLIENT ${signer.signerOrder} — AUTORYZOWANO ELEKTRONICZNIE`,
    name: signer.name,
    role,
    authorizedAt: signer.signedAt,
    phone: signer.phone,
    smsVerified: true,
  };
}

export function applyIdeaSignVisualSignatures(
  pdf: PDFDocument,
  assets: CertificateAssets,
  document: IdeaSignVisualSignatureDocument,
  params: IdeaSignCertificateParams
) {
  const pages = pdf.getPages();
  const signer1 = params.signers[0];
  const signer2 = params.signers[1];
  const offeror: AuthorizationCard | null = params.offerorAuthorizedAt && params.offerorPhone
    ? {
        label: "OFERTA IDEASOL — AUTORYZOWANO ELEKTRONICZNIE",
        name: params.offerorName,
        role: params.offerorCapacity,
        authorizedAt: params.offerorAuthorizedAt,
        phone: params.offerorPhone,
        smsVerified: true,
      }
    : null;
  const fileName = document.fileName.toLowerCase();
  const title = document.title.toLowerCase();

  const stamp = (
    pageIndex: number,
    record: AuthorizationCard | null,
    box: { x: number; y: number; width: number; height: number }
  ) => {
    if (!record || !pages[pageIndex]) return;
    drawMiniAuthorizationStamp(pages[pageIndex], assets, record, box);
  };
  const placeAndDate = (
    pageIndex: number,
    authorizedAt: string | null | undefined,
    box: { x: number; y: number; width: number; size?: number }
  ) => {
    if (!authorizedAt || !pages[pageIndex]) return;
    drawPlaceAndDate(pages[pageIndex], assets.font, params.contractPlace, authorizedAt, box);
  };

  if (document.kind === "agreement") {
    stamp(6, offeror, { x: 37, y: 672, width: 191, height: 52 });
    stamp(6, signer1 ? clientCard(signer1) : null, { x: 312, y: 672, width: 247, height: 52 });
    stamp(6, signer2 ? clientCard(signer2) : null, { x: 312, y: 605, width: 247, height: 52 });
    return;
  }

  if (document.kind === "withdrawal_form") {
    // Górna część to pusty wzór odstąpienia i celowo pozostaje bez podpisów.
    // Pieczęcie trafiają wyłącznie pod żądanie rozpoczęcia odpłatnych usług.
    placeAndDate(1, params.concludedAt, { x: 64, y: 425, width: 142 });
    stamp(1, signer1 ? clientCard(signer1) : null, { x: 176, y: 423, width: 162, height: 36 });
    stamp(1, signer2 ? clientCard(signer2) : null, { x: 416, y: 423, width: 143, height: 36 });
    return;
  }

  if (title.includes("warunki gwarancji")) {
    placeAndDate(1, params.concludedAt, { x: 64, y: 474, width: 142 });
    stamp(1, signer1 ? clientCard(signer1) : null, { x: 176, y: 462, width: 162, height: 42 });
    stamp(1, signer2 ? clientCard(signer2) : null, { x: 416, y: 462, width: 143, height: 42 });
    return;
  }

  if (document.kind === "consumer_information") {
    placeAndDate(0, signer1?.signedAt, { x: 64, y: 383, width: 190 });
    placeAndDate(0, signer2?.signedAt, { x: 64, y: 196, width: 190 });
    stamp(0, signer1 ? clientCard(signer1) : null, { x: 334, y: 347, width: 205, height: 29 });
    stamp(0, signer2 ? clientCard(signer2) : null, { x: 334, y: 160, width: 205, height: 29 });
    return;
  }

  if (
    title.includes("ankieta techniczna") ||
    fileName.includes("zalacznik-4-ankieta-techniczna")
  ) {
    const pageIndex = pages.length - 1;
    placeAndDate(pageIndex, params.concludedAt, { x: 42, y: 121, width: 300, size: 6.8 });
    stamp(pageIndex, offeror, { x: 42, y: 58, width: 160, height: 46 });
    stamp(pageIndex, signer1 ? clientCard(signer1) : null, { x: 217, y: 58, width: 160, height: 46 });
    stamp(pageIndex, signer2 ? clientCard(signer2) : null, { x: 392, y: 58, width: 160, height: 46 });
    return;
  }

  if (isPme2AttachmentFive(document)) {
    const pageIndex = pages.length - 1;
    pages[pageIndex].drawRectangle({
      x: 39,
      y: 136,
      width: 411,
      height: 51,
      color: WHITE,
    });
    placeAndDate(pageIndex, params.concludedAt, { x: 132, y: 190, width: 305, size: 6.8 });
    stamp(pageIndex, offeror, { x: 42, y: 146, width: 127, height: 36 });
    stamp(pageIndex, signer1 ? clientCard(signer1) : null, { x: 181, y: 146, width: 127, height: 36 });
    stamp(pageIndex, signer2 ? clientCard(signer2) : null, { x: 319, y: 146, width: 127, height: 36 });
    return;
  }

  if (fileName.includes("pelnomocnictwo-zm")) {
    stamp(0, signer1 ? clientCard(signer1, "Prosument 1") : null, { x: 70, y: 195, width: 192, height: 48 });
    stamp(0, signer2 ? clientCard(signer2, "Prosument 2") : null, { x: 315, y: 195, width: 207, height: 48 });
    return;
  }

  if (fileName === "ppoz.pdf") {
    placeAndDate(0, params.concludedAt, { x: 350, y: 733, width: 190, size: 6.8 });
    stamp(0, signer1 ? clientCard(signer1, "Prosument 1") : null, { x: 36, y: 164, width: 205, height: 36 });
    stamp(0, signer2 ? clientCard(signer2, "Prosument 2") : null, { x: 333, y: 164, width: 223, height: 36 });
    if (signer2) {
      placeAndDate(1, params.concludedAt, { x: 352, y: 768, width: 180, size: 6.8 });
      stamp(1, clientCard(signer1, "Wnioskodawca 1"), { x: 320, y: 180, width: 108, height: 34 });
      stamp(1, clientCard(signer2, "Wnioskodawca 2"), { x: 432, y: 180, width: 108, height: 34 });
    } else {
      placeAndDate(1, params.concludedAt, { x: 352, y: 768, width: 180, size: 6.8 });
      stamp(1, signer1 ? clientCard(signer1, "Wnioskodawca") : null, { x: 320, y: 180, width: 220, height: 42 });
    }
  }
}

function drawAuthorizationCard(
  page: PDFPage,
  font: PDFFont,
  card: AuthorizationCard,
  top: number
) {
  const x = 52;
  const width = 491;
  const height = 118;
  const bottom = top - height;
  const time = formatWarsawParts(card.authorizedAt);

  page.drawRectangle({
    x,
    y: bottom,
    width,
    height,
    color: card.smsVerified ? LIGHT_BLUE : rgb(0.965, 0.97, 0.98),
    borderColor: card.smsVerified ? MID_BLUE : rgb(0.82, 0.84, 0.88),
    borderWidth: 1,
  });
  page.drawRectangle({
    x,
    y: bottom,
    width: 6,
    height,
    color: card.smsVerified ? BLUE : MUTED,
  });

  page.drawText(card.label, {
    x: x + 22,
    y: top - 24,
    size: 8.5,
    font,
    color: card.smsVerified ? BLUE : MUTED,
  });
  page.drawText(fitText(font, card.name, 325, 15), {
    x: x + 22,
    y: top - 49,
    size: 15,
    font,
    color: NAVY,
  });
  page.drawText(fitText(font, card.role, 325, 8.5), {
    x: x + 22,
    y: top - 67,
    size: 8.5,
    font,
    color: MUTED,
  });
  page.drawText(`Data: ${time.date}    Godzina: ${time.time}`, {
    x: x + 22,
    y: top - 89,
    size: 9,
    font,
    color: NAVY,
  });
  page.drawText(
    card.smsVerified
      ? `Kod SMS wysłany na numer ${maskPhone(card.phone)}`
      : "Proces rozpoczęty przed wdrożeniem autoryzacji handlowca SMS",
    {
      x: x + 22,
      y: top - 105,
      size: 8.2,
      font,
      color: MUTED,
    }
  );

  drawCheckSeal(page, x + width - 46, top - 59, card.smsVerified);
}

export function appendIdeaSignCertificatePage(
  pdf: PDFDocument,
  assets: CertificateAssets,
  params: IdeaSignCertificateParams
) {
  const page = pdf.addPage([595.28, 841.89]);
  const { font, logo } = assets;

  page.drawRectangle({ x: 0, y: 0, width: page.getWidth(), height: page.getHeight(), color: WHITE });
  page.drawRectangle({ x: 0, y: 785, width: page.getWidth(), height: 57, color: NAVY });

  const logoScale = Math.min(72 / logo.width, 72 / logo.height);
  const logoWidth = logo.width * logoScale;
  const logoHeight = logo.height * logoScale;
  page.drawImage(logo, {
    x: 52,
    y: 684,
    width: logoWidth,
    height: logoHeight,
  });

  page.drawText(params.heading, {
    x: 143,
    y: 742,
    size: 17,
    font,
    color: NAVY,
  });
  page.drawText("Potwierdzenia autoryzacji w systemie IdeaSign", {
    x: 143,
    y: 716,
    size: 10.5,
    font,
    color: BLUE,
  });
  page.drawText(fitText(font, params.documentTitle, 400, 8.5), {
    x: 143,
    y: 694,
    size: 8.5,
    font,
    color: MUTED,
  });
  page.drawText(`Umowa: ${fitText(font, params.contractNumber, 175, 8.5)}`, {
    x: 367,
    y: 805,
    size: 8.5,
    font,
    color: WHITE,
  });
  page.drawText(`ID: ${fitText(font, params.transactionId, 175, 8.5)}`, {
    x: 367,
    y: 791,
    size: 8.5,
    font,
    color: WHITE,
  });

  const records: AuthorizationCard[] = [
    {
      label: params.offerorAuthorizedAt
        ? "OFERTA IDEASOL — AUTORYZOWANO ELEKTRONICZNIE"
        : "OFERTA IDEASOL — ZAPIS SYSTEMOWY",
      name: params.offerorName,
      role: params.offerorCapacity,
      authorizedAt: params.offerorAuthorizedAt || params.offeredAt,
      phone: params.offerorPhone || "",
      smsVerified: Boolean(params.offerorAuthorizedAt && params.offerorPhone),
    },
    ...params.signers.map((signer) => clientCard(signer, `Osoba podpisująca ${signer.signerOrder}`)),
  ];

  let top = 650;
  for (const record of records) {
    drawAuthorizationCard(page, font, record, top);
    top -= 132;
  }

  const concluded = formatWarsawParts(params.concludedAt);
  const footerY = 54;
  page.drawLine({
    start: { x: 52, y: footerY + 60 },
    end: { x: 543, y: footerY + 60 },
    color: MID_BLUE,
    thickness: 1,
  });
  page.drawText(
    `Umowa zawarta ${concluded.date} o ${concluded.time} (Europe/Warsaw).`,
    { x: 52, y: footerY + 42, size: 8.5, font, color: NAVY }
  );
  page.drawText(`SHA-256 manifestu: ${params.manifestSha256}`, {
    x: 52,
    y: footerY + 26,
    size: 7,
    font,
    color: MUTED,
  });
  if (params.documentSha256) {
    page.drawText(`SHA-256 dokumentu źródłowego: ${params.documentSha256}`, {
      x: 52,
      y: footerY + 13,
      size: 7,
      font,
      color: MUTED,
    });
  }
  page.drawText(
    "Wizualizacja stanowi część elektronicznego śladu audytowego IdeaSign.",
    { x: 52, y: footerY, size: 7, font, color: MUTED }
  );

  return page;
}
