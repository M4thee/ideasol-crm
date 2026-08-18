export const CALCULATOR_ANALYTICS_SESSION_COLUMNS = [
  "id",
  "first_seen_at",
  "last_seen_at",
  "ip_address",
  "country_code",
  "region",
  "city",
  "postal_code",
  "timezone",
  "referrer",
  "landing_url",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "device_type",
  "is_test",
  "is_spam",
  "spam_reason",
  "spam_marked_at",
  "spam_marked_by",
  "max_step",
  "last_event",
  "event_count",
  "recommendation_type",
  "recommended_storage_kwh",
  "lead_client_id",
  "lead_submitted_at",
  "report_unlocked_at",
  "user_agent",
].join(",");

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_IN_MS = 5 * 366 * DAY_IN_MS;

function parseDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function readCalculatorAnalyticsRange(searchParams: URLSearchParams) {
  const now = new Date();
  const fallbackDays = Math.min(
    365,
    Math.max(1, Number(searchParams.get("days")) || 30)
  );
  const rawFrom = searchParams.get("from");
  const rawTo = searchParams.get("to");
  const from = parseDate(rawFrom) || new Date(now.getTime() - fallbackDays * DAY_IN_MS);
  const to = parseDate(rawTo) || now;

  if ((rawFrom && !parseDate(rawFrom)) || (rawTo && !parseDate(rawTo))) {
    throw new Error("Nieprawidłowy zakres dat.");
  }

  if (to.getTime() <= from.getTime()) {
    throw new Error("Data końcowa musi być późniejsza od początkowej.");
  }

  if (to.getTime() - from.getTime() > MAX_RANGE_IN_MS) {
    throw new Error("Zakres dat nie może przekraczać 5 lat.");
  }

  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}
