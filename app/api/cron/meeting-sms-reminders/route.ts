import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendMeetingReminderSms } from "@/lib/meetingSms";

type CalendarEventReminderRow = {
  id: string;
  event_at: string | null;
  event_type: string | null;
  client_id: string | null;
  assigned_user_id: string | null;
};

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Brak konfiguracji Supabase service role dla CRON SMS przypomnień.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function isCronAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    return false;
  }

  const authorization = request.headers.get("authorization") || "";
  return authorization === `Bearer ${cronSecret}`;
}

function getReminderWindow(request: Request) {
  const url = new URL(request.url);
  const hoursAhead = Number(url.searchParams.get("hoursAhead") || "24");
  const windowMinutes = Number(url.searchParams.get("windowMinutes") || "90");

  const safeHoursAhead = Number.isFinite(hoursAhead) ? hoursAhead : 24;
  const safeWindowMinutes = Number.isFinite(windowMinutes) ? windowMinutes : 90;

  const now = new Date();
  const targetTime = new Date(now.getTime() + safeHoursAhead * 60 * 60 * 1000);
  const halfWindowMs = Math.max(15, safeWindowMinutes) * 60 * 1000;

  return {
    from: new Date(targetTime.getTime() - halfWindowMs).toISOString(),
    to: new Date(targetTime.getTime() + halfWindowMs).toISOString(),
    hoursAhead: safeHoursAhead,
    windowMinutes: Math.max(15, safeWindowMinutes),
  };
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    };
  }

  if (typeof error === "object" && error !== null) {
    try {
      return JSON.parse(JSON.stringify(error));
    } catch {
      return String(error);
    }
  }

  return String(error);
}

export async function GET(request: Request) {
  try {
    if (!isCronAuthorized(request)) {
      return NextResponse.json(
        { ok: false, error: "Brak autoryzacji CRON." },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const dryRun = url.searchParams.get("dryRun") === "true";
    const limit = Math.min(Number(url.searchParams.get("limit") || "100") || 100, 250);
    const clientId = url.searchParams.get("clientId")?.trim() || "";
    const meetingId = url.searchParams.get("meetingId")?.trim() || "";
    const reminderWindow = getReminderWindow(request);
    const supabaseAdmin = getSupabaseAdminClient();

    let meetingsQuery = supabaseAdmin
      .from("calendar_events")
      .select("id, event_at, event_type, client_id, assigned_user_id")
      .eq("event_type", "meeting")
      .gte("event_at", reminderWindow.from)
      .lte("event_at", reminderWindow.to)
      .not("client_id", "is", null);

    if (clientId) {
      meetingsQuery = meetingsQuery.eq("client_id", clientId);
    }

    if (meetingId) {
      meetingsQuery = meetingsQuery.eq("id", meetingId);
    }

    const { data: meetingsData, error: meetingsError } = await meetingsQuery
      .order("event_at", { ascending: true })
      .limit(limit);

    if (meetingsError) {
      throw new Error(`Nie udało się pobrać spotkań do SMS przypomnień: ${meetingsError.message}`);
    }

    const meetings = (meetingsData || []) as CalendarEventReminderRow[];
    const results: Array<{
      calendarEventId: string;
      eventAt: string | null;
      ok: boolean;
      skipped?: boolean;
      dryRun?: boolean;
      error?: unknown;
      result?: unknown;
    }> = [];

    for (const meeting of meetings) {
      if (dryRun) {
        results.push({
          calendarEventId: meeting.id,
          eventAt: meeting.event_at,
          ok: true,
          dryRun: true,
        });
        continue;
      }

      try {
        const result = await sendMeetingReminderSms({
          calendarEventId: meeting.id,
          triggeredByUserId: null,
        });

        results.push({
          calendarEventId: meeting.id,
          eventAt: meeting.event_at,
          ok: true,
          skipped:
            typeof result === "object" &&
            result !== null &&
            "skipped" in result &&
            Boolean((result as { skipped?: unknown }).skipped),
          result,
        });
      } catch (error) {
        const details = serializeError(error);
        console.error("Nie udało się wysłać SMS przypomnienia o spotkaniu:", {
          calendarEventId: meeting.id,
          eventAt: meeting.event_at,
          error: details,
        });

        results.push({
          calendarEventId: meeting.id,
          eventAt: meeting.event_at,
          ok: false,
          error: details,
        });
      }
    }

    const sent = results.filter((item) => item.ok && !item.skipped && !item.dryRun).length;
    const skipped = results.filter((item) => item.skipped).length;
    const failed = results.filter((item) => !item.ok).length;

    return NextResponse.json({
      ok: failed === 0,
      dryRun,
      window: reminderWindow,
      filters: {
        clientId: clientId || null,
        meetingId: meetingId || null,
      },
      found: meetings.length,
      sent,
      skipped,
      failed,
      results,
    });
  } catch (error) {
    const details = serializeError(error);
    console.error("Błąd CRON SMS przypomnień o spotkaniach:", details);

    return NextResponse.json(
      {
        ok: false,
        error: "Nie udało się obsłużyć CRON SMS przypomnień o spotkaniach.",
        details,
      },
      { status: 500 }
    );
  }
}
