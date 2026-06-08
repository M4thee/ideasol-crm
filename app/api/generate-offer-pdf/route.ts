import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

export const runtime = "nodejs";

type OfferPdfData = {
  clientName?: string;
  offerType?: string;
  pvPowerKw?: number;
  panelCount?: number;
  panelPowerWp?: number;
  panelName?: string;
  inverter?: string;
  inverterProducer?: string;
  inverterModel?: string;
  inverterPowerKw?: number | string;
  inverterNet?: number;
  inverterGross?: number;
  energyStorage?: string;
  pvNet?: number;
  pvGross?: number;
  storageNet?: number;
  storageGross?: number;
  withEms?: boolean;
  withBackup?: boolean;
  backupName?: string;
  backupNet?: number;
  backupGross?: number;
  emsName?: string;
  emsNet?: number;
  emsGross?: number;
  additionalServices?: unknown;
  subsidyTotal?: number;
  subsidyAllocation?: {
    enabled?: boolean;
    pvNet?: number;
    storageNet?: number;
    emsNet?: number;
    total?: number;
    storageSubsidy?: number;
    emsBonus?: number;
  };
  finalNet?: number;
  finalGross?: number;
  vatRate?: number;
  advisorName?: string;
  advisorPhone?: string;
  advisorEmail?: string;
  pdfQuantity?: number;
};

function formatMoney(value: unknown) {
  const amount = Number(value || 0)
    .toLocaleString("pl-PL", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    .replace(/\u00A0/g, " ")
    .replace(/\u202F/g, " ")
    .replace(/´/g, " ");

  return `${amount} zł`;
}

function formatMaybeMoney(value: unknown) {
  const numberValue = Number(value || 0);
  if (!numberValue) return "-";
  return formatMoney(numberValue);
}

function findFirstExistingFile(paths: string[]) {
  return paths.find((candidatePath) => existsSync(candidatePath));
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;

  return rgb(r, g, b);
}

function wrapText(text: string, font: any, size: number, maxWidth: number) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";

  words.forEach((word) => {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, size);

    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  });

  if (currentLine) lines.push(currentLine);
  return lines;
}

function drawWrappedText(
  page: ReturnType<PDFDocument["addPage"]>,
  text: string,
  options: {
    x: number;
    y: number;
    maxWidth: number;
    size: number;
    lineHeight: number;
    font: any;
    color: ReturnType<typeof rgb>;
  }
) {
  const lines = wrapText(text, options.font, options.size, options.maxWidth);

  lines.forEach((line, index) => {
    page.drawText(line, {
      x: options.x,
      y: options.y - index * options.lineHeight,
      size: options.size,
      font: options.font,
      color: options.color,
    });
  });

  return options.y - lines.length * options.lineHeight;
}

function getSubsidyTotal(data: OfferPdfData) {
  return Number(
    data.subsidyTotal ||
      data.subsidyAllocation?.total ||
      ((data.subsidyAllocation?.storageSubsidy || 0) + (data.subsidyAllocation?.emsBonus || 0)) ||
      0
  );
}

function normalizeAdditionalServices(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as Array<{ name: string; quantity: number; unitNet: number }>;
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        return {
          name: item.trim(),
          quantity: 1,
          unitNet: 0,
        };
      }

      if (!item || typeof item !== "object") return null;

      const service = item as Record<string, unknown>;
      const name = String(service.name || service.label || service.displayName || "").trim();
      const quantity = Number(service.quantity || service.qty || 1);
      const unitNet = Number(service.priceNet || service.unitNet || service.netPrice || service.net_price || 0);
      const totalNet = Number(service.totalNet || service.total_net || 0);

      if (!name) return null;

      return {
        name,
        quantity: Math.max(quantity, 1),
        unitNet: unitNet || (totalNet && quantity ? totalNet / quantity : 0),
      };
    })
    .filter(Boolean) as Array<{ name: string; quantity: number; unitNet: number }>;
}

