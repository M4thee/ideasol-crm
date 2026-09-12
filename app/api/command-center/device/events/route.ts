import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  COMMAND_CENTER_DEVICE_COOKIE,
  loadCommandCenterLiveEvents,
} from "@/lib/command-center/device-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COMMAND_CENTER_DEVICE_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "Urządzenie wymaga aktywacji." }, { status: 401 });

  const after = new URL(request.url).searchParams.get("after");
  const result = await loadCommandCenterLiveEvents(token, after);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.status === 404 ? "Urządzenie wymaga ponownej aktywacji." : result.error },
      { status: result.status === 404 ? 401 : result.status }
    );
  }
  return NextResponse.json(result.payload, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
