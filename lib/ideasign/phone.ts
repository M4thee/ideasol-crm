export function normalizeIdeaSignPolishPhone(value: unknown) {
  let digits = String(value ?? "").replace(/\D/g, "");

  if (digits.startsWith("0048")) {
    digits = digits.slice(2);
  }

  if (digits.length === 9) {
    return `48${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("48")) {
    return digits;
  }

  return "";
}

export function formatIdeaSignPolishPhone(value: unknown) {
  const normalized = normalizeIdeaSignPolishPhone(value);
  if (!normalized) return "";

  const local = normalized.slice(2);
  return `+48 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

export function areIdeaSignPhonesEqual(first: unknown, second: unknown) {
  const normalizedFirst = normalizeIdeaSignPolishPhone(first);
  const normalizedSecond = normalizeIdeaSignPolishPhone(second);
  return Boolean(normalizedFirst && normalizedFirst === normalizedSecond);
}
