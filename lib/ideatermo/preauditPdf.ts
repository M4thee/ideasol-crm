import { readFile } from "node:fs/promises";
import path from "node:path";

import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB,
} from "pdf-lib";

import {
  BUILDING_STOREY_OPTIONS,
  BUILDING_TYPE_OPTIONS,
  CURRENT_FUEL_OPTIONS,
  CURRENT_HEATING_PERFORMANCE_OPTIONS,
  EXTERNAL_DOOR_OPTIONS,
  BASEMENT_COVERAGE_OPTIONS,
  FOOTPRINT_SHAPE_OPTIONS,
  FUEL_CONSUMPTION_BASIS_OPTIONS,
  HEATED_LEVEL_LABELS,
  HEATING_DISTRIBUTION_OPTIONS,
  HEAT_SOURCE_OPTIONS,
  INSULATION_MATERIAL_OPTIONS,
  PLANNED_HEAT_SOURCE_OPTIONS,
  ROOF_TYPE_OPTIONS,
  WALL_MATERIAL_OPTIONS,
  WINDOW_GLAZING_OPTIONS,
  WOOD_SEASONING_OPTIONS,
  WOOD_TYPE_OPTIONS,
  getOptionLabel,
  getWindowKindLabel,
  type HeatedLevelValue,
} from "@/lib/ideatermo/preauditFields";

type PdfRecord = Record<string, unknown>;
type InfoItem = { label: string; value: unknown; span?: 2 };
type Writer = {
  document: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  logo: PDFImage | null;
  y: number;
  pageTitle: string;
  pageTitles: Map<PDFPage, string>;
};

const W = 595.28;
const H = 841.89;
const M = 42;
const CONTENT_W = W - M * 2;
const BOTTOM = 48;

const COLORS = {
  ink: rgb(0.08, 0.12, 0.2),
  muted: rgb(0.36, 0.42, 0.5),
  line: rgb(0.86, 0.89, 0.93),
  soft: rgb(0.97, 0.98, 0.99),
  accent: rgb(0.255, 0.549, 0.937),
  accentDark: rgb(0.157, 0.392, 0.714),
  accentSoft: rgb(0.949, 0.969, 1),
  accentBorder: rgb(0.62, 0.77, 0.98),
  blue: rgb(0.157, 0.392, 0.714),
  blueSoft: rgb(0.949, 0.969, 1),
  green: rgb(0.12, 0.52, 0.24),
  white: rgb(1, 1, 1),
  warningSoft: rgb(1, 0.97, 0.88),
  soil: rgb(0.85, 0.82, 0.77),
  unheated: rgb(0.9, 0.92, 0.95),
};

function clean(value: unknown, fallback = "Brak danych") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value).replace(/[–—‑]/g, "-").replace(/\s+/g, " ").trim();
}

function toFiniteNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value: number, maximumFractionDigits = 2) {
  return value.toLocaleString("pl-PL", { maximumFractionDigits });
}

function wrap(value: unknown, font: PDFFont, size: number, maxWidth: number) {
  const input = clean(value, "");
  if (!input) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of input.split(" ")) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function drawWrappedAt(
  page: PDFPage,
  font: PDFFont,
  value: unknown,
  x: number,
  y: number,
  width: number,
  size: number,
  lineHeight: number,
  color: RGB = COLORS.ink
) {
  const lines = wrap(value, font, size, width);
  lines.forEach((line, index) => {
    page.drawText(line, {
      x,
      y: y - index * lineHeight,
      size,
      font,
      color,
    });
  });
  return { lines, bottom: y - lines.length * lineHeight };
}

function optionLabel(
  options: readonly { value: string; label: string }[],
  value: unknown,
  fallback = "Brak danych"
) {
  return clean(getOptionLabel(options, value, fallback));
}

function yesNo(value: unknown) {
  return value === true ? "Tak" : value === false ? "Nie" : "Nie wskazano";
}

function heatedLevelsText(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return "Nie wskazano";
  const labels = value.flatMap((level) => {
    if (typeof level !== "string") return [];
    const label = HEATED_LEVEL_LABELS[level as HeatedLevelValue];
    return label ? [clean(label)] : [];
  });
  return labels.length ? labels.join(", ") : "Nie wskazano";
}

function dimensionRows(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return ["Brak wymiarów"];
  return value.map((dimension, index) => {
    const record =
      dimension && typeof dimension === "object"
        ? (dimension as PdfRecord)
        : {};
    return `${index + 1}. ${clean(record.width_cm, "-")} x ${clean(
      record.height_cm,
      "-"
    )} cm`;
  });
}

function doorText(value: unknown, legacyType: unknown) {
  if (!Array.isArray(value) || value.length === 0) return [];
  return value.map((door, index) => {
    const record = door && typeof door === "object" ? (door as PdfRecord) : {};
    const type = record.type || legacyType;
    return {
      label: `${index + 1}. ${optionLabel(
        EXTERNAL_DOOR_OPTIONS,
        type,
        "Nie wybrano rodzaju"
      )}`,
      dimensions: `${clean(record.width_cm, "-")} x ${clean(
        record.height_cm,
        "-"
      )} cm`,
    };
  });
}

function wallSurfaceDetails(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    return { rows: [] as string[], totalAreaM2: null as number | null };
  }

  let totalAreaM2 = 0;
  let hasArea = false;
  const rows = value.map((surface, index) => {
    const record =
      surface && typeof surface === "object" ? (surface as PdfRecord) : {};
    const width = toFiniteNumber(record.width_m);
    const height = toFiniteNumber(record.height_m);
    const manualArea = toFiniteNumber(record.manual_area_m2);
    const storedArea = toFiniteNumber(record.area_m2);
    const isManual = record.area_mode === "manual" || manualArea !== null;
    const area =
      storedArea ??
      (isManual
        ? manualArea
        : width !== null && height !== null
          ? width * height
          : null);

    if (area !== null) {
      totalAreaM2 += area;
      hasArea = true;
    }

    return isManual
      ? `${index + 1}. Powierzchnia wpisana ręcznie: ${
          area === null ? "-" : formatNumber(area)
        } m²`
      : `${index + 1}. ${width === null ? "-" : formatNumber(width)} x ${
          height === null ? "-" : formatNumber(height)
        } m = ${area === null ? "-" : formatNumber(area)} m²`;
  });

  return { rows, totalAreaM2: hasArea ? totalAreaM2 : null };
}

function insulationLayersText(
  value: unknown,
  legacyMaterial: unknown,
  legacyThicknessCm: unknown,
  maxLayers: number
) {
  const layers = Array.isArray(value) ? value.slice(0, maxLayers) : [];
  if (!layers.length && (legacyMaterial || legacyThicknessCm)) {
    layers.push({
      material: legacyMaterial || "unknown",
      thickness_cm: legacyThicknessCm,
    });
  }
  if (!layers.length) return "Brak izolacji";

  return layers
    .map((layer, index) => {
      const record =
        layer && typeof layer === "object" ? (layer as PdfRecord) : {};
      const material =
        record.material === "__other__"
          ? clean(record.custom_material, "Inny materiał")
          : optionLabel(
              INSULATION_MATERIAL_OPTIONS,
              record.material,
              "Nieznany materiał"
            );
      const thickness = toFiniteNumber(record.thickness_cm);
      return `${index + 1}. ${material} - ${
        thickness === null
          ? "grubość niepodana"
          : `${formatNumber(thickness)} cm`
      }`;
    })
    .join("; ");
}

