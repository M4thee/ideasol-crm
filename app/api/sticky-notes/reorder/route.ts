import { NextResponse } from "next/server";
import {
  authenticateStickyNotesRequest,
  canViewStickyNote,
  StickyNotesRequestError,
  type StickyNoteRow,
} from "@/lib/stickyNotesServer";

function errorResponse(error: unknown) {
  const status = error instanceof StickyNotesRequestError ? error.status : 500;
  const message = error instanceof Error ? error.message : "Nie udało się zapisać układu tablicy.";
  if (status >= 500) console.error("Błąd zapisu układu tablicy zadań:", error);
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const { admin, user, profile } = await authenticateStickyNotesRequest(request);
    const body = (await request.json()) as { orderedIds?: unknown };
    const orderedIds = Array.isArray(body.orderedIds)
      ? [...new Set(body.orderedIds.map((id) => String(id || "").trim()).filter(Boolean))]
      : [];

    if (orderedIds.length === 0 || orderedIds.length > 500) {
      throw new StickyNotesRequestError("Nieprawidłowy układ tablicy.");
    }

    const { data, error } = await admin.from("sticky_notes").select("*").in("id", orderedIds);
    if (error) throw error;
    const visibleIds = new Set(
      ((data || []) as StickyNoteRow[])
        .filter((note) => canViewStickyNote(note, user.id, profile.role))
        .map((note) => note.id)
    );
    if (visibleIds.size !== orderedIds.length) {
      throw new StickyNotesRequestError("Nie możesz zmienić położenia niewidocznej notatki.", 403);
    }

    const now = new Date().toISOString();
    const { error: upsertError } = await admin.from("sticky_note_positions").upsert(
      orderedIds.map((noteId, index) => ({
        note_id: noteId,
        user_id: user.id,
        sort_order: index,
        updated_at: now,
      })),
      { onConflict: "note_id,user_id" }
    );
    if (upsertError) throw upsertError;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
