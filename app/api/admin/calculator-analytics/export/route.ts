import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireAdminRequest } from "@/lib/auth/requireAdminRequest";
import {
  CALCULATOR_ANALYTICS_SESSION_COLUMNS,
  readCalculatorAnalyticsRange,
} from "@/lib/calculatorAnalytics";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPORT_PAGE_SIZE = 1000;
const EXPORT_LIMIT = 25_000;

type ExportSession = {
  id: string;
  first_seen_at: string;
  last_seen_at: string;
  ip_address: string | null;
  country_code: string | null;
  region: string | null;
  city: string | null;
  postal_code: string | null;
  timezone: string | null;
  referrer: string | null;
  landing_url: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  device_type: string | null;
  is_test: boolean;
  max_step: number;
  last_event: string;
  event_count: number;
  recommendation_type: "recommended" | "not_recommended" | null;
  recommended_storage_kwh: number | null;
  lead_client_id: string | null;
  lead_submitted_at: string | null;
  report_unlocked_at: string | null;
  user_agent: string | null;
};

const PROGRESS_LABELS: Record<number, string> = {
  0: "Tylko wejście",
  1: "Rozpoczęto",
  2: "Dane instalacji / rachunku",
  3: "Rachunek / taryfa",
  4: "Taryfa / priorytety",
  5: "Priorytety",
  6: "Analiza",
  7: "Rekomendacja + formularz",
  8: "Wysyłka formularza",
  9: "Formularz zapisany",
  10: "Pełny raport",
};

function sourceLabel(session: ExportSession) {
  if (session.utm_source) {
    return [session.utm_source, session.utm_campaign].filter(Boolean).join(" / ");
  }
  if (!session.referrer) return "Wejście bezpośrednie";

  try {
    return new URL(session.referrer).hostname.replace(/^www\./, "");
  } catch {
    return session.referrer;
  }
}

async function getSessions(
  range: { from: string; to: string },
  includeTest: boolean
) {
  const sessions: ExportSession[] = [];

  for (let offset = 0; offset < EXPORT_LIMIT; offset += EXPORT_PAGE_SIZE) {
    let query = supabaseAdmin
      .from("energy_storage_calculator_sessions")
      .select(CALCULATOR_ANALYTICS_SESSION_COLUMNS)
      .gte("first_seen_at", range.from)
      .lt("first_seen_at", range.to)
      .order("first_seen_at", { ascending: false })
      .range(offset, offset + EXPORT_PAGE_SIZE - 1);

    if (!includeTest) query = query.eq("is_test", false);

    const { data, error } = await query;
    if (error) throw error;

    const page = (data || []) as unknown as ExportSession[];
    sessions.push(...page);
    if (page.length < EXPORT_PAGE_SIZE) break;
  }

  return sessions.slice(0, EXPORT_LIMIT);
}

