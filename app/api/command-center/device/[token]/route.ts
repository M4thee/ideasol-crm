import { NextResponse } from "next/server";

import { loadCommandCenterDevicePayload } from "@/lib/command-center/device-server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const result = await loadCommandCenterDevicePayload(token);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.payload, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
