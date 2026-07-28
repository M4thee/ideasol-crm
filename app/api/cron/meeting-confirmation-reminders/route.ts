import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTeamsDirectMeetingConfirmationReminder } from "@/lib/microsoftTeams";

type PendingMeetingConfirmation = {
  id: string;
  event_at: string;
  client_id: string;
  assigned_user_id: string | null;
  created_by: string | null;
  confirmation_reminder_at: string;
};

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Brak konfiguracji Supabase dla przypomnień o potwierdzeniu spotkań.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function isCronAuthorized(request: Request) {
  const cronSecret =
    process.env.CRON_SECRET?.trim() ||
    process.env.REPORTS_CRON_SECRET?.trim();

  if (!cronSecret) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (
    !process.env.CRON_SECRET?.trim() &&
    !process.env.REPORTS_CRON_SECRET?.trim()
  ) {
    return NextResponse.json(
      { ok: false, error: "Brak konfiguracji sekretu harmonogramu." },
      { status: 503 }
    );
  }

  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Brak autoryzacji CRON." }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const now = new Date();
  const retryBefore = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("calendar_events")
    .select(
      "id, event_at, client_id, assigned_user_id, created_by, confirmation_reminder_at"
    )
    .eq("event_type", "meeting")
    .eq("confirmation_required", true)
    .is("client_confirmed_at", null)
    .is("confirmation_reminder_sent_at", null)
    .lte("confirmation_reminder_at", now.toISOString())
    .gt("event_at", now.toISOString())
    .or(
      `confirmation_reminder_attempted_at.is.null,confirmation_reminder_attempted_at.lte.${retryBefore}`
    )
    .order("confirmation_reminder_at", { ascending: true })
    .limit(50);

  if (error) {
    console.error("Nie udało się pobrać przypomnień o potwierdzeniu spotkań:", error);
    return NextResponse.json(
      { ok: false, error: "Nie udało się pobrać przypomnień." },
      { status: 500 }
    );
  }

  const meetings = (data || []) as PendingMeetingConfirmation[];
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  for (const meeting of meetings) {
    const claimTime = new Date().toISOString();
    const { data: claimedMeeting, error: claimError } = await supabaseAdmin
      .from("calendar_events")
      .update({
        confirmation_reminder_attempted_at: claimTime,
        confirmation_reminder_sent_at: claimTime,
        confirmation_reminder_error: null,
      })
      .eq("id", meeting.id)
      .is("confirmation_reminder_sent_at", null)
      .is("client_confirmed_at", null)
      .select("id")
      .maybeSingle();

    if (claimError || !claimedMeeting) {
      if (claimError) {
        console.error("Nie udało się zarezerwować przypomnienia Teams:", claimError);
      }
      continue;
    }

    try {
      const advisorId = meeting.assigned_user_id || meeting.created_by;

      if (!advisorId) {
        throw new Error("Spotkanie nie ma przypisanego doradcy.");
      }

      const [{ data: advisor, error: advisorError }, { data: client, error: clientError }] =
        await Promise.all([
          supabaseAdmin
            .from("profiles")
            .select("display_name, email")
            .eq("id", advisorId)
            .maybeSingle(),
          supabaseAdmin
            .from("clients")
            .select("full_name, company_name")
            .eq("id", meeting.client_id)
            .maybeSingle(),
        ]);

      if (advisorError || !advisor?.email) {
        throw new Error(advisorError?.message || "Doradca nie ma adresu e-mail Teams.");
      }

      if (clientError || !client) {
        throw new Error(clientError?.message || "Nie znaleziono klienta spotkania.");
      }

      const crmUrl = process.env.NEXT_PUBLIC_CRM_URL || "https://crm.ideasol.pl";

      await sendTeamsDirectMeetingConfirmationReminder({
        userEmail: advisor.email,
        advisorName: advisor.display_name || advisor.email,
        clientName: client.full_name || client.company_name || "Klient",
        eventAt: meeting.event_at,
        eventUrl: `${crmUrl.replace(/\/$/, "")}/event/${encodeURIComponent(meeting.id)}`,
      });

      results.push({ id: meeting.id, ok: true });
    } catch (sendError) {
      const errorMessage = serializeError(sendError);

      console.error("Nie udało się wysłać przypomnienia Teams o potwierdzeniu:", {
        meetingId: meeting.id,
        error: errorMessage,
      });

      await supabaseAdmin
        .from("calendar_events")
        .update({
          confirmation_reminder_sent_at: null,
          confirmation_reminder_error: errorMessage,
        })
        .eq("id", meeting.id);

      results.push({ id: meeting.id, ok: false, error: errorMessage });
    }
  }

  return NextResponse.json({
    ok: results.every((result) => result.ok),
    found: meetings.length,
    sent: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    results,
  });
}
