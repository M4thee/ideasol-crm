import { createHash } from "node:crypto";

export type MetaCrmEventName = "Schedule" | "QualifiedLead" | "Purchase";

export type MetaCrmUser = {
  email?: string | null;
  phone?: string | null;
  phoneCountryCode?: string | null;
  fullName?: string | null;
  city?: string | null;
  postalCode?: string | null;
  externalId: string;
};

type SendMetaCrmEventInput = {
  eventName: MetaCrmEventName;
  eventId: string;
  eventTime?: Date;
  user: MetaCrmUser;
  value?: number;
  currency?: "PLN";
};

type MetaApiResponse = {
  events_received?: number;
  fbtrace_id?: string;
  messages?: string[];
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
};

const DEFAULT_GRAPH_API_VERSION = "v23.0";

function removeDiacritics(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function normalizeText(value?: string | null) {
  return removeDiacritics(String(value || "").trim().toLowerCase());
}

function normalizeEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function normalizePhone(value?: string | null, countryCode?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) return digits;
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.length === 9) {
    const normalizedCountryCode =
      String(countryCode || "48").replace(/\D/g, "") || "48";
    return `${normalizedCountryCode}${digits}`;
  }
  return digits;
}

function normalizePostalCode(value?: string | null) {
  return String(value || "").replace(/\s/g, "").toLowerCase();
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function hashIfPresent(value: string) {
  return value ? [sha256(value)] : undefined;
}

function splitName(fullName?: string | null) {
  const parts = normalizeText(fullName).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(""),
  };
}

function getConfig() {
  const datasetId = process.env.META_CAPI_DATASET_ID?.trim();
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN?.trim();

  if (!datasetId || !accessToken) {
    return null;
  }

  const configuredVersion = process.env.META_GRAPH_API_VERSION?.trim();
  const graphApiVersion = /^v\d+\.\d+$/.test(configuredVersion || "")
    ? configuredVersion!
    : DEFAULT_GRAPH_API_VERSION;

  return {
    datasetId,
    accessToken,
    graphApiVersion,
    testEventCode: process.env.META_CAPI_TEST_EVENT_CODE?.trim() || undefined,
  };
}

export async function sendMetaCrmEvent(
  input: SendMetaCrmEventInput
): Promise<MetaApiResponse> {
  const config = getConfig();
  if (!config) {
    throw new Error(
      "Brak META_CAPI_DATASET_ID lub META_CAPI_ACCESS_TOKEN w środowisku."
    );
  }

  const { firstName, lastName } = splitName(input.user.fullName);
  const userData = {
    em: hashIfPresent(normalizeEmail(input.user.email)),
    ph: hashIfPresent(
      normalizePhone(input.user.phone, input.user.phoneCountryCode)
    ),
    fn: hashIfPresent(firstName),
    ln: hashIfPresent(lastName),
    ct: hashIfPresent(normalizeText(input.user.city)),
    zp: hashIfPresent(normalizePostalCode(input.user.postalCode)),
    country: [sha256("pl")],
    external_id: [sha256(input.user.externalId)],
  };

  const event = {
    event_name: input.eventName,
    event_time: Math.floor((input.eventTime || new Date()).getTime() / 1000),
    event_id: input.eventId,
    action_source: "system_generated",
    user_data: Object.fromEntries(
      Object.entries(userData).filter(([, value]) => value !== undefined)
    ),
    ...(input.eventName === "Purchase"
      ? {
          custom_data: {
            value: input.value,
            currency: input.currency,
          },
        }
      : {}),
  };

  const response = await fetch(
    `https://graph.facebook.com/${config.graphApiVersion}/${config.datasetId}/events`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [event],
        access_token: config.accessToken,
        ...(config.testEventCode
          ? { test_event_code: config.testEventCode }
          : {}),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    }
  );

  const result = (await response.json().catch(() => ({}))) as MetaApiResponse;
  if (!response.ok || result.error) {
    throw new Error(
      result.error?.message ||
        `Meta Conversions API zwróciło HTTP ${response.status}.`
    );
  }

  return result;
}