function getHeadline(offerType?: string) {
  if (offerType === "pv") return "Oferta instalacji fotowoltaicznej";
  if (offerType === "storage") return "Oferta magazynu energii";

  return "Oferta instalacji fotowoltaicznej\nz magazynem energii";
}

function getPvDescription(data: OfferPdfData) {
  if (!data.pvPowerKw || !data.panelName) return "";

  return `Instalacja fotowoltaiczna o mocy ${data.pvPowerKw} kWp z panelami ${data.panelName} - wraz z montażem`;
}

function getInverterDescription(data: OfferPdfData) {
  const rawInverter = data.inverter || "";
  const normalizedType = rawInverter.toLowerCase().includes("hybryd") || rawInverter.toLowerCase().includes("hybrid")
    ? "hybrydowy"
    : "sieciowy";

  const parts = [data.inverterProducer, data.inverterModel].filter(Boolean).join(" ").trim();
  const power = data.inverterPowerKw ? ` ${data.inverterPowerKw} kW` : "";
  const equipmentName = parts || rawInverter;

  if (!equipmentName || equipmentName === "Brak") return "";
  return `Inwerter ${normalizedType} ${equipmentName}${power} wraz z montażem`;
}

function getStorageDescription(data: OfferPdfData) {
  if (!data.energyStorage || data.energyStorage === "Brak") return "";

  return `Magazyn energii ${data.energyStorage} wraz z montażem`;
}

function getEmsDescription(data: OfferPdfData) {
  return "Moduł EMS Zeronest Świetlik D300 wraz z montażem";
}

function getBackupDescription(data: OfferPdfData) {
  if (!data.withBackup) return "";

  return data.backupName || "Backup zasilania awaryjnego";
}

