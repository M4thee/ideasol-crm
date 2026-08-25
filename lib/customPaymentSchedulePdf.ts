import {
  arrayAsString,
  decodePDFRawStream,
  PDFHexString,
  PDFArray,
  PDFContentStream,
  PDFName,
  PDFRawStream,
  PDFRef,
  beginText,
  endText,
  moveText,
  rgb,
  setFillingRgbColor,
  setFontAndSize,
  showText,
  typedArrayFor,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

import {
  formatCustomPaymentInstallment,
  hasCustomPaymentDeposit,
  type CustomPaymentSchedule,
} from "./customPaymentSchedule";

type DrawCustomPaymentScheduleOptions = {
  paymentPage: PDFPage;
  realizationPage: PDFPage;
  layoutFont: PDFFont;
  schedule: CustomPaymentSchedule;
};

const HELVETICA_TYPE0_CIDS = new Map<number, number>([
  [0x20, 0x0003],
  [0x00f3, 0x0079],
  [0x00a7, 0x0086],
  [0x2013, 0x00b1],
  [0x00d3, 0x00cf],
  [0x0141, 0x00e0],
  [0x0142, 0x00e1],
  [0x00b2, 0x00f0],
  [0x0107, 0x00fc],
  [0x0104, 0x0104],
  [0x0105, 0x0105],
  [0x0118, 0x0109],
  [0x0119, 0x010a],
  [0x0143, 0x0113],
  [0x0144, 0x0114],
  [0x015a, 0x011d],
  [0x015b, 0x011e],
  [0x017a, 0x0128],
  [0x017b, 0x0129],
  [0x017c, 0x012a],
]);

const WIN_ANSI_BYTES = new Map<number, number>([
  [0x201a, 0x82],
  [0x201e, 0x84],
  [0x2026, 0x85],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2013, 0x96],
  [0x2014, 0x97],
]);

const PDF_NUMBER_PATTERN = "[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)";
const TEXT_BLOCK_PATTERN = /BT(?:\r\n|\n|\r)[\s\S]*?(?:\r\n|\n|\r)ET/g;
const TEXT_MATRIX_PATTERN = new RegExp(
  `${PDF_NUMBER_PATTERN}\\s+${PDF_NUMBER_PATTERN}\\s+${PDF_NUMBER_PATTERN}\\s+${PDF_NUMBER_PATTERN}\\s+${PDF_NUMBER_PATTERN}\\s+(${PDF_NUMBER_PATTERN})\\s+Tm`,
  "g"
);

function decodedContentStream(stream: PDFRawStream | PDFContentStream) {
  if (stream instanceof PDFRawStream) {
    return arrayAsString(decodePDFRawStream(stream).decode());
  }
  return arrayAsString(stream.getUnencodedContents());
}

function removeSelectableTemplateText(
  page: PDFPage,
  minY: number,
  maxY: number
) {
  const contents = page.node.Contents();
  if (!contents) return;

  const streams: Array<PDFRawStream | PDFContentStream> = [];
  if (contents instanceof PDFArray) {
    for (let index = 0; index < contents.size(); index += 1) {
      const stream = contents.lookup(index);
      if (stream instanceof PDFRawStream || stream instanceof PDFContentStream) {
        streams.push(stream);
      }
    }
  } else if (
    contents instanceof PDFRawStream ||
    contents instanceof PDFContentStream
  ) {
    streams.push(contents);
  }

  if (streams.length === 0) return;

  const sanitized = streams
    .map(decodedContentStream)
    .join("\n")
    .replace(TEXT_BLOCK_PATTERN, (block) => {
      TEXT_MATRIX_PATTERN.lastIndex = 0;
      let match = TEXT_MATRIX_PATTERN.exec(block);
      while (match) {
        const y = Number(match[1]);
        if (Number.isFinite(y) && y >= minY && y <= maxY) return "";
        match = TEXT_MATRIX_PATTERN.exec(block);
      }
      return block;
    });

  const sanitizedStream = page.doc.context.flateStream(
    typedArrayFor(sanitized)
  );
  const contentsEntry = page.node.get(PDFName.of("Contents"));

  if (contentsEntry instanceof PDFRef) {
    // Replace the original object under the same reference. This prevents the
    // removed text from surviving in the saved PDF as an orphaned stream.
    page.doc.context.assign(contentsEntry, sanitizedStream);
  } else {
    const sanitizedStreamRef = page.doc.context.register(sanitizedStream);
    page.node.set(PDFName.of("Contents"), sanitizedStreamRef);
  }
}

export function sanitizeCustomPaymentTemplatePages(
  paymentPage: PDFPage,
  realizationPage: PDFPage
) {
  removeSelectableTemplateText(paymentPage, 92, 575);
  removeSelectableTemplateText(realizationPage, 730, 772);
}

