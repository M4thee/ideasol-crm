import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument,
  PDFFont,
  PDFPage,
  rgb,
} from "pdf-lib";

export const TECHNICAL_SURVEY_DECLARATION =
  "Oświadczam, że podane przeze mnie informacje są zgodne ze stanem faktycznym, a miejsce montażu instalacji spełnia warunki umożliwiające jej prawidłowy i bezpieczny montaż oraz użytkowanie. Przyjmuję do wiadomości, że zatajenie lub nieujawnienie istotnych informacji dotyczących w szczególności stanu technicznego dachu, instalacji elektrycznej lub terenu przeznaczonego pod montaż może skutkować koniecznością uzgodnienia dodatkowych prac, zmianą terminu albo odmową wykonania prac, których nie można bezpiecznie lub zgodnie z prawem wykonać. Postanowienie to nie wyłącza odpowiedzialności Wykonawcy za brak należytej staranności.";

const MAX_SNAPSHOT_BYTES = 1_500_000;
const MAX_MEDIA_ITEMS = 24;
const MEDIA_DATA_KEYS = new Set([
  "base64",
  "contentBase64",
  "dataUrl",
  "imageData",
  "imageBase64",
]);
const STRUCTURAL_KEYS = new Set([
  "answers",
  "attachments",
  "cableRoutes",
  "declarationAccepted",
  "declarationAcceptedAt",
  "media",
  "photos",
  "products",
  "roofSketch",
  "routes",
  "scope",
  "sections",
]);

type JsonObject = Record<string, unknown>;

export type TechnicalSurveyInstallationPlace = "roof" | "ground";

export type TechnicalSurveyAnswer = {
  label: string;
  value: string;
};

export type TechnicalSurveyRoute = {
  label: string;
  section: "B" | "D";
  insideMeters: number;
  facadeMeters: number;
  groundMeters: number;
  overheadMeters: number;
  totalMeters: number;
};

export type TechnicalSurveyMediaInput = {
  key: string;
  role: "roofSketch" | "photo";
  id: string;
  version: string;
  category: string;
  description: string;
  mimeType: string;
  documentId: string | null;
  storagePath: string | null;
  inlineData: string | null;
};

export type ResolvedTechnicalSurveyMedia = {
  key: string;
  role: "roofSketch" | "photo";
  id: string;
  version: string;
  category: string;
  description: string;
  mimeType: "image/png" | "image/jpeg";
  bytes: Buffer;
  sha256: string;
  storagePath: string | null;
};

export type NormalizedTechnicalSurvey = {
  sanitizedInput: JsonObject;
  hasPv: boolean;
  hasMe: boolean;
  pvInstallationPlace: TechnicalSurveyInstallationPlace | null;
  declarationAcceptedAt: string;
  preparedBy: { id: string; name: string };
  sections: Record<"A" | "B" | "C" | "D", TechnicalSurveyAnswer[]>;
  routes: TechnicalSurveyRoute[];
  media: TechnicalSurveyMediaInput[];
};

export type TechnicalSurveySnapshot = JsonObject & {
  _ideaSign: {
    schemaVersion: 1;
    declarationAcceptedAt: string;
    preparedBy: { id: string; name: string };
    scope: {
      pv: boolean;
      me: boolean;
      pvInstallationPlace: TechnicalSurveyInstallationPlace | null;
    };
    media: Array<{
      id: string;
      version: string;
      role: "roofSketch" | "photo";
      category: string;
      description: string;
      mimeType: string;
      sha256: string;
      storagePath: string | null;
    }>;
  };
};

export class TechnicalSurveyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TechnicalSurveyValidationError";
  }
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, max = 2_000) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);
}

