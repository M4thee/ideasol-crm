import { NextResponse } from "next/server";
import {
  getStickyNotesAdminClient,
  loadActiveStickyProfiles,
  notifyStickyReminder,
  type StickyNoteRow,
} from "@/lib/stickyNotesServer";

const reminderUnitMilliseconds: Record<string, number> = {
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
  weeks: 604_800_000,
};

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim() || process.env.REPORTS_CRON_SECRET?.trim();
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

function nextRecurringReminder(note: StickyNoteRow, now: Date) {
  if (note.reminder_mode !== "recurring" || !note.reminder_amount || !note.reminder_unit) {
    return null;
  }
  const interval = reminderUnitMilliseconds[note.reminder_unit] * note.reminder_amount;
  if (!Number.isFinite(interval) || interval <= 0) return null;

  let nextTimestamp = new Date(note.next_reminder_at || now).getTime() + interval;
  while (nextTimestamp <= now.getTime()) nextTimestamp += interval;
  if (note.expires_at && nextTimestamp > new Date(note.expires_at).getTime()) return null;
  return new Date(nextTimestamp).toISOString();
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Brak autoryzacji CRON." }, { status: 401 });
  }

  const admin = getStickyNotesAdminClient();
  const now = new Date();
  const retryBefore = new Date(now.getTime() - 10 * 60_000).toISOString();
  const { data, error } = await admin
    .from("sticky_notes")
    .select("*")
    .eq("reminder_enabled", true)
    .is("completed_at", null)
    .not("next_reminder_at", "is", null)
    .lte("next_reminder_at", now.toISOString())
    .or(`reminder_claimed_at.is.null,reminder_claimed_at.lte.${retryBefore}`)
    .order("next_reminder_at", { ascending: true })
    .limit(100);

  if (error) {
    console.error("Nie udało się pobrać przypomnień tablicy zadań:", error);
    return NextResponse.json({ ok: false, error: "Nie udało się pobrać przypomnień." }, { status: 500 });
  }

  const profiles = await loadActiveStickyProfiles(admin);
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  for (const note of (data || []) as StickyNoteRow[]) {
    const claimTime = new Date().toISOString();
    const { data: claimed, error: claimError } = await admin
      .from("sticky_notes")
      .update({ reminder_claimed_at: claimTime, reminder_error: null })
      .eq("id", note.id)
      .eq("next_reminder_at", note.next_reminder_at)
      .is("completed_at", null)
      .or(`reminder_claimed_at.is.null,reminder_claimed_at.lte.${retryBefore}`)
      .select("id")
      .maybeSingle();
    if (claimError || !claimed) continue;

    try {
      const notificationErrors = await notifyStickyReminder({ admin, note, profiles });
      const nextReminderAt = nextRecurringReminder(note, now);
      const { error: updateError } = await admin
        .from("sticky_notes")
        .update({
          next_reminder_at: nextReminderAt,
          reminder_last_sent_at: claimTime,
          reminder_claimed_at: null,
          reminder_error: notificationErrors.length ? notificationErrors.join(" | ") : null,
          reminder_occurrence_count: (note.reminder_occurrence_count || 0) + 1,
        })
        .eq("id", note.id);
      if (updateError) throw updateError;
      results.push({ id: note.id, ok: notificationErrors.length === 0, error: notificationErrors.join(" | ") || undefined });
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : String(sendError);
      await admin
        .from("sticky_notes")
        .update({ reminder_claimed_at: null, reminder_error: message })
        .eq("id", note.id);
      results.push({ id: note.id, ok: false, error: message });
    }
  }

  return NextResponse.json({
    ok: results.every((result) => result.ok),
    found: (data || []).length,
    sent: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    teamsEnabled: process.env.STICKY_NOTES_TEAMS_ENABLED === "true",
    results,
  });
}

export const POST = GET;