async function loadLogo(document: PDFDocument) {
  try {
    const bytes = await readFile(
      path.join(process.cwd(), "public", "brand", "ideatermo-logo.jpg")
    );
    return await document.embedJpg(bytes);
  } catch {
    return null;
  }
}

function drawPageHeader(
  page: PDFPage,
  font: PDFFont,
  logo: PDFImage | null,
  title: string
) {
  page.drawRectangle({
    x: 0,
    y: H - 72,
    width: W,
    height: 72,
    color: COLORS.white,
  });
  page.drawRectangle({
    x: 0,
    y: H - 75,
    width: W,
    height: 3,
    color: COLORS.accent,
  });

  if (logo) {
    page.drawImage(logo, {
      x: M - 4,
      y: H - 66,
      width: 54,
      height: 54,
    });
  } else {
    page.drawText("IdeaTermo", {
      x: M,
      y: H - 43,
      size: 14,
      font,
      color: COLORS.accentDark,
    });
  }

  page.drawText(clean(title).toUpperCase(), {
    x: 128,
    y: H - 34,
    size: 15,
    font,
    color: COLORS.ink,
  });
  page.drawText("IdeaTermo - konfigurator", {
    x: 128,
    y: H - 53,
    size: 8.8,
    font,
    color: COLORS.muted,
  });
}

function addPage(writer: Writer, title: string) {
  const isFirstContentPage = writer.pageTitles.size === 0;
  writer.page = writer.document.addPage([W, H]);
  writer.pageTitle = title;
  writer.pageTitles.set(writer.page, title);
  drawPageHeader(
    writer.page,
    writer.font,
    isFirstContentPage ? writer.logo : null,
    title
  );

  writer.y = H - 124;
}

function ensureSpace(writer: Writer, needed: number, continuationTitle?: string) {
  if (writer.y - needed >= BOTTOM) return false;
  const baseTitle = writer.pageTitle.replace(/(?: - (?:ciąg dalszy|cd\.))+$/i, "");
  addPage(writer, continuationTitle || `${baseTitle} - cd.`);
  return true;
}

function sectionHeader(writer: Writer, title: string, subtitle?: string) {
  const height = subtitle ? 48 : 34;
  ensureSpace(writer, height + 10);
  writer.page.drawRectangle({
    x: M,
    y: writer.y - height,
    width: CONTENT_W,
    height,
    color: COLORS.ink,
  });
  writer.page.drawRectangle({
    x: M,
    y: writer.y - height,
    width: 6,
    height,
    color: COLORS.accent,
  });
  writer.page.drawText(clean(title), {
    x: M + 17,
    y: writer.y - 22,
    size: 13,
    font: writer.font,
    color: COLORS.white,
  });
  if (subtitle) {
    writer.page.drawText(clean(subtitle), {
      x: M + 17,
      y: writer.y - 38,
      size: 8.2,
      font: writer.font,
      color: rgb(0.78, 0.82, 0.88),
    });
  }
  writer.y -= height + 10;
}

function messageCard(
  writer: Writer,
  value: string,
  color = COLORS.blue,
  background = COLORS.blueSoft
) {
  const lines = wrap(value, writer.font, 9.5, CONTENT_W - 42);
  const height = Math.max(46, 24 + lines.length * 13);
  ensureSpace(writer, height + 10);
  writer.page.drawRectangle({
    x: M,
    y: writer.y - height,
    width: CONTENT_W,
    height,
    color: background,
    borderColor: color,
    borderWidth: 1,
  });
  writer.page.drawCircle({
    x: M + 18,
    y: writer.y - 22,
    size: 5,
    color,
  });
  drawWrappedAt(
    writer.page,
    writer.font,
    value,
    M + 33,
    writer.y - 20,
    CONTENT_W - 48,
    9.5,
    13,
    COLORS.ink
  );
  writer.y -= height + 10;
}

function infoCard(writer: Writer, items: InfoItem[]) {
  const groups: InfoItem[][] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item.span === 2 || !items[index + 1] || items[index + 1].span === 2) {
      groups.push([item]);
    } else {
      groups.push([item, items[index + 1]]);
      index += 1;
    }
  }

  const innerWidth = CONTENT_W - 28;
  const groupHeights = groups.map((group) => {
    const columnWidth = group.length === 1 ? innerWidth : (innerWidth - 28) / 2;
    return Math.max(
      ...group.map((item) => {
        const lines = wrap(item.value, writer.font, 9.5, columnWidth);
        return Math.max(38, 22 + lines.length * 12);
      })
    );
  });
  const height = 18 + groupHeights.reduce((sum, value) => sum + value, 0);
  ensureSpace(writer, height + 10);
  const top = writer.y;
  const bottom = top - height;

  writer.page.drawRectangle({
    x: M,
    y: bottom,
    width: CONTENT_W,
    height,
    color: COLORS.soft,
    borderColor: COLORS.line,
    borderWidth: 1,
  });

  let rowTop = top - 9;
  groups.forEach((group, groupIndex) => {
    const rowHeight = groupHeights[groupIndex];
    const columnWidth =
      group.length === 1 ? innerWidth : (innerWidth - 28) / 2;
    group.forEach((item, columnIndex) => {
      const x = M + 14 + columnIndex * (columnWidth + 28);
      writer.page.drawText(clean(item.label).toUpperCase(), {
        x,
        y: rowTop - 10,
        size: 7.1,
        font: writer.font,
        color: COLORS.muted,
      });
      drawWrappedAt(
        writer.page,
        writer.font,
        item.value,
        x,
        rowTop - 26,
        columnWidth,
        9.5,
        12,
        COLORS.ink
      );
      if (columnIndex === 0 && group.length === 2) {
        const dividerX = M + 14 + columnWidth + 14;
        writer.page.drawLine({
          start: { x: dividerX, y: rowTop - rowHeight + 4 },
          end: { x: dividerX, y: rowTop - 4 },
          thickness: 0.6,
          color: COLORS.line,
        });
      }
    });
    rowTop -= rowHeight;
    if (groupIndex < groups.length - 1) {
      writer.page.drawLine({
        start: { x: M + 14, y: rowTop + 2 },
        end: { x: W - M - 14, y: rowTop + 2 },
        thickness: 0.6,
        color: COLORS.line,
      });
    }
  });

  writer.y = bottom - 10;
}

