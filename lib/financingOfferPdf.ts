import fontkit from "@pdf-lib/fontkit";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PDFDocument, type PDFFont, type PDFImage, type PDFPage, rgb } from "pdf-lib";

export type FinancingOfferPdfData = {
  installationPrice: number;
  downPayment: number;
  creditAmount: number;
  totalCreditCost: number;
  totalRepayment: number;
  nominalAnnualRate: number;
  rrso: number;
  bankName: string;
  bankLogoUrl?: string;
  offerName: string;
  termMonths: number;
  installment: number;
};

const DISCLAIMER = "Niniejsza kalkulacja nie jest ofertą. Ostateczna oferta zostanie przedstawiona przez instytucję finansującą po złożeniu wniosku. Możliwość sfinansowania zakupu zależy od indywidualnej decyzji banku po weryfikacji zdolności kredytowej Klienta.";
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 42;

function color(hex: string) {
  const normalized = hex.replace("#", "");
  return rgb(
    parseInt(normalized.slice(0, 2), 16) / 255,
    parseInt(normalized.slice(2, 4), 16) / 255,
    parseInt(normalized.slice(4, 6), 16) / 255
  );
}

function formatMoney(value: number) {
  return `${value.toLocaleString("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).replace(/\u00A0|\u202F/g, " ")} zł`;
}