function getOfferRows(data: OfferPdfData) {
  const pvDescription = getPvDescription(data);
  const inverterDescription = getInverterDescription(data);
  const emsDescription = getEmsDescription(data);
  const backupDescription = getBackupDescription(data);
  const storageDescription = getStorageDescription(data);
  const pdfQuantity = Math.max(Number(data.pdfQuantity || 1), 1);
  const vatPercent = Number(data.vatRate || 0);
  const finalNetPerInstallation = Number(data.finalNet || 0);
  const additionalServices = normalizeAdditionalServices(data.additionalServices);
  const additionalUnitNetTotal = additionalServices.reduce(
    (sum, service) => sum + Number(service.unitNet || 0) * Number(service.quantity || 1),
    0
  );
  const hasSubsidyMode = Boolean(data.subsidyAllocation?.enabled && getSubsidyTotal(data) > 0);

  const rawPvNet = Number(data.pvNet || 0);
  const rawInverterNet = Number(data.inverterNet || 0);
  const rawStorageNet = Number(data.storageNet || 0);
  const rawEmsNet = data.withEms ? Number(data.emsNet || 0) : 0;
  const symbolicGross = 1;
  const symbolicNet = symbolicGross / (1 + vatPercent / 100);
  const backupUnitGross = data.withBackup ? symbolicGross : 0;
  const backupUnitNet = data.withBackup ? symbolicNet : 0;
  const pvMinimumGross = pvDescription ? symbolicGross : 0;
  const pvMinimumNet = pvDescription ? symbolicNet : 0;
  const inverterSubsidyNet = hasSubsidyMode && inverterDescription ? symbolicNet : rawInverterNet;

  let pvUnitNet = 0;
  let inverterUnitNet = inverterSubsidyNet;
  let storageUnitNet = 0;
  let emsUnitNet = 0;
  let backupNet = backupUnitNet;

  if (hasSubsidyMode) {
    const fixedNet = inverterUnitNet + backupNet + additionalUnitNetTotal;
    const availableForSubsidyItems = Math.max(finalNetPerInstallation - fixedNet - pvMinimumNet, 0);
    const requestedEmsNet = data.withEms ? Number(data.subsidyAllocation?.emsNet || rawEmsNet || 0) : 0;
    const requestedStorageNet = storageDescription ? Number(data.subsidyAllocation?.storageNet || rawStorageNet || 0) : 0;

    emsUnitNet = Math.min(requestedEmsNet, availableForSubsidyItems);
    const availableAfterEms = Math.max(availableForSubsidyItems - emsUnitNet, 0);
    storageUnitNet = Math.min(requestedStorageNet, availableAfterEms);

    const reservedNet = inverterUnitNet + storageUnitNet + emsUnitNet + backupNet + additionalUnitNetTotal;
    pvUnitNet = pvDescription ? Math.max(finalNetPerInstallation - reservedNet, pvMinimumNet) : 0;
  } else {
    emsUnitNet = rawEmsNet;
    storageUnitNet = rawStorageNet;

    const fixedNet = rawInverterNet + rawEmsNet + backupNet + additionalUnitNetTotal;
    const basePvAndStorageNet = (pvDescription ? rawPvNet : 0) + (storageDescription ? rawStorageNet : 0);
    const remainingNet = Math.max(finalNetPerInstallation - fixedNet - basePvAndStorageNet, 0);
    const splitTargets = [pvDescription ? "pv" : null, storageDescription ? "storage" : null].filter(Boolean);
    const splitCount = Math.max(splitTargets.length, 1);
    const pvExtraNet = splitTargets.includes("pv") ? remainingNet / splitCount : 0;
    const storageExtraNet = splitTargets.includes("storage") ? remainingNet / splitCount : 0;

    pvUnitNet = pvDescription ? rawPvNet + pvExtraNet : 0;
    storageUnitNet = storageDescription ? rawStorageNet + storageExtraNet : 0;
  }

  let lp = 1;
  const rows: Array<
    [number, string, number, number, number, number, number, number, boolean]
  > = [];

  function pushRow(name: string, quantity: number, unitNet: number, isAdditional = false) {
    const safeQuantity = Math.max(Number(quantity || 1), 1);
    const safeUnitNet = Number(unitNet || 0);
    const valueNet = safeUnitNet * safeQuantity;
    const vatValue = valueNet * vatPercent / 100;
    const valueGross = valueNet + vatValue;

    rows.push([
      lp++,
      name,
      safeQuantity,
      safeUnitNet,
      valueNet,
      vatPercent,
      vatValue,
      valueGross,
      isAdditional,
    ]);
  }

  if (pvDescription) {
    pushRow(pvDescription, pdfQuantity, pvUnitNet);
  }

  if (inverterDescription && inverterDescription !== "Brak" && inverterUnitNet > 0) {
    pushRow(inverterDescription, pdfQuantity, inverterUnitNet);
  }

  if (storageDescription) {
    pushRow(storageDescription, pdfQuantity, storageUnitNet);
  }

  if (data.withEms && emsUnitNet > 0) {
    pushRow(emsDescription, pdfQuantity, emsUnitNet);
  }

  if (backupDescription && backupNet > 0) {
    pushRow(backupDescription, pdfQuantity, backupNet);
  }

  additionalServices.forEach((service) => {
    pushRow(
      service.name,
      Number(service.quantity || 1) * pdfQuantity,
      Number(service.unitNet || 0),
      true
    );
  });

  const expectedTotalNet = finalNetPerInstallation * pdfQuantity;
  const currentTotalNet = rows.reduce((sum, row) => sum + Number(row[4] || 0), 0);
  const differenceNet = expectedTotalNet - currentTotalNet;

  if (Math.abs(differenceNet) >= 0.005) {
    const pvRowIndex = rows.findIndex((row) => row[1] === pvDescription);
    const storageRowIndex = rows.findIndex((row) => row[1] === storageDescription);
    const inverterRowIndex = rows.findIndex((row) => row[1] === inverterDescription);
    const candidateIndexes = differenceNet < 0
      ? [pvRowIndex, storageRowIndex, inverterRowIndex]
      : [pvRowIndex, storageRowIndex];

    const correctionTargetIndex = candidateIndexes.find((index) => {
      if (index < 0) return false;
      const row = rows[index];
      const quantity = Number(row[2] || 1);
      const correctedUnitNet = Number(row[3] || 0) + differenceNet / quantity;
      return correctedUnitNet >= 0;
    }) ?? -1;

    if (correctionTargetIndex >= 0) {
      const targetRow = rows[correctionTargetIndex];
      const targetQuantity = Number(targetRow[2] || 1);
      const correctedUnitNet = Number(targetRow[3] || 0) + differenceNet / targetQuantity;
      const correctedValueNet = correctedUnitNet * targetQuantity;
      const correctedVatValue = correctedValueNet * vatPercent / 100;
      const correctedValueGross = correctedValueNet + correctedVatValue;

      rows[correctionTargetIndex] = [
        targetRow[0],
        targetRow[1],
        targetRow[2],
        correctedUnitNet,
        correctedValueNet,
        targetRow[5],
        correctedVatValue,
        correctedValueGross,
        targetRow[8],
      ];
    }
  }

  return rows;
}

