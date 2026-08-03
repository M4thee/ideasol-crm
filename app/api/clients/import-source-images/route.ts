import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUCKET_NAME = "ocr-source-images";
const MAX_FILES = 30;
const MAX_FILE_SIZE = 20 * 1024 * 1024;

type SourceImageItem = {
  noteId: string;
  clientId: string;
  importKey: string;
  fileField: string;
};

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function fileExtension(file: File) {
  const fromName = file.name.toLowerCase().match(/\.([a-z0-9]{1,8})$/)?.[1];
  if (fromName && ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"].includes(fromName)) {
    return fromName;
  }

  const byMimeType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif",
  };
  return byMimeType[file.type] || "img";
}

async function requireUser(request: Request) {
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

  if (profileError || !profile) return null;
  return profile;
}

async function ensurePrivateBucket() {
  const { data: existingBucket } = await supabaseAdmin.storage.getBucket(BUCKET_NAME);
  if (existingBucket) return;

  const { error } = await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
    public: false,
    fileSizeLimit: MAX_FILE_SIZE,
  });

  if (error && !error.message.toLowerCase().includes("already exists")) {
    throw new Error(`Nie udało się przygotować prywatnego magazynu zdjęć: ${error.message}`);
  }
}

export async function POST(request: Request) {
  try {
    const profile = await requireUser(request);
    if (!profile) {
      return NextResponse.json(
        { ok: false, error: "Brak dostępu do zapisu zdjęć źródłowych." },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const rawMetadata = cleanText(formData.get("metadata"));
    let items: SourceImageItem[] = [];

    try {
      items = JSON.parse(rawMetadata) as SourceImageItem[];
    } catch {
      return NextResponse.json({ ok: false, error: "Nieprawidłowe dane zdjęć." }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0 || items.length > MAX_FILES) {
      return NextResponse.json(
        { ok: false, error: `Możesz zapisać od 1 do ${MAX_FILES} zdjęć naraz.` },
        { status: 400 }
      );
    }

    const normalizedItems = items.map((item) => ({
      noteId: cleanText(item.noteId),
      clientId: cleanText(item.clientId),
      importKey: cleanText(item.importKey),
      fileField: cleanText(item.fileField),
    }));

    if (
      normalizedItems.some(
        (item) =>
          !isUuid(item.noteId) ||
          !isUuid(item.clientId) ||
          !isUuid(item.importKey) ||
          !item.fileField
      )
    ) {
      return NextResponse.json({ ok: false, error: "Nieprawidłowe powiązanie zdjęć." }, { status: 400 });
    }

    const noteIds = normalizedItems.map((item) => item.noteId);
    const { data: notes, error: notesError } = await supabaseAdmin
      .from("client_notes")
      .select("id, client_id, created_by, source_image_import_key")
      .in("id", noteIds);

    if (notesError) throw notesError;
    const notesById = new Map((notes || []).map((note) => [note.id, note]));

    for (const item of normalizedItems) {
      const note = notesById.get(item.noteId);
      if (
        !note ||
        note.client_id !== item.clientId ||
        note.created_by !== profile.id ||
        note.source_image_import_key !== item.importKey
      ) {
        return NextResponse.json(
          { ok: false, error: "Jedno ze zdjęć nie pasuje do utworzonej notatki." },
          { status: 400 }
        );
      }
    }

    await ensurePrivateBucket();

    const results: Array<{ noteId: string; uploaded: boolean; error?: string }> = [];

    for (const item of normalizedItems) {
      const fileValue = formData.get(item.fileField);

      if (!(fileValue instanceof File)) {
        results.push({ noteId: item.noteId, uploaded: false, error: "Brak pliku źródłowego." });
        continue;
      }
      if (!fileValue.type.startsWith("image/")) {
        results.push({ noteId: item.noteId, uploaded: false, error: "Plik nie jest obrazem." });
        continue;
      }
      if (fileValue.size <= 0 || fileValue.size > MAX_FILE_SIZE) {
        results.push({ noteId: item.noteId, uploaded: false, error: "Nieprawidłowy rozmiar pliku." });
        continue;
      }

      const objectPath = `${item.clientId}/${item.noteId}/${crypto.randomUUID()}.${fileExtension(fileValue)}`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .upload(objectPath, fileValue, {
          contentType: fileValue.type,
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        results.push({ noteId: item.noteId, uploaded: false, error: uploadError.message });
        continue;
      }

      const { data: updatedNote, error: updateError } = await supabaseAdmin
        .from("client_notes")
        .update({
          source_image_bucket: BUCKET_NAME,
          source_image_path: objectPath,
          source_image_original_name: fileValue.name.slice(0, 255),
          source_image_mime_type: fileValue.type.slice(0, 100),
          source_image_size: fileValue.size,
        })
        .eq("id", item.noteId)
        .eq("client_id", item.clientId)
        .eq("source_image_import_key", item.importKey)
        .select("id")
        .maybeSingle();

      if (updateError || !updatedNote) {
        await supabaseAdmin.storage.from(BUCKET_NAME).remove([objectPath]);
        results.push({
          noteId: item.noteId,
          uploaded: false,
          error: updateError?.message || "Nie udało się powiązać pliku z notatką.",
        });
        continue;
      }

      results.push({ noteId: item.noteId, uploaded: true });
    }

    const uploaded = results.filter((result) => result.uploaded).length;
    return NextResponse.json({
      ok: uploaded === results.length,
      uploaded,
      failed: results.length - uploaded,
      results,
    });
  } catch (error) {
    console.error("Błąd zapisu zdjęć źródłowych OCR", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Nie udało się zapisać zdjęć źródłowych.",
      },
      { status: 500 }
    );
  }
}