function cleanPdfText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function helveticaCid(codePoint: number) {
  const special = HELVETICA_TYPE0_CIDS.get(codePoint);
  if (special !== undefined) return special;
  if (codePoint >= 0x28 && codePoint <= 0x29) return 0x000b + codePoint - 0x28;
  if (codePoint >= 0x2e && codePoint <= 0x3b) return 0x0011 + codePoint - 0x2e;
  if (codePoint >= 0x40 && codePoint <= 0x50) return 0x0023 + codePoint - 0x40;
  if (codePoint >= 0x52 && codePoint <= 0x5a) return 0x0035 + codePoint - 0x52;
  if (codePoint === 0x5f) return 0x0042;
  if (codePoint >= 0x61 && codePoint <= 0x70) return 0x0044 + codePoint - 0x61;
  if (codePoint >= 0x72 && codePoint <= 0x75) return 0x0055 + codePoint - 0x72;
  if (codePoint === 0x77) return 0x005a;
  if (codePoint >= 0x79 && codePoint <= 0x7a) return 0x005c + codePoint - 0x79;
  return null;
}

function asciiFallback(character: string) {
  return character
    .replace(/[Łł]/g, (value) => (value === "Ł" ? "L" : "l"))
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "?");
}

function helveticaRuns(text: string) {
  const runs: Array<{
    font: "standard" | "F5";
    text: string;
    hex: string;
  }> = [];

  function append(font: "standard" | "F5", character: string, hex = "") {
    const previous = runs[runs.length - 1];
    if (previous?.font === font) {
      previous.text += character;
      previous.hex += hex;
    } else {
      runs.push({ font, text: character, hex });
    }
  }

  for (const character of text) {
    const codePoint = character.codePointAt(0) || 0x3f;
    const cid = helveticaCid(codePoint);
    if (cid !== null) {
      append("F5", character, cid.toString(16).padStart(4, "0"));
      continue;
    }

    if (
      WIN_ANSI_BYTES.has(codePoint) ||
      (codePoint >= 0x20 && codePoint <= 0x7e) ||
      (codePoint >= 0xa0 && codePoint <= 0xff)
    ) {
      append("standard", character);
      continue;
    }

    for (const fallbackCharacter of asciiFallback(character)) {
      append("standard", fallbackCharacter);
    }
  }

  return runs;
}

function drawHelveticaText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  layoutFont: PDFFont
) {
  let currentX = x;

  helveticaRuns(text).forEach((run) => {
    if (run.font === "F5") {
      page.pushOperators(
        setFillingRgbColor(0, 0, 0),
        beginText(),
        moveText(currentX, y),
        setFontAndSize("F5", size),
        showText(PDFHexString.of(run.hex)),
        endText()
      );
    } else {
      page.drawText(run.text, {
        x: currentX,
        y,
        size,
        font: layoutFont,
        color: rgb(0, 0, 0),
      });
    }

    currentX += layoutFont.widthOfTextAtSize(helveticaMetricsText(run.text), size);
  });
}

