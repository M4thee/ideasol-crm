import { NextResponse } from "next/server";
import { requireClientAccessRequest } from "@/lib/auth/requireClientAccessRequest";
import { createIdeaTermoPreauditPdf } from "@/lib/ideatermo/preauditPdf";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ clientId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { clientId } = await context.params;
  const access = await requireClientAccessRequest(request, clientId);
  if (!access || access.client.business_area !== "ideatermo") {
    return NextResponse.json({ error: "Brak dostępu do karty zakresu IdeaTermo." }, { status: 403 });
  }

  const [clientResult, preauditResult] = await Promise.all([
    supabaseAdmin
      .from("clients")
      .select("id,public_id,full_name,company_name,email,phone,city,street,building_number,postal_code")
      .eq("id", clientId)
      .single(),
    supabaseAdmin.from("ideatermo_preaudits").select("*").eq("client_id", clientId).maybeSingle(),
  ]);
  if (clientResult.error || !clientResult.data) {
    return NextResponse.json({ error: "Nie znaleziono klienta." }, { status: 404 });
  }
  if (preauditResult.error || !preauditResult.data) {
    return NextResponse.json({ error: "Najpierw zapisz zakres prac klienta." }, { status: 404 });
  }

  try {
    const pdfBytes = await createIdeaTermoPreauditPdf(clientResult.data, preauditResult.data);
    const safeClient = String(clientResult.data.public_id || clientId.slice(0, 8)).replace(/[^a-zA-Z0-9_-]/g, "");
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="IdeaTermo-zakres-prac-${safeClient}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[IDEATERMO WORK SCOPE PDF]", error);
    return NextResponse.json({ error: "Nie udało się wygenerować dokumentu PDF." }, { status: 500 });
  }
}
