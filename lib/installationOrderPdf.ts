import { readFile } from "fs/promises";
import path from "path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";

export type InstallationSupplySource = "ideasol" | "installer";

export type InstallationSupplySources = {
  panels: InstallationSupplySource;
  inverter: InstallationSupplySource;
  energy_storage: InstallationSupplySource;
  construction: InstallationSupplySource;
  materials: InstallationSupplySource;
};

export type InstallationOrderIncludedItems = {
  panels: boolean;
  inverter: boolean;
  energy_storage: boolean;
  construction: boolean;
  materials: boolean;
};

export const DEFAULT_INSTALLATION_SUPPLY_SOURCES: InstallationSupplySources = {
  panels: "ideasol",
  inverter: "ideasol",
  energy_storage: "ideasol",
  construction: "ideasol",
  materials: "ideasol",
};

export const DEFAULT_INSTALLATION_ORDER_INCLUDED_ITEMS: InstallationOrderIncludedItems = {
  panels: true,
  inverter: true,
  energy_storage: true,
  construction: true,
  materials: true,
};

export type InstallationOrderCoverInput = {
  saleNumber: string;
  installationDate: string;
  installer: {
    companyName: string;
    address: string;
    nip: string;
    contactName: string;
    phone: string;
    email: string;
  };
  client: {
    name: string;
    phone: string;
    installationAddress: string;
  };
  pv: {
    mountingType: string;
    panelModel: string;
    panelPowerWp: string;
    panelCount: string;
    totalPowerKw: string;
  };
  scope: {
    hasPv: boolean;
    hasStorage: boolean;
  };
  equipment: {
    inverter: string;
    energyStorage: string;
  };
  supplySources: InstallationSupplySources;
  includedItems: InstallationOrderIncludedItems;
  attachments: {
    audits: number;
    photos: number;
  };
};

export const INSTALLATION_ORDER_PAGE_WIDTH = 595.28;
export const INSTALLATION_ORDER_PAGE_HEIGHT = 841.89;
export const INSTALLATION_ORDER_PAGE_MARGIN = 50;

const NAVY = rgb(0.05, 0.09, 0.16);
const GREEN = rgb(0.02, 0.72, 0.42);
const GREEN_DARK = rgb(0.02, 0.48, 0.31);
const MUTED = rgb(0.38, 0.45, 0.55);
const BORDER = rgb(0.84, 0.88, 0.92);
const SOFT = rgb(0.97, 0.98, 0.99);
const WHITE = rgb(1, 1, 1);

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let line = words[0];

  for (const word of words.slice(1)) {
    const candidate = `${line} ${word}`;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }

  lines.push(line);
  return lines;
}

function drawLines(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: PDFFont,
  size: number,
  color = NAVY,
  lineHeight = size * 1.3,
  maxLines?: number
) {
  const lines = wrapText(text, font, size, maxWidth);
  const visibleLines = typeof maxLines === "number" ? lines.slice(0, maxLines) : lines;

  visibleLines.forEach((line, index) => {
    page.drawText(line, {
      x,
      y: y - index * lineHeight,
      font,
      size,
      color,
    });
  });
}

function drawSectionTitle(page: PDFPage, title: string, y: number, boldFont: PDFFont) {
  page.drawText(title, {
    x: INSTALLATION_ORDER_PAGE_MARGIN,
    y,
    font: boldFont,
    size: 14,
    color: NAVY,
  });
}

function drawCard(
  page: PDFPage,
  top: number,
  height: number,
  options?: { x?: number; width?: number; background?: "white" | "soft" }
) {
  const x = options?.x ?? INSTALLATION_ORDER_PAGE_MARGIN;
  const width = options?.width ?? INSTALLATION_ORDER_PAGE_WIDTH - INSTALLATION_ORDER_PAGE_MARGIN * 2;

  page.drawRectangle({
    x,
    y: top - height,
    width,
    height,
    color: options?.background === "soft" ? SOFT : WHITE,
    borderColor: BORDER,
    borderWidth: 0.8,
  });
  page.drawRectangle({
    x,
    y: top - height,
    width: 5,
    height,
    color: GREEN,
  });
}

