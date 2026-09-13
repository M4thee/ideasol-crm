import { createHash } from "node:crypto";

import {
  isCountedCommandCenterSale,
  loadCommandCenterMetrics,
} from "@/lib/command-center/metrics";
import { getCommandCenterAppVersion } from "@/lib/command-center/app-version";
import type {
  CommandCenterDevicePayload,
  CommandCenterLiveEvent,
  CommandCenterLiveEventsPayload,
} from "@/lib/command-center/types";
import { validateCommandCenterSnapshot } from "@/lib/command-center/validation";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const COMMAND_CENTER_DEVICE_COOKIE = "cc_device_session";
export const COMMAND_CENTER_DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

type DevicePayloadResult =
  | { ok: true; payload: CommandCenterDevicePayload }
  | { ok: false; error: string; status: number };

type LiveEventsResult =
  | { ok: true; payload: CommandCenterLiveEventsPayload }
  | { ok: false; error: string; status: number };

export function digestCommandCenterSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function numericValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value || "0").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function valueAtPath(source: unknown, path: string[]) {
  return path.reduce<unknown>((current, key) => asRecord(current)?.[key], source);
}

function firstPositiveNumber(source: unknown, paths: string[][]) {
  for (const path of paths) {
    const value = numericValue(valueAtPath(source, path));
    if (value > 0) return value;
  }
  return 0;
}

function saleTechnicalDetails(offerSnapshot: unknown) {
  return {
    pvPowerKwp: firstPositiveNumber(offerSnapshot, [
      ["pv_power_kw"],
      ["pvPowerKw"],
      ["offer_data", "pv_power_kw"],
      ["offer_data", "result", "pvPowerKw"],
    ]),
    storageCapacityKwh: firstPositiveNumber(offerSnapshot, [
      ["storage_capacity_kwh"],
      ["storageCapacityKwh"],
      ["offer_data", "storage_capacity_kwh"],
      ["offer_data", "result", "storageCapacityKwh"],
    ]),
  };
}

function normalize(value: unknown) {
  return String(value || "").trim().toLocaleLowerCase("pl-PL");
}

function leadCampaignName(leadSource: string | null, integrationName?: string | null) {
  const source = normalize(leadSource);
  if (!source) return "Lead doradcy";
  if (source === "kalkulatorme") return "Kalkulator ME";
  if (source === "import ze zdjęcia") return "Załatwione z roboty";
  if (source !== "meta ads") return leadSource?.trim() || "Lead doradcy";

  const name = integrationName?.trim() || "";
  const normalizedName = normalize(name);
  if (normalizedName.includes("arimr")) return "ARiMR";
  if (normalizedName.includes("magazyn") || normalizedName.includes("kwh")) return "ME";
  return name.split("|")[0]?.trim() || "Meta Ads";
}

function parseCommandCenterTestEvent(settings: unknown): CommandCenterLiveEvent | null {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return null;
  const candidate = (settings as Record<string, unknown>).testNotification;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const record = candidate as Record<string, unknown>;
  const kind = record.kind === "sale" ? "sale" : record.kind === "lead" ? "lead" : null;
  const occurredAt = typeof record.occurredAt === "string" ? record.occurredAt : "";
  const timestamp = new Date(occurredAt).getTime();
  if (!kind || !Number.isFinite(timestamp)) return null;
  const id = typeof record.id === "string" && record.id ? record.id : occurredAt;
  return {
    id: `test:${id}`,
    kind,
    occurredAt,
    advisorName: typeof record.advisorName === "string" && record.advisorName.trim()
      ? record.advisorName.trim()
      : "Doradca testowy",
    ...(kind === "lead"
      ? {
          campaignName: typeof record.campaignName === "string" && record.campaignName.trim()
            ? record.campaignName.trim()
            : "Kampania testowa",
        }
      : {
          value: numericValue(record.value),
          pvPowerKwp: numericValue(record.pvPowerKwp) || 8.37,
          storageCapacityKwh: numericValue(record.storageCapacityKwh) || 28.42,
        }),
  };
}

