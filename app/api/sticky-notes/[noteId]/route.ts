import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  authenticateStickyNotesRequest,
  canCompleteStickyNote,
  StickyNotesRequestError,
  type StickyNoteRow,
} from "@/lib/stickyNotesServer";

type RouteContext = { params: Promise<{ noteId: string }> };

function errorResponse(error: unknown) {
  const status = error instanceof StickyNotesRequestError ? error.status : 500;
  const message = error instanceof Error ? error.message : "Nie udało się zmienić notatki.";
  if (status >= 500) console.error("Błąd API pojedynczej notatki:", error);
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function loadNote(admin: SupabaseClient, noteId: string) {
  const { data, error } = await admin
    .from("sticky_notes")
    .select("*")
    .eq("id", noteId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new StickyNotesRequestError("Nie znaleziono notatki.", 404);
  return data as StickyNoteRow;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { noteId } = await context.params;
    const { admin, user, profile } = await authenticateStickyNotesRequest(request);
    const note = await loadNote(admin, noteId);
    const body = (await request.json()) as { action?: string };

    if (body.action !== "toggle-completed") {
      throw new StickyNotesRequestError("Nieprawidłowa operacja na notatce.");
    }
    if (!canCompleteStickyNote(note, user.id, profile.role)) {
      throw new StickyNotesRequestError("Nie możesz oznaczyć tej notatki jako wykonanej.", 403);
    }

    const isCompleted = Boolean(note.completed_at);
    const completedByName =
      profile.display_name?.trim() || profile.email?.trim() || "Użytkownik CRM";
    const { data, error } = await admin
      .from("sticky_notes")
      .update({
        completed_at: isCompleted ? null : new Date().toISOString(),
        completed_by_id: isCompleted ? null : user.id,
        completed_by_name: isCompleted ? null : completedByName,
        updated_at: new Date().toISOString(),
        reminder_claimed_at: null,
      })
      .eq("id", noteId)
      .select("completed_at, completed_by_id, completed_by_name")
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, completion: data });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { noteId } = await context.params;
    const { admin, user, profile } = await authenticateStickyNotesRequest(request);
    const note = await loadNote(admin, noteId);

    if (profile.role !== "admin" && note.author_id !== user.id) {
      throw new StickyNotesRequestError("Notatkę może usunąć tylko autor lub administrator.", 403);
    }

    const { error } = await admin.from("sticky_notes").delete().eq("id", noteId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
