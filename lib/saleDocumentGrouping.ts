export const DOCUMENT_GROUPS = [
  {
    key: "contracts",
    title: "Umowa wraz z załącznikami",
    description:
      "Umowa, załączniki do umowy, dokumenty podpisowe, potwierdzenia wpłat i dokumenty kredytowe.",
    acceptedTypes: [
      "Umowa",
      "Umowa i załączniki",
      "Umowa wraz z załącznikami",
      "Potwierdzenie wpłaty",
      "Umowa kredytowa",
    ],
    accept: ".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp",
    maxSizeMb: 50,
  },
  {
    key: "technical_audit",
    title: "Audyt techniczny",
    description:
      "Audyt techniczny, protokoły, schematy, karty techniczne i dokumentacja techniczna montażu.",
    acceptedTypes: [
      "Audyt techniczny",
      "Dokumenty techniczne",
      "Protokół montażu",
    ],
    accept: ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp",
    maxSizeMb: 20,
  },
  {
    key: "photos",
    title: "Zdjęcia",
    description:
      "Zdjęcia z audytu, montażu, miejsca instalacji i dokumentacji fotograficznej.",
    acceptedTypes: ["Zdjęcia", "Zdjęcie", "Galeria zdjęć"],
    accept: "image/*",
    maxSizeMb: 30,
  },
  {
    key: "osd_invoice",
    title: "Faktura OSD",
    description:
      "Faktura OSD i dokumenty związane z operatorem sieci dystrybucyjnej.",
    acceptedTypes: ["Faktura OSD"],
    accept: ".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp",
    maxSizeMb: 15,
  },
  {
    key: "zm_power_of_attorney",
    title: "Pełnomocnictwo ZM",
    description:
      "Pełnomocnictwo ZM oraz dokumenty do zgłoszenia mikroinstalacji.",
    acceptedTypes: ["Pełnomocnictwo ZM"],
    accept: ".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp",
    maxSizeMb: 15,
  },
  {
    key: "ppoz",
    title: "PPOŻ",
    description:
      "Dokumenty PPOŻ, uzgodnienia i pełnomocnictwa związane ze strażą pożarną.",
    acceptedTypes: ["PPOŻ", "PPOZ", "Pełnomocnictwo do straży pożarnej"],
    accept: ".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp",
    maxSizeMb: 15,
  },
  {
    key: "pme_grant",
    title: "Dotacja PME",
    description:
      "Dokumenty dotacyjne programu PME i materiały potrzebne do rozliczenia dotacji.",
    acceptedTypes: ["Dotacja PME", "Dokumenty związane z dotacją"],
    accept: ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp",
    maxSizeMb: 25,
  },
  {
    key: "other",
    title: "Inne",
    description:
      "Pozostałe dokumenty i pliki, których nie da się jednoznacznie przypisać do wcześniejszych kontenerów.",
    acceptedTypes: ["Inne"],
    accept: ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp",
    maxSizeMb: 50,
  },
] as const;

export type DocumentGroupKey = (typeof DOCUMENT_GROUPS)[number]["key"];

export type SaleDocumentForGrouping = {
  id?: string;
  description?: string | null;
  document_type?: string | null;
  file_name?: string | null;
  file_type?: string | null;
};

export function normalizeDocumentText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferGroupFromText(value: unknown): DocumentGroupKey | null {
  const text = normalizeDocumentText(value);

  if (!text) return null;

  if (
    text.includes("ppoz") ||
    text.includes("straz") ||
    text.includes("pozar")
  ) {
    return "ppoz";
  }
  if (text.includes("osd") || text.includes("operator sieci")) {
    return "osd_invoice";
  }
  if (
    text.includes("pelnomocnictwo zm") ||
    (text.includes("zgloszeni") && text.includes("mikroinstalac")) ||
    /(^|\s)zm($|\s)/.test(text)
  ) {
    return "zm_power_of_attorney";
  }
  if (text.includes("dotac") || /(^|\s)pme($|\s)/.test(text)) {
    return "pme_grant";
  }
  if (
    text.includes("audyt") ||
    text.includes("technicz") ||
    text.includes("protokol") ||
    text.includes("schemat")
  ) {
    return "technical_audit";
  }
  if (
    text.includes("umow") ||
    text.includes("zalacznik") ||
    text.includes("potwierdzenie wplaty") ||
    text.includes("kredyt")
  ) {
    return "contracts";
  }
  if (
    text.includes("zdjec") ||
    text.includes("foto") ||
    text.includes("galeria")
  ) {
    return "photos";
  }

  return null;
}

function isImageDocument(document: SaleDocumentForGrouping) {
  const fileType = String(document.file_type ?? "")
    .trim()
    .toLowerCase();
  const fileName = normalizeDocumentText(document.file_name);

  return (
    fileType.startsWith("image/") ||
    /\.(avif|bmp|gif|heic|heif|jpe?g|png|tiff?|webp)$/.test(fileName)
  );
}

export function getSaleDocumentGroupKey(
  document: SaleDocumentForGrouping,
): DocumentGroupKey {
  const normalizedType = normalizeDocumentText(document.document_type);

  if (normalizedType) {
    const exactGroup = DOCUMENT_GROUPS.find((group) =>
      [group.key, group.title, ...group.acceptedTypes]
        .map(normalizeDocumentText)
        .includes(normalizedType),
    );

    if (exactGroup) return exactGroup.key;

    return inferGroupFromText(normalizedType) || "other";
  }

  const legacyTextGroup = inferGroupFromText(
    `${document.description ?? ""} ${document.file_name ?? ""}`,
  );

  if (legacyTextGroup) return legacyTextGroup;

  return isImageDocument(document) ? "photos" : "other";
}

export function getPhotoGalleryDocuments<T extends SaleDocumentForGrouping>(
  documents: T[],
) {
  return documents.filter(
    (document) => getSaleDocumentGroupKey(document) === "photos",
  );
}