function helveticaMetricsText(value: string) {
  return asciiFallback(value)
    .replace(/[„”]/g, '"')
    .replace(/[–—]/g, "-");
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = cleanPdfText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;

    if (
      font.widthOfTextAtSize(helveticaMetricsText(candidate), size) <= maxWidth ||
      !currentLine
    ) {
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
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  lineHeight: number,
  font: PDFFont
) {
  wrapText(text, font, size, maxWidth).forEach((line, index) => {
    drawHelveticaText(page, line, x, y - index * lineHeight, size, font);
  });
}

export function drawCustomPaymentScheduleContractPages({
  paymentPage,
  realizationPage,
  layoutFont,
  schedule,
}: DrawCustomPaymentScheduleOptions) {
  if (!schedule.enabled) return;

  const area = {
    x: 28,
    y: 92,
    width: 539,
    height: 488,
    numberX: 54,
    textX: 72,
    maxTextWidth: 478,
  };
  paymentPage.drawRectangle({
    x: area.x,
    y: area.y,
    width: area.width,
    height: area.height,
    color: rgb(1, 1, 1),
  });

  const hasDeposit = hasCustomPaymentDeposit(schedule);
  const depositNote = hasDeposit
    ? "Każdorazowo kiedy w przypadku danej transzy mówimy o zadatku, to ma ona charakter zadatku w rozumieniu art. 394 Kodeksu cywilnego. Po wykonaniu Umowy zostają zaliczone na poczet wynagrodzenia. W razie ustawowego odstąpienia od Umowy stosuje się przepisy bezwzględnie obowiązujące oraz Załącznik nr 1."
    : "";
  const clauses = [
    {
      number: "5.",
      text: "Klient dokonuje płatności wszystkich transz wskazanych w harmonogramie bezpośrednio na rachunek bankowy Wykonawcy prowadzony przez mBank S.A. nr 33 1140 2004 0000 3302 8689 3030, każdorazowo podając w tytule numer Umowy lub faktury.",
    },
    {
      number: "6.",
      text: "Jeżeli Umowę zawarto podczas nieumówionej wizyty Wykonawcy w miejscu zamieszkania lub zwykłego pobytu Klienta, Wykonawca nie przyjmuje żadnej płatności przed upływem ustawowego terminu odstąpienia od Umowy.",
    },
    {
      number: "7.",
      text: "Strony ustalają, że instalacja pozostaje własnością Wykonawcy do czasu uiszczenia przez Klienta całego wynagrodzenia, z uwzględnieniem bezwzględnie obowiązujących przepisów. Postanowienie to nie uprawnia Wykonawcy do wejścia na nieruchomość ani do demontażu bez zgody Klienta lub właściwego rozstrzygnięcia.",
    },
  ];

  let fontSize = 8;
  let lineHeight = 9.25;
  let rowGap = 2.8;
  let sectionGap = 5.5;

  function createLayout() {
    return {
      heading: wrapText(
        "Klient dokonuje płatności według indywidualnego harmonogramu:",
        layoutFont,
        fontSize,
        area.maxTextWidth
      ),
      rows: schedule.installments.map((installment) =>
        wrapText(
          formatCustomPaymentInstallment(installment),
          layoutFont,
          fontSize,
          area.maxTextWidth - 12
        )
      ),
      deposit: depositNote
        ? wrapText(depositNote, layoutFont, fontSize, area.maxTextWidth)
        : [],
      clauses: clauses.map((clause) => ({
        ...clause,
        lines: wrapText(clause.text, layoutFont, fontSize, area.maxTextWidth),
      })),
    };
  }

  function layoutHeight(layout: ReturnType<typeof createLayout>) {
    const headingHeight = layout.heading.length * lineHeight + sectionGap;
    const rowsHeight =
      layout.rows.reduce((sum, lines) => sum + lines.length * lineHeight, 0) +
      Math.max(0, layout.rows.length - 1) * rowGap;
    const depositHeight = layout.deposit.length
      ? sectionGap + layout.deposit.length * lineHeight
      : 0;
    const clausesHeight = layout.clauses.reduce(
      (sum, clause) => sum + sectionGap + clause.lines.length * lineHeight,
      0
    );
    return headingHeight + rowsHeight + depositHeight + clausesHeight;
  }

  let layout = createLayout();
  while (layoutHeight(layout) > 405 && fontSize > 5.8) {
    fontSize -= 0.2;
    lineHeight = fontSize + 2.15;
    rowGap = Math.max(1.8, fontSize - 4.2);
    sectionGap = Math.max(3.5, fontSize - 1.5);
    layout = createLayout();
  }

  function drawLines(lines: string[], x: number, startY: number) {
    let currentY = startY;
    lines.forEach((line) => {
      drawHelveticaText(paymentPage, line, x, currentY, fontSize, layoutFont);
      currentY -= lineHeight;
    });
    return currentY;
  }

  let y = 529;
  drawHelveticaText(paymentPage, "4.", area.numberX, y, fontSize, layoutFont);
  y = drawLines(layout.heading, area.textX, y) - sectionGap;

  layout.rows.forEach((lines, index) => {
    drawHelveticaText(
      paymentPage,
      `${String.fromCharCode(97 + index)})`,
      area.textX,
      y,
      fontSize,
      layoutFont
    );
    y = drawLines(lines, area.textX + 18, y) - rowGap;
  });

  if (layout.deposit.length > 0) {
    y -= sectionGap - rowGap;
    y = drawLines(layout.deposit, area.textX, y);
  }

  layout.clauses.forEach((clause) => {
    y -= sectionGap;
    drawHelveticaText(
      paymentPage,
      clause.number,
      area.numberX,
      y,
      fontSize,
      layoutFont
    );
    y = drawLines(clause.lines, area.textX, y);
  });

  realizationPage.drawRectangle({
    x: 40,
    y: 730.5,
    width: 520,
    height: 41.5,
    color: rgb(1, 1, 1),
  });
  drawHelveticaText(realizationPage, "1.", 42.5, 751, 8, layoutFont);
  drawWrappedText(
    realizationPage,
    "Termin realizacji wynosi do 30 dni od zaksięgowania ostatniej transzy, której termin według harmonogramu przypada przed rozpoczęciem montażu; jeżeli harmonogram nie przewiduje takiej transzy - od podpisania Umowy.",
    72,
    751,
    478,
    8,
    9.25,
    layoutFont
  );
  drawHelveticaText(realizationPage, "2.", 42.5, 732.5, 8, layoutFont);
  drawHelveticaText(
    realizationPage,
    "Termin wskazany w punkcie 1. powyżej może zostać wydłużony w przypadku wystąpienia okoliczności niezależnych bezpośrednio od",
    72,
    732.5,
    8,
    layoutFont
  );
}