function checklist(writer: Writer, items: string[]) {
  const values = items.length ? items : ["Nie wskazano zakresu prac"];
  const columns = 2;
  const rows = Math.ceil(values.length / columns);
  const rowHeight = 40;
  const height = rows * rowHeight + 16;
  ensureSpace(writer, height + 10);

  writer.page.drawRectangle({
    x: M,
    y: writer.y - height,
    width: CONTENT_W,
    height,
    color: COLORS.accentSoft,
    borderColor: COLORS.accentBorder,
    borderWidth: 1,
  });

  const columnWidth = (CONTENT_W - 28) / 2;
  values.forEach((value, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = M + 14 + column * columnWidth;
    const y = writer.y - 18 - row * rowHeight;
    writer.page.drawCircle({ x: x + 7, y: y - 3, size: 7, color: COLORS.accent });
    writer.page.drawLine({
      start: { x: x + 3.5, y: y - 3 },
      end: { x: x + 6.2, y: y - 6 },
      thickness: 1.3,
      color: COLORS.white,
    });
    writer.page.drawLine({
      start: { x: x + 6.2, y: y - 6 },
      end: { x: x + 11, y: y + 1 },
      thickness: 1.3,
      color: COLORS.white,
    });
    drawWrappedAt(
      writer.page,
      writer.font,
      value,
      x + 22,
      y,
      columnWidth - 32,
      9.2,
      11.5,
      COLORS.ink
    );
  });
  writer.y -= height + 10;
}

function simpleTable(
  writer: Writer,
  headers: string[],
  rows: string[][],
  widths: number[],
  rowHeight = 28
) {
  const height = rowHeight * (rows.length + 1);
  ensureSpace(writer, height + 10);
  const top = writer.y;
  let x = M;

  headers.forEach((header, index) => {
    const width = widths[index];
    writer.page.drawRectangle({
      x,
      y: top - rowHeight,
      width,
      height: rowHeight,
      color: COLORS.ink,
    });
    drawWrappedAt(
      writer.page,
      writer.font,
      header,
      x + 7,
      top - 18,
      width - 14,
      8.1,
      10,
      COLORS.white
    );
    x += width;
  });

  rows.forEach((row, rowIndex) => {
    x = M;
    const rowTop = top - rowHeight * (rowIndex + 1);
    row.forEach((value, columnIndex) => {
      const width = widths[columnIndex];
      writer.page.drawRectangle({
        x,
        y: rowTop - rowHeight,
        width,
        height: rowHeight,
        color: rowIndex % 2 === 0 ? COLORS.soft : COLORS.white,
        borderColor: COLORS.line,
        borderWidth: 0.6,
      });
      drawWrappedAt(
        writer.page,
        writer.font,
        value,
        x + 7,
        rowTop - 18,
        width - 14,
        8.7,
        10.5,
        COLORS.ink
      );
      x += width;
    });
  });
  writer.y = top - height - 10;
}

function drawWindowDiagram(
  page: PDFPage,
  kindValue: unknown,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const kind = typeof kindValue === "string" ? kindValue : "1_fixed";
  const separatorIndex = kind.indexOf("_");
  const wings = Math.max(1, Math.min(3, Number(kind.slice(0, separatorIndex)) || 1));
  const operation = kind.slice(separatorIndex + 1);
  const sashWidth = width / wings;

  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: COLORS.white,
    borderColor: COLORS.blue,
    borderWidth: 1.6,
  });
  for (let index = 0; index < wings; index += 1) {
    const sashX = x + index * sashWidth;
    const centerX = sashX + sashWidth / 2;
    if (index > 0) {
      page.drawLine({
        start: { x: sashX, y },
        end: { x: sashX, y: y + height },
        thickness: 1.2,
        color: COLORS.blue,
      });
    }
    if (operation === "turn" || operation === "tilt_turn") {
      page.drawLine({
        start: { x: sashX + 4, y: y + height - 4 },
        end: { x: sashX + sashWidth - 4, y: y + height / 2 },
        thickness: 1,
        color: COLORS.accent,
      });
      page.drawLine({
        start: { x: sashX + sashWidth - 4, y: y + height / 2 },
        end: { x: sashX + 4, y: y + 4 },
        thickness: 1,
        color: COLORS.accent,
      });
    }
    if (operation === "tilt" || operation === "tilt_turn") {
      page.drawLine({
        start: { x: sashX + 4, y: y + 4 },
        end: { x: centerX, y: y + height - 4 },
        thickness: 0.9,
        color: COLORS.green,
        dashArray: operation === "tilt_turn" ? [3, 2] : undefined,
      });
      page.drawLine({
        start: { x: centerX, y: y + height - 4 },
        end: { x: sashX + sashWidth - 4, y: y + 4 },
        thickness: 0.9,
        color: COLORS.green,
        dashArray: operation === "tilt_turn" ? [3, 2] : undefined,
      });
    }
    if (operation === "fixed") {
      page.drawRectangle({
        x: sashX + 5,
        y: y + 5,
        width: sashWidth - 10,
        height: height - 10,
        borderColor: COLORS.muted,
        borderWidth: 0.8,
      });
    }
  }
}

function windowCard(writer: Writer, record: PdfRecord, index: number) {
  const dimensions = dimensionRows(record.dimensions);
  const dimensionLines = dimensions.flatMap((value) =>
    wrap(value, writer.font, 8.8, 300)
  );
  const height = Math.max(108, 58 + dimensionLines.length * 12);
  const moved = ensureSpace(writer, height + 10, "Stolarka - ciąg dalszy");
  if (moved) sectionHeader(writer, "9. Okna - ciąg dalszy");
  const top = writer.y;
  const bottom = top - height;

  writer.page.drawRectangle({
    x: M,
    y: bottom,
    width: CONTENT_W,
    height,
    color: COLORS.blueSoft,
    borderColor: rgb(0.63, 0.78, 0.91),
    borderWidth: 1,
  });
  drawWindowDiagram(writer.page, record.kind, M + 16, bottom + 20, 118, 66);
  writer.page.drawText(`${index + 1}. ${clean(getWindowKindLabel(record.kind))}`, {
    x: M + 154,
    y: top - 24,
    size: 10.7,
    font: writer.font,
    color: COLORS.blue,
  });
  writer.page.drawText(`Liczba okien: ${dimensions.length}`, {
    x: M + 154,
    y: top - 43,
    size: 8.2,
    font: writer.font,
    color: COLORS.muted,
  });
  dimensionLines.forEach((line, lineIndex) => {
    writer.page.drawText(line, {
      x: M + 154,
      y: top - 62 - lineIndex * 12,
      size: 8.8,
      font: writer.font,
      color: COLORS.ink,
    });
  });
  writer.y = bottom - 10;
}

function doorsGrid(
  writer: Writer,
  doors: { label: string; dimensions: string }[]
) {
  const height = 102;
  const moved = ensureSpace(writer, height + 4, "Stolarka - ciąg dalszy");
  if (moved) sectionHeader(writer, "10. Drzwi - ciąg dalszy");
  const top = writer.y;
  const bottom = top - height;

  writer.page.drawRectangle({
    x: M,
    y: bottom,
    width: CONTENT_W,
    height,
    color: COLORS.accentSoft,
    borderColor: COLORS.accentBorder,
    borderWidth: 1,
  });
  const columnWidth = CONTENT_W / doors.length;
  doors.forEach((door, index) => {
    const columnX = M + index * columnWidth;
    if (index > 0) {
      writer.page.drawLine({
        start: { x: columnX, y: bottom + 10 },
        end: { x: columnX, y: top - 10 },
        thickness: 0.7,
        color: COLORS.accentBorder,
      });
    }
    writer.page.drawRectangle({
      x: columnX + 13,
      y: bottom + 20,
      width: 30,
      height: 60,
      color: COLORS.white,
      borderColor: COLORS.accentDark,
      borderWidth: 1.2,
    });
    writer.page.drawCircle({
      x: columnX + 38,
      y: bottom + 49,
      size: 1.8,
      color: COLORS.accent,
    });
    drawWrappedAt(
      writer.page,
      writer.font,
      door.label,
      columnX + 55,
      top - 31,
      columnWidth - 65,
      8.7,
      10.5,
      COLORS.accentDark
    );
    drawWrappedAt(
      writer.page,
      writer.font,
      `Wymiary: ${clean(door.dimensions)}`,
      columnX + 55,
      top - 61,
      columnWidth - 65,
      8.2,
      10,
      COLORS.ink
    );
  });
  writer.y = bottom - 4;
}