async function createOfferPdf(data: OfferPdfData) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  let page = pdfDoc.addPage([595, 842]);
  const { width, height } = page.getSize();

  const fontPath = findFirstExistingFile([
    path.join(process.cwd(), "public", "fonts", "DejaVuSans.ttf"),
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/Library/Fonts/Arial Unicode.ttf",
  ]);

  if (!fontPath) {
    throw new Error("Brak poprawnego fontu TTF/OTF do wygenerowania PDF");
  }

  const fontBytes = readFileSync(fontPath);
  const font = await pdfDoc.embedFont(fontBytes, { subset: true });
  const headingFont = font;

  page.drawRectangle({ x: 0, y: 0, width, height, color: hexToRgb("#FFFFFF") });

  const marginX = 40;
  const cardWidth = width - marginX * 2;
  let y = height - 40;

  page.drawRectangle({
    x: marginX,
    y: y - 104,
    width: cardWidth,
    height: 104,
    color: hexToRgb("#FFFFFF"),
  });
  page.drawRectangle({
    x: marginX,
    y: y - 104,
    width: cardWidth,
    height: 5,
    color: hexToRgb("#10B981"),
  });

  const logoPath = findFirstExistingFile([
    path.join(process.cwd(), "public", "logo.png"),
    path.join(process.cwd(), "public", "logo-transparent.png"),
    path.join(process.cwd(), "public", "Logo.png"),
    path.join(process.cwd(), "public", "ideasol-logo.png"),
    path.join(process.cwd(), "public", "IdeaSol.png"),
    path.join(process.cwd(), "public", "logo-ideasol.png"),
  ]);

  if (logoPath) {
    const logoBytes = readFileSync(logoPath);
    const logoImage = await pdfDoc.embedPng(logoBytes);
    const logoDims = logoImage.scaleToFit(210, 88);
    page.drawImage(logoImage, {
      x: marginX + 18,
      y: y - 82,
      width: logoDims.width,
      height: logoDims.height,
    });
  } else {
    page.drawText("IdeaSol", {
      x: marginX + 18,
      y: y - 58,
      size: 25,
      font: headingFont,
      color: hexToRgb("#0F172A"),
    });
  }

  drawWrappedText(page, getHeadline(data.offerType), {
    x: marginX + 170,
    y: y - 30,
    maxWidth: 250,
    size: 12,
    lineHeight: 15,
    font: headingFont,
    color: hexToRgb("#0F172A"),
  });

  page.drawText(`Data: ${new Date().toLocaleDateString("pl-PL")}`, {
    x: width - 112,
    y: y - 78,
    size: 8,
    font,
    color: hexToRgb("#64748B"),
  });

  y -= 122;

  const halfCardWidth = (cardWidth - 14) / 2;

  page.drawRectangle({ x: marginX, y: y - 70, width: halfCardWidth, height: 70, color: hexToRgb("#FFFFFF") });
  page.drawRectangle({ x: marginX, y: y - 70, width: 5, height: 70, color: hexToRgb("#10B981") });
  page.drawText("Imię i nazwisko klienta / Nazwa firmy", {
    x: marginX + 18,
    y: y - 22,
    size: 7.6,
    font,
    color: hexToRgb("#64748B"),
  });
  page.drawText(String(data.clientName || "Nie podano"), {
    x: marginX + 18,
    y: y - 48,
    size: 13,
    font: headingFont,
    color: hexToRgb("#0F172A"),
    maxWidth: halfCardWidth - 34,
  });

  const advisorX = marginX + halfCardWidth + 14;
  page.drawRectangle({ x: advisorX, y: y - 70, width: halfCardWidth, height: 70, color: hexToRgb("#FFFFFF") });
  page.drawRectangle({ x: advisorX, y: y - 70, width: 5, height: 70, color: hexToRgb("#10B981") });
  page.drawText("Ofertę przygotował:", {
    x: advisorX + 18,
    y: y - 20,
    size: 7.6,
    font,
    color: hexToRgb("#64748B"),
  });
  page.drawText(data.advisorName || "IdeaSol", {
    x: advisorX + 18,
    y: y - 39,
    size: 11,
    font: headingFont,
    color: hexToRgb("#0F172A"),
    maxWidth: halfCardWidth - 34,
  });
  page.drawText(`tel. ${data.advisorPhone || "-"}`, {
    x: advisorX + 18,
    y: y - 54,
    size: 7.2,
    font,
    color: hexToRgb("#475569"),
    maxWidth: halfCardWidth - 34,
  });
  page.drawText(`e-mail: ${data.advisorEmail || "-"}`, {
    x: advisorX + 18,
    y: y - 66,
    size: 7.2,
    font,
    color: hexToRgb("#475569"),
    maxWidth: halfCardWidth - 34,
  });

  y -= 98;

  page.drawText("Zakres oferty", {
    x: marginX,
    y,
    size: 16,
    font: headingFont,
    color: hexToRgb("#0F172A"),
  });
  y -= 18;

  const rows = getOfferRows(data);
  const rowHeights = rows.map(([, name, , , , , , , isAdditional]) => {
    const nameLines = wrapText(name, font, isAdditional ? 6.4 : 6.8, 195).length;
    return Math.max(isAdditional ? 25 : 34, nameLines * (isAdditional ? 8 : 8.5) + 14);
  });

  function drawOfferTableHeader(currentY: number) {
    page.drawRectangle({
      x: marginX,
      y: currentY - 24,
      width: cardWidth,
      height: 24,
      color: hexToRgb("#F8FAFC"),
      borderColor: hexToRgb("#E2E8F0"),
      borderWidth: 0.7,
    });
    page.drawText("Lp.", { x: marginX + 8, y: currentY - 16, size: 7.1, font, color: hexToRgb("#64748B") });
    page.drawText("Nazwa towaru/usługi", { x: marginX + 30, y: currentY - 16, size: 7.1, font, color: hexToRgb("#64748B") });
    page.drawText("Ilość", { x: marginX + 220, y: currentY - 16, size: 7.1, font, color: hexToRgb("#64748B") });
    page.drawText("Cena netto", { x: marginX + 255, y: currentY - 16, size: 7.1, font, color: hexToRgb("#64748B") });
    page.drawText("Wart. netto", { x: marginX + 315, y: currentY - 16, size: 7.1, font, color: hexToRgb("#64748B") });
    page.drawText("VAT %", { x: marginX + 377, y: currentY - 16, size: 7.1, font, color: hexToRgb("#64748B") });
    page.drawText("Wart. VAT", { x: marginX + 415, y: currentY - 16, size: 7.1, font, color: hexToRgb("#64748B") });
    page.drawText("Wart. Brutto", { x: marginX + 467, y: currentY - 16, size: 7.1, font, color: hexToRgb("#64748B") });
  }

  function addContinuationPage() {
    page = pdfDoc.addPage([595, 842]);
    page.drawRectangle({ x: 0, y: 0, width, height, color: hexToRgb("#FFFFFF") });
    y = height - 44;
    page.drawText("Zakres oferty — ciąg dalszy", {
      x: marginX,
      y,
      size: 13,
      font: headingFont,
      color: hexToRgb("#0F172A"),
    });
    y -= 18;
    drawOfferTableHeader(y);
    y -= 42;
  }

  drawOfferTableHeader(y);
  let rowY = y - 42;

  if (rows.length === 0) {
    page.drawText("Brak dodatkowych elementów konfiguracji.", {
      x: marginX + 28,
      y: y - 44,
      size: 10,
      font,
      color: hexToRgb("#64748B"),
    });
    y -= 86;
  } else {
    rows.forEach(([lp, name, quantity, unitNet, valueNet, vatPercent, vatValue, valueGross, isAdditional], index) => {
      const rowHeight = rowHeights[index];

      if (rowY - rowHeight < 110) {
        addContinuationPage();
        rowY = y;
      }

      if (rowY !== y - 42 && index > 0) {
        page.drawLine({
          start: { x: marginX + 8, y: rowY + 10 },
          end: { x: marginX + cardWidth - 8, y: rowY + 10 },
          thickness: 0.5,
          color: hexToRgb("#E2E8F0"),
        });
      }

      const nameFontSize = isAdditional ? 6.9 : 7.3;
      const nameLineHeight = isAdditional ? 8 : 8.5;
      const nameLines = wrapText(name, font, nameFontSize, 185);
      const nameBlockHeight = nameLines.length * nameLineHeight;
      const textStartY = rowY - Math.max(0, (rowHeight - nameBlockHeight) / 2) + 2;
      const amountY = rowY - Math.max(0, (rowHeight - 8) / 2) + 2;

      page.drawText(String(lp), {
        x: marginX + 8,
        y: amountY,
        size: 7.1,
        font,
        color: hexToRgb("#0F172A"),
      });

      nameLines.forEach((line, lineIndex) => {
        page.drawText(line, {
          x: marginX + 30,
          y: textStartY - lineIndex * nameLineHeight,
          size: nameFontSize,
          font,
          color: isAdditional ? hexToRgb("#475569") : hexToRgb("#0F172A"),
        });
      });

      page.drawText(`${quantity} szt.`, {
        x: marginX + 220,
        y: amountY,
        size: 6.9,
        font,
        color: hexToRgb("#0F172A"),
        maxWidth: 32,
      });

      page.drawText(formatMaybeMoney(unitNet), {
        x: marginX + 255,
        y: amountY,
        size: 6.7,
        font,
        color: hexToRgb("#0F172A"),
        maxWidth: 56,
      });

      page.drawText(formatMaybeMoney(valueNet), {
        x: marginX + 315,
        y: amountY,
        size: 6.7,
        font,
        color: hexToRgb("#0F172A"),
        maxWidth: 56,
      });

      page.drawText(`${vatPercent}%`, {
        x: marginX + 380,
        y: amountY,
        size: 6.7,
        font,
        color: hexToRgb("#0F172A"),
        maxWidth: 30,
      });

      page.drawText(formatMaybeMoney(vatValue), {
        x: marginX + 415,
        y: amountY,
        size: 6.7,
        font,
        color: hexToRgb("#0F172A"),
        maxWidth: 54,
      });

      page.drawText(formatMaybeMoney(valueGross), {
        x: marginX + 467,
        y: amountY,
        size: 6.7,
        font,
        color: hexToRgb("#0F172A"),
        maxWidth: 64,
      });

      rowY -= rowHeight;
      y = rowY - 20;
    });
  }

  y -= 14;

  page.drawText("Podsumowanie ceny", {
    x: marginX,
    y,
    size: 16,
    font: headingFont,
    color: hexToRgb("#0F172A"),
  });
  y -= 18;

  const pdfQuantity = Math.max(Number(data.pdfQuantity || 1), 1);
  const summaryNet = rows.reduce((sum, row) => sum + Number(row[4] || 0), 0);
  const summaryVat = rows.reduce((sum, row) => sum + Number(row[6] || 0), 0);
  const summaryGross = rows.reduce((sum, row) => sum + Number(row[7] || 0), 0);

  page.drawRectangle({
    x: marginX,
    y: y - 72,
    width: cardWidth,
    height: 72,
    color: hexToRgb("#FFFFFF"),
    borderColor: hexToRgb("#E2E8F0"),
    borderWidth: 0.7,
  });
  page.drawRectangle({ x: marginX, y: y - 72, width: 5, height: 72, color: hexToRgb("#10B981") });

  page.drawText("Podsumowanie wartości", {
    x: marginX + 20,
    y: y - 20,
    size: 9,
    font: headingFont,
    color: hexToRgb("#0F172A"),
  });

  page.drawText(`Wartość brutto: ${formatMoney(summaryGross)}`, {
    x: marginX + 20,
    y: y - 41,
    size: 12,
    font: headingFont,
    color: hexToRgb("#047857"),
    maxWidth: 260,
  });

  page.drawText(`Netto: ${formatMoney(summaryNet)}   VAT: ${formatMoney(summaryVat)}`, {
    x: marginX + 300,
    y: y - 41,
    size: 8,
    font,
    color: hexToRgb("#475569"),
    maxWidth: 210,
  });

  y -= 88;

  const depositGross = summaryGross * 0.25;
  const remainingGross = Math.max(summaryGross - depositGross, 0);

  page.drawRectangle({
    x: marginX,
    y: y - 58,
    width: cardWidth,
    height: 58,
    color: hexToRgb("#FFFFFF"),
    borderColor: hexToRgb("#E2E8F0"),
    borderWidth: 0.7,
  });

  page.drawText("Forma rozliczenia", {
    x: marginX + 18,
    y: y - 18,
    size: 9,
    font: headingFont,
    color: hexToRgb("#0F172A"),
  });

  drawWrappedText(
    page,
    `Zaliczka: ${formatMoney(depositGross)} płatna w terminie 14 dni od zawarcia umowy sprzedaży i montażu instalacji.\n\nPozostała kwota: ${formatMoney(remainingGross)} płatna w terminie 3 dni roboczych od podpisania protokołu odbioru instalacji.`,
    {
      x: marginX + 18,
      y: y - 34,
      maxWidth: cardWidth - 36,
      size: 7,
      lineHeight: 9,
      font,
      color: hexToRgb("#475569"),
    }
  );

  y -= 70;

  const subsidyTotal = data.subsidyAllocation?.enabled ? getSubsidyTotal(data) : 0;

  if (subsidyTotal > 0) {
    page.drawRectangle({ x: marginX, y: y - 104, width: cardWidth, height: 104, color: hexToRgb("#ECFDF5") });
    page.drawRectangle({ x: marginX, y: y - 104, width: 5, height: 104, color: hexToRgb("#10B981") });

    page.drawText("Informacja o dotacji", {
      x: marginX + 20,
      y: y - 24,
      size: 7.5,
      font: headingFont,
      color: hexToRgb("#047857"),
    });

    page.drawText(
      `Szacowana dotacja za każdą z ${pdfQuantity} instalacji: ${formatMoney(subsidyTotal)}`,
      {
        x: marginX + 260,
        y: y - 24,
        size: 7.5,
        font: headingFont,
        color: hexToRgb("#047857"),
        maxWidth: 250,
      }
    );

    drawWrappedText(
      page,
      "Powyższa cena nie uwzględnia dotacji rządowej w Programie Priorytetowym Przydomowe Magazyny Energii, która wypłacana jest przez Narodowy Fundusz Ochrony Środowiska i Gospodarki Wodnej na rachunek bankowy beneficjenta na podstawie złożonego wniosku o dofinansowanie, na podstawie faktur i protokołów potwierdzających montaż urządzeń dofinansowywanych przez program. IdeaSol składa wnioski o dofinansowanie w imieniu swoich klientów, jeżeli tak zostanie ustalone podczas zawierania umowy sprzedaży i montażu instalacji fotowoltaicznej i/lub magazynu energii. Szacowana kwota dotacji została wyliczona na podstawie oficjalnych informacji zawartych na stronie internetowej Programu Priorytetowego Przydomowe Magazyny Energii część II. IdeaSol nie odpowiada za decyzje instytucji prowadzących nabór co do ich terminu, wcześniejszego zakończenia lub zmian w regulaminie PP Przydomowe Magazyny, a takze za decyzje co do przyznania dofinansowania.",
      {
        x: marginX + 20,
        y: y - 43,
        maxWidth: 470,
        size: 6.5,
        lineHeight: 7.7,
        font,
        color: hexToRgb("#065F46"),
      }
    );

    y -= 116;
  }

  page.drawRectangle({ x: marginX, y: 52, width: cardWidth, height: 2, color: hexToRgb("#10B981") });

  drawWrappedText(
    page,
    data.subsidyAllocation?.enabled
      ? "Oferta ma charakter informacyjny i wymaga potwierdzenia po analizie warunków montażowych. Powyższe ceny obowiązują przy zakupie całego oferowanego pakietu i zostały zoptymalizowane pod jak najkorzystniejszą dla klienta wysokość dotacji z programu PME."
      : "Oferta ma charakter informacyjny i wymaga potwierdzenia po analizie warunków montażowych. Powyższe ceny obowiązują przy zakupie całego oferowanego pakietu.",
    {
      x: marginX,
      y: 34,
      size: 7.0,
      lineHeight: 8.2,
      font,
      color: hexToRgb("#6B7380"),
      maxWidth: cardWidth,
    }
  );
  page.drawText("Dokument wygenerowany w systemie IdeaSol CRM", {
    x: marginX,
    y: 16,
    size: 6.8,
    font,
    color: hexToRgb("#6B7380"),
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const pdfBuffer = await createOfferPdf({
      clientName: body.clientName,
      offerType: body.offerType,
      pvPowerKw: body.pvPowerKw,
      panelCount: body.panelCount,
      panelPowerWp: body.panelPowerWp,
      panelName: body.panelName,
      inverter: body.inverter,
      inverterProducer: body.inverterProducer,
      inverterModel: body.inverterModel,
      inverterPowerKw: body.inverterPowerKw,
      inverterNet: body.inverterNet,
      inverterGross: body.inverterGross,
      energyStorage: body.energyStorage,
      pvNet: body.pvNet,
      pvGross: body.pvGross,
      storageNet: body.storageNet,
      storageGross: body.storageGross,
      withEms: body.withEms,
      withBackup: body.withBackup,
      backupName: body.backupName,
      backupNet: body.backupNet,
      backupGross: body.backupGross,
      emsName: body.emsName,
      emsNet: body.emsNet,
      emsGross: body.emsGross,
      additionalServices: body.additionalServices,
      subsidyTotal: body.subsidyTotal,
      subsidyAllocation: body.subsidyAllocation,
      finalNet: body.finalNet,
      finalGross: body.finalGross,
      vatRate: body.vatRate,
      advisorName: body.advisorName,
      advisorPhone: body.advisorPhone,
      advisorEmail: body.advisorEmail,
      pdfQuantity: body.pdfQuantity,
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="oferta-ideasol.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF generation error", error);

    return NextResponse.json(
      {
        error: "Nie udalo sie wygenerowac PDF",
        details: error instanceof Error ? error.message : String(error),
      },
      {
        status: 500,
      }
    );
  }
}