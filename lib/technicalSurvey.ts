export const TECHNICAL_SURVEY_DECLARATION =
  "Oświadczam, że podane przeze mnie informacje są zgodne ze stanem faktycznym, a miejsce montażu instalacji spełnia warunki umożliwiające jej prawidłowy i bezpieczny montaż oraz użytkowanie. Przyjmuję do wiadomości, że zatajenie lub nieujawnienie istotnych informacji dotyczących w szczególności stanu technicznego dachu, instalacji elektrycznej lub terenu przeznaczonego pod montaż może skutkować koniecznością uzgodnienia dodatkowych prac, zmianą terminu albo odmową wykonania prac, których nie można bezpiecznie lub zgodnie z prawem wykonać. Postanowienie to nie wyłącza odpowiedzialności Wykonawcy za brak należytej staranności.";

export const TECHNICAL_SURVEY_ROOF_ORIENTATIONS = [
  "Wschód",
  "Południowy-wschód",
  "Południe",
  "Południowy-zachód",
  "Zachód",
] as const;

export type TechnicalSurveyRoofSlope = {
  id: string;
  orientation: string;
  angle: string;
  width: string;
  length: string;
  panelCount: string;
};

export type TechnicalSurveyPhoto = {
  id: string;
  documentId: string;
  version: string;
  category: string;
  description: string;
  mimeType: string;
  storagePath: string;
};

export type TechnicalSurvey = {
  version: 1;
  clientName: string;
  installationAddress: string;
  contractNumber: string;
  auditDate: string;
  auditor: string;
  scopes: string[];
  text: Record<string, string>;
  choices: Record<string, string[]>;
  roofSlopes: TechnicalSurveyRoofSlope[];
  photos: TechnicalSurveyPhoto[];
  photoChecklist: string[];
  technicalNotes: string;
  declarationAccepted: boolean;
  declarationText: string;
  sketchData: string;
  updatedAt: string;
};

type SurveySale = {
  sold_items?: unknown;
  offer_snapshot?: unknown;
  offer_data?: unknown;
};

type SurveyDefaults = {
  clientName?: unknown;
  installationAddress?: unknown;
  contractNumber?: unknown;
  auditor?: unknown;
  osdOperator?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function cleanText(value: unknown, max = 2_000) {
  return String(value ?? "").trim().slice(0, max);
}

function inferInstallationScope(sale: SurveySale) {
  const snapshot = asRecord(sale.offer_snapshot);
  const offerData = asRecord(snapshot.offer_data ?? sale.offer_data);
  const form = asRecord(offerData.form);
  const result = asRecord(offerData.result);
  const offerType = cleanText(
    snapshot.offer_type ??
      snapshot.offerType ??
      offerData.offer_type ??
      offerData.offerType ??
      form.offer_type ??
      form.offerType ??
      result.offer_type ??
      result.offerType,
    80
  ).toLowerCase();
  if (offerType === "storage") return { hasPv: false, hasStorage: true };
  if (offerType === "pv") return { hasPv: true, hasStorage: false };
  if (offerType.includes("pv") && offerType.includes("storage")) {
    return { hasPv: true, hasStorage: true };
  }
  const soldItems = cleanText(sale.sold_items, 2_000).toLowerCase();
  const hasPv =
    soldItems.includes("fotowolta") ||
    soldItems.includes("panel") ||
    /(^|\W)pv(\W|$)/.test(soldItems) ||
    Number(snapshot.pv_power_kw ?? result.pvPowerKw ?? 0) > 0;
  const storageName = cleanText(
    snapshot.storage_name ?? snapshot.energy_storage ?? result.energyStorage ?? result.storage,
    200
  ).toLowerCase();
  const hasStorage =
    soldItems.includes("magazyn energii") ||
    soldItems.includes("energy storage") ||
    (Boolean(storageName) && !storageName.includes("brak"));
  return { hasPv, hasStorage };
}

function stringArray(value: unknown) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => cleanText(item, 240)).filter(Boolean))];
  }
  const single = cleanText(value, 240);
  return single ? [single] : [];
}

function stringMap(value: unknown) {
  const source = asRecord(value);
  return Object.fromEntries(
    Object.entries(source).map(([key, item]) => [key, cleanText(item)])
  );
}

function choiceMap(value: unknown) {
  const source = asRecord(value);
  return Object.fromEntries(
    Object.entries(source).map(([key, item]) => [key, stringArray(item)])
  );
}

function dateString(value: unknown) {
  const raw = cleanText(value, 40);
  const parsed = raw ? new Date(raw) : new Date();
  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString()
    : parsed.toISOString();
}

function makeRoofSlopes(value?: unknown): TechnicalSurveyRoofSlope[] {
  const source = Array.isArray(value) ? value : [];
  return TECHNICAL_SURVEY_ROOF_ORIENTATIONS.map((orientation, index) => {
    const matching = source
      .map(asRecord)
      .find((item) => cleanText(item.orientation, 80) === orientation);
    const item = matching || asRecord(source[index]);
    return {
      id: cleanText(item.id, 80) || `roof-slope-${index + 1}`,
      orientation,
      angle: cleanText(item.angle, 40),
      width: cleanText(item.width, 40),
      length: cleanText(item.length, 40),
      panelCount: cleanText(item.panelCount ?? item.panel_count, 40),
    };
  });
}

function makePhotos(value?: unknown): TechnicalSurveyPhoto[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(asRecord)
    .map((item, index) => ({
      id: cleanText(item.id ?? item.documentId ?? item.document_id, 180) || `photo-${index + 1}`,
      documentId: cleanText(item.documentId ?? item.document_id ?? item.id, 180),
      version: cleanText(item.version ?? item.createdAt ?? item.created_at, 180) || "1",
      category: cleanText(item.category, 200) || "Zdjęcie ankiety technicznej",
      description: cleanText(item.description, 1_000),
      mimeType: cleanText(item.mimeType ?? item.mime_type ?? item.fileType ?? item.file_type, 100),
      storagePath: cleanText(item.storagePath ?? item.storage_path ?? item.filePath ?? item.file_path, 1_000),
    }))
    .filter((item) => item.documentId || item.storagePath);
}

export function createEmptyTechnicalSurvey(): TechnicalSurvey {
  const now = new Date().toISOString();
  return {
    version: 1,
    clientName: "",
    installationAddress: "",
    contractNumber: "",
    auditDate: now,
    auditor: "",
    scopes: [],
    text: {},
    choices: {},
    roofSlopes: makeRoofSlopes(),
    photos: [],
    photoChecklist: [],
    technicalNotes: "",
    declarationAccepted: false,
    declarationText: TECHNICAL_SURVEY_DECLARATION,
    sketchData: "",
    updatedAt: now,
  };
}

export function normalizeTechnicalSurvey(
  value: unknown,
  fallback?: Partial<TechnicalSurvey>
): TechnicalSurvey {
  const empty = createEmptyTechnicalSurvey();
  const source = asRecord(value);
  const base = { ...empty, ...fallback };
  const sourceText = stringMap(source.text);
  const sourceChoices = choiceMap(source.choices);
  const fallbackText = fallback?.text || {};
  const fallbackChoices = fallback?.choices || {};
  const scopes = stringArray(source.scopes);
  const normalizedChoices = {
    ...fallbackChoices,
    ...sourceChoices,
  };

  if (!normalizedChoices.products?.length && scopes.length) {
    normalizedChoices.products = scopes.flatMap((scope) => {
      const normalized = scope.toLowerCase();
      return [
        ...(normalized.includes("fotowolta") || normalized === "pv" ? ["PV"] : []),
        ...(normalized.includes("magazyn") || normalized === "me" ? ["ME"] : []),
      ];
    });
  }

  return {
    version: 1,
    clientName: cleanText(source.clientName ?? source.client_name ?? base.clientName, 240),
    installationAddress: cleanText(
      source.installationAddress ?? source.installation_address ?? base.installationAddress,
      600
    ),
    contractNumber: cleanText(
      source.contractNumber ?? source.contract_number ?? base.contractNumber,
      160
    ),
    auditDate: dateString(source.auditDate ?? source.audit_date ?? base.auditDate),
    auditor: cleanText(source.auditor ?? base.auditor, 240),
    scopes: scopes.length ? scopes : stringArray(base.scopes),
    text: { ...fallbackText, ...sourceText },
    choices: normalizedChoices,
    roofSlopes: makeRoofSlopes(source.roofSlopes ?? source.roof_slopes ?? base.roofSlopes),
    photos: makePhotos(source.photos ?? base.photos),
    photoChecklist: stringArray(
      source.photoChecklist ?? source.photo_checklist ?? base.photoChecklist
    ),
    technicalNotes: cleanText(
      source.technicalNotes ?? source.technical_notes ?? base.technicalNotes,
      8_000
    ),
    declarationAccepted:
      source.declarationAccepted === true || source.declaration_accepted === true,
    declarationText:
      cleanText(
        source.declarationText ?? source.declaration_text ?? base.declarationText,
        4_000
      ) || TECHNICAL_SURVEY_DECLARATION,
    sketchData: cleanText(source.sketchData ?? source.sketch_data ?? base.sketchData, 8_000_000),
    updatedAt: dateString(source.updatedAt ?? source.updated_at ?? base.updatedAt),
  };
}

function firstRecordPath(record: Record<string, unknown>, paths: string[][]) {
  for (const path of paths) {
    let current: unknown = record;
    for (const segment of path) current = asRecord(current)[segment];
    if (cleanText(current)) return current;
  }
  return "";
}

function roofLabel(value: unknown) {
  const normalized = cleanText(value, 80)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (normalized.includes("grunt") || normalized.includes("ground")) return "Grunt";
  if (normalized.includes("dachow")) return "Dachówka";
  if (normalized.includes("papa")) return "Papa";
  if (normalized.includes("blach")) return "Blacha";
  return cleanText(value, 120);
}

export function createTechnicalSurveyForSale(
  sale: SurveySale,
  existing: unknown,
  defaults: SurveyDefaults = {}
) {
  const scope = inferInstallationScope(sale);
  const saleRecord = asRecord(sale);
  const roofType = firstRecordPath(saleRecord, [
    ["offer_snapshot", "roof_type"],
    ["offer_snapshot", "roofType"],
    ["offer_snapshot", "offer_data", "form", "roofType"],
    ["offer_snapshot", "offer_data", "form", "roof_type"],
    ["offer_data", "form", "roofType"],
    ["offer_data", "form", "roof_type"],
  ]);
  const products = [scope.hasPv ? "PV" : "", scope.hasStorage ? "ME" : ""].filter(Boolean);
  const fallback = createEmptyTechnicalSurvey();
  fallback.clientName = cleanText(defaults.clientName, 240);
  fallback.installationAddress = cleanText(defaults.installationAddress, 600);
  fallback.contractNumber = cleanText(defaults.contractNumber, 160);
  fallback.auditor = cleanText(defaults.auditor, 240);
  fallback.scopes = products;
  fallback.choices.products = products;
  if (scope.hasPv) fallback.choices.pv_location = [roofLabel(roofType) === "Grunt" ? "Grunt" : "Dach"];
  fallback.text.client_name = fallback.clientName;
  fallback.text.installation_address = fallback.installationAddress;
  fallback.text.contract_number = fallback.contractNumber;
  fallback.text.auditor = fallback.auditor;
  fallback.text.osd_operator = cleanText(defaults.osdOperator, 80);
  fallback.text.roof_type_from_offer = roofLabel(roofType) || "Nie podano";
  return normalizeTechnicalSurvey(existing, fallback);
}

export function technicalSurveyHasProduct(survey: TechnicalSurvey, product: "PV" | "ME") {
  return survey.choices.products?.includes(product) === true;
}

export function getTechnicalSurveyChoice(survey: TechnicalSurvey, key: string) {
  return survey.choices[key]?.[0] || "";
}

export function technicalSurveyRouteTotal(survey: TechnicalSurvey, prefix: string) {
  return ["a", "b", "c", "d"].reduce((sum, suffix) => {
    const parsed = Number(String(survey.text[`${prefix}_${suffix}`] || "").replace(",", "."));
    return sum + (Number.isFinite(parsed) ? parsed : 0);
  }, 0);
}

export function validateTechnicalSurveyForSigning(survey: TechnicalSurvey) {
  const errors: string[] = [];
  const products = survey.choices.products || [];
  if (!products.includes("PV") && !products.includes("ME")) {
    errors.push("Wybierz, czy klient kupuje instalację PV, magazyn energii albo oba produkty.");
  }
  if (products.includes("PV") && !getTechnicalSurveyChoice(survey, "pv_location")) {
    errors.push("Wybierz miejsce montażu instalacji PV: dach albo grunt.");
  }
  if (!survey.declarationAccepted) {
    errors.push("Klient musi potwierdzić oświadczenie pod ankietą techniczną.");
  }
  return errors;
}
