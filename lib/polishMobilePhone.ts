const POLISH_MOBILE_PREFIXES = new Set([
  "45",
  "50",
  "51",
  "53",
  "57",
  "60",
  "66",
  "69",
  "72",
  "73",
  "78",
  "79",
  "88",
]);

const OBVIOUS_FAKE_NUMBERS = new Set(["123456789", "987654321"]);

export function normalizePolishMobilePhone(value: unknown): string | null {
  if (typeof value !== "string") return null;

  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("0048")) digits = digits.slice(4);
  else if (digits.startsWith("48") && digits.length === 11) digits = digits.slice(2);

  if (digits.length !== 9 || !POLISH_MOBILE_PREFIXES.has(digits.slice(0, 2))) {
    return null;
  }

  if (
    OBVIOUS_FAKE_NUMBERS.has(digits) ||
    /^(\d)\1{8}$/.test(digits) ||
    /^\d{2}(\d)\1{6}$/.test(digits)
  ) {
    return null;
  }

  return digits;
}

export function isValidPolishMobilePhone(value: unknown) {
  return normalizePolishMobilePhone(value) !== null;
}
