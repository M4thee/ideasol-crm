import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/ideasign/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ saleId: string }> };

function missingServerConfiguration() {
  return NextResponse.json(
    {
      error:
        "Lokalny serwer nie ma konfiguracji SUPABASE_SERVICE_ROLE_KEY wymaganej przez IdeaSign.",
    },
    { status: 503, headers: { "Cache-Control": "no-store" } }
  );
}

async function loadIdeaSignCrm() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  return import("@/lib/ideasign/crm");
}

export async function GET(request: Request, context: RouteContext) {
  const crm = await loadIdeaSignCrm();
  if (!crm) return missingServerConfiguration();
  const actor = await crm.requireIdeaSignCrmActor(request);
  if (!actor) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const { saleId } = await context.params;
  const state = await crm.getIdeaSignSaleStatus(saleId, actor);
  if (!state) return NextResponse.json({ error: "Brak dostępu do sprzedaży." }, { status: 403 });
  return NextResponse.json({ state }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request, context: RouteContext) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "Nieprawidłowe źródło żądania." }, { status: 403 });
  const crm = await loadIdeaSignCrm();
  if (!crm) return missingServerConfiguration();
  const actor = await crm.requireIdeaSignCrmActor(request);
  if (!actor) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const { saleId } = await context.params;
  const result = await crm.cancelIdeaSignSaleSession({ saleId, actor, request });
  return NextResponse.json(result, { status: result.ok ? 200 : result.status });
}

export async function POST(request: Request, context: RouteContext) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "Nieprawidłowe źródło żądania." }, { status: 403 });
  const crm = await loadIdeaSignCrm();
  if (!crm) return missingServerConfiguration();
  const actor = await crm.requireIdeaSignCrmActor(request);
  if (!actor) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const { saleId } = await context.params;
  try {
    const body = (await request.json().catch(() => null)) as { contractData?: unknown } | null;
    const contractData = body?.contractData;
    if (!contractData || typeof contractData !== "object" || Array.isArray(contractData)) {
      return NextResponse.json({ error: "Brak danych zatwierdzonej wersji umowy." }, { status: 400 });
    }
    const result = await crm.createAndSendIdeaSignSession({
      saleId,
      actor,
      request,
      contractData: contractData as Record<string, unknown>,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nie udało się przygotować umowy IdeaSign." },
      { status: 500 }
    );
  }
}