function drawBuildingShapePreview(writer: Writer, preaudit: PdfRecord) {
  const heated = new Set(
    Array.isArray(preaudit.heated_levels)
      ? preaudit.heated_levels.filter(
          (level): level is string => typeof level === "string"
        )
      : []
  );
  const floorCount = preaudit.building_storeys === "ground_plus_3"
    ? 3
    : preaudit.building_storeys === "ground_plus_2"
      ? 2
      : preaudit.building_storeys === "ground_plus_1"
        ? 1
        : 0;
  const hasBasement = preaudit.has_basement === true;
  const hasGarage = preaudit.has_integrated_garage === true;
  const roofType = clean(preaudit.roof_type, "pitched_without_attic");
  const height = 300;
  ensureSpace(writer, height + 10);
  const top = writer.y;
  const bottom = top - height;

  writer.page.drawRectangle({
    x: M,
    y: bottom,
    width: CONTENT_W,
    height,
    color: COLORS.soft,
    borderColor: COLORS.accentBorder,
    borderWidth: 1,
  });
  writer.page.drawText("SCHEMAT BUDYNKU", {
    x: M + 18,
    y: top - 25,
    size: 8,
    font: writer.font,
    color: COLORS.accentDark,
  });
  writer.page.drawText("Pogląd schematyczny - nie zachowuje skali", {
    x: M + 18,
    y: top - 42,
    size: 8.2,
    font: writer.font,
    color: COLORS.muted,
  });

  const mainWidth = 228;
  const garageWidth = hasGarage ? 96 : 0;
  const combinedWidth = mainWidth + garageWidth;
  const mainX = M + (CONTENT_W - combinedWidth) / 2;
  const groundY = bottom + (hasBasement ? 68 : 45);
  const levelHeight = 32;
  const basementHeight = 40;

  if (hasBasement) {
    writer.page.drawRectangle({
      x: M + 14,
      y: bottom + 18,
      width: CONTENT_W - 28,
      height: groundY - bottom - 18,
      color: COLORS.soil,
    });
  }

  const drawLevel = (
    key: string,
    label: string,
    y: number,
    options?: { basement?: boolean; width?: number; x?: number }
  ) => {
    const isHeated = heated.has(key);
    const x = options?.x ?? mainX;
    const width = options?.width ?? mainWidth;
    writer.page.drawRectangle({
      x,
      y,
      width,
      height: levelHeight,
      color: isHeated ? COLORS.accentSoft : options?.basement ? COLORS.soil : COLORS.unheated,
      borderColor: isHeated ? COLORS.accent : COLORS.muted,
      borderWidth: 1,
      borderDashArray: options?.basement ? [4, 2] : undefined,
    });
    if (isHeated) {
      writer.page.drawRectangle({
        x,
        y,
        width: 5,
        height: levelHeight,
        color: COLORS.accent,
      });
    }
    writer.page.drawText(label, {
      x: x + 13,
      y: y + 18,
      size: 8.8,
      font: writer.font,
      color: COLORS.ink,
    });
    writer.page.drawText(isHeated ? "OGRZEWANE" : "NIEOGRZEWANE", {
      x: x + 13,
      y: y + 7,
      size: 5.8,
      font: writer.font,
      color: isHeated ? COLORS.accentDark : COLORS.muted,
    });
    writer.page.drawRectangle({
      x: x + width - 32,
      y: y + 8,
      width: 11,
      height: 14,
      color: COLORS.white,
      borderColor: isHeated ? COLORS.accent : COLORS.muted,
      borderWidth: 0.7,
    });
    writer.page.drawRectangle({
      x: x + width - 17,
      y: y + 8,
      width: 11,
      height: 14,
      color: COLORS.white,
      borderColor: isHeated ? COLORS.accent : COLORS.muted,
      borderWidth: 0.7,
    });
  };

  if (hasBasement) {
    drawLevel("basement", "Piwnica", groundY - basementHeight, {
      basement: true,
    });
  }

  const levels = [
    { key: "ground_floor", label: "Parter" },
    ...Array.from({ length: floorCount }, (_, index) => ({
      key: `floor_${index + 1}`,
      label: `${index + 1}. piętro`,
    })),
  ];
  levels.forEach((level, index) => {
    drawLevel(level.key, level.label, groundY + index * levelHeight);
  });

  writer.page.drawLine({
    start: { x: mainX - 18, y: groundY },
    end: { x: mainX + combinedWidth + 18, y: groundY },
    thickness: 2.2,
    color: rgb(0.36, 0.27, 0.18),
  });
  writer.page.drawText("POZIOM GRUNTU", {
    x: mainX - 17,
    y: groundY - 12,
    size: 5.8,
    font: writer.font,
    color: rgb(0.36, 0.27, 0.18),
  });

  if (hasGarage) {
    drawLevel("garage", "Garaż", groundY, {
      width: garageWidth,
      x: mainX + mainWidth,
    });
  }

  const roofBaseY = groundY + levels.length * levelHeight;
  if (roofType === "flat") {
    writer.page.drawRectangle({
      x: mainX,
      y: roofBaseY,
      width: mainWidth,
      height: 14,
      color: COLORS.unheated,
      borderColor: COLORS.muted,
      borderWidth: 1.4,
    });
    writer.page.drawText("Dach płaski", {
      x: mainX + 86,
      y: roofBaseY + 4,
      size: 7,
      font: writer.font,
      color: COLORS.ink,
    });
  } else {
    const atticHeated = heated.has("attic");
    const roofColor = atticHeated ? COLORS.accent : COLORS.muted;
    writer.page.drawLine({
      start: { x: mainX, y: roofBaseY },
      end: { x: mainX + mainWidth / 2, y: roofBaseY + 46 },
      thickness: 2,
      color: roofColor,
    });
    writer.page.drawLine({
      start: { x: mainX + mainWidth / 2, y: roofBaseY + 46 },
      end: { x: mainX + mainWidth, y: roofBaseY },
      thickness: 2,
      color: roofColor,
    });
    writer.page.drawLine({
      start: { x: mainX, y: roofBaseY },
      end: { x: mainX + mainWidth, y: roofBaseY },
      thickness: 1,
      color: roofColor,
    });
    const roofLabel = roofType === "pitched_with_attic" ? "Poddasze" : "Dach skośny";
    writer.page.drawText(roofLabel, {
      x: mainX + mainWidth / 2 - writer.font.widthOfTextAtSize(roofLabel, 8.5) / 2,
      y: roofBaseY + 20,
      size: 8.5,
      font: writer.font,
      color: COLORS.ink,
    });
    if (roofType === "pitched_with_attic") {
      const status = atticHeated ? "OGRZEWANE" : "NIEOGRZEWANE";
      writer.page.drawText(status, {
        x: mainX + mainWidth / 2 - writer.font.widthOfTextAtSize(status, 5.8) / 2,
        y: roofBaseY + 9,
        size: 5.8,
        font: writer.font,
        color: atticHeated ? COLORS.accentDark : COLORS.muted,
      });
    }
  }

  const legendY = bottom + 10;
  writer.page.drawRectangle({
    x: M + 18,
    y: legendY,
    width: 9,
    height: 9,
    color: COLORS.accent,
  });
  writer.page.drawText("Ogrzewane", {
    x: M + 33,
    y: legendY + 1,
    size: 7.2,
    font: writer.font,
    color: COLORS.muted,
  });
  writer.page.drawRectangle({
    x: M + 105,
    y: legendY,
    width: 9,
    height: 9,
    color: COLORS.unheated,
    borderColor: COLORS.muted,
    borderWidth: 0.5,
  });
  writer.page.drawText("Nieogrzewane", {
    x: M + 120,
    y: legendY + 1,
    size: 7.2,
    font: writer.font,
    color: COLORS.muted,
  });

  writer.y = bottom - 10;
}

