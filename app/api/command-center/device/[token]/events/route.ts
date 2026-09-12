import { NextResponse } from "next/server";

import { loadCommandCenterLiveEvents } from "@/lib/command-center/device-server";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const after = new URL(request.url).searchParams.get("after");
  const result = await loadCommandCenterLiveEvents(token, after);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.payload, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
