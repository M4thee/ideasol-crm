import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { requireAdminRequest } from "@/lib/auth/requireAdminRequest";
import { createDefaultCommandCenterSnapshot } from "@/lib/command-center/widget-registry";
import { validateCommandCenterSnapshot } from "@/lib/command-center/validation";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function slugify(value: string) {
  const base = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return base || `dashboard-${Date.now()}`;
}

const DEVICE_PLATFORMS = new Set(["browser", "android_tv", "google_tv", "apple_tv", "fire_tv", "other"]);
const DEVICE_THEMES = new Set(["light", "dark", "auto"]);

function isValidTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("pl-PL", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

async function uniqueSlug(name: string) {
  const base = slugify(name);
  const { data } = await supabaseAdmin.from("cc_dashboards").select("slug").like("slug", `${base}%`);
  const used = new Set((data || []).map((row) => row.slug));
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export async function GET(request: Request) {
  const profile = await requireAdminRequest(request);
  if (!profile) return errorResponse("Brak uprawnień administratora.", 403);

  const [dashboardsResult, versionsResult, devicesResult, stationsResult] = await Promise.all([
    supabaseAdmin.from("cc_dashboards").select("*").order("created_at", { ascending: true }),
    supabaseAdmin.from("cc_dashboard_versions").select("id,dashboard_id,version_number,published_at,published_by").order("published_at", { ascending: false }).limit(200),
    supabaseAdmin.from("cc_devices").select("id,name,platform,dashboard_id,theme,timezone,auto_dark_from,auto_light_from,radio_station_id,radio_volume,radio_autoplay,last_seen_at,created_at,updated_at").order("created_at", { ascending: true }),
    supabaseAdmin.from("cc_radio_stations").select("id,name,stream_url,homepage_url,is_active,sort_order").order("sort_order", { ascending: true }).order("name", { ascending: true }),
  ]);

  const firstError = [dashboardsResult, versionsResult, devicesResult, stationsResult]
    .map((result) => result.error)
    .find(Boolean);
  if (firstError) return errorResponse(firstError.message, 500);

  const onlineThreshold = Date.now() - 45_000;

  return NextResponse.json({
    dashboards: dashboardsResult.data || [],
    versions: versionsResult.data || [],
    devices: (devicesResult.data || []).map((device) => ({
      ...device,
      is_online: Boolean(device.last_seen_at && new Date(device.last_seen_at).getTime() >= onlineThreshold),
    })),
    stations: stationsResult.data || [],
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const profile = await requireAdminRequest(request);
  if (!profile) return errorResponse("Brak uprawnień administratora.", 403);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Nieprawidłowe dane żądania.");
  }

  const action = String(body.action || "");

  if (action === "create-dashboard") {
    const name = String(body.name || "Nowy dashboard").trim();
    const slug = await uniqueSlug(name);
    const { data, error } = await supabaseAdmin.from("cc_dashboards").insert({
      name,
      slug,
      description: null,
      default_rotation_seconds: 30,
      draft_snapshot: createDefaultCommandCenterSnapshot(),
      created_by: profile.id,
      updated_by: profile.id,
    }).select("*").single();
    if (error) return errorResponse(error.message, 500);
    return NextResponse.json({ dashboard: data });
  }

  if (action === "save-draft" || action === "publish") {
    const dashboardId = String(body.dashboardId || "");
    let snapshot;
    try {
      snapshot = validateCommandCenterSnapshot(body.snapshot);
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : "Nieprawidłowa konfiguracja dashboardu.");
    }

    if (action === "save-draft") {
      const { data, error } = await supabaseAdmin.from("cc_dashboards").update({
        draft_snapshot: snapshot,
        updated_by: profile.id,
      }).eq("id", dashboardId).is("archived_at", null).select("*").single();
      if (error) return errorResponse(error.message, 500);
      return NextResponse.json({ dashboard: data });
    }

    const { data, error } = await supabaseAdmin.rpc("cc_publish_dashboard", {
      p_dashboard_id: dashboardId,
      p_snapshot: snapshot,
      p_published_by: profile.id,
    });
    if (error) return errorResponse(error.message, 500);
    return NextResponse.json({ version: data });
  }

  if (action === "rollback") {
    const dashboardId = String(body.dashboardId || "");
    const versionId = String(body.versionId || "");
    const { data: sourceVersion, error: sourceError } = await supabaseAdmin
      .from("cc_dashboard_versions")
      .select("snapshot")
      .eq("id", versionId)
      .eq("dashboard_id", dashboardId)
      .maybeSingle();
    if (sourceError || !sourceVersion) return errorResponse("Nie znaleziono wskazanej wersji.", 404);

    let snapshot;
    try {
      snapshot = validateCommandCenterSnapshot(sourceVersion.snapshot);
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : "Historyczna wersja jest nieprawidłowa.");
    }
    const { data, error } = await supabaseAdmin.rpc("cc_publish_dashboard", {
      p_dashboard_id: dashboardId,
      p_snapshot: snapshot,
      p_published_by: profile.id,
    });
    if (error) return errorResponse(error.message, 500);
    return NextResponse.json({ version: data });
  }

  if (action === "update-dashboard") {
    const dashboardId = String(body.dashboardId || "");
    const updates: Record<string, unknown> = { updated_by: profile.id };
    if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
    if (typeof body.description === "string" || body.description === null) updates.description = body.description;
    if (Number.isInteger(body.defaultRotationSeconds)) {
      const rotation = Number(body.defaultRotationSeconds);
      if (rotation < 10 || rotation > 3600) return errorResponse("Domyślna rotacja musi wynosić od 10 do 3600 sekund.");
      updates.default_rotation_seconds = rotation;
    }
    const { data, error } = await supabaseAdmin.from("cc_dashboards").update(updates).eq("id", dashboardId).is("archived_at", null).select("*").single();
    if (error) return errorResponse(error.message, 500);
    return NextResponse.json({ dashboard: data });
  }

  if (action === "archive-dashboard") {
    const dashboardId = String(body.dashboardId || "");
    const { count, error: deviceCheckError } = await supabaseAdmin.from("cc_devices").select("id", { count: "exact", head: true }).eq("dashboard_id", dashboardId);
    if (deviceCheckError) return errorResponse(deviceCheckError.message, 500);
    if (count) return errorResponse("Najpierw odłącz dashboard od wszystkich urządzeń.", 409);
    const { error } = await supabaseAdmin.from("cc_dashboards").update({
      archived_at: new Date().toISOString(),
      updated_by: profile.id,
    }).eq("id", dashboardId);
    if (error) return errorResponse(error.message, 500);
    return NextResponse.json({ ok: true });
  }

  if (action === "duplicate-dashboard") {
    const { data: source, error: sourceError } = await supabaseAdmin.from("cc_dashboards").select("name,description,default_rotation_seconds,draft_snapshot").eq("id", String(body.dashboardId || "")).single();
    if (sourceError || !source) return errorResponse(sourceError?.message || "Nie znaleziono dashboardu.", 404);
    const name = `${source.name} — kopia`;
    const { data, error } = await supabaseAdmin.from("cc_dashboards").insert({
      name,
      slug: await uniqueSlug(name),
      description: source.description,
      default_rotation_seconds: source.default_rotation_seconds,
      draft_snapshot: source.draft_snapshot,
      created_by: profile.id,
      updated_by: profile.id,
    }).select("*").single();
    if (error) return errorResponse(error.message, 500);
    return NextResponse.json({ dashboard: data });
  }

  if (action === "create-device") {
    const name = String(body.name || "").trim();
    const platform = String(body.platform || "browser");
    if (name.length < 2) return errorResponse("Podaj nazwę urządzenia.");
    if (!DEVICE_PLATFORMS.has(platform)) return errorResponse("Nieobsługiwana platforma urządzenia.");
    const rawToken = randomBytes(24).toString("base64url");
    const digest = createHash("sha256").update(rawToken).digest("hex");
    const { data, error } = await supabaseAdmin.from("cc_devices").insert({
      name,
      platform,
      access_token_digest: digest,
      dashboard_id: body.dashboardId || null,
      created_by: profile.id,
      updated_by: profile.id,
    }).select("id,name").single();
    if (error) return errorResponse(error.message, 500);
    return NextResponse.json({ device: data, token: rawToken });
  }

  if (action === "update-device") {
    const allowedFields: Record<string, string> = {
      name: "name",
      platform: "platform",
      dashboardId: "dashboard_id",
      theme: "theme",
      timezone: "timezone",
      autoDarkFrom: "auto_dark_from",
      autoLightFrom: "auto_light_from",
      radioStationId: "radio_station_id",
      radioVolume: "radio_volume",
      radioAutoplay: "radio_autoplay",
    };
    const updates: Record<string, unknown> = { updated_by: profile.id };
    Object.entries(allowedFields).forEach(([input, column]) => {
      if (Object.prototype.hasOwnProperty.call(body, input)) updates[column] = body[input] ?? null;
    });
    if (typeof updates.name === "string") updates.name = updates.name.trim();
    if (typeof updates.platform === "string" && !DEVICE_PLATFORMS.has(updates.platform)) return errorResponse("Nieobsługiwana platforma urządzenia.");
    if (typeof updates.theme === "string" && !DEVICE_THEMES.has(updates.theme)) return errorResponse("Nieobsługiwany motyw urządzenia.");
    if (typeof updates.timezone === "string" && !isValidTimezone(updates.timezone)) return errorResponse("Nieprawidłowa strefa czasowa.");
    for (const field of ["auto_dark_from", "auto_light_from"] as const) {
      if (field in updates && (!Number.isInteger(updates[field]) || Number(updates[field]) < 0 || Number(updates[field]) > 23)) return errorResponse("Godzina trybu automatycznego musi mieścić się w zakresie 0–23.");
    }
    if ("radio_volume" in updates && (!Number.isInteger(updates.radio_volume) || Number(updates.radio_volume) < 0 || Number(updates.radio_volume) > 100)) return errorResponse("Głośność musi mieścić się w zakresie 0–100.");
    const { data, error } = await supabaseAdmin.from("cc_devices").update(updates).eq("id", String(body.deviceId || "")).select("id").single();
    if (error) return errorResponse(error.message, 500);
    return NextResponse.json({ device: data });
  }

  if (action === "rotate-device-token") {
    const rawToken = randomBytes(24).toString("base64url");
    const digest = createHash("sha256").update(rawToken).digest("hex");
    const { data, error } = await supabaseAdmin.from("cc_devices").update({
      access_token_digest: digest,
      updated_by: profile.id,
    }).eq("id", String(body.deviceId || "")).select("id,name").single();
    if (error) return errorResponse(error.message, 500);
    return NextResponse.json({ device: data, token: rawToken });
  }

  if (action === "create-station") {
    const streamUrl = String(body.streamUrl || "").trim();
    if (!streamUrl.startsWith("https://")) return errorResponse("Stream radia musi używać HTTPS.");
    const { data, error } = await supabaseAdmin.from("cc_radio_stations").insert({
      name: String(body.name || "").trim(),
      stream_url: streamUrl,
      homepage_url: body.homepageUrl || null,
      created_by: profile.id,
      updated_by: profile.id,
    }).select("*").single();
    if (error) return errorResponse(error.message, 500);
    return NextResponse.json({ station: data });
  }

  if (action === "update-station") {
    const updates: Record<string, unknown> = { updated_by: profile.id };
    if (typeof body.name === "string") updates.name = body.name.trim();
    if (typeof body.streamUrl === "string") {
      const streamUrl = body.streamUrl.trim();
      if (!streamUrl.startsWith("https://")) return errorResponse("Stream radia musi używać HTTPS.");
      updates.stream_url = streamUrl;
    }
    if (typeof body.homepageUrl === "string" || body.homepageUrl === null) updates.homepage_url = body.homepageUrl || null;
    if (typeof body.isActive === "boolean") updates.is_active = body.isActive;
    const { data, error } = await supabaseAdmin.from("cc_radio_stations").update(updates).eq("id", String(body.stationId || "")).select("id").single();
    if (error) return errorResponse(error.message, 500);
    return NextResponse.json({ station: data });
  }

  return errorResponse("Nieznana operacja.");
}
