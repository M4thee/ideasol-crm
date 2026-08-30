import { NextResponse } from "next/server";
import { finalizeIdeaSignContractV2 } from "@/lib/ideasign/finalize-v2";
import { requireIdeaSignMutation } from "@/lib/ideasign/server";
import { assertSameOrigin } from "@/lib/ideasign/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ ok: false, error: "Nieprawidłowe źródło żądania." }, { status: 403 });
  }
  const context = await requireIdeaSignMutation(request);
  if (!context) {
    return NextResponse.json({ ok: false, error: "Sesja wygasła albo token CSRF jest nieprawidłowy." }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { code?: unknown } | null;
  const code = String(body?.code || "").trim();
  try {
    const result = await finalizeIdeaSignContractV2({ context, code, request });
    return NextResponse.json(result, { status: result.ok ? 200 : result.status });
  } catch (error) {
    console.error("IdeaSign finalization failed", error);
    return NextResponse.json(
      { ok: false, error: "Nie udało się dokończyć zawarcia umowy. Spróbuj ponownie lub skontaktuj się z IdeaSol." },
      { status: 500 }
    );
  }
}
