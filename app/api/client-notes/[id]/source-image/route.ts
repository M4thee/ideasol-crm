import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

async function getAuthorizedUser(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const accessToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  if (!accessToken) return null;

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(accessToken);
  if (authError || !user) return null;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  return profileError ? null : profile;
}

async function canAccessClient(params: {
  userId: string;
  role: string;
  assignedUserId: string | null;
}) {
  const role = params.role.toLowerCase();
  if (["admin", "owner", "cc"].includes(role)) return true;
  if (params.assignedUserId === params.userId) return true;
  if (role !== "manager" || !params.assignedUserId) return false;

  const { data: assignedProfile } = await supabaseAdmin
    .from("profiles")
    .select("manager_id")
    .eq("id", params.assignedUserId)
    .maybeSingle();

  return assignedProfile?.manager_id === params.userId;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const profile = await getAuthorizedUser(request);
    if (!profile) {
      return NextResponse.json({ ok: false, error: "Brak autoryzacji." }, { status: 401 });
    }

    const { id: noteId } = await context.params;
    const { data: note, error: noteError } = await supabaseAdmin
      .from("client_notes")
      .select(
        "id, client_id, source_image_bucket, source_image_path, source_image_original_name"
      )
      .eq("id", noteId)
      .maybeSingle();

    if (noteError || !note?.source_image_path || !note.source_image_bucket) {
      return NextResponse.json(
        { ok: false, error: "Notatka nie ma zdjęcia źródłowego." },
        { status: 404 }
      );
    }

    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("assigned_user_id")
      .eq("id", note.client_id)
      .maybeSingle();

    if (clientError || !client) {
      return NextResponse.json({ ok: false, error: "Nie znaleziono klienta." }, { status: 404 });
    }

    const allowed = await canAccessClient({
      userId: profile.id,
      role: String(profile.role || "seller"),
      assignedUserId: client.assigned_user_id,
    });

    if (!allowed) {
      return NextResponse.json(
        { ok: false, error: "Nie masz dostępu do tej notatki." },
        { status: 403 }
      );
    }

    if (
      note.source_image_bucket !== "ocr-source-images" ||
      !note.source_image_path.startsWith(`${note.client_id}/${note.id}/`)
    ) {
      return NextResponse.json(
        { ok: false, error: "Nieprawidłowe powiązanie pliku źródłowego." },
        { status: 400 }
      );
    }

    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
      .from(note.source_image_bucket)
      .createSignedUrl(note.source_image_path, 5 * 60);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      throw new Error(signedUrlError?.message || "Nie udało się otworzyć zdjęcia.");
    }

    return NextResponse.json(
      {
        ok: true,
        signedUrl: signedUrlData.signedUrl,
        fileName: note.source_image_original_name || "notatka-zrodlowa",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Błąd otwierania zdjęcia źródłowego OCR", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Nie udało się otworzyć zdjęcia.",
      },
      { status: 500 }
    );
  }
}
