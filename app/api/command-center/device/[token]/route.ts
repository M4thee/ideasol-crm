import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { loadCommandCenterMetrics } from "@/lib/command-center/metrics";
import { validateCommandCenterSnapshot } from "@/lib/command-center/validation";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const digest = createHash("sha256").update(token).digest("hex");
  const { data: device, error: deviceError } = await supabaseAdmin
    .from("cc_devices")
    .select("id,name,platform,dashboard_id,theme,timezone,auto_dark_from,auto_light_from,radio_station_id,radio_volume,radio_autoplay,last_seen_at,created_at,updated_at")
    .eq("access_token_digest", digest)
    .maybeSingle();

  if (deviceError || !device) {
    return NextResponse.json({ error: "Urządzenie nie jest zarejestrowane." }, { status: 404 });
  }
  if (!device.dashboard_id) {
    return NextResponse.json({ error: "Do urządzenia nie przypisano dashboardu." }, { status: 409 });
  }

  const { data: dashboard, error: dashboardError } = await supabaseAdmin
    .from("cc_dashboards")
    .select("id,name,default_rotation_seconds,published_version_id,archived_at")
    .eq("id", device.dashboard_id)
    .maybeSingle();
  if (dashboardError || !dashboard || dashboard.archived_at || !dashboard.published_version_id) {
    return NextResponse.json({ error: "Dashboard nie ma opublikowanej wersji." }, { status: 409 });
  }

  const [{ data: version, error: versionError }, { data: station }] = await Promise.all([
    supabaseAdmin.from("cc_dashboard_versions").select("id,version_number,snapshot,published_at").eq("id", dashboard.published_version_id).single(),
    device.radio_station_id
      ? supabaseAdmin.from("cc_radio_stations").select("id,name,stream_url,homepage_url,is_active,sort_order").eq("id", device.radio_station_id).eq("is_active", true).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (versionError || !version) {
    return NextResponse.json({ error: "Nie udało się odczytać opublikowanej wersji." }, { status: 500 });
  }

  try {
    const [metrics] = await Promise.all([
      loadCommandCenterMetrics(supabaseAdmin, device.timezone),
      supabaseAdmin.from("cc_devices").update({ last_seen_at: new Date().toISOString() }).eq("id", device.id),
    ]);
    const snapshot = validateCommandCenterSnapshot(version.snapshot);
    return NextResponse.json({
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
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("Command Center device metrics error:", error);
    return NextResponse.json({ error: "Nie udało się pobrać zagregowanych danych CRM." }, { status: 500 });
  }
}