function drawLabel(page: PDFPage, label: string, x: number, y: number, boldFont: PDFFont) {
  page.drawText(label.toUpperCase(), {
    x,
    y,
    font: boldFont,
    size: 6.6,
    color: MUTED,
  });
}

function supplySourceLabel(source: InstallationSupplySource) {
  return source === "installer" ? "Sprzęt instalatora" : "Dostawa własna IdeaSol";
}

function displayValue(value: string) {
  return String(value || "").trim() || "Brak / nie dotyczy";
}

function drawFooter(page: PDFPage, saleNumber: string, regularFont: PDFFont) {
  page.drawLine({
    start: { x: INSTALLATION_ORDER_PAGE_MARGIN, y: 55 },
    end: { x: INSTALLATION_ORDER_PAGE_WIDTH - INSTALLATION_ORDER_PAGE_MARGIN, y: 55 },
    thickness: 2,
    color: GREEN,
  });
  page.drawText("Wygenerowano z systemu IdeaSol CRM", {
    x: INSTALLATION_ORDER_PAGE_MARGIN,
    y: 37,
    font: regularFont,
    size: 7.5,
    color: MUTED,
  });
  const saleNumberWidth = regularFont.widthOfTextAtSize(saleNumber, 7.5);
  page.drawText(saleNumber, {
    x: INSTALLATION_ORDER_PAGE_WIDTH - INSTALLATION_ORDER_PAGE_MARGIN - saleNumberWidth,
    y: 37,
    font: regularFont,
    size: 7.5,
    color: MUTED,
  });
}

