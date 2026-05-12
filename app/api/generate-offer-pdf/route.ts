import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

export const runtime = "nodejs";

function formatMoney(value: unknown) {
  const amount = Number(value || 0)
    .toLocaleString("pl-PL", {
      maximumFractionDigits: 0,
    })
    .replace(/\u00A0/g, " ")
    .replace(/\u202F/g, " ")
    .replace(/´/g, " ");

  return `${amount} zł`;
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

async function createOfferPdf(data: {
  clientName?: string;
  offerType?: string;
  pvPowerKw?: number;
  panelCount?: number;
  panelPowerWp?: number;
  panelName?: string;
  inverter?: string;
  energyStorage?: string;
  finalNet?: number;
  finalGross?: number;
  vatRate?: number;
  advisorName?: string;
  advisorPhone?: string;
  advisorEmail?: string;
}) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const page = pdfDoc.addPage([595, 842]);
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
  const font = await pdfDoc.embedFont(fontBytes, {
    subset: true,
  });

  const headingFont = font;

  const headline =
    data.offerType === "pv"
      ? "Twoja wycena instalacji fotowoltaicznej"
      : data.offerType === "storage"
        ? "Twoja wycena instalacji magazynu energii"
        : "Twoja wycena instalacji fotowoltaicznej z magazynem energii";

  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: hexToRgb("#F4F8FA"),
  });

  page.drawRectangle({
    x: 0,
    y: height - 122,
    width,
    height: 122,
    color: hexToRgb("#050F26"),
  });

  page.drawRectangle({
    x: 0,
    y: height - 122,
    width,
    height: 6,
    color: hexToRgb("#10C889"),
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
    const logoDims = logoImage.scaleToFit(180, 98);

    page.drawImage(logoImage, {
      x: 42,
      y: height - 106,
      width: logoDims.width,
      height: logoDims.height,
    });
  } else {
    page.drawText("IdeaSol", {
      x: 50,
      y: height - 70,
      size: 28,
      font,
      color: hexToRgb("#FFFFFF"),
    });
  }

  page.drawText(headline, {
    x: 210,
    y: height - 84,
    size: 12,
    font: headingFont,
    color: hexToRgb("#B8C7D9"),
  });

  page.drawText(`Data: ${new Date().toLocaleDateString("pl-PL")}`, {
    x: 465,
    y: height - 36,
    size: 8,
    font,
    color: hexToRgb("#B8C7D9"),
  });

  // Client card
  page.drawRectangle({
    x: 40,
    y: height - 204,
    width: 515,
    height: 58,
    color: hexToRgb("#FFFFFF"),
  });

  page.drawRectangle({
    x: 40,
    y: height - 204,
    width: 5,
    height: 58,
    color: hexToRgb("#10C889"),
  });

  page.drawText("Klient / firma", {
    x: 60,
    y: height - 170,
    size: 9,
    font,
    color: hexToRgb("#6B7280"),
  });

  page.drawText(String(data.clientName || "Nie podano"), {
    x: 60,
    y: height - 194,
    size: 16,
    font,
    color: hexToRgb("#050F26"),
    maxWidth: 470,
  });

  page.drawText("Zakres oferty", {
    x: 40,
    y: height - 258,
    size: 18,
    font: headingFont,
    color: hexToRgb("#050F26"),
  });

  page.drawRectangle({
    x: 40,
    y: height - 480,
    width: 515,
    height: 210,
    color: hexToRgb("#FFFFFF"),
  });

  const rows = [
    data.pvPowerKw ? ["Moc instalacji", `${data.pvPowerKw} kWp`] : null,
    data.panelName ? ["Model panelu", data.panelName] : null,
    data.panelCount && data.panelPowerWp
      ? ["Panele", `${data.panelCount} × ${data.panelPowerWp} Wp`]
      : null,
    data.inverter && data.inverter !== "Brak" ? ["Falownik", data.inverter] : null,
    data.energyStorage && data.energyStorage !== "Brak"
      ? ["Magazyn energii", data.energyStorage]
      : null,
  ].filter(Boolean) as string[][];

  let rowY = height - 307;

  rows.forEach(([label, value], index) => {
    if (index % 2 === 0) {
      page.drawRectangle({
        x: 55,
        y: rowY - 12,
        width: 485,
        height: 34,
        color: hexToRgb("#F4F8FA"),
      });
    }

    page.drawText(label, {
      x: 70,
      y: rowY,
      size: 10,
      font,
      color: hexToRgb("#6B7280"),
    });

    page.drawText(value, {
      x: 230,
      y: rowY,
      size: 10,
      font,
      color: hexToRgb("#050F26"),
      maxWidth: 290,
    });

    page.drawLine({
      start: { x: 55, y: rowY - 18 },
      end: { x: 540, y: rowY - 18 },
      thickness: 1,
      color: hexToRgb("#E5EAF0"),
    });

    rowY -= 38;
  });

  if (rows.length === 0) {
    page.drawText("Brak dodatkowych elementów konfiguracji.", {
      x: 70,
      y: height - 310,
      size: 11,
      font,
      color: hexToRgb("#6B7280"),
    });
  }

  page.drawText("Podsumowanie ceny", {
    x: 40,
    y: height - 543,
    size: 18,
    font: headingFont,
    color: hexToRgb("#050F26"),
  });

  page.drawRectangle({
    x: 40,
    y: height - 667,
    width: 515,
    height: 112,
    color: hexToRgb("#050F26"),
  });

  page.drawRectangle({
    x: 40,
    y: height - 561,
    width: 515,
    height: 6,
    color: hexToRgb("#10C889"),
  });

  page.drawText("Cena netto", {
    x: 65,
    y: height - 590,
    size: 11,
    font,
    color: hexToRgb("#B8C7D9"),
  });

  page.drawText(formatMoney(data.finalNet), {
    x: 65,
    y: height - 625,
    size: 24,
    font,
    color: hexToRgb("#FFFFFF"),
  });

  page.drawText(`Cena brutto VAT ${data.vatRate || 0}%`, {
    x: 335,
    y: height - 590,
    size: 11,
    font,
    color: hexToRgb("#B8C7D9"),
  });

  page.drawText(formatMoney(data.finalGross), {
    x: 335,
    y: height - 625,
    size: 24,
    font,
    color: hexToRgb("#10C889"),
  });

  page.drawRectangle({
    x: 40,
    y: height - 757,
    width: 515,
    height: 52,
    color: hexToRgb("#FFFFFF"),
  });

  page.drawText("Informacja", {
    x: 60,
    y: height - 727,
    size: 10,
    font,
    color: hexToRgb("#6B7280"),
  });

  page.drawText(
    "Oferta ma charakter informacyjny i wymaga potwierdzenia po analizie warunków montażowych.",
    {
      x: 60,
      y: height - 746,
      size: 9,
      font,
      color: hexToRgb("#6B7280"),
      maxWidth: 470,
    }
  );

  page.drawText("KONTAKT Z DORADCĄ", {
    x: 40,
    y: 57,
    size: 8,
    font,
    color: hexToRgb("#050F26"),
  });

  page.drawText(`Twój doradca - ${data.advisorName || "Jan"}`, {
    x: 40,
    y: 43,
    size: 8,
    font,
    color: hexToRgb("#6B7280"),
  });

  page.drawText(`tel. ${data.advisorPhone || "501 000 000"}`, {
    x: 190,
    y: 43,
    size: 8,
    font,
    color: hexToRgb("#6B7280"),
  });

  page.drawText(`mail: ${data.advisorEmail || "jan@ideasol.pl"}`, {
    x: 300,
    y: 43,
    size: 8,
    font,
    color: hexToRgb("#6B7280"),
  });

  page.drawText("Dokument wygenerowany automatycznie z kalkulatora ofertowego.", {
    x: 300,
    y: 25,
    size: 7,
    font,
    color: hexToRgb("#6B7280"),
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
      energyStorage: body.energyStorage,
      finalNet: body.finalNet,
      finalGross: body.finalGross,
      vatRate: body.vatRate,
      advisorName: body.advisorName,
      advisorPhone: body.advisorPhone,
      advisorEmail: body.advisorEmail,
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