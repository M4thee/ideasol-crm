import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  COMMAND_CENTER_DEVICE_COOKIE,
  loadCommandCenterDevicePayload,
} from "@/lib/command-center/device-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COMMAND_CENTER_DEVICE_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: "Urządzenie wymaga aktywacji." }, { status: 401 });
  }

  const result = await loadCommandCenterDevicePayload(token);
  if (!result.ok) {
    const response = NextResponse.json(
      { error: result.status === 404 ? "Urządzenie wymaga ponownej aktywacji." : result.error },
      { status: result.status === 404 ? 401 : result.status }
    );
    if (result.status === 404) {
      response.cookies.set(COMMAND_CENTER_DEVICE_COOKIE, "", {
        httpOnly: true,
        maxAge: 0,
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }
    return response;
  }

  return NextResponse.json(result.payload, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