export async function createInstallationOrderCover(input: InstallationOrderCoverInput) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const regularFontBytes = await readFile(
    path.join(process.cwd(), "public", "fonts", "NotoSans-Regular.ttf")
  );
  let boldFontBytes = regularFontBytes;
  try {
    boldFontBytes = await readFile(
      path.join(process.cwd(), "public", "fonts", "NotoSans-Bold.ttf")
    );
  } catch {
    boldFontBytes = regularFontBytes;
  }

  const logoBytes = await readFile(path.join(process.cwd(), "public", "logo.png"));
  const regularFont = await pdfDoc.embedFont(regularFontBytes);
  const boldFont = await pdfDoc.embedFont(boldFontBytes);
  const logo = await pdfDoc.embedPng(logoBytes);
  const page = pdfDoc.addPage([
    INSTALLATION_ORDER_PAGE_WIDTH,
    INSTALLATION_ORDER_PAGE_HEIGHT,
  ]);

  page.drawImage(logo, {
    x: INSTALLATION_ORDER_PAGE_MARGIN,
    y: 744,
    width: 67,
    height: 66,
  });

  page.drawText("IdeaSol Sp. z o. o.", {
    x: 135,
    y: 807,
    font: boldFont,
    size: 11,
    color: NAVY,
  });
  page.drawText("ul. Złota 23/101", {
    x: 135,
    y: 790,
    font: regularFont,
    size: 8.5,
    color: MUTED,
  });
  page.drawText("25-015 Kielce", {
    x: 135,
    y: 776,
    font: regularFont,
    size: 8.5,
    color: MUTED,
  });
  page.drawText("NIP 9592095104  |  REGON 545265529", {
    x: 135,
    y: 758,
    font: regularFont,
    size: 8,
    color: MUTED,
  });

  page.drawText("Zlecenie montażu", {
    x: 371,
    y: 803,
    font: boldFont,
    size: 17,
    color: NAVY,
  });
  page.drawText(input.saleNumber, {
    x: 371,
    y: 781,
    font: regularFont,
    size: 9,
    color: MUTED,
  });
  page.drawText(`Data montażu: ${input.installationDate}`, {
    x: 371,
    y: 760,
    font: regularFont,
    size: 8,
    color: MUTED,
  });

  page.drawRectangle({
    x: INSTALLATION_ORDER_PAGE_MARGIN,
    y: 718,
    width: INSTALLATION_ORDER_PAGE_WIDTH - INSTALLATION_ORDER_PAGE_MARGIN * 2,
    height: 4,
    color: GREEN,
  });

  drawSectionTitle(page, "Dane zlecenia", 691, boldFont);
  drawCard(page, 675, 94);

  drawLabel(page, "Numer sprzedaży", 72, 651, boldFont);
  page.drawText(input.saleNumber, { x: 72, y: 633, font: boldFont, size: 10, color: NAVY });
  drawLabel(page, "Data montażu", 72, 609, boldFont);
  page.drawText(input.installationDate, { x: 72, y: 591, font: regularFont, size: 9, color: NAVY });

  page.drawLine({
    start: { x: 243, y: 593 },
    end: { x: 243, y: 661 },
    thickness: 0.8,
    color: BORDER,
  });
  drawLabel(page, "Instalator", 264, 651, boldFont);
  page.drawText(displayValue(input.installer.companyName), {
    x: 264,
    y: 633,
    font: boldFont,
    size: 9,
    color: NAVY,
  });
  drawLines(page, displayValue(input.installer.address), 264, 617, 258, regularFont, 7.5, MUTED, 10, 2);
  page.drawText(`NIP: ${displayValue(input.installer.nip)}`, {
    x: 264,
    y: 603,
    font: regularFont,
    size: 7.5,
    color: MUTED,
  });
  drawLines(
    page,
    `Kontakt: ${displayValue(input.installer.contactName)} | ${displayValue(input.installer.phone)} | ${displayValue(input.installer.email)}`,
    264,
    588,
    274,
    regularFont,
    6.8,
    MUTED,
    8,
    1
  );

  drawSectionTitle(page, "Klient i miejsce montażu", 559, boldFont);
  drawCard(page, 543, 72);
  drawLabel(page, "Klient", 72, 519, boldFont);
  drawLines(page, displayValue(input.client.name), 72, 501, 194, boldFont, 9, NAVY, 11, 2);
  drawLabel(page, "Telefon", 286, 519, boldFont);
  page.drawText(displayValue(input.client.phone), {
    x: 286,
    y: 501,
    font: regularFont,
    size: 9,
    color: NAVY,
  });
  drawLabel(page, "Adres montażu", 393, 519, boldFont);
  drawLines(
    page,
    displayValue(input.client.installationAddress),
    393,
    501,
    142,
    regularFont,
    8,
    NAVY,
    10,
    3
  );

  drawSectionTitle(
    page,
    input.scope.hasPv ? "Parametry instalacji PV" : "Zakres instalacji",
    449,
    boldFont
  );
  drawCard(page, 433, 94, { background: "soft" });
  const pvFields = input.scope.hasPv
    ? [
        ["Miejsce montażu", displayValue(input.pv.mountingType)],
        ["Model panela", displayValue(input.pv.panelModel)],
        ["Moc panela", displayValue(input.pv.panelPowerWp)],
        ["Liczba paneli", displayValue(input.pv.panelCount)],
        ["Łączna moc PV", displayValue(input.pv.totalPowerKw)],
      ]
    : [["Zakres", "Montaż magazynu energii"]];
  const pvColumnWidth = 95;
  pvFields.forEach(([label, value], index) => {
    const x = 69 + index * pvColumnWidth;
    drawLabel(page, label, x, 407, boldFont);
    drawLines(page, value, x, 386, pvColumnWidth - 10, index === 4 ? boldFont : regularFont, 8, index === 4 ? GREEN_DARK : NAVY, 10, 3);
  });

  drawSectionTitle(page, "Urządzenia i odpowiedzialność za dostawę", 317, boldFont);
  const tableX = INSTALLATION_ORDER_PAGE_MARGIN;
  const tableTop = 302;
  const tableWidth = INSTALLATION_ORDER_PAGE_WIDTH - INSTALLATION_ORDER_PAGE_MARGIN * 2;
  const headerHeight = 23;
  const rowHeight = 34;
  const itemWidth = 126;
  const descriptionWidth = 230;

  page.drawRectangle({
    x: tableX,
    y: tableTop - headerHeight,
    width: tableWidth,
    height: headerHeight,
    color: SOFT,
    borderColor: BORDER,
    borderWidth: 0.8,
  });
  page.drawText("Pozycja", { x: tableX + 10, y: tableTop - 15, font: regularFont, size: 7, color: MUTED });
  page.drawText("Model / zakres", { x: tableX + itemWidth + 10, y: tableTop - 15, font: regularFont, size: 7, color: MUTED });
  page.drawText("Dostawa", { x: tableX + itemWidth + descriptionWidth + 10, y: tableTop - 15, font: regularFont, size: 7, color: MUTED });

  const rows: string[][] = [];
  if (input.scope.hasPv && input.includedItems.panels) {
    rows.push([
      "Panele fotowoltaiczne",
      displayValue(input.pv.panelModel),
      supplySourceLabel(input.supplySources.panels),
    ]);
  }
  if (
    input.includedItems.inverter &&
    input.equipment.inverter !== "Brak / nie dotyczy"
  ) {
    rows.push([
      "Falownik",
      displayValue(input.equipment.inverter),
      supplySourceLabel(input.supplySources.inverter),
    ]);
  }
  if (
    input.includedItems.energy_storage &&
    (input.scope.hasStorage || input.equipment.energyStorage !== "Brak / nie dotyczy")
  ) {
    rows.push([
      "Magazyn energii",
      displayValue(input.equipment.energyStorage),
      supplySourceLabel(input.supplySources.energy_storage),
    ]);
  }
  if (input.scope.hasPv && input.includedItems.construction) {
    rows.push([
      "Konstrukcja",
      displayValue(input.pv.mountingType),
      supplySourceLabel(input.supplySources.construction),
    ]);
  }
  if (input.includedItems.materials) {
    rows.push([
      "Materiały",
      "Materiały montażowe i instalacyjne",
      supplySourceLabel(input.supplySources.materials),
    ]);
  }
  if (rows.length === 0) {
    rows.push(["Brak wybranych elementów", "-", "-"]);
  }

  rows.forEach(([item, description, source], index) => {
    const rowTop = tableTop - headerHeight - index * rowHeight;
    page.drawRectangle({
      x: tableX,
      y: rowTop - rowHeight,
      width: tableWidth,
      height: rowHeight,
      color: index % 2 === 0 ? WHITE : SOFT,
      borderColor: BORDER,
      borderWidth: 0.5,
    });
    drawLines(page, item, tableX + 10, rowTop - 14, itemWidth - 18, boldFont, 7.4, NAVY, 9, 2);
    drawLines(page, description, tableX + itemWidth + 10, rowTop - 14, descriptionWidth - 18, regularFont, 7.2, NAVY, 9, 2);
    drawLines(page, source, tableX + itemWidth + descriptionWidth + 10, rowTop - 14, tableWidth - itemWidth - descriptionWidth - 18, regularFont, 7.2, GREEN_DARK, 9, 2);
  });

  page.drawText(
    `Załączniki: audyt techniczny - ${input.attachments.audits}, zdjęcia - ${input.attachments.photos}`,
    {
      x: INSTALLATION_ORDER_PAGE_MARGIN,
      y: 72,
      font: regularFont,
      size: 7.5,
      color: MUTED,
    }
  );

  drawFooter(page, input.saleNumber, regularFont);

  return { pdfDoc, regularFont, boldFont };
}
