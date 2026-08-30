import { NextResponse } from "next/server";
import { getIdeaSignAccessContext, getIdeaSignSessionDto } from "@/lib/ideasign/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getIdeaSignAccessContext();
  if (!context) {
    return NextResponse.json({ ok: false, error: "Sesja IdeaSign wygasła." }, { status: 401 });
  }

  const session = await getIdeaSignSessionDto(context);
  return NextResponse.json(
    { ok: true, session },
    { headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow" } }
  );
}