function formatPercent(value: number) {
  return `${value.toLocaleString("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function cleanText(value: string, maxLength = 140) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = cleanText(text, 1200).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (!currentLine || font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines;
}

function drawWrappedText(
  page: PDFPage,
  text: string,
  options: {
    x: number;
    y: number;
    maxWidth: number;
    size: number;
    lineHeight: number;
    font: PDFFont;
    textColor: ReturnType<typeof rgb>;
  }
) {
  const lines = wrapText(text, options.font, options.size, options.maxWidth);
  lines.forEach((line, index) => {
    page.drawText(line, {
      x: options.x,
      y: options.y - index * options.lineHeight,
      size: options.size,
      font: options.font,
      color: options.textColor,
    });
  });
  return options.y - lines.length * options.lineHeight;
}

function findFontPath() {
  return [
    path.join(process.cwd(), "public", "fonts", "DejaVuSans.ttf"),
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/Library/Fonts/Arial Unicode.ttf",
  ].find((candidate) => existsSync(candidate));
}

function drawImageContain(
  page: PDFPage,
  image: PDFImage,
  x: number,
  y: number,
  maxWidth: number,
  maxHeight: number
) {
  const dimensions = image.scaleToFit(maxWidth, maxHeight);
  page.drawImage(image, {
    x: x + (maxWidth - dimensions.width) / 2,
    y: y + (maxHeight - dimensions.height) / 2,
    width: dimensions.width,
    height: dimensions.height,
  });
}

async function embedBankLogo(pdf: PDFDocument, source?: string) {
  if (!source) return null;

  try {
    let bytes: Uint8Array;
    let mimeType = "";
    const dataMatch = source.match(/^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/i);

    if (dataMatch) {
      mimeType = dataMatch[1].toLowerCase();
      bytes = new Uint8Array(Buffer.from(dataMatch[2], "base64"));
    } else {
      const sourceUrl = new URL(source);
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl || sourceUrl.origin !== new URL(supabaseUrl).origin) return null;
      if (!sourceUrl.pathname.includes("/storage/v1/object/public/credit-bank-logos/")) return null;

      const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) return null;
      mimeType = response.headers.get("content-type")?.split(";")[0].toLowerCase() || "";
      bytes = new Uint8Array(await response.arrayBuffer());
    }

    if (bytes.byteLength === 0 || bytes.byteLength > 2 * 1024 * 1024) return null;
    if (mimeType === "image/png") return pdf.embedPng(bytes);
    if (mimeType === "image/jpeg") return pdf.embedJpg(bytes);
  } catch (error) {
    console.error("Nie udało się osadzić logo banku w PDF", error);
  }

  return null;
}

function addMonths(baseDate: Date, months: number) {
  const day = baseDate.getDate();
  const result = new Date(baseDate.getFullYear(), baseDate.getMonth() + months, 1);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

function formatDate(value: Date) {
  return value.toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function buildSchedule(data: FinancingOfferPdfData) {
  const regularInstallment = Math.round(data.installment * 100) / 100;
  let paid = 0;
  const generatedAt = new Date();

  return Array.from({ length: data.termMonths }, (_, index) => {
    const number = index + 1;
    const amount = number === data.termMonths
      ? Math.round((data.totalRepayment - paid) * 100) / 100
      : regularInstallment;
    paid += amount;

    return {
      number,
      date: formatDate(addMonths(generatedAt, number)),
      amount,
      remaining: Math.max(0, Math.round((data.totalRepayment - paid) * 100) / 100),
    };
  });
}

function drawMetric(
  page: PDFPage,
  font: PDFFont,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string
) {
  page.drawRectangle({
    x,
    y,
    width,
    height: 52,
    color: color("#FFFFFF"),
    borderColor: color("#E2E8F0"),
    borderWidth: 0.7,
  });
  page.drawText(label, {
    x: x + 14,
    y: y + 33,
    size: 7.2,
    font,
    color: color("#64748B"),
  });
  page.drawText(value, {
    x: x + 14,
    y: y + 14,
    size: 11.2,
    font,
    color: color("#0F172A"),
    maxWidth: width - 28,
  });
}

function drawFooter(page: PDFPage, font: PDFFont, pageNumber: number, pageCount: number) {
  page.drawLine({
    start: { x: MARGIN, y: 34 },
    end: { x: PAGE_WIDTH - MARGIN, y: 34 },
    thickness: 0.6,
    color: color("#E2E8F0"),
  });
  page.drawText("Dokument wygenerowany w systemie IdeaSol CRM", {
    x: MARGIN,
    y: 18,
    size: 6.5,
    font,
    color: color("#64748B"),
  });
  page.drawText(`Strona ${pageNumber} z ${pageCount}`, {
    x: PAGE_WIDTH - 92,
    y: 18,
    size: 6.5,
    font,
    color: color("#64748B"),
  });
}

export async function createFinancingOfferPdf(data: FinancingOfferPdfData) {
  const fontPath = findFontPath();
  if (!fontPath) throw new Error("Brak fontu potrzebnego do wygenerowania PDF.");

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(readFileSync(fontPath), { subset: true });
  const bankLogo = await embedBankLogo(pdf, data.bankLogoUrl);
  const ideaSolLogoPath = path.join(process.cwd(), "public", "logo.png");
  const ideaSolLogo = existsSync(ideaSolLogoPath)
    ? await pdf.embedPng(readFileSync(ideaSolLogoPath))
    : null;

  pdf.setTitle("Kalkulacja finansowania IdeaSol Sp. z o.o.");
  pdf.setAuthor("IdeaSol Sp. z o.o.");
  pdf.setSubject("Wstępna kalkulacja finansowania instalacji");
  pdf.setCreator("IdeaSol CRM");
  pdf.setCreationDate(new Date());

  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: color("#FFFFFF") });

  if (ideaSolLogo) {
    drawImageContain(page, ideaSolLogo, MARGIN + 8, 718, 116, 88);
  } else {
    page.drawText("IdeaSol", { x: MARGIN + 18, y: 758, size: 22, font, color: color("#0F172A") });
  }

  page.drawText("Kalkulacja finansowania", {
    x: 218,
    y: 767,
    size: 15,
    font,
    color: color("#0F172A"),
  });
  page.drawText("IdeaSol Sp. z o.o.", {
    x: 218,
    y: 746,
    size: 8.5,
    font,
    color: color("#64748B"),
  });
  page.drawText(`Data: ${formatDate(new Date())}`, {
    x: 458,
    y: 725,
    size: 7.2,
    font,
    color: color("#64748B"),
  });
  page.drawRectangle({ x: MARGIN, y: 702, width: PAGE_WIDTH - MARGIN * 2, height: 5, color: color("#10B981") });

  const overviewWidth = (PAGE_WIDTH - MARGIN * 2 - 12) / 2;
  page.drawRectangle({ x: MARGIN, y: 625, width: 5, height: 58, color: color("#10B981") });
  page.drawText("Bank finansujący", {
    x: bankLogo ? MARGIN + 88 : MARGIN + 18,
    y: 668,
    size: 7.2,
    font,
    color: color("#64748B"),
  });
  if (bankLogo) drawImageContain(page, bankLogo, MARGIN + 12, 635, 64, 38);
  page.drawText(cleanText(data.bankName), {
    x: bankLogo ? MARGIN + 88 : MARGIN + 18,
    y: 644,
    size: 12,
    font,
    color: color("#0F172A"),
    maxWidth: bankLogo ? overviewWidth - 98 : overviewWidth - 28,
  });

  const offerX = MARGIN + overviewWidth + 12;
  page.drawRectangle({ x: offerX, y: 625, width: 5, height: 58, color: color("#10B981") });
  page.drawText("Wybrany wariant finansowania", {
    x: offerX + 18,
    y: 668,
    size: 7.2,
    font,
    color: color("#64748B"),
  });
  drawWrappedText(page, cleanText(data.offerName), {
    x: offerX + 18,
    y: 649,
    maxWidth: overviewWidth - 32,
    size: 9.2,
    lineHeight: 11,
    font,
    textColor: color("#0F172A"),
  });
  page.drawText(`${data.termMonths} równych rat miesięcznych`, {
    x: offerX + 18,
    y: 630,
    size: 7,
    font,
    color: color("#64748B"),
  });

  page.drawText("Podsumowanie finansowania", {
    x: MARGIN,
    y: 592,
    size: 17,
    font,
    color: color("#0F172A"),
  });
  page.drawRectangle({
    x: MARGIN,
    y: 507,
    width: PAGE_WIDTH - MARGIN * 2,
    height: 64,
    color: color("#FFFFFF"),
    borderColor: color("#CBD5E1"),
    borderWidth: 0.7,
  });
  page.drawRectangle({ x: MARGIN, y: 507, width: 5, height: 64, color: color("#10B981") });
  page.drawText("Miesięczna rata", {
    x: MARGIN + 22,
    y: 550,
    size: 7.5,
    font,
    color: color("#475569"),
  });
  page.drawText(formatMoney(data.installment), {
    x: MARGIN + 22,
    y: 524,
    size: 17,
    font,
    color: color("#008A68"),
  });
  page.drawText(`${data.termMonths} rat`, {
    x: 467,
    y: 535,
    size: 9,
    font,
    color: color("#475569"),
  });

  const metricWidth = (PAGE_WIDTH - MARGIN * 2 - 10) / 2;
  const metrics = [
    ["Cena instalacji", formatMoney(data.installationPrice)],
    ["Wkład własny Klienta", formatMoney(data.downPayment)],
    ["Kwota kredytu", formatMoney(data.creditAmount)],
    ["Całkowity koszt kredytu", formatMoney(data.totalCreditCost)],
    ["Całkowita kwota spłaty", formatMoney(data.totalRepayment)],
    ["Liczba rat", String(data.termMonths)],
    ["Oprocentowanie nominalne w skali roku", formatPercent(data.nominalAnnualRate)],
    ["RRSO", formatPercent(data.rrso)],
  ];
  metrics.forEach(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    drawMetric(
      page,
      font,
      MARGIN + column * (metricWidth + 10),
      439 - row * 54,
      metricWidth,
      label,
      value
    );
  });

  page.drawRectangle({
    x: MARGIN,
    y: 126,
    width: PAGE_WIDTH - MARGIN * 2,
    height: 98,
    color: color("#ECFDF5"),
    borderColor: color("#D1FAE5"),
    borderWidth: 0.7,
  });
  page.drawRectangle({ x: MARGIN, y: 126, width: 5, height: 98, color: color("#10B981") });
  page.drawText("Ważna informacja", {
    x: MARGIN + 20,
    y: 202,
    size: 7.4,
    font,
    color: color("#047857"),
  });
  drawWrappedText(page, DISCLAIMER, {
    x: MARGIN + 20,
    y: 184,
    maxWidth: PAGE_WIDTH - MARGIN * 2 - 38,
    size: 7.5,
    lineHeight: 10.2,
    font,
    textColor: color("#065F46"),
  });
  page.drawText("Wstępny harmonogram rat znajduje się na kolejnych stronach dokumentu.", {
    x: MARGIN,
    y: 98,
    size: 7.2,
    font,
    color: color("#64748B"),
  });

  const schedule = buildSchedule(data);
  const rowsPerPage = 30;
  for (let offset = 0; offset < schedule.length; offset += rowsPerPage) {
    const schedulePage = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    schedulePage.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: color("#FFFFFF") });
    schedulePage.drawRectangle({ x: MARGIN, y: 797, width: PAGE_WIDTH - MARGIN * 2, height: 5, color: color("#10B981") });
    schedulePage.drawText("WSTĘPNY HARMONOGRAM RAT", {
      x: MARGIN,
      y: 770,
      size: 14,
      font,
      color: color("#0F172A"),
    });
    schedulePage.drawText(`${cleanText(data.bankName)} - ${cleanText(data.offerName)}`, {
      x: MARGIN,
      y: 751,
      size: 7.5,
      font,
      color: color("#64748B"),
      maxWidth: PAGE_WIDTH - MARGIN * 2,
    });

    const tableTop = 728;
    const columns = [MARGIN, MARGIN + 58, MARGIN + 190, MARGIN + 337, PAGE_WIDTH - MARGIN];
    schedulePage.drawRectangle({
      x: MARGIN,
      y: tableTop - 24,
      width: PAGE_WIDTH - MARGIN * 2,
      height: 24,
      color: color("#F1F5F9"),
      borderColor: color("#CBD5E1"),
      borderWidth: 0.7,
    });
    ["Rata", "Termin orientacyjny", "Kwota raty", "Pozostało do spłaty"].forEach((label, index) => {
      schedulePage.drawText(label, {
        x: columns[index] + 8,
        y: tableTop - 16,
        size: 7,
        font,
        color: color("#475569"),
      });
    });

    schedule.slice(offset, offset + rowsPerPage).forEach((row, index) => {
      const rowTop = tableTop - 24 - index * 20;
      schedulePage.drawRectangle({
        x: MARGIN,
        y: rowTop - 20,
        width: PAGE_WIDTH - MARGIN * 2,
        height: 20,
        color: index % 2 === 0 ? color("#FFFFFF") : color("#F8FAFC"),
        borderColor: color("#E2E8F0"),
        borderWidth: 0.45,
      });
      [String(row.number), row.date, formatMoney(row.amount), formatMoney(row.remaining)].forEach((value, columnIndex) => {
        schedulePage.drawText(value, {
          x: columns[columnIndex] + 8,
          y: rowTop - 14,
          size: 7.1,
          font,
          color: color("#0F172A"),
          maxWidth: columns[columnIndex + 1] - columns[columnIndex] - 14,
        });
      });
    });

    schedulePage.drawText("Harmonogram ma charakter orientacyjny. Kalkulacja wstępna - nie stanowi oferty instytucji finansującej.", {
      x: MARGIN,
      y: 61,
      size: 6.6,
      font,
      color: color("#64748B"),
      maxWidth: PAGE_WIDTH - MARGIN * 2,
    });
  }

  const pages = pdf.getPages();
  pages.forEach((currentPage, index) => drawFooter(currentPage, font, index + 1, pages.length));
  return pdf.save();
}