function normalizedToken(value: unknown) {
  return text(value, 200)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function readBoolean(value: unknown): boolean {
  if (value === true || value === 1) return true;
  const token = normalizedToken(value);
  return ["1", "tak", "true", "yes", "on", "selected", "included"].includes(token);
}

function nestedValue(source: JsonObject, paths: string[][]) {
  for (const parts of paths) {
    let current: unknown = source;
    for (const part of parts) {
      if (!isObject(current)) {
        current = undefined;
        break;
      }
      current = current[part];
    }
    if (current !== undefined && current !== null && current !== "") return current;
  }
  return undefined;
}

function productObjectSelected(value: unknown, tokens: string[]) {
  if (readBoolean(value)) return true;
  if (isObject(value)) {
    for (const key of ["selected", "enabled", "included", "active"] as const) {
      if (value[key] !== undefined) return readBoolean(value[key]);
    }
    if (tokens.some((token) => normalizedToken(value.type).includes(token))) return true;
    // W natywnym formularzu sam obiekt konfiguracji produktu oznacza, że produkt
    // należy do zakresu. Pusty obiekt nie jest wystarczającym wskazaniem.
    return Object.keys(value).length > 0;
  }
  return false;
}

function productsContain(value: unknown, tokens: string[]) {
  if (!Array.isArray(value)) return false;
  return value.some((item) => {
    if (typeof item === "string") {
      const token = normalizedToken(item);
      return tokens.some((candidate) => token.includes(candidate));
    }
    if (!isObject(item)) return false;
    const label = normalizedToken(item.type ?? item.code ?? item.name ?? item.productType);
    return tokens.some((candidate) => label.includes(candidate)) &&
      !["false", "nie", "0"].includes(normalizedToken(item.selected ?? true));
  });
}

function resolveProductScope(source: JsonObject) {
  const products = isObject(source.products) ? source.products : {};
  const scope = isObject(source.scope) ? source.scope : {};
  const productList = Array.isArray(source.products)
    ? source.products
    : source.selectedProducts ?? source.productTypes;

  const hasPv =
    productObjectSelected(products.pv, ["pv", "fotowolta"]) ||
    productObjectSelected(source.pv, ["pv", "fotowolta"]) ||
    readBoolean(source.hasPv ?? source.includesPv ?? scope.pv) ||
    productsContain(productList, ["pv", "fotowolta"]);

  const hasMe =
    productObjectSelected(products.me, ["me", "magazyn", "storage", "battery"]) ||
    productObjectSelected(products.energyStorage, ["me", "magazyn", "storage", "battery"]) ||
    productObjectSelected(source.me ?? source.energyStorage, ["me", "magazyn", "storage", "battery"]) ||
    readBoolean(source.hasMe ?? source.includesMe ?? scope.me ?? scope.energyStorage) ||
    productsContain(productList, ["me", "magazyn", "storage", "battery"]);

  return { hasPv, hasMe };
}

function resolveInstallationPlace(source: JsonObject): TechnicalSurveyInstallationPlace | null {
  const raw = nestedValue(source, [
    ["pvInstallationPlace"],
    ["installationPlace"],
    ["pvLocation"],
    ["scope", "pvInstallationPlace"],
    ["products", "pv", "installationPlace"],
    ["products", "pv", "location"],
    ["pv", "installationPlace"],
    ["pv", "location"],
  ]);
  if (isObject(raw)) {
    if (readBoolean(raw.roof ?? raw.dach)) return "roof";
    if (readBoolean(raw.ground ?? raw.grunt)) return "ground";
  }
  const token = normalizedToken(raw);
  if (token.includes("roof") || token.includes("dach")) return "roof";
  if (token.includes("ground") || token.includes("grunt")) return "ground";
  return null;
}

function sectionFromArray(sections: unknown, id: "A" | "B" | "C" | "D") {
  if (!Array.isArray(sections)) return undefined;
  return sections.find((item) => {
    if (!isObject(item)) return false;
    return normalizedToken(item.id ?? item.code ?? item.section) === id.toLowerCase();
  });
}

function sectionSource(source: JsonObject, id: "A" | "B" | "C" | "D") {
  const sections = source.sections;
  const aliases: Record<typeof id, string[]> = {
    A: ["A", "a", "currentData", "existingData", "existingInfrastructure", "sectionA"],
    B: ["B", "b", "plannedPv", "plannedInstallationPv", "photovoltaics", "sectionB"],
    C: ["C", "c", "roof", "roofConstruction", "sectionC"],
    D: ["D", "d", "energyStorage", "battery", "sectionD"],
  };
  if (isObject(sections)) {
    for (const alias of aliases[id]) {
      if (sections[alias] !== undefined) return sections[alias];
    }
  }
  const arraySection = sectionFromArray(sections, id);
  if (arraySection !== undefined) {
    return isObject(arraySection) && arraySection.answers !== undefined
      ? arraySection.answers
      : arraySection;
  }
  for (const alias of aliases[id]) {
    if (source[alias] !== undefined) return source[alias];
  }
  return undefined;
}

const LABELS: Record<string, string> = {
  osd: "OSD / sprzedawca",
  seller: "Sprzedawca energii",
  comprehensiveagreement: "Umowa kompleksowa",
  existinginstallation: "Istniejąca mikroinstalacja",
  existingpv: "Istniejąca instalacja PV",
  existingpowerkw: "Moc istniejącej instalacji [kW]",
  panelcount: "Liczba paneli",
  panels: "Panele - producent i model",
  inverter: "Falownik - producent i model",
  energystorage: "Magazyn energii",
  propertyaccess: "Wjazd do posesji",
  phases: "Liczba faz",
  connectionpowerkw: "Moc przyłączeniowa [kW]",
  premetersafetyamps: "Zabezpieczenie przedlicznikowe [A]",
  meterlocation: "Lokalizacja licznika",
  connectionpoint: "Miejsce przyłączenia",
  invertertype: "Rodzaj inwertera",
  inverterlocation: "Miejsce inwertera / zabezpieczeń",
  groundinfrastructure: "Infrastruktura w gruncie",
  groundstructure: "Struktura gruntu",
  shading: "Możliwe zacienienia",
  internet: "Internet w miejscu urządzeń",
  buildingheight: "Wysokość budynku [m]",
  liftaccess: "Możliwość wjazdu zwyżki",
  lightningprotection: "Instalacja odgromowa",
  roofslopecount: "Liczba połaci",
  rooforientation: "Orientacja połaci",
  roofcovering: "Pokrycie dachu",
  roofstructure: "Konstrukcja dachu",
  rafterspacing: "Rozstaw krokwi [cm]",
  storageinstallationplace: "Miejsce montażu magazynu",
  storageexpansionmethod: "Sposób rozbudowy",
  backup: "Układ rezerwy / agregat",
  notes: "Uwagi",
};

function labelForKey(key: string) {
  const normalized = key
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
  if (LABELS[normalized]) return LABELS[normalized];
  return key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function scalarAnswer(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value ? "Tak" : "Nie";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  if (typeof value === "string") return text(value);
  if (Array.isArray(value) && value.every((item) => ["string", "number", "boolean"].includes(typeof item))) {
    const result = value.map((item) => scalarAnswer(item)).filter(Boolean).join(", ");
    return result || null;
  }
  return null;
}

function flattenAnswers(
  value: unknown,
  entries: TechnicalSurveyAnswer[] = [],
  prefix = "",
  depth = 0
) {
  if (depth > 6 || entries.length >= 240 || value === null || value === undefined) return entries;
  if (Array.isArray(value)) {
    for (const item of value) {
      if (isObject(item)) {
        const label = text(item.label ?? item.question ?? item.title ?? item.name, 300);
        const answer = scalarAnswer(item.answer ?? item.value ?? item.response);
        if (label && answer !== null) {
          entries.push({ label, value: answer });
          continue;
        }
      }
      flattenAnswers(item, entries, prefix, depth + 1);
    }
    return entries;
  }
  if (!isObject(value)) return entries;

  const directLabel = text(value.label ?? value.question ?? value.title, 300);
  const directAnswer = scalarAnswer(value.answer ?? value.value ?? value.response);
  if (directLabel && directAnswer !== null) {
    entries.push({ label: directLabel, value: directAnswer });
    return entries;
  }

  for (const [key, child] of Object.entries(value)) {
    if (STRUCTURAL_KEYS.has(key) || MEDIA_DATA_KEYS.has(key)) continue;
    const label = prefix ? `${prefix} - ${labelForKey(key)}` : labelForKey(key);
    const answer = scalarAnswer(child);
    if (answer !== null) {
      entries.push({ label, value: answer });
    } else if (isObject(child) || Array.isArray(child)) {
      flattenAnswers(child, entries, label, depth + 1);
    }
    if (entries.length >= 240) break;
  }
  return entries;
}

function numberValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? Math.max(0, value) : 0;
  const parsed = Number(text(value, 40).replace(",", ".").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function segmentValue(route: JsonObject, aliases: string[]) {
  const segments = isObject(route.segments) ? route.segments : route;
  for (const alias of aliases) {
    if (segments[alias] !== undefined) return numberValue(segments[alias]);
  }
  return 0;
}

function routeSection(route: JsonObject, label: string): "B" | "D" {
  const token = normalizedToken(route.section ?? route.scope ?? route.product ?? label);
  return token.includes("magaz") || token.includes("storage") || token.includes("battery") || token === "d"
    ? "D"
    : "B";
}

function collectRoutes(source: JsonObject, sectionB: unknown, sectionD: unknown) {
  const candidates: unknown[] = [
    source.routes,
    source.cableRoutes,
    isObject(sectionB) ? sectionB.routes ?? sectionB.cableRoutes : undefined,
    isObject(sectionD) ? sectionD.routes ?? sectionD.cableRoutes : undefined,
  ];
  const routes: TechnicalSurveyRoute[] = [];
  for (const candidate of candidates) {
    const items = Array.isArray(candidate)
      ? candidate
      : isObject(candidate)
        ? Object.entries(candidate).map(([key, value]) => isObject(value) ? { name: key, ...value } : null)
        : [];
    for (const item of items) {
      if (!isObject(item)) continue;
      const label = text(item.label ?? item.name ?? item.title ?? item.type, 180) || `Trasa ${routes.length + 1}`;
      const insideMeters = segmentValue(item, ["insideMeters", "insideBuildingMeters", "inside", "internal", "wewnatrz"]);
      const facadeMeters = segmentValue(item, ["facadeMeters", "facade", "elevation", "elewacja"]);
      const groundMeters = segmentValue(item, ["groundMeters", "ground", "underground", "grunt"]);
      const overheadMeters = segmentValue(item, ["overheadMeters", "overhead", "air", "napowietrznie"]);
      if (![insideMeters, facadeMeters, groundMeters, overheadMeters].some((value) => value > 0)) continue;
      const totalMeters = Math.round(
        (insideMeters + facadeMeters + groundMeters + overheadMeters) * 100
      ) / 100;
      routes.push({
        label,
        section: routeSection(item, label),
        insideMeters,
        facadeMeters,
        groundMeters,
        overheadMeters,
        totalMeters,
      });
    }
  }
  return routes.slice(0, 30);
}

function mediaInput(
  value: unknown,
  role: "roofSketch" | "photo",
  index: number
): TechnicalSurveyMediaInput | null {
  if (typeof value === "string") {
    const inlineData = value.startsWith("data:image/") ? value : null;
    return {
      key: `${role}-${index + 1}`,
      role,
      id: `${role}-${index + 1}`,
      version: "1",
      category: role === "roofSketch" ? "Szkic dachu" : "Zdjęcie",
      description: "",
      mimeType: "",
      documentId: null,
      storagePath: inlineData ? null : text(value, 1_000),
      inlineData,
    };
  }
  if (!isObject(value)) return null;
  const id = text(
    value.id ?? value.photoId ?? value.mediaId ?? value.documentId ?? value.saleDocumentId,
    180
  ) || `${role}-${index + 1}`;
  const version = text(
    value.version ?? value.revision ?? value.updatedAt ?? value.updated_at,
    180
  ) || "1";
  const category = text(value.category ?? value.type ?? value.label, 200) ||
    (role === "roofSketch" ? "Szkic dachu" : "Zdjęcie");
  const description = text(value.description ?? value.caption ?? value.note, 1_000);
  const inlineData = text(
    value.dataUrl ?? value.contentBase64 ?? value.imageBase64 ?? value.imageData ?? value.base64,
    20_000_000
  ) || null;
  return {
    key: `${role}-${index + 1}`,
    role,
    id,
    version,
    category,
    description,
    mimeType: text(value.mimeType ?? value.contentType, 100).toLowerCase(),
    documentId: text(value.documentId ?? value.saleDocumentId ?? value.photoId, 80) || null,
    storagePath: text(
      value.storagePath ?? value.storage_path ?? value.filePath ?? value.file_path ?? value.path,
      1_000
    ) || null,
    inlineData,
  };
}

function collectMedia(source: JsonObject, sectionC: unknown) {
  const mediaRoot = isObject(source.media) ? source.media : {};
  const attachments = isObject(source.attachments) ? source.attachments : {};
  const documentation = isObject(source.documentation) ? source.documentation : {};
  const looseMedia = Array.isArray(source.media)
    ? source.media
    : Array.isArray(source.attachments)
      ? source.attachments
      : [];
  const looseSketch = looseMedia.find((item) =>
    isObject(item) && ["sketch", "szkic"].some((token) =>
      normalizedToken(item.role ?? item.type ?? item.category).includes(token)
    )
  );
  const loosePhotos = looseMedia.filter((item) => item !== looseSketch);
  const rawPhotos = source.photos ?? mediaRoot.photos ?? attachments.photos ??
    documentation.photos ?? loosePhotos;
  const photos = (Array.isArray(rawPhotos) ? rawPhotos : rawPhotos ? [rawPhotos] : [])
    .map((item, index) => mediaInput(item, "photo", index))
    .filter((item): item is TechnicalSurveyMediaInput => Boolean(item));
  const rawSketch = source.roofSketch ?? mediaRoot.roofSketch ??
    (isObject(sectionC) ? sectionC.roofSketch ?? sectionC.sketch : undefined) ?? looseSketch;
  const sketch = rawSketch ? mediaInput(rawSketch, "roofSketch", 0) : null;
  const result = [...(sketch ? [sketch] : []), ...photos];
  if (result.length > MAX_MEDIA_ITEMS) {
    throw new TechnicalSurveyValidationError(`Ankieta może zawierać maksymalnie ${MAX_MEDIA_ITEMS} pliki graficzne.`);
  }
  return result;
}

function sanitizeSnapshot(value: unknown, depth = 0): unknown {
  if (depth > 12) return "[pominięto zbyt głęboką strukturę]";
  if (Array.isArray(value)) return value.map((item) => sanitizeSnapshot(item, depth + 1));
  if (!isObject(value)) {
    if (typeof value === "string") return text(value, 20_000);
    if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
    return null;
  }
  const result: JsonObject = {};
  for (const [key, child] of Object.entries(value)) {
    if (MEDIA_DATA_KEYS.has(key)) continue;
    result[key.slice(0, 200)] = sanitizeSnapshot(child, depth + 1);
  }
  return result;
}

export function normalizeTechnicalSurvey(
  input: unknown,
  context: {
    acceptedAt: string;
    preparedBy: { id: string; name: string };
  }
): NormalizedTechnicalSurvey {
  if (!isObject(input)) {
    throw new TechnicalSurveyValidationError("Brak ankiety technicznej technicalSurvey.");
  }
  if (input.declarationAccepted !== true) {
    throw new TechnicalSurveyValidationError("Przed utworzeniem transakcji zaakceptuj oświadczenie ankiety technicznej.");
  }
  const { hasPv, hasMe } = resolveProductScope(input);
  if (!hasPv && !hasMe) {
    throw new TechnicalSurveyValidationError("Ankieta techniczna musi obejmować co najmniej jeden produkt: PV lub magazyn energii.");
  }
  const pvInstallationPlace = resolveInstallationPlace(input);
  if (hasPv && !pvInstallationPlace) {
    throw new TechnicalSurveyValidationError("Dla instalacji PV wskaż miejsce montażu: dach albo grunt.");
  }
  const sanitizedInput = sanitizeSnapshot(input) as JsonObject;
  if (Buffer.byteLength(JSON.stringify(sanitizedInput), "utf8") > MAX_SNAPSHOT_BYTES) {
    throw new TechnicalSurveyValidationError("Snapshot ankiety technicznej jest zbyt duży.");
  }
  const sourceA = sectionSource(input, "A");
  const sourceB = sectionSource(input, "B");
  const sourceC = sectionSource(input, "C");
  const sourceD = sectionSource(input, "D");
  return {
    sanitizedInput,
    hasPv,
    hasMe,
    pvInstallationPlace,
    declarationAcceptedAt: context.acceptedAt,
    preparedBy: {
      id: text(context.preparedBy.id, 80),
      name: text(context.preparedBy.name, 200),
    },
    sections: {
      A: flattenAnswers(sourceA),
      B: hasPv ? flattenAnswers(sourceB) : [],
      C: hasPv && pvInstallationPlace === "roof" ? flattenAnswers(sourceC) : [],
      D: hasMe ? flattenAnswers(sourceD) : [],
    },
    routes: collectRoutes(input, sourceB, sourceD),
    media: collectMedia(input, sourceC),
  };
}

export function buildTechnicalSurveySnapshot(
  survey: NormalizedTechnicalSurvey,
  media: ResolvedTechnicalSurveyMedia[]
): TechnicalSurveySnapshot {
  return {
    ...survey.sanitizedInput,
    _ideaSign: {
      schemaVersion: 1,
      declarationAcceptedAt: survey.declarationAcceptedAt,
      preparedBy: survey.preparedBy,
      scope: {
        pv: survey.hasPv,
        me: survey.hasMe,
        pvInstallationPlace: survey.pvInstallationPlace,
      },
      media: media.map((item) => ({
        id: item.id,
        version: item.version,
        role: item.role,
        category: item.category,
        description: item.description,
        mimeType: item.mimeType,
        sha256: item.sha256,
        storagePath: item.storagePath,
      })),
    },
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "long",
    timeStyle: "medium",
    timeZone: "Europe/Warsaw",
  }).format(new Date(value));
}

function wrapText(font: PDFFont, value: string, size: number, maxWidth: number) {
  const words = value.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

async function embedMedia(pdf: PDFDocument, item: ResolvedTechnicalSurveyMedia) {
  try {
    return item.mimeType === "image/png"
      ? await pdf.embedPng(item.bytes)
      : await pdf.embedJpg(item.bytes);
  } catch {
    throw new TechnicalSurveyValidationError(`Nie udało się osadzić obrazu „${item.category}” w ankiecie.`);
  }
}

export async function generateTechnicalSurveyPdf(params: {
  survey: NormalizedTechnicalSurvey;
  media: ResolvedTechnicalSurveyMedia[];
  contractNumber: string;
  clientName: string;
  installationAddress: string;
}) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [regularBytes, logoBytes] = await Promise.all([
    readFile(path.join(process.cwd(), "public", "fonts", "NotoSans-Regular.ttf")),
    readFile(path.join(process.cwd(), "public", "logo.png")),
  ]);
  const regular = await pdf.embedFont(regularBytes, { subset: false });
  const bold = await pdf.embedFont(regularBytes, { subset: false });
  const logo = await pdf.embedPng(logoBytes);
  const PAGE = { width: 595.28, height: 841.89, margin: 42 };
  const contentWidth = PAGE.width - PAGE.margin * 2;
  const navy = rgb(0.02, 0.08, 0.18);
  const blue = rgb(0.02, 0.36, 0.82);
  const green = rgb(0.05, 0.55, 0.36);
  const muted = rgb(0.36, 0.43, 0.54);
  const line = rgb(0.84, 0.87, 0.91);
  const panel = rgb(0.965, 0.975, 0.99);
  let page!: PDFPage;
  let y = 0;

  const addPage = () => {
    page = pdf.addPage([PAGE.width, PAGE.height]);
    const logoScale = logo.scale(0.032);
    page.drawImage(logo, {
      x: PAGE.margin,
      y: PAGE.height - 55,
      width: logoScale.width,
      height: logoScale.height,
    });
    page.drawText("IdeaSol Sp. z o.o.", {
      x: PAGE.margin + 31,
      y: PAGE.height - 37,
      size: 8.5,
      font: bold,
      color: navy,
    });
    page.drawText("Załącznik nr 4 – Ankieta techniczna", {
      x: PAGE.margin + 31,
      y: PAGE.height - 50,
      size: 7.5,
      font: regular,
      color: muted,
    });
    page.drawLine({
      start: { x: PAGE.margin, y: PAGE.height - 66 },
      end: { x: PAGE.width - PAGE.margin, y: PAGE.height - 66 },
      color: line,
      thickness: 0.8,
    });
    y = PAGE.height - 88;
  };

  const ensure = (height: number) => {
    if (y - height < 86) addPage();
  };

  const drawWrapped = (
    value: string,
    options: {
      font?: PDFFont;
      size?: number;
      color?: ReturnType<typeof rgb>;
      x?: number;
      width?: number;
      lineHeight?: number;
    } = {}
  ) => {
    const selectedFont = options.font || regular;
    const size = options.size || 9;
    const width = options.width || contentWidth;
    const x = options.x ?? PAGE.margin;
    const lineHeight = options.lineHeight || size * 1.38;
    const lines = wrapText(selectedFont, value, size, width);
    ensure(lines.length * lineHeight + 4);
    for (const row of lines) {
      page.drawText(row, { x, y, size, font: selectedFont, color: options.color || navy });
      y -= lineHeight;
    }
    return lines.length * lineHeight;
  };

  const drawSectionTitle = (title: string) => {
    ensure(42);
    y -= 7;
    page.drawRectangle({
      x: PAGE.margin,
      y: y - 18,
      width: contentWidth,
      height: 24,
      color: panel,
      borderColor: line,
      borderWidth: 0.6,
    });
    page.drawText(title, {
      x: PAGE.margin + 10,
      y: y - 10,
      size: 10,
      font: bold,
      color: blue,
    });
    y -= 34;
  };

  const drawAnswer = (answer: TechnicalSurveyAnswer, index: number) => {
    const labelWidth = 208;
    const valueWidth = contentWidth - labelWidth - 18;
    const labelLines = wrapText(bold, answer.label, 7.6, labelWidth - 14);
    const valueLines = wrapText(regular, answer.value, 8.2, valueWidth - 14);
    const height = Math.max(labelLines.length * 10.5, valueLines.length * 11.2) + 14;
    ensure(height + 2);
    page.drawRectangle({
      x: PAGE.margin,
      y: y - height,
      width: contentWidth,
      height,
      color: index % 2 === 0 ? rgb(1, 1, 1) : rgb(0.985, 0.989, 0.996),
      borderColor: line,
      borderWidth: 0.45,
    });
    page.drawLine({
      start: { x: PAGE.margin + labelWidth, y },
      end: { x: PAGE.margin + labelWidth, y: y - height },
      color: line,
      thickness: 0.45,
    });
    let labelY = y - 12;
    for (const row of labelLines) {
      page.drawText(row, { x: PAGE.margin + 7, y: labelY, size: 7.6, font: bold, color: navy });
      labelY -= 10.5;
    }
    let valueY = y - 12;
    for (const row of valueLines) {
      page.drawText(row, { x: PAGE.margin + labelWidth + 7, y: valueY, size: 8.2, font: regular, color: navy });
      valueY -= 11.2;
    }
    y -= height;
  };

  const drawSection = (title: string, answers: TechnicalSurveyAnswer[]) => {
    drawSectionTitle(title);
    if (!answers.length) {
      drawWrapped("Brak dodatkowych odpowiedzi w tej sekcji.", { size: 8.5, color: muted });
      y -= 5;
      return;
    }
    answers.forEach(drawAnswer);
    y -= 6;
  };

  const drawRoutes = (section: "B" | "D") => {
    const routes = params.survey.routes.filter((route) => route.section === section);
    if (!routes.length) return;
    ensure(58);
    drawWrapped("Automatycznie obliczone sumy tras", { font: bold, size: 9.2, color: green });
    y -= 3;
    routes.forEach((route, index) => {
      drawAnswer({
        label: route.label,
        value: `Wewnątrz: ${route.insideMeters} m | Elewacja: ${route.facadeMeters} m | Grunt: ${route.groundMeters} m | Napowietrznie: ${route.overheadMeters} m | SUMA: ${route.totalMeters} m`,
      }, index);
    });
    y -= 6;
  };

  const drawImagePage = async (item: ResolvedTechnicalSurveyMedia, heading: string) => {
    addPage();
    drawSectionTitle(heading);
    drawWrapped(item.category, { font: bold, size: 10, color: navy });
    if (item.description) {
      drawWrapped(item.description, { size: 8.5, color: muted });
    }
    y -= 8;
    const image = await embedMedia(pdf, item);
    const maxHeight = y - 90;
    const scale = Math.min(contentWidth / image.width, maxHeight / image.height, 1);
    const width = image.width * scale;
    const height = image.height * scale;
    page.drawRectangle({
      x: PAGE.margin,
      y: y - height - 8,
      width: contentWidth,
      height: height + 16,
      color: rgb(0.97, 0.975, 0.985),
      borderColor: line,
      borderWidth: 0.8,
    });
    page.drawImage(image, {
      x: PAGE.margin + (contentWidth - width) / 2,
      y: y - height,
      width,
      height,
    });
    y -= height + 24;
  };

  addPage();
  page.drawText("ZAŁĄCZNIK NR 4", {
    x: PAGE.margin,
    y,
    size: 9,
    font: bold,
    color: green,
  });
  y -= 27;
  page.drawText("Ankieta techniczna", {
    x: PAGE.margin,
    y,
    size: 22,
    font: bold,
    color: navy,
  });
  y -= 31;
  drawWrapped("Integralna część pakietu podpisywanego elektronicznie w systemie IdeaSign.", {
    size: 9,
    color: muted,
  });
  y -= 13;
  const identity: TechnicalSurveyAnswer[] = [
    { label: "Numer umowy", value: text(params.contractNumber, 180) || "-" },
    { label: "Klient", value: text(params.clientName, 300) || "-" },
    { label: "Miejsce montażu", value: text(params.installationAddress, 600) || "-" },
    { label: "Ankietę sporządził(a)", value: params.survey.preparedBy.name || "-" },
    { label: "Data sporządzenia i akceptacji oświadczenia", value: formatDate(params.survey.declarationAcceptedAt) },
    {
      label: "Zakres",
      value: [
        params.survey.hasPv
          ? `PV - ${params.survey.pvInstallationPlace === "roof" ? "dach" : "grunt"}`
          : "",
        params.survey.hasMe ? "Magazyn energii" : "",
      ].filter(Boolean).join(", "),
    },
  ];
  identity.forEach(drawAnswer);
  y -= 10;

  drawSection("A - Dane obecne", params.survey.sections.A);
  if (params.survey.hasPv) {
    drawSection("B - Planowana instalacja PV", params.survey.sections.B);
    drawRoutes("B");
  }
  if (params.survey.hasPv && params.survey.pvInstallationPlace === "roof") {
    drawSection("C - Konstrukcja dachowa", params.survey.sections.C);
  }
  if (params.survey.hasMe) {
    drawSection("D - Magazyn energii", params.survey.sections.D);
    drawRoutes("D");
  }

  const sketch = params.media.find((item) => item.role === "roofSketch");
  if (sketch && params.survey.hasPv && params.survey.pvInstallationPlace === "roof") {
    await drawImagePage(sketch, "C - Szkic dachu");
  }
  for (const photo of params.media.filter((item) => item.role === "photo")) {
    await drawImagePage(photo, "Dokumentacja zdjęciowa");
  }

  const statementLines = wrapText(regular, TECHNICAL_SURVEY_DECLARATION, 8.2, contentWidth);
  const statementHeight = statementLines.length * 11.4 + 145;
  ensure(statementHeight);
  drawSectionTitle("Oświadczenie");
  drawWrapped(TECHNICAL_SURVEY_DECLARATION, { size: 8.2, lineHeight: 11.4, color: navy });
  y -= 18;
  page.drawLine({
    start: { x: PAGE.margin, y: 112 },
    end: { x: PAGE.width - PAGE.margin, y: 112 },
    color: line,
    thickness: 0.8,
  });
  const signatureColumns = [
    { x: PAGE.margin, width: 160, label: "Przedstawiciel Wykonawcy" },
    { x: PAGE.margin + 175, width: 160, label: "Klient 1" },
    { x: PAGE.margin + 350, width: 160, label: "Klient 2" },
  ];
  signatureColumns.forEach((column) => {
    page.drawLine({
      start: { x: column.x, y: 51 },
      end: { x: column.x + column.width, y: 51 },
      color: muted,
      thickness: 0.6,
    });
    page.drawText(column.label, {
      x: column.x,
      y: 38,
      size: 6.3,
      font: regular,
      color: muted,
    });
  });

  const pages = pdf.getPages();
  pages.forEach((current, index) => {
    current.drawText(`${index + 1} / ${pages.length}`, {
      x: PAGE.width - PAGE.margin - 25,
      y: 18,
      size: 6.5,
      font: regular,
      color: muted,
    });
  });
  pdf.setTitle("Załącznik nr 4 – Ankieta techniczna");
  pdf.setSubject("Ankieta techniczna stanowiąca integralną część umowy IdeaSol");
  pdf.setAuthor("IdeaSol Sp. z o.o.");
  pdf.setCreator("IdeaSign");
  pdf.setProducer("IdeaSign");
  return Buffer.from(await pdf.save());
}

