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

type MetaLeadFieldMapping = Record<string, string[]>;

export const DEFAULT_META_LEAD_FIELD_MAPPING: MetaLeadFieldMapping = {
  fullName: [
    "full_name",
    "full name",
    "imie_i_nazwisko",
    "imię i nazwisko",
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
};

export function normalizeMetaFieldName(value?: string) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getFieldValue(fields: MetaLeadField[], candidates: string[]) {
  const normalizedCandidates = candidates.map(normalizeMetaFieldName);
  const field = fields.find((item) =>
    normalizedCandidates.includes(normalizeMetaFieldName(item.name))
  );
  return field?.values?.[0]?.trim() || null;
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
  const mapping = { ...DEFAULT_META_LEAD_FIELD_MAPPING, ...fieldMapping };
  const mappedNames = new Set(
    Object.values(mapping).flat().map((fieldName) => normalizeMetaFieldName(fieldName))
  );
  const directFullName = getFieldValue(
    fields,
    mapping.fullName ?? DEFAULT_META_LEAD_FIELD_MAPPING.fullName
  );
  const firstName = getFieldValue(
    fields,
    mapping.firstName ?? DEFAULT_META_LEAD_FIELD_MAPPING.firstName
  );
  const lastName = getFieldValue(
    fields,
    mapping.lastName ?? DEFAULT_META_LEAD_FIELD_MAPPING.lastName
  );
  const email = getFieldValue(
    fields,
    mapping.email ?? DEFAULT_META_LEAD_FIELD_MAPPING.email
  );

  return {
    fullName: directFullName || joinNameParts(firstName, lastName),
    email: email?.toLowerCase() || null,
    phone: getFieldValue(fields, mapping.phone ?? DEFAULT_META_LEAD_FIELD_MAPPING.phone),
    postalCode: normalizePostalCode(
      getFieldValue(fields, mapping.postalCode ?? DEFAULT_META_LEAD_FIELD_MAPPING.postalCode)
    ),
    extraAnswers: fields
      .filter((field) => !mappedNames.has(normalizeMetaFieldName(field.name)))
      .map((field) => ({
        label: field.name || "Pole formularza",
        value: field.values?.join(", ") || "brak danych",
      })),
    rawFieldData: fields,
  } satisfies NormalizedMetaLead;
}
