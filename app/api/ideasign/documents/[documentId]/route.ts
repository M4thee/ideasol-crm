import { NextResponse } from "next/server";
import { appendIdeaSignAuditEvent, getIdeaSignAccessContext } from "@/lib/ideasign/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const context = await getIdeaSignAccessContext();
  if (!context || !context.access.entry_verified_at) {
    return NextResponse.json({ error: "Najpierw potwierdź dostęp kodem SMS." }, { status: 403 });
  }

  const { documentId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(documentId)) {
    return NextResponse.json({ error: "Nie znaleziono dokumentu." }, { status: 404 });
  }

  const { data: document, error } = await supabaseAdmin
    .from("contract_signature_documents")
    .select("id, file_name, storage_path, mime_type, sha256")
    .eq("id", documentId)
    .eq("signature_session_id", context.signature.id)
    .maybeSingle();

  if (error || !document) {
    return NextResponse.json({ error: "Nie znaleziono dokumentu." }, { status: 404 });
  }

  const { data: file, error: downloadError } = await supabaseAdmin.storage
    .from("ideasign-documents")
    .download(document.storage_path);

  if (downloadError || !file) {
    return NextResponse.json({ error: "Nie udało się pobrać dokumentu." }, { status: 500 });
  }


  const now = new Date().toISOString();
  const { data: existingView } = await supabaseAdmin
    .from("contract_signature_document_views")
    .select("id, open_count")
    .eq("signature_session_id", context.signature.id)
    .eq("signer_id", context.signer.id)
    .eq("document_id", document.id)
    .maybeSingle();
  const viewResult = existingView
    ? await supabaseAdmin
        .from("contract_signature_document_views")
        .update({ last_opened_at: now, open_count: Number(existingView.open_count) + 1 })
        .eq("id", existingView.id)
    : await supabaseAdmin.from("contract_signature_document_views").insert({
        signature_session_id: context.signature.id,
        signer_id: context.signer.id,
        document_id: document.id,
        first_opened_at: now,
        last_opened_at: now,
      });
  if (viewResult.error) {
    return NextResponse.json({ error: "Nie udało się zarejestrować otwarcia dokumentu." }, { status: 500 });
  }
  await appendIdeaSignAuditEvent({
    signatureSessionId: context.signature.id,
    signerId: context.signer.id,
    eventType: "document_opened",
    request,
    eventData: { documentId: document.id, documentSha256: document.sha256 },
  });

  const safeFileName = String(document.file_name || "dokument.pdf").replace(/[\r\n"]/g, "_");
  return new Response(await file.arrayBuffer(), {
    headers: {
      "Content-Type": document.mime_type || "application/pdf",
      "Content-Disposition": `inline; filename="${safeFileName}"`,
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
    },
  });
}
