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
  try {
    const crm = await loadIdeaSignCrm();
    if (!crm) return missingServerConfiguration();
    const actor = await crm.requireIdeaSignCrmActor(request);
    if (!actor) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
    const { saleId } = await context.params;
    const state = await crm.getIdeaSignAttachmentFiveState(saleId, actor);
    if (!state) return NextResponse.json({ error: "Brak dostępu do sprzedaży." }, { status: 403 });
    return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nie udało się odczytać Załącznika nr 5." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Nieprawidłowe źródło żądania." }, { status: 403 });
  }
  try {
    const crm = await loadIdeaSignCrm();
    if (!crm) return missingServerConfiguration();
    const actor = await crm.requireIdeaSignCrmActor(request);
    if (!actor) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Wybierz plik PDF." }, { status: 400 });
    }
    if (file.size === 0 || file.size > crm.IDEA_SIGN_ATTACHMENT_FIVE_MAX_BYTES) {
      return NextResponse.json({ error: "Wybierz plik PDF o rozmiarze do 50 MB." }, { status: 400 });
    }
    const { saleId } = await context.params;
    const result = await crm.uploadIdeaSignAttachmentFive({
      saleId,
      actor,
      fileName: file.name,
      bytes: Buffer.from(await file.arrayBuffer()),
    });
    return NextResponse.json(
      result.ok ? { attachment: result.attachment } : { error: result.error },
      { status: result.ok ? 201 : result.status, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nie udało się dodać Załącznika nr 5." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Nieprawidłowe źródło żądania." }, { status: 403 });
  }
  try {
    const crm = await loadIdeaSignCrm();
    if (!crm) return missingServerConfiguration();
    const actor = await crm.requireIdeaSignCrmActor(request);
    if (!actor) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
    const { saleId } = await context.params;
    const result = await crm.deleteIdeaSignAttachmentFive({ saleId, actor });
    return NextResponse.json(
      result.ok ? { attachment: null } : { error: result.error },
      { status: result.ok ? 200 : result.status, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nie udało się usunąć Załącznika nr 5." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