function createWorkbook(
  sessions: ExportSession[],
  summary: Record<string, number>,
  range: { from: string; to: string },
  includeTest: boolean
) {
  const rows = sessions.map((session) => ({
    "Początek wizyty": new Date(session.first_seen_at),
    "Ostatnia aktywność": new Date(session.last_seen_at),
    "Czas wizyty (s)": Math.max(
      0,
      Math.round(
        (new Date(session.last_seen_at).getTime() -
          new Date(session.first_seen_at).getTime()) /
          1000
      )
    ),
    IP: session.ip_address || "",
    Kraj: session.country_code || "",
    Region: session.region || "",
    Miasto: session.city || "",
    "Kod pocztowy": session.postal_code || "",
    "Strefa czasowa": session.timezone || "",
    Źródło: sourceLabel(session),
    "UTM source": session.utm_source || "",
    "UTM medium": session.utm_medium || "",
    "UTM campaign": session.utm_campaign || "",
    "UTM content": session.utm_content || "",
    "UTM term": session.utm_term || "",
    Urządzenie: session.device_type || "",
    Test: session.is_test ? "Tak" : "Nie",
    "Osiągnięty etap": PROGRESS_LABELS[session.max_step] || `Etap ${session.max_step}`,
    "Numer etapu": session.max_step,
    "Ostatnie zdarzenie": session.last_event,
    "Liczba zdarzeń": session.event_count,
    Rekomendacja:
      session.recommendation_type === "recommended"
        ? "TAK"
        : session.recommendation_type === "not_recommended"
          ? "NIE"
          : "",
    "Magazyn (kWh)": session.recommended_storage_kwh || "",
    "Lead istnieje w CRM": session.lead_client_id ? "Tak" : "Nie",
    "ID klienta CRM": session.lead_client_id || "",
    "Wysłanie formularza": session.lead_submitted_at
      ? new Date(session.lead_submitted_at)
      : "",
    "Odblokowanie raportu": session.report_unlocked_at
      ? new Date(session.report_unlocked_at)
      : "",
    "Strona wejścia": session.landing_url || "",
    Referrer: session.referrer || "",
    "Przeglądarka / urządzenie": session.user_agent || "",
    "ID sesji": session.id,
  }));

  const sessionsSheet = XLSX.utils.json_to_sheet(rows, { cellDates: true });
  sessionsSheet["!cols"] = [
    { wch: 21 }, { wch: 21 }, { wch: 16 }, { wch: 18 }, { wch: 9 },
    { wch: 16 }, { wch: 20 }, { wch: 14 }, { wch: 20 }, { wch: 28 },
    { wch: 18 }, { wch: 18 }, { wch: 24 }, { wch: 24 }, { wch: 22 },
    { wch: 14 }, { wch: 9 }, { wch: 28 }, { wch: 12 }, { wch: 24 },
    { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 22 }, { wch: 38 },
    { wch: 22 }, { wch: 22 }, { wch: 55 }, { wch: 45 }, { wch: 60 }, { wch: 38 },
  ];

  const infoSheet = XLSX.utils.aoa_to_sheet([
    ["Analityka kalkulatora magazynów energii"],
    ["Zakres od", new Date(range.from)],
    ["Zakres do", new Date(range.to)],
    ["Uwzględniono testy", includeTest ? "Tak" : "Nie"],
    ["Wygenerowano", new Date()],
    ["Wizyty", summary.visits || 0],
    ["Rozpoczęte", summary.started || 0],
    ["Rekomendacje", summary.recommendations || 0],
    ["Skuteczne wysłania formularza", summary.successful_submissions || 0],
    ["Leady istniejące w CRM", summary.leads || 0],
    ["Pełne raporty", summary.reports_unlocked || 0],
    ["Liczba wyeksportowanych wizyt", sessions.length],
    [
      "Uwaga",
      sessions.length >= EXPORT_LIMIT
        ? `Eksport ograniczono do ${EXPORT_LIMIT.toLocaleString("pl-PL")} najnowszych wizyt.`
        : "Eksport obejmuje wszystkie wizyty z wybranego zakresu.",
    ],
  ]);
  infoSheet["!cols"] = [{ wch: 34 }, { wch: 90 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, infoSheet, "Podsumowanie");
  XLSX.utils.book_append_sheet(workbook, sessionsSheet, "Wizyty");

  return XLSX.write(workbook, {
    type: "buffer",
    bookType: "biff8",
    cellDates: true,
  });
}

export async function GET(request: Request) {
  if (!(await requireAdminRequest(request))) {
    return NextResponse.json({ ok: false, error: "Brak uprawnień." }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const range = readCalculatorAnalyticsRange(url.searchParams);
    const includeTest = url.searchParams.get("includeTest") === "true";
    const [sessions, summaryResult] = await Promise.all([
      getSessions(range, includeTest),
      supabaseAdmin.rpc("get_energy_storage_calculator_analytics_summary_range", {
        p_from: range.from,
        p_to: range.to,
        p_include_test: includeTest,
      }),
    ]);

    if (summaryResult.error) throw summaryResult.error;

    const output = createWorkbook(
      sessions,
      (summaryResult.data || {}) as Record<string, number>,
      range,
      includeTest
    );
    const fileFrom = range.from.slice(0, 10);
    const fileTo = new Date(new Date(range.to).getTime() - 1).toISOString().slice(0, 10);

    return new NextResponse(output, {
      headers: {
        "Content-Type": "application/vnd.ms-excel",
        "Content-Disposition": `attachment; filename="analityka-kalkulatora-${fileFrom}_${fileTo}.xls"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Błąd eksportu analityki kalkulatora", error);
    return NextResponse.json(
      { ok: false, error: "Nie udało się przygotować eksportu .xls." },
      { status: 500 }
    );
  }
}
