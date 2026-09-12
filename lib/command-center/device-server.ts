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

export async function loadCommandCenterLiveEvents(
  rawToken: string,
  after?: string | null
): Promise<LiveEventsResult> {
  const { data: device, error: deviceError } = await supabaseAdmin
    .from("cc_devices")
    .select("id")
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

  const [{ data: leads, error: leadsError }, { data: sales, error: salesError }] = await Promise.all([
    supabaseAdmin
      .from("clients")
      .select("id,created_at")
      .gt("created_at", lowerBoundIso)
      .lte("created_at", cursor)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(25),
    supabaseAdmin
      .from("sales")
      .select("id,created_at,contract_value,status")
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

  const events: CommandCenterLiveEvent[] = [
    ...(leads || []).map((lead) => ({
      id: `lead:${lead.id}`,
      kind: "lead" as const,
      occurredAt: lead.created_at,
    })),
    ...(sales || [])
      .filter(isCountedCommandCenterSale)
      .map((sale) => ({
        id: `sale:${sale.id}`,
        kind: "sale" as const,
        occurredAt: sale.created_at,
        value: numericValue(sale.contract_value),
      })),
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

  const [{ data: version, error: versionError }, { data: station }] = await Promise.all([
    supabaseAdmin
      .from("cc_dashboard_versions")
      .select("id,version_number,snapshot,published_at")
      .eq("id", dashboard.published_version_id)
      .single(),
    device.radio_station_id
      ? supabaseAdmin
        .from("cc_radio_stations")
        .select("id,name,stream_url,homepage_url,is_active,sort_order")
        .eq("id", device.radio_station_id)
        .eq("is_active", true)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (versionError || !version) {
    return { ok: false, error: "Nie udało się odczytać opublikowanej wersji.", status: 500 };
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
        radioStation: station || null,
      },
    };
  } catch (error) {
    console.error("Command Center device metrics error:", error);
    return { ok: false, error: "Nie udało się pobrać zagregowanych danych CRM.", status: 500 };
  }
}
