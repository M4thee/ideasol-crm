import { NextResponse } from "next/server";
import {
  authenticateStickyNotesRequest,
  canViewStickyNote,
  getStickyViewerIds,
  hydrateStickyNote,
  loadActiveStickyProfiles,
  notifyStickyNoteCreated,
  StickyNotesRequestError,
  type StickyCommentRow,
  type StickyNoteRow,
  type StickyVisibility,
} from "@/lib/stickyNotesServer";

const allowedColors = new Set([
  "yellow", "mint", "blue", "pink", "lavender", "peach",
  "coral", "aqua", "sage", "lilac", "apricot", "stone",
]);
const allowedReminderModes = new Set(["relative", "scheduled", "recurring"]);
const allowedReminderUnits = new Set(["minutes", "hours", "days", "weeks"]);

function errorResponse(error: unknown) {
  const status = error instanceof StickyNotesRequestError ? error.status : 500;
  const message =
    error instanceof Error ? error.message : "Nie udało się obsłużyć tablicy zadań.";
  if (status >= 500) console.error("Błąd API tablicy zadań:", error);
  return NextResponse.json({ ok: false, error: message }, { status });
}

function uniqueIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
}

export async function GET(request: Request) {
  try {
    const { admin, user, profile } = await authenticateStickyNotesRequest(request);
    const profiles = await loadActiveStickyProfiles(admin);
    const { data: noteData, error: notesError } = await admin
      .from("sticky_notes")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (notesError) throw notesError;

    const notes = ((noteData || []) as StickyNoteRow[]).filter((note) =>
      canViewStickyNote(note, user.id, profile.role)
    );
    const { data: positionData, error: positionsError } = await admin
      .from("sticky_note_positions")
      .select("note_id, sort_order")
      .eq("user_id", user.id);
    if (positionsError) throw positionsError;
    const positionByNoteId = new Map(
      (positionData || []).map((position) => [position.note_id as string, position.sort_order as number])
    );
    notes.sort((first, second) => {
      const firstPosition = positionByNoteId.get(first.id);
      const secondPosition = positionByNoteId.get(second.id);
      if (firstPosition !== undefined || secondPosition !== undefined) {
        return (firstPosition ?? Number.MAX_SAFE_INTEGER) - (secondPosition ?? Number.MAX_SAFE_INTEGER);
      }
      return first.sort_order - second.sort_order;
    });
    let comments: StickyCommentRow[] = [];

    if (notes.length > 0) {
      const { data: commentData, error: commentsError } = await admin
        .from("sticky_note_comments")
        .select("*")
        .in("note_id", notes.map((note) => note.id))
        .order("created_at", { ascending: true });

      if (commentsError) throw commentsError;
      comments = (commentData || []) as StickyCommentRow[];
    }

    return NextResponse.json({
      ok: true,
      notes: notes.map((note) => hydrateStickyNote(note, comments, profiles)),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { admin, user, profile } = await authenticateStickyNotesRequest(request);
    const body = (await request.json()) as Record<string, unknown>;
    const content = String(body.content || "").trim();
    const visibility = String(body.visibility || "private") as StickyVisibility;
    const recipientIds = uniqueIds(body.recipientIds).filter((id) => id !== user.id);
    const requestedMentionIds = uniqueIds(body.mentionedUserIds).filter((id) => id !== user.id);

    if (!content || content.length > 320) {
      throw new StickyNotesRequestError("Treść notatki musi mieć od 1 do 320 znaków.");
    }

    const validVisibilities = new Set(["private", "management", "public", "shared", "user"]);
    if (!validVisibilities.has(visibility)) {
      throw new StickyNotesRequestError("Nieprawidłowy rodzaj widoczności.");
    }

    const privileged = profile.role === "admin" || profile.role === "owner";
    const allowedVisibilities = privileged
      ? ["private", "management", "public", "shared", "user"]
      : ["private", "management", "user"];

    if (!allowedVisibilities.includes(visibility)) {
      throw new StickyNotesRequestError("Nie masz uprawnień do tej widoczności.", 403);
    }

    if (["shared", "user"].includes(visibility) !== (recipientIds.length > 0)) {
      throw new StickyNotesRequestError(
        ["shared", "user"].includes(visibility)
          ? "Wybierz odbiorcę notatki."
          : "Ten rodzaj widoczności nie przyjmuje odbiorców."
      );
    }

    const profiles = await loadActiveStickyProfiles(admin);
    const activeIds = new Set(profiles.map((item) => item.id));
    if (recipientIds.some((id) => !activeIds.has(id))) {
      throw new StickyNotesRequestError("Wybrany odbiorca nie ma aktywnego konta CRM.");
    }

    const reminderEnabled = Boolean(body.reminderEnabled);
    const reminderMode = body.reminderMode ? String(body.reminderMode) : null;
    const reminderUnit = body.reminderUnit ? String(body.reminderUnit) : null;
    const reminderAmount = body.reminderAmount === null || body.reminderAmount === undefined
      ? null
      : Number(body.reminderAmount);
    const expiresAtDate = body.expiresAt ? new Date(String(body.expiresAt)) : null;
    const reminderAtDate = body.reminderAt ? new Date(String(body.reminderAt)) : null;
    if (expiresAtDate && !Number.isFinite(expiresAtDate.getTime())) {
      throw new StickyNotesRequestError("Nieprawidłowy termin ważności notatki.");
    }
    if (reminderAtDate && !Number.isFinite(reminderAtDate.getTime())) {
      throw new StickyNotesRequestError("Nieprawidłowa data przypomnienia.");
    }
    const expiresAt = expiresAtDate?.toISOString() || null;
    const reminderAt = reminderAtDate?.toISOString() || null;

    if (reminderEnabled && (!reminderMode || !allowedReminderModes.has(reminderMode))) {
      throw new StickyNotesRequestError("Nieprawidłowy rodzaj przypomnienia.");
    }
    if (reminderEnabled && !reminderAtDate) {
      throw new StickyNotesRequestError("Ustaw datę i godzinę przypomnienia.");
    }
    if (reminderAtDate && reminderAtDate.getTime() <= Date.now()) {
      throw new StickyNotesRequestError("Termin przypomnienia musi przypadać w przyszłości.");
    }
    if (reminderEnabled && reminderMode === "relative" && !expiresAtDate) {
      throw new StickyNotesRequestError("Przypomnienie przed terminem wymaga terminu ważności.");
    }
    if (
      reminderEnabled &&
      reminderMode === "recurring" &&
      expiresAtDate &&
      reminderAtDate &&
      reminderAtDate.getTime() > expiresAtDate.getTime()
    ) {
      throw new StickyNotesRequestError("Pierwsze przypomnienie musi przypadać przed terminem notatki.");
    }
    if (reminderEnabled && reminderMode !== "scheduled") {
      if (!reminderUnit || !allowedReminderUnits.has(reminderUnit)) {
        throw new StickyNotesRequestError("Nieprawidłowa jednostka przypomnienia.");
      }
      if (!Number.isInteger(reminderAmount) || Number(reminderAmount) < 1) {
        throw new StickyNotesRequestError("Nieprawidłowy odstęp przypomnienia.");
      }
    }

    const authorName = profile.display_name?.trim() || profile.email?.trim() || "Użytkownik CRM";
    const authorColor = allowedColors.has(String(profile.sticky_note_color || ""))
      ? String(profile.sticky_note_color)
      : "yellow";
    const { data: insertedData, error: insertError } = await admin
      .from("sticky_notes")
      .insert({
        content,
        author_id: user.id,
        author_name: authorName,
        color: authorColor,
        visibility,
        recipient_ids: recipientIds,
        expires_at: expiresAt,
        reminder_enabled: reminderEnabled,
        reminder_mode: reminderEnabled ? reminderMode : null,
        reminder_amount: reminderEnabled && reminderMode !== "scheduled" ? reminderAmount : null,
        reminder_unit: reminderEnabled && reminderMode !== "scheduled" ? reminderUnit : null,
        reminder_at: reminderEnabled ? reminderAt : null,
        next_reminder_at: reminderEnabled ? reminderAt : null,
        sort_order: Date.now(),
      })
      .select("*")
      .single();

    if (insertError) throw insertError;
    const note = insertedData as StickyNoteRow;
    const viewerIds = getStickyViewerIds(note, profiles);
    const mentionedUserIds = requestedMentionIds.filter((id) => viewerIds.has(id));

    if (mentionedUserIds.length > 0) {
      const { error: mentionError } = await admin.from("sticky_note_mentions").insert(
        mentionedUserIds.map((mentionedUserId) => ({
          note_id: note.id,
          comment_id: null,
          mentioned_user_id: mentionedUserId,
          mentioned_by_user_id: user.id,
        }))
      );
      if (mentionError) throw mentionError;
    }

    const notificationErrors: string[] = [];
    try {
      notificationErrors.push(
        ...(await notifyStickyNoteCreated({
          admin,
          note,
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
        note: hydrateStickyNote(note, [], profiles),
        notificationErrors,
      },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
