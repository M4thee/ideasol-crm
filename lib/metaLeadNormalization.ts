export type MetaLeadField = {
  name?: string;
  values?: string[];
};

export type NormalizedMetaLead = {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  postalCode: string | null;
  extraAnswers: Array<{ label: string; value: string }>;
  rawFieldData: MetaLeadField[];
};

type MetaLeadFieldMapping = Record<string, string[] | undefined>;

export const DEFAULT_META_LEAD_FIELD_MAPPING = {
  fullName: [
    "full_name",
    "full name",
    "first_and_last_name",
    "first and last name",
    "imie_i_nazwisko",
    "imię i nazwisko",
    "imie_nazwisko",
    "imię nazwisko",
    "name",
  ],
  firstName: ["first_name", "first name", "imie", "imię"],
  lastName: ["last_name", "last name", "nazwisko"],
  email: [
    "email",
    "email_address",
    "email address",
    "e_mail",
    "adres_email",
    "adres e-mail",
  ],
  phone: ["phone_number", "phone", "numer_telefonu", "numer telefonu", "telefon"],
  postalCode: [
    "postal_code",
    "postal code",
    "post_code",
    "postcode",
    "zip_code",
    "zip code",
    "kod_pocztowy",
    "kod pocztowy",
    "kod_pocztowy_inwestycji",
  ],
} satisfies MetaLeadFieldMapping;

export function normalizeMetaFieldName(value?: string) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

type FieldMatch = {
  field: MetaLeadField;
  value: string;
};

function getFirstValue(field: MetaLeadField) {
  return field.values?.find((value) => String(value ?? "").trim())?.trim() || null;
}

function getFieldMatch(fields: MetaLeadField[], candidates: string[]): FieldMatch | null {
  const normalizedCandidates = candidates.map(normalizeMetaFieldName);
  for (const field of fields) {
    if (!normalizedCandidates.includes(normalizeMetaFieldName(field.name))) continue;
    const value = getFirstValue(field);
    if (value) return { field, value };
  }
  return null;
}

function getFieldMatchByName(
  fields: MetaLeadField[],
  predicate: (normalizedName: string) => boolean
): FieldMatch | null {
  for (const field of fields) {
    if (!predicate(normalizeMetaFieldName(field.name))) continue;
    const value = getFirstValue(field);
    if (value) return { field, value };
  }
  return null;
}

function mergeMapping(fieldMapping: MetaLeadFieldMapping) {
  return Object.fromEntries(
    Object.entries(DEFAULT_META_LEAD_FIELD_MAPPING).map(([key, defaults]) => {
      const custom = Array.isArray(fieldMapping[key]) ? fieldMapping[key] : [];
      const candidates = [...custom, ...defaults].filter(
        (candidate, index, all) =>
          all.findIndex(
            (otherCandidate) =>
              normalizeMetaFieldName(otherCandidate) === normalizeMetaFieldName(candidate)
          ) === index
      );
      return [key, candidates];
    })
  ) as Record<keyof typeof DEFAULT_META_LEAD_FIELD_MAPPING, string[]>;
}

function hasToken(normalizedName: string, token: string) {
  return normalizedName.split("_").includes(token);
}

function looksLikeFullNameField(normalizedName: string) {
  const hasPolishFirstName = hasToken(normalizedName, "imie") || hasToken(normalizedName, "imiona");
  const hasPolishLastName = hasToken(normalizedName, "nazwisko");
  const hasEnglishFullName =
    hasToken(normalizedName, "first") &&
    hasToken(normalizedName, "last") &&
    hasToken(normalizedName, "name");

  return (
    (hasPolishFirstName && hasPolishLastName) ||
    hasEnglishFullName ||
    normalizedName === "contact_name" ||
    normalizedName === "customer_name" ||
    normalizedName === "client_name"
  );
}

function looksLikeFirstNameField(normalizedName: string) {
  return (
    hasToken(normalizedName, "imie") ||
    hasToken(normalizedName, "imiona") ||
    (hasToken(normalizedName, "first") && hasToken(normalizedName, "name"))
  );
}

function looksLikeLastNameField(normalizedName: string) {
  return (
    hasToken(normalizedName, "nazwisko") ||
    hasToken(normalizedName, "surname") ||
    (hasToken(normalizedName, "last") && hasToken(normalizedName, "name"))
  );
}

function normalizePostalCode(value: string | null) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length === 5 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : value?.trim() || null;
}

function joinNameParts(firstName: string | null, lastName: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ").trim() || null;
}

export function normalizeMetaLead(
  fields: MetaLeadField[],
  fieldMapping: MetaLeadFieldMapping = {}
) {
  // Integracje utworzone przed rozszerzeniem mapowania mają w bazie krótkie
  // listy aliasów. Łączymy je z aktualnymi wartościami domyślnymi zamiast je
  // zastępować, aby starsza konfiguracja nie wyłączała obsługi nowych formularzy.
  const mapping = mergeMapping(fieldMapping);
  const mappedNames = new Set(
    Object.values(mapping).flat().map((fieldName) => normalizeMetaFieldName(fieldName))
  );
  const directFullNameMatch =
    getFieldMatch(fields, mapping.fullName) ||
    getFieldMatchByName(fields, looksLikeFullNameField);
  const firstNameMatch =
    getFieldMatch(fields, mapping.firstName) ||
    getFieldMatchByName(fields, looksLikeFirstNameField);
  const lastNameMatch =
    getFieldMatch(fields, mapping.lastName) ||
    getFieldMatchByName(fields, looksLikeLastNameField);
  const emailMatch = getFieldMatch(fields, mapping.email);
  const phoneMatch = getFieldMatch(fields, mapping.phone);
  const postalCodeMatch = getFieldMatch(fields, mapping.postalCode);
  const detectedContactFieldNames = new Set(
    [
      directFullNameMatch,
      firstNameMatch,
      lastNameMatch,
      emailMatch,
      phoneMatch,
      postalCodeMatch,
    ]
      .filter((match): match is FieldMatch => Boolean(match))
      .map((match) => normalizeMetaFieldName(match.field.name))
  );

  return {
    fullName:
      directFullNameMatch?.value ||
      joinNameParts(firstNameMatch?.value ?? null, lastNameMatch?.value ?? null),
    email: emailMatch?.value.toLowerCase() || null,
    phone: phoneMatch?.value || null,
    postalCode: normalizePostalCode(postalCodeMatch?.value || null),
    extraAnswers: fields
      .filter((field) => {
        const normalizedName = normalizeMetaFieldName(field.name);
        return !mappedNames.has(normalizedName) && !detectedContactFieldNames.has(normalizedName);
      })
      .map((field) => ({
        label: field.name || "Pole formularza",
        value: field.values?.join(", ") || "brak danych",
      })),
    rawFieldData: fields,
  } satisfies NormalizedMetaLead;
}