function assumptionsList(writer: Writer, values: unknown[]) {
  const items = values.length ? values : ["Brak dodatkowych założeń"];
  items.forEach((item, index) => {
    const lines = wrap(item, writer.font, 8.3, CONTENT_W - 52);
    const height = Math.max(22, 10 + lines.length * 10.5);
    const moved = ensureSpace(writer, height + 4, "Dobór mocy - ciąg dalszy");
    if (moved) sectionHeader(writer, "13. Założenia do oszacowania mocy - ciąg dalszy");
    writer.page.drawCircle({
      x: M + 13,
      y: writer.y - 11,
      size: 8,
      color: COLORS.blueSoft,
      borderColor: COLORS.blue,
      borderWidth: 0.8,
    });
    const marker = String(index + 1);
    writer.page.drawText(marker, {
      x: M + 13 - writer.font.widthOfTextAtSize(marker, 6.8) / 2,
      y: writer.y - 13.3,
      size: 6.8,
      font: writer.font,
      color: COLORS.blue,
    });
    drawWrappedAt(
      writer.page,
      writer.font,
      item,
      M + 34,
      writer.y - 8,
      CONTENT_W - 46,
      8.3,
      10.5,
      COLORS.ink
    );
    writer.y -= height + 4;
  });
}

export async function createIdeaTermoPreauditPdf(
  client: PdfRecord,
  preaudit: PdfRecord
) {
  const calculation = (preaudit.calculation || {}) as PdfRecord;
  const planned = Array.isArray(preaudit.planned_scope)
    ? preaudit.planned_scope.map((value) => clean(value))
    : [];
  const workScope =
    calculation.workScope && typeof calculation.workScope === "object"
      ? (calculation.workScope as PdfRecord)
      : {};
  const advancedEnergy =
    calculation.advancedEnergy && typeof calculation.advancedEnergy === "object"
      ? (calculation.advancedEnergy as PdfRecord)
      : {};
  const advancedSurvey =
    preaudit.advanced_survey && typeof preaudit.advanced_survey === "object"
      ? (preaudit.advanced_survey as PdfRecord)
      : {};
  const heatedLevels = Array.isArray(preaudit.heated_levels)
    ? preaudit.heated_levels
    : [];
  const hasUnheatedBasement =
    preaudit.has_basement === true && !heatedLevels.includes("basement");

  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const font = await document.embedFont(
    await readFile(
      path.join(process.cwd(), "public", "fonts", "DejaVuSans.ttf")
    ),
    { subset: false }
  );
  const logo = await loadLogo(document);
  const firstPage = document.addPage([W, H]);
  const writer: Writer = {
    document,
    page: firstPage,
    font,
    logo,
    y: H,
    pageTitle: "",
    pageTitles: new Map(),
  };

  addPage(writer, "Karta zakresu prac termomodernizacyjnych");
  document.removePage(0);

  const heroHeight = 78;
  writer.page.drawRectangle({
    x: M,
    y: writer.y - heroHeight,
    width: CONTENT_W,
    height: heroHeight,
    color: COLORS.accentSoft,
    borderColor: COLORS.accent,
    borderWidth: 1.2,
  });
  writer.page.drawText(clean(client.full_name || client.company_name, "Klient"), {
    x: M + 18,
    y: writer.y - 31,
    size: 18,
    font,
    color: COLORS.ink,
  });
  writer.page.drawText(
    `Data ankiety: ${clean(preaudit.audit_date)}   |   Numer: ${clean(
      client.public_id
    )}`,
    {
      x: M + 18,
      y: writer.y - 56,
      size: 9.2,
      font,
      color: COLORS.muted,
    }
  );
  writer.y -= heroHeight + 12;

  sectionHeader(writer, "1. Dane klienta");
  infoCard(writer, [
    {
      label: "Klient",
      value: client.full_name || client.company_name,
      span: 2,
    },
    { label: "Numer klienta", value: client.public_id },
    { label: "Data ankiety", value: preaudit.audit_date },
    { label: "Telefon", value: client.phone },
    { label: "E-mail", value: client.email },
    {
      label: "Adres",
      value: [
        client.street,
        client.building_number,
        client.postal_code,
        client.city,
      ]
        .filter(Boolean)
        .join(" "),
      span: 2,
    },
  ]);

  sectionHeader(writer, "2. Budynek i ogrzewane kondygnacje");
  infoCard(writer, [
    {
      label: "Typ budynku",
      value: optionLabel(BUILDING_TYPE_OPTIONS, preaudit.building_type),
    },
    {
      label: "Liczba kondygnacji",
      value: optionLabel(
        BUILDING_STOREY_OPTIONS,
        preaudit.building_storeys
      ),
    },
    {
      label: "Dach",
      value: optionLabel(ROOF_TYPE_OPTIONS, preaudit.roof_type),
    },
    { label: "Budynek podpiwniczony", value: yesNo(preaudit.has_basement) },
    {
      label: "Garaż w bryle budynku",
      value: yesNo(preaudit.has_integrated_garage),
    },
    {
      label: "Ogrzewane kondygnacje",
      value: heatedLevelsText(preaudit.heated_levels),
    },
    {
      label: "Powierzchnia ogrzewana",
      value: preaudit.heated_area_m2
        ? `${preaudit.heated_area_m2} m²`
        : null,
    },
    {
      label: "Powierzchnia całkowita",
      value: preaudit.total_building_area_m2
        ? `${preaudit.total_building_area_m2} m²`
        : null,
    },
    {
      label: "Liczba mieszkańców",
      value:
        Number(preaudit.household_members) >= 10
          ? "10+"
          : preaudit.household_members,
    },
  ]);

  addPage(writer, "Poglądowa bryła budynku");
  sectionHeader(
    writer,
    "2A. Poglądowa bryła budynku",
    "Schemat odzwierciedla liczbę kondygnacji, dach, piwnicę, garaż i ogrzewane poziomy."
  );
  drawBuildingShapePreview(writer, preaudit);
  if (advancedSurvey.enabled === true) {
    const basementArea = toFiniteNumber(
      advancedSurvey.partial_basement_area_m2
    );
    const geometryItems: InfoItem[] = [
      {
        label: "Kształt rzutu budynku",
        value: optionLabel(
          FOOTPRINT_SHAPE_OPTIONS,
          advancedSurvey.footprint_shape
        ),
      },
      {
        label: "Zakres podpiwniczenia",
        value: preaudit.has_basement
          ? optionLabel(
              BASEMENT_COVERAGE_OPTIONS,
              advancedSurvey.basement_coverage
            )
          : "Budynek bez piwnicy",
      },
    ];
    if (
      preaudit.has_basement === true &&
      advancedSurvey.basement_coverage === "partial"
    ) {
      geometryItems.push({
        label: "Powierzchnia piwnicy",
        value: basementArea === null ? "Nie podano" : `${formatNumber(basementArea)} m²`,
        span: 2,
      });
    }
    infoCard(writer, geometryItems);
  }

  addPage(writer, "Ogrzewanie i przegrody");
  sectionHeader(writer, "3. Ogrzewanie - stan obecny");
  const heatingItems: InfoItem[] = [
    {
      label: "Obecne źródło ciepła",
      value:
        preaudit.current_heat_source === "other"
          ? `Inne: ${clean(preaudit.heat_source_other)}`
          : optionLabel(HEAT_SOURCE_OPTIONS, preaudit.current_heat_source),
    },
    {
      label: "Moc znamionowa",
      value: preaudit.current_source_power_kw
        ? `${preaudit.current_source_power_kw} kW`
        : null,
    },
    {
      label: "Źródło przygotowuje CWU",
      value: yesNo(preaudit.current_source_heats_dhw),
    },
    {
      label: "Komfort podczas mrozów",
      value: optionLabel(
        CURRENT_HEATING_PERFORMANCE_OPTIONS,
        preaudit.current_heating_performance
      ),
    },
  ];
  if (preaudit.current_fuel_type) {
    heatingItems.push(
      {
        label: "Używany opał",
        value: optionLabel(CURRENT_FUEL_OPTIONS, preaudit.current_fuel_type),
      },
      {
        label: "Roczne zużycie opału",
        value: preaudit.annual_fuel_quantity
          ? `${preaudit.annual_fuel_quantity} ${
              preaudit.annual_fuel_unit === "m3" ? "m³" : "t"
            }/rok`
          : null,
      },
      {
        label: "Podstawa zużycia",
        value: optionLabel(
          FUEL_CONSUMPTION_BASIS_OPTIONS,
          preaudit.fuel_consumption_basis
        ),
      },
      {
        label: "Dodatkowe źródło ciepła",
        value: yesNo(preaudit.supplemental_heating_used),
      }
    );
    if (preaudit.current_fuel_type === "firewood") {
      heatingItems.push(
        {
          label: "Rodzaj drewna",
          value: optionLabel(WOOD_TYPE_OPTIONS, preaudit.wood_type),
        },
        {
          label: "Stopień wysuszenia",
          value: optionLabel(WOOD_SEASONING_OPTIONS, preaudit.wood_seasoning),
        }
      );
    }
  }
  infoCard(writer, heatingItems);

  sectionHeader(writer, "4. Przegrody - stan obecny");
  infoCard(writer, [
    {
      label: "Materiał i grubość ścian",
      value: `${optionLabel(
        WALL_MATERIAL_OPTIONS,
        preaudit.wall_material
      )}; ${clean(preaudit.wall_thickness_cm, "-")} cm`,
    },
    {
      label: "Warstwy izolacji ścian",
      value: insulationLayersText(
        preaudit.wall_insulation_layers,
        preaudit.wall_insulation_material,
        preaudit.wall_insulation_cm,
        4
      ),
    },
    {
      label: "Warstwy izolacji dachu / stropu",
      value: insulationLayersText(
        preaudit.roof_insulation_layers,
        preaudit.roof_insulation_material,
        preaudit.roof_insulation_cm,
        3
      ),
    },
    {
      label: hasUnheatedBasement
        ? "Warstwy izolacji stropu nad nieogrzewaną piwnicą"
        : "Warstwy izolacji podłogi na gruncie",
      value: insulationLayersText(
        preaudit.floor_insulation_layers,
        null,
        preaudit.floor_insulation_cm,
        3
      ),
    },
  ]);

  sectionHeader(writer, "5. Planowane nowe źródło ciepła");
  infoCard(writer, [
    {
      label: "Planowane źródło",
      value: optionLabel(
        PLANNED_HEAT_SOURCE_OPTIONS,
        preaudit.planned_heat_source
      ),
    },
    {
      label: "Nowe źródło przygotowuje CWU",
      value: yesNo(preaudit.planned_source_heats_dhw),
    },
    {
      label: "Sposób oddawania ciepła",
      value: optionLabel(
        HEATING_DISTRIBUTION_OPTIONS,
        preaudit.heating_distribution_type
      ),
    },
    {
      label: "Temperatura zasilania przy mrozie",
      value: preaudit.heating_supply_temperature_c
        ? `${preaudit.heating_supply_temperature_c}°C`
        : null,
    },
    {
      label: "Oczekiwana temperatura w budynku",
      value: preaudit.desired_indoor_temperature_c
        ? `${preaudit.desired_indoor_temperature_c}°C`
        : null,
      span: 2,
    },
  ]);

  addPage(writer, "Plan modernizacji");
  sectionHeader(writer, "6. Planowany zakres prac");
  checklist(writer, planned);

  sectionHeader(writer, "7. Docieplenie przegród");
  const plannedInsulation: InfoItem[] = [];
  if (planned.includes("Docieplenie ścian")) {
    plannedInsulation.push({
      label: "Planowana izolacja ścian",
      value: `${optionLabel(
        INSULATION_MATERIAL_OPTIONS,
        preaudit.planned_wall_insulation_material
      )}; ${clean(preaudit.planned_wall_insulation_cm, "-")} cm`,
    });
  }
  if (planned.includes("Docieplenie dachu / stropu")) {
    plannedInsulation.push({
      label: "Planowana izolacja dachu / stropu",
      value: `${optionLabel(
        INSULATION_MATERIAL_OPTIONS,
        preaudit.planned_roof_insulation_material
      )}; ${clean(preaudit.planned_roof_insulation_cm, "-")} cm; ${
        toFiniteNumber(workScope.roofAreaM2) === null
          ? "powierzchnia niepodana"
          : `${formatNumber(toFiniteNumber(workScope.roofAreaM2)!)} m²`
      }`,
    });
  }
  if (planned.includes("Docieplenie podłogi")) {
    plannedInsulation.push({
      label: hasUnheatedBasement
        ? "Planowana izolacja stropu nad piwnicą"
        : "Planowana izolacja podłogi",
      value: `${optionLabel(
        INSULATION_MATERIAL_OPTIONS,
        preaudit.planned_floor_insulation_material
      )}; ${clean(preaudit.planned_floor_insulation_cm, "-")} cm; ${
        toFiniteNumber(workScope.floorAreaM2) === null
          ? "powierzchnia niepodana"
          : `${formatNumber(toFiniteNumber(workScope.floorAreaM2)!)} m²`
      }`,
      span: plannedInsulation.length % 2 === 0 ? undefined : 2,
    });
  }
  if (plannedInsulation.length) infoCard(writer, plannedInsulation);
  else messageCard(writer, "Nie wskazano docieplenia przegród w zakresie prac.");

  sectionHeader(writer, "8. Ściany do docieplenia");
  const wallSurfaces = wallSurfaceDetails(preaudit.wall_insulation_surfaces);
  if (planned.includes("Docieplenie ścian") && wallSurfaces.rows.length) {
    simpleTable(
      writer,
      ["Lp.", "Wymiary / powierzchnia"],
      wallSurfaces.rows.map((value, index) => [String(index + 1), value.replace(/^\d+\.\s*/, "")]),
      [54, CONTENT_W - 54],
      30
    );
    messageCard(
      writer,
      `Łączna powierzchnia ścian: ${
        wallSurfaces.totalAreaM2 === null
          ? "brak danych"
          : `${formatNumber(wallSurfaces.totalAreaM2)} m²`
      }`,
      COLORS.accent,
      COLORS.accentSoft
    );
  } else {
    messageCard(writer, "Nie podano wymiarów ani powierzchni ścian.");
  }

  addPage(writer, "Stolarka okienna i drzwiowa");
  sectionHeader(
    writer,
    "9. Stolarka okienna",
    "Każdy wybrany typ pokazano wraz ze schematem otwierania i wymiarami."
  );
  infoCard(writer, [
    {
      label: "Stan obecnych okien",
      value: optionLabel(WINDOW_GLAZING_OPTIONS, preaudit.window_type),
    },
    {
      label: "Docelowe Uw nowych okien",
      value: preaudit.planned_window_u_value
        ? `${preaudit.planned_window_u_value} W/(m²·K)`
        : null,
    },
  ]);
  const windows = Array.isArray(preaudit.windows) ? preaudit.windows : [];
  if (planned.includes("Wymiana okien") && windows.length) {
    windows.forEach((windowGroup, index) => {
      const record =
        windowGroup && typeof windowGroup === "object"
          ? (windowGroup as PdfRecord)
          : {};
      windowCard(writer, record, index);
    });
  } else {
    messageCard(
      writer,
      planned.includes("Wymiana okien")
        ? "Nie wskazano rodzajów ani wymiarów okien."
        : "Wymiana okien nie została wybrana w zakresie prac."
    );
  }

  sectionHeader(
    writer,
    "10. Drzwi zewnętrzne",
    `Docelowe Ud nowych drzwi: ${
      preaudit.planned_door_u_value
        ? `${preaudit.planned_door_u_value} W/(m²·K)`
        : "brak danych"
    }`
  );
  const doors = doorText(preaudit.external_doors, preaudit.external_door_type);
  if (planned.includes("Wymiana drzwi") && doors.length) {
    doorsGrid(writer, doors);
  } else {
    messageCard(
      writer,
      planned.includes("Wymiana drzwi")
        ? "Nie wskazano rodzaju ani wymiarów drzwi."
        : "Wymiana drzwi nie została wybrana w zakresie prac."
    );
  }

  addPage(writer, "Zestawienie do wyceny");
  sectionHeader(
    writer,
    "11. Zestawienie prac dla wykonawcy",
    "Ilości i parametry wynikają z ankiety oraz pomiarów wpisanych przez handlowca."
  );
  const quoteRows: string[][] = [];
  if (planned.includes("Docieplenie ścian")) {
    quoteRows.push([
      "Docieplenie ścian",
      toFiniteNumber(workScope.wallAreaM2) === null
        ? "Powierzchnia niepodana"
        : `${formatNumber(toFiniteNumber(workScope.wallAreaM2)!)} m²`,
      `${optionLabel(INSULATION_MATERIAL_OPTIONS, preaudit.planned_wall_insulation_material)}; ${clean(preaudit.planned_wall_insulation_cm, "-")} cm`,
    ]);
  }
  if (planned.includes("Docieplenie dachu / stropu")) {
    quoteRows.push([
      "Docieplenie dachu / stropu",
      toFiniteNumber(workScope.roofAreaM2) === null
        ? "Powierzchnia niepodana"
        : `${formatNumber(toFiniteNumber(workScope.roofAreaM2)!)} m²`,
      `${optionLabel(INSULATION_MATERIAL_OPTIONS, preaudit.planned_roof_insulation_material)}; ${clean(preaudit.planned_roof_insulation_cm, "-")} cm`,
    ]);
  }
  if (planned.includes("Docieplenie podłogi")) {
    quoteRows.push([
      hasUnheatedBasement
        ? "Docieplenie stropu nad piwnicą"
        : "Docieplenie podłogi",
      toFiniteNumber(workScope.floorAreaM2) === null
        ? "Powierzchnia niepodana"
        : `${formatNumber(toFiniteNumber(workScope.floorAreaM2)!)} m²`,
      `${optionLabel(INSULATION_MATERIAL_OPTIONS, preaudit.planned_floor_insulation_material)}; ${clean(preaudit.planned_floor_insulation_cm, "-")} cm`,
    ]);
  }
  if (planned.includes("Wymiana okien")) {
    quoteRows.push([
      "Wymiana okien",
      `${clean(workScope.windowCount, "0")} szt.; ${
        toFiniteNumber(workScope.windowAreaM2) === null
          ? "powierzchnia niepodana"
          : `${formatNumber(toFiniteNumber(workScope.windowAreaM2)!)} m²`
      }`,
      `Docelowe Uw ${clean(preaudit.planned_window_u_value, "-")} W/(m²·K)`,
    ]);
  }
  if (planned.includes("Wymiana drzwi")) {
    quoteRows.push([
      "Wymiana drzwi",
      `${clean(workScope.doorCount, "0")} szt.; ${
        toFiniteNumber(workScope.doorAreaM2) === null
          ? "powierzchnia niepodana"
          : `${formatNumber(toFiniteNumber(workScope.doorAreaM2)!)} m²`
      }`,
      `Docelowe Ud ${clean(preaudit.planned_door_u_value, "-")} W/(m²·K)`,
    ]);
  }
  if (planned.includes("Modernizacja źródła ciepła")) {
    quoteRows.push([
      "Wymiana źródła ciepła",
      "1 komplet",
      `${optionLabel(HEAT_SOURCE_OPTIONS, preaudit.current_heat_source)} -> ${optionLabel(PLANNED_HEAT_SOURCE_OPTIONS, preaudit.planned_heat_source)}`,
    ]);
  }
  if (planned.includes("Modernizacja instalacji CO/CWU")) {
    quoteRows.push([
      "Modernizacja instalacji CO/CWU",
      "Zakres wg uwag",
      optionLabel(HEATING_DISTRIBUTION_OPTIONS, preaudit.heating_distribution_type),
    ]);
  }
  if (quoteRows.length) {
    simpleTable(
      writer,
      ["Zakres", "Ilość / powierzchnia", "Parametry"],
      quoteRows,
      [170, 130, CONTENT_W - 300],
      46
    );
  } else {
    messageCard(writer, "Nie wskazano prac do wyceny.");
  }

  sectionHeader(writer, "12. Wymiana źródła ciepła");
  if (planned.includes("Modernizacja źródła ciepła")) {
    const powerAvailable =
      toFiniteNumber(calculation.indicativeRequiredPowerKw) !== null &&
      toFiniteNumber(calculation.indicativePowerMinKw) !== null &&
      toFiniteNumber(calculation.indicativePowerMaxKw) !== null;
    infoCard(writer, [
      {
        label: "Źródło demontowane",
        value: optionLabel(HEAT_SOURCE_OPTIONS, preaudit.current_heat_source),
      },
      {
        label: "Źródło planowane",
        value: optionLabel(
          PLANNED_HEAT_SOURCE_OPTIONS,
          preaudit.planned_heat_source
        ),
      },
      {
        label: "Moc przyjęta do wyceny",
        value: powerAvailable
          ? `${formatNumber(toFiniteNumber(calculation.indicativeRequiredPowerKw)!)} kW`
          : "Do potwierdzenia po audycie",
      },
      {
        label: "Szacowany przedział (±15%)",
        value: powerAvailable
          ? `${formatNumber(toFiniteNumber(calculation.indicativePowerMinKw)!)}-${formatNumber(toFiniteNumber(calculation.indicativePowerMaxKw)!)} kW`
          : "Nie wyznaczono",
      },
      {
        label: "Sposób oddawania ciepła",
        value: optionLabel(
          HEATING_DISTRIBUTION_OPTIONS,
          preaudit.heating_distribution_type
        ),
      },
      {
        label: "Temperatura zasilania przy mrozie",
        value: preaudit.heating_supply_temperature_c
          ? `${preaudit.heating_supply_temperature_c}°C`
          : null,
      },
    ]);

    if (!powerAvailable) {
      const missing = Array.isArray(calculation.powerEstimateMissingInputs)
        ? calculation.powerEstimateMissingInputs.map((value) => clean(value)).join(", ")
        : "brak kompletu danych";
      messageCard(
        writer,
        `Nie podano mocy źródła, ponieważ ankieta nie zapewnia dokładności do ±15%. Brakuje: ${missing}.`,
        COLORS.accentDark,
        COLORS.warningSoft
      );
    } else {
      messageCard(
        writer,
        clean(
          calculation.disclaimer,
          "Przedział mocy służy wyłącznie do wstępnej wyceny i wymaga potwierdzenia przez audytora lub projektanta."
        ),
        COLORS.accentDark,
        COLORS.warningSoft
      );
    }

  } else {
    messageCard(writer, "Wymiana źródła ciepła nie została wybrana w zakresie prac.");
  }

  let sectionNumber = 13;
  if (advancedEnergy.enabled === true) {
    const currentRange =
      advancedEnergy.currentRange && typeof advancedEnergy.currentRange === "object"
        ? (advancedEnergy.currentRange as PdfRecord)
        : {};
    const postRange =
      advancedEnergy.postRange && typeof advancedEnergy.postRange === "object"
        ? (advancedEnergy.postRange as PdfRecord)
        : {};
    const reductionRange =
      advancedEnergy.reductionRange &&
      typeof advancedEnergy.reductionRange === "object"
        ? (advancedEnergy.reductionRange as PdfRecord)
        : {};
    const rangeText = (range: PdfRecord, suffix: string) =>
      toFiniteNumber(range.min) !== null && toFiniteNumber(range.max) !== null
        ? `${formatNumber(toFiniteNumber(range.min)!)}-${formatNumber(toFiniteNumber(range.max)!)} ${suffix}`
        : "Nie wyznaczono";

    sectionHeader(
      writer,
      `${sectionNumber}. Wstępna analiza energetyczna`,
      "Opcjonalny tryb zaawansowany - wynik wyłącznie dla zakresu prac wybranego w ankiecie."
    );
    infoCard(writer, [
      {
        label: "EU przed modernizacją",
        value: rangeText(currentRange, "kWh/(m²·rok)"),
      },
      {
        label: "EU po modernizacji",
        value: rangeText(postRange, "kWh/(m²·rok)"),
      },
      {
        label: "Szacowana redukcja",
        value: rangeText(reductionRange, "%"),
      },
      {
        label: "Pewność oszacowania",
        value: `${clean(advancedEnergy.confidence)}${
          toFiniteNumber(advancedEnergy.uncertaintyPercent) !== null
            ? `; margines ±${formatNumber(toFiniteNumber(advancedEnergy.uncertaintyPercent)!)}%`
            : ""
        }`,
      },
      {
        label: "Wstępna ocena warunku energetycznego",
        value: clean(advancedEnergy.programmeAssessmentLabel),
        span: 2,
      },
      {
        label: "Próg dochodowy i ocena łączna",
        value: clean(advancedEnergy.combinedAssessmentLabel),
        span: 2,
      },
    ]);
    messageCard(
      writer,
      clean(
        advancedEnergy.disclaimer,
        "Wynik jest wyłącznie orientacyjną kalkulacją ankietową i wymaga potwierdzenia w audycie oraz DPAE."
      ),
      COLORS.accentDark,
      COLORS.warningSoft
    );
    sectionNumber += 1;
  }

  const assumptions = Array.isArray(calculation.calculationAssumptions)
    ? calculation.calculationAssumptions
    : [];
  if (planned.includes("Modernizacja źródła ciepła") && assumptions.length) {
    sectionHeader(writer, `${sectionNumber}. Założenia do oszacowania mocy`);
    assumptionsList(writer, assumptions);
    sectionNumber += 1;
  }

  sectionHeader(writer, `${sectionNumber}. Uwagi dla wykonawcy`);
  messageCard(
    writer,
    clean(preaudit.notes, "Brak dodatkowych uwag."),
    COLORS.muted,
    COLORS.soft
  );
  sectionNumber += 1;

  sectionHeader(writer, `${sectionNumber}. Ważna informacja`);
  messageCard(
    writer,
    "Dokument służy do przekazania zakresu wykonawcy i przygotowania wyceny. Nie jest ofertą, umową, audytem energetycznym ani DPAE. Jeżeli włączono tryb zaawansowany, wynik EU i ocena programu są wyłącznie orientacyjne i nie stanowią decyzji o przyznaniu dotacji. Ostateczny zakres, wskaźniki energetyczne i dobór mocy źródła wymagają potwierdzenia po profesjonalnym audycie i ankiecie technicznej.",
    COLORS.accentDark,
    COLORS.warningSoft
  );

  const pages = document.getPages();
  pages.forEach((page, index) => {
    page.drawLine({
      start: { x: M, y: 34 },
      end: { x: W - M, y: 34 },
      thickness: 0.6,
      color: COLORS.line,
    });
    page.drawText("IdeaTermo | zakres prac do wyceny", {
      x: M,
      y: 20,
      size: 7.2,
      font,
      color: COLORS.muted,
    });
    const pageLabel = `Strona ${index + 1} z ${pages.length}`;
    page.drawText(pageLabel, {
      x: W - M - font.widthOfTextAtSize(pageLabel, 7.2),
      y: 20,
      size: 7.2,
      font,
      color: COLORS.muted,
    });
  });

  return document.save();
}
