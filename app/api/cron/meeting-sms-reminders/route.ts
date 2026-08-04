import { NextResponse } from "next/server";
import { getSmsAutomationWindow } from "@/lib/automaticSms";
import { getActiveSmsAutomations } from "@/lib/automaticSmsServer";
import { sendMeetingReminderSms } from "@/lib/meetingSms";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type CalendarEventReminderRow = {
  id: string;
  event_at: string | null;
};

function isCronAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization") || "";
  return Boolean(cronSecret && authorization === `Bearer ${cronSecret}`);
}

function serializeError(error: unknown) {
  if (error instanceof Error) return { name: error.name, message: error.message };
  return String(error || "Nieznany błąd");
}

export async function GET(request: Request) {
  try {
    if (!isCronAuthorized(request)) {
      return NextResponse.json({ ok: false, error: "Brak autoryzacji CRON." }, { status: 401 });
    }

    const url = new URL(request.url);
    const dryRun = url.searchParams.get("dryRun") === "true";
    const limit = Math.min(Number(url.searchParams.get("limit") || "100") || 100, 250);
    const clientId = url.searchParams.get("clientId")?.trim() || "";
    const meetingId = url.searchParams.get("meetingId")?.trim() || "";
    const automations = await getActiveSmsAutomations("before_meeting");
    const results: Array<Record<string, unknown>> = [];

    for (const automation of automations) {
      const stalePendingBefore = new Date(Date.now() - 30 * 60_000).toISOString();
      await supabaseAdmin
        .from("sms_messages")
        .update({
          status: "failed",
          error_message: "Poprzednia próba nie została zakończona. Zaplanowano ponowienie.",
        })
        .eq("message_type", automation.message_type)
        .eq("status", "pending")
        .lt("created_at", stalePendingBefore);

      const window = getSmsAutomationWindow(automation.offset_minutes);
      let query = supabaseAdmin
        .from("calendar_events")
        .select("id,event_at")
        .eq("event_type", "meeting")
        .gte("event_at", window.from)
        .lte("event_at", window.to)
        .not("client_id", "is", null);

      if (clientId) query = query.eq("client_id", clientId);
      if (meetingId) query = query.eq("id", meetingId);

      const { data, error } = await query.order("event_at", { ascending: true }).limit(limit);
      if (error) throw new Error(`Nie udało się pobrać spotkań: ${error.message}`);

      for (const meeting of (data || []) as CalendarEventReminderRow[]) {
        if (dryRun) {
          results.push({
            automationId: automation.id,
            automationTitle: automation.title,
            calendarEventId: meeting.id,
            eventAt: meeting.event_at,
            window,
            ok: true,
            dryRun: true,
          });
          continue;
        }

        try {
          const result = await sendMeetingReminderSms({
            calendarEventId: meeting.id,
            triggeredByUserId: null,
            automationId: automation.id,
          });
          results.push({
            automationId: automation.id,
            automationTitle: automation.title,
            calendarEventId: meeting.id,
            eventAt: meeting.event_at,
            ok: true,
            skipped: result.skipped,
            result,
          });
        } catch (error) {
          const details = serializeError(error);
          console.error("Nie udało się wysłać automatycznego SMS przed spotkaniem", {
            automationId: automation.id,
            calendarEventId: meeting.id,
            error: details,
          });
          results.push({
            automationId: automation.id,
            calendarEventId: meeting.id,
            ok: false,
            error: details,
          });
        }
      }
    }

    const sent = results.filter((item) => item.ok && !item.skipped && !item.dryRun).length;
    const skipped = results.filter((item) => item.skipped).length;
    const failed = results.filter((item) => !item.ok).length;

    return NextResponse.json({
      ok: failed === 0,
      dryRun,
      automations: automations.length,
      found: results.length,
      sent,
      skipped,
      failed,
      results,
    });
  } catch (error) {
    const details = serializeError(error);
    console.error("Błąd CRON automatycznych SMS przed spotkaniami", details);
    return NextResponse.json(
      { ok: false, error: "Nie udało się obsłużyć automatów SMS przed spotkaniami.", details },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