export async function loadCommandCenterLiveEvents(
  rawToken: string,
  after?: string | null
): Promise<LiveEventsResult> {
  const { data: device, error: deviceError } = await supabaseAdmin
    .from("cc_devices")
    .select("id,settings")
    .eq("access_token_digest", digestCommandCenterSecret(rawToken))
    .maybeSingle();
  if (deviceError || !device) {
    return { ok: false, error: "Urządzenie nie jest zarejestrowane.", status: 404 };
  }

  const cursorDate = new Date();
  const cursor = cursorDate.toISOString();
  if (!after) return { ok: true, payload: { cursor, events: [] } };

  const requestedAfter = new Date(after);
  if (!Number.isFinite(requestedAfter.getTime())) {
    return { ok: false, error: "Nieprawidłowy znacznik czasu zdarzeń.", status: 400 };
  }

  // Po dłuższym uśpieniu TV nie odtwarza całej historii powiadomień.
  const oldestAllowed = new Date(cursorDate.getTime() - 10 * 60 * 1000);
  const lowerBound = requestedAfter > oldestAllowed ? requestedAfter : oldestAllowed;
  const lowerBoundIso = lowerBound.toISOString();
  const testEvent = parseCommandCenterTestEvent(device.settings);

  const [{ data: leads, error: leadsError }, { data: sales, error: salesError }] = await Promise.all([
    supabaseAdmin
      .from("clients")
      .select("id,created_at,lead_source,assigned_user_id")
      .gt("created_at", lowerBoundIso)
      .lte("created_at", cursor)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(25),
    supabaseAdmin
      .from("sales")
      .select("id,created_at,contract_value,status,seller_id,offer_snapshot")
      .gt("created_at", lowerBoundIso)
      .lte("created_at", cursor)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(25),
  ]);
  if (leadsError || salesError) {
    console.error("Command Center live events error:", leadsError || salesError);
    return { ok: false, error: "Nie udało się pobrać zdarzeń live.", status: 500 };
  }

  const leadRows = leads || [];
  const saleRows = (sales || []).filter(isCountedCommandCenterSale);
  const profileIds = Array.from(new Set([
    ...leadRows.map((lead) => lead.assigned_user_id),
    ...saleRows.map((sale) => sale.seller_id),
  ].filter((id): id is string => Boolean(id))));
  const metaClientIds = leadRows
    .filter((lead) => normalize(lead.lead_source) === "meta ads")
    .map((lead) => lead.id);

  const [{ data: profiles, error: profilesError }, { data: metaLeads, error: metaLeadsError }] = await Promise.all([
    profileIds.length
      ? supabaseAdmin.from("profiles").select("id,display_name").in("id", profileIds)
      : Promise.resolve({ data: [], error: null }),
    metaClientIds.length
      ? supabaseAdmin.from("meta_leads").select("client_id,integration_id,created_at").in("client_id", metaClientIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (profilesError || metaLeadsError) {
    console.error("Command Center live event details error:", profilesError || metaLeadsError);
    return { ok: false, error: "Nie udało się pobrać szczegółów zdarzeń live.", status: 500 };
  }

  const integrationIds = Array.from(new Set((metaLeads || [])
    .map((metaLead) => metaLead.integration_id)
    .filter((id): id is string => Boolean(id))));
  const { data: integrations, error: integrationsError } = integrationIds.length
    ? await supabaseAdmin.from("lead_integrations").select("id,campaign_name").in("id", integrationIds)
    : { data: [], error: null };
  if (integrationsError) {
    console.error("Command Center live event campaign error:", integrationsError);
    return { ok: false, error: "Nie udało się pobrać kampanii zdarzenia live.", status: 500 };
  }

  const profileNames = new Map((profiles || []).map((profile) => [profile.id, profile.display_name?.trim() || "Doradca"]));
  const integrationNames = new Map((integrations || []).map((integration) => [integration.id, integration.campaign_name]));
  const integrationByClient = new Map<string, string | null>();
  (metaLeads || []).forEach((metaLead) => {
    if (metaLead.client_id && !integrationByClient.has(metaLead.client_id)) {
      integrationByClient.set(metaLead.client_id, metaLead.integration_id);
    }
  });

  const events: CommandCenterLiveEvent[] = [
    ...(testEvent
      && new Date(testEvent.occurredAt) > lowerBound
      && new Date(testEvent.occurredAt) <= cursorDate
      ? [testEvent]
      : []),
    ...leadRows.map((lead) => {
      const integrationId = integrationByClient.get(lead.id);
      return {
        id: `lead:${lead.id}`,
        kind: "lead" as const,
        occurredAt: lead.created_at,
        campaignName: leadCampaignName(
          lead.lead_source,
          integrationId ? integrationNames.get(integrationId) : null
        ),
        advisorName: lead.assigned_user_id
          ? profileNames.get(lead.assigned_user_id) || "Nieprzypisany doradca"
          : "Nieprzypisany doradca",
      };
    }),
    ...saleRows.map((sale) => {
      const technicalDetails = saleTechnicalDetails(sale.offer_snapshot);
      return {
        id: `sale:${sale.id}`,
        kind: "sale" as const,
        occurredAt: sale.created_at,
        value: numericValue(sale.contract_value),
        advisorName: sale.seller_id
          ? profileNames.get(sale.seller_id) || "Nieprzypisany doradca"
          : "Nieprzypisany doradca",
        ...technicalDetails,
      };
    }),
  ]
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id))
    .slice(-25);

  return { ok: true, payload: { cursor, events } };
}

export async function loadCommandCenterDevicePayload(rawToken: string): Promise<DevicePayloadResult> {
  const { data: device, error: deviceError } = await supabaseAdmin
    .from("cc_devices")
    .select("id,name,platform,dashboard_id,theme,timezone,auto_dark_from,auto_light_from,radio_station_id,radio_volume,radio_autoplay,last_seen_at,created_at,updated_at")
    .eq("access_token_digest", digestCommandCenterSecret(rawToken))
    .maybeSingle();

  if (deviceError || !device) {
    return { ok: false, error: "Urządzenie nie jest zarejestrowane.", status: 404 };
  }
  if (!device.dashboard_id) {
    return { ok: false, error: "Do urządzenia nie przypisano dashboardu.", status: 409 };
  }

  const { data: dashboard, error: dashboardError } = await supabaseAdmin
    .from("cc_dashboards")
    .select("id,name,default_rotation_seconds,published_version_id,archived_at")
    .eq("id", device.dashboard_id)
    .maybeSingle();
  if (dashboardError || !dashboard || dashboard.archived_at || !dashboard.published_version_id) {
    return { ok: false, error: "Dashboard nie ma opublikowanej wersji.", status: 409 };
  }

  const [{ data: version, error: versionError }, { data: stations, error: stationsError }] = await Promise.all([
    supabaseAdmin
      .from("cc_dashboard_versions")
      .select("id,version_number,snapshot,published_at")
      .eq("id", dashboard.published_version_id)
      .single(),
    supabaseAdmin
      .from("cc_radio_stations")
      .select("id,name,stream_url,homepage_url,is_active,sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);
  if (versionError || !version) {
    return { ok: false, error: "Nie udało się odczytać opublikowanej wersji.", status: 500 };
  }
  if (stationsError) {
    return { ok: false, error: "Nie udało się odczytać listy stacji radiowych.", status: 500 };
  }

  try {
    const [metrics] = await Promise.all([
      loadCommandCenterMetrics(supabaseAdmin, device.timezone),
      supabaseAdmin.from("cc_devices").update({ last_seen_at: new Date().toISOString() }).eq("id", device.id),
    ]);
    const snapshot = validateCommandCenterSnapshot(version.snapshot);
    return {
      ok: true,
      payload: {
        appVersion: getCommandCenterAppVersion(),
        device,
        dashboard: {
          id: dashboard.id,
          name: dashboard.name,
          defaultRotationSeconds: dashboard.default_rotation_seconds,
          versionId: version.id,
          versionNumber: version.version_number,
          publishedAt: version.published_at,
        },
        snapshot,
        metrics,
        radioStation: stations?.find((station) => station.id === device.radio_station_id) || null,
        radioStations: stations || [],
      },
    };
  } catch (error) {
    console.error("Command Center device metrics error:", error);
    return { ok: false, error: "Nie udało się pobrać zagregowanych danych CRM.", status: 500 };
  }
}
