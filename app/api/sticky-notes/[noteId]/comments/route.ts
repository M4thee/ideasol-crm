import { NextResponse } from "next/server";
import {
  authenticateStickyNotesRequest,
  canViewStickyNote,
  getStickyViewerIds,
  loadActiveStickyProfiles,
  notifyStickyCommentCreated,
  StickyNotesRequestError,
  type StickyCommentRow,
  type StickyNoteRow,
} from "@/lib/stickyNotesServer";

type RouteContext = { params: Promise<{ noteId: string }> };

function uniqueIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
}

function errorResponse(error: unknown) {
  const status = error instanceof StickyNotesRequestError ? error.status : 500;
  const message = error instanceof Error ? error.message : "Nie udało się dodać komentarza.";
  if (status >= 500) console.error("Błąd API komentarzy tablicy zadań:", error);
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { noteId } = await context.params;
    const { admin, user, profile } = await authenticateStickyNotesRequest(request);
    const body = (await request.json()) as Record<string, unknown>;
    const content = String(body.content || "").trim();
    const requestedMentionIds = uniqueIds(body.mentionedUserIds).filter((id) => id !== user.id);

    if (!content || content.length > 500) {
      throw new StickyNotesRequestError("Komentarz musi mieć od 1 do 500 znaków.");
    }

    const { data: noteData, error: noteError } = await admin
      .from("sticky_notes")
      .select("*")
      .eq("id", noteId)
      .maybeSingle();
    if (noteError) throw noteError;
    if (!noteData) throw new StickyNotesRequestError("Nie znaleziono notatki.", 404);

    const note = noteData as StickyNoteRow;
    if (!canViewStickyNote(note, user.id, profile.role)) {
      throw new StickyNotesRequestError("Nie masz dostępu do tej notatki.", 403);
    }

    const authorName = profile.display_name?.trim() || profile.email?.trim() || "Użytkownik CRM";
    const { data: commentData, error: commentError } = await admin
      .from("sticky_note_comments")
      .insert({
        note_id: noteId,
        author_id: user.id,
        author_name: authorName,
        content,
      })
      .select("*")
      .single();
    if (commentError) throw commentError;

    const comment = commentData as StickyCommentRow;
    const profiles = await loadActiveStickyProfiles(admin);
    const viewerIds = getStickyViewerIds(note, profiles);
    const mentionedUserIds = requestedMentionIds.filter((id) => viewerIds.has(id));

    if (mentionedUserIds.length > 0) {
      const { error: mentionError } = await admin.from("sticky_note_mentions").insert(
        mentionedUserIds.map((mentionedUserId) => ({
          note_id: noteId,
          comment_id: comment.id,
          mentioned_user_id: mentionedUserId,
          mentioned_by_user_id: user.id,
        }))
      );
      if (mentionError) throw mentionError;
    }

    const notificationErrors: string[] = [];
    try {
      notificationErrors.push(
        ...(await notifyStickyCommentCreated({
          admin,
          note,
          comment,
          profiles,
          mentionedUserIds,
        }))
      );
    } catch (notificationError) {
      notificationErrors.push(
        notificationError instanceof Error ? notificationError.message : String(notificationError)
      );
    }

    return NextResponse.json(
      {
        ok: true,
        comment: {
          id: comment.id,
          authorId: comment.author_id,
          authorName: comment.author_name,
          content: comment.content,
          createdAt: comment.created_at,
        },
        notificationErrors,
      },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
