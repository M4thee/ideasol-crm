export type OsdOperator = "enea" | "tauron" | "pge" | "energa" | "eon";

export const OSD_OPTIONS: Array<{ value: OsdOperator; label: string; ppePrefix: string }> = [
  { value: "enea", label: "Enea Operator", ppePrefix: "5903106" },
  { value: "tauron", label: "Tauron Dystrybucja", ppePrefix: "5903224" },
  { value: "pge", label: "PGE Dystrybucja", ppePrefix: "5905435" },
  { value: "energa", label: "Energa-Operator", ppePrefix: "5902438" },
  { value: "eon", label: "Stoen Operator / E.ON", ppePrefix: "5903801" },
];

export function normalizePpe(value: unknown) {
  return String(value ?? "").replace(/[\s-]+/g, "");
}

export function hasValidGs1CheckDigit(value: string) {
  if (!/^\d{18}$/.test(value)) return false;

  const body = value.slice(0, -1);
  const expectedCheckDigit = Number(value.at(-1));
  const weightedSum = [...body].reduce(
    (sum, digit, index) => sum + Number(digit) * (index % 2 === 0 ? 3 : 1),
    0
  );
  const calculatedCheckDigit = (10 - (weightedSum % 10)) % 10;

  return calculatedCheckDigit === expectedCheckDigit;
}

export function validatePpe(value: unknown, osdOperator: string) {
  const normalized = normalizePpe(value);

  if (!normalized) {
    return "Uzupełnij numer PPE.";
  }

  if (!/^\d+$/.test(normalized)) {
    return "Numer PPE może zawierać wyłącznie cyfry.";
  }

  if (normalized.length !== 18) {
    return "Numer PPE musi mieć dokładnie 18 cyfr.";
  }

  const osd = OSD_OPTIONS.find((option) => option.value === osdOperator);

  if (!osd) {
    return "Najpierw wybierz operatora OSD.";
  }

  if (!normalized.startsWith(osd.ppePrefix)) {
    return `Numer PPE dla operatora ${osd.label} musi zaczynać się od ${osd.ppePrefix}.`;
  }

  if (!hasValidGs1CheckDigit(normalized)) {
    return "Numer PPE ma nieprawidłową cyfrę kontrolną GS1 — sprawdź go na fakturze lub umowie z OSD.";
  }

  return "";
}
