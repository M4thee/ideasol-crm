import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/requireAdminRequest";
import {
  CALCULATOR_ANALYTICS_SESSION_COLUMNS,
  readCalculatorAnalyticsRange,
} from "@/lib/calculatorAnalytics";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await requireAdminRequest(request))) {
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

      return NextResponse.json({ ok: true, session, events: events || [] });
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
