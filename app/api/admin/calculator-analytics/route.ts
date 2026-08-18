import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/requireAdminRequest";
import {
  CALCULATOR_ANALYTICS_SESSION_COLUMNS,
  readCalculatorAnalyticsRange,
} from "@/lib/calculatorAnalytics";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function withSpamMarkerName(session: Record<string, unknown>) {
  const spamMarkedBy = typeof session.spam_marked_by === "string" ? session.spam_marked_by : null;
  if (!spamMarkedBy) return { ...session, spam_marked_by_name: null };

  const { data } = await supabaseAdmin
    .from("profiles")
    .select("display_name")
    .eq("id", spamMarkedBy)
    .maybeSingle();

  return { ...session, spam_marked_by_name: data?.display_name || "Administrator" };
}

export async function GET(request: Request) {
  const admin = await requireAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Brak uprawnień." }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId")?.trim();

    if (sessionId) {
      const [{ data: session, error: sessionError }, { data: events, error: eventsError }] =
        await Promise.all([
          supabaseAdmin
            .from("energy_storage_calculator_sessions")
            .select("*")
            .eq("id", sessionId)
            .maybeSingle(),
          supabaseAdmin
            .from("energy_storage_calculator_events")
            .select("id,event_name,step_number,step_key,payload,created_at")
            .eq("session_id", sessionId)
            .order("created_at", { ascending: true }),
        ]);

      if (sessionError || eventsError) throw sessionError || eventsError;
      if (!session) {
        return NextResponse.json({ ok: false, error: "Nie znaleziono wizyty." }, { status: 404 });
      }

      return NextResponse.json({
        ok: true,
        session: await withSpamMarkerName(session as unknown as Record<string, unknown>),
        events: events || [],
      });
    }

    let range: ReturnType<typeof readCalculatorAnalyticsRange>;
    try {
      range = readCalculatorAnalyticsRange(url.searchParams);
    } catch (rangeError) {
      return NextResponse.json(
        {
          ok: false,
          error: rangeError instanceof Error ? rangeError.message : "Nieprawidłowy zakres dat.",
        },
        { status: 400 }
      );
    }

    const includeTest = url.searchParams.get("includeTest") === "true";
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get("pageSize")) || 50));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let sessionsQuery = supabaseAdmin
      .from("energy_storage_calculator_sessions")
      .select(CALCULATOR_ANALYTICS_SESSION_COLUMNS, { count: "exact" })
      .gte("first_seen_at", range.from)
      .lt("first_seen_at", range.to);

    if (!includeTest) sessionsQuery = sessionsQuery.eq("is_test", false);

    const [{ data: sessions, error: sessionsError, count }, { data: summary, error: summaryError }] =
      await Promise.all([
        sessionsQuery.order("first_seen_at", { ascending: false }).range(from, to),
        supabaseAdmin.rpc("get_energy_storage_calculator_analytics_summary_range", {
          p_from: range.from,
          p_to: range.to,
          p_include_test: includeTest,
        }),
      ]);

    if (sessionsError || summaryError) throw sessionsError || summaryError;

    return NextResponse.json({
      ok: true,
      sessions: sessions || [],
      summary: summary || {},
      count: count || 0,
      page,
      pageSize,
      from: range.from,
      to: range.to,
      includeTest,
    });
  } catch (error) {
    console.error("Błąd pobierania analityki kalkulatora", error);
    return NextResponse.json(
      { ok: false, error: "Nie udało się pobrać analityki kalkulatora." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const admin = await requireAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Brak uprawnień." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      sessionId?: string;
      isSpam?: boolean;
      reason?: string;
    };
    const sessionId = body.sessionId?.trim() || "";
    const reason = body.reason?.trim() || "";

    if (!UUID_PATTERN.test(sessionId) || typeof body.isSpam !== "boolean") {
      return NextResponse.json({ ok: false, error: "Nieprawidłowe dane zmiany." }, { status: 400 });
    }

    if (body.isSpam && (reason.length < 3 || reason.length > 500)) {
      return NextResponse.json(
        { ok: false, error: "Podaj powód oznaczenia jako spam (3–500 znaków)." },
        { status: 400 }
      );
    }

    const update = body.isSpam
      ? {
          is_spam: true,
          spam_reason: reason,
          spam_marked_at: new Date().toISOString(),
          spam_marked_by: admin.id,
        }
      : {
          is_spam: false,
          spam_reason: null,
          spam_marked_at: null,
          spam_marked_by: null,
        };

    const { data: session, error } = await supabaseAdmin
      .from("energy_storage_calculator_sessions")
      .update(update)
      .eq("id", sessionId)
      .select(CALCULATOR_ANALYTICS_SESSION_COLUMNS)
      .maybeSingle();

    if (error) throw error;
    if (!session) {
      return NextResponse.json({ ok: false, error: "Nie znaleziono wizyty." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      session: await withSpamMarkerName(session as unknown as Record<string, unknown>),
    });
  } catch (error) {
    console.error("Błąd zmiany statusu spamu w analityce kalkulatora", error);
    return NextResponse.json(
      { ok: false, error: "Nie udało się zmienić statusu wizyty." },
      { status: 500 }
    );
  }
}
