"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type AnalyticsSummary = {
  visits: number;
  started: number;
  analysis_started: number;
  recommendations: number;
  form_attempts: number;
  successful_submissions: number;
  leads: number;
  reports_unlocked: number;
  recommended: number;
  not_recommended: number;
  spam: number;
};

type AnalyticsSession = {
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
  device_type: string | null;
  is_test: boolean;
  is_spam: boolean;
  spam_reason: string | null;
  spam_marked_at: string | null;
  spam_marked_by: string | null;
  spam_marked_by_name?: string | null;
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

type AnalyticsEvent = {
  id: number;
  event_name: string;
  step_number: number | null;
  step_key: string | null;
  payload: Record<string, string | number | boolean>;
  created_at: string;
};

const EMPTY_SUMMARY: AnalyticsSummary = {
  visits: 0,
  started: 0,
  analysis_started: 0,
  recommendations: 0,
  form_attempts: 0,
  successful_submissions: 0,
  leads: 0,
  reports_unlocked: 0,
  recommended: 0,
  not_recommended: 0,
  spam: 0,
};

const EVENT_LABELS: Record<string, string> = {
  calculator_view: "Wejście do kalkulatora",
  calculator_started: "Rozpoczęcie kalkulacji",
  step_view: "Wyświetlenie pytania",
  analysis_started: "Uruchomienie analizy",
  recommendation_shown: "Wyświetlenie rekomendacji i formularza",
  lead_submit_attempt: "Próba wysłania formularza",
  lead_submit_success: "Formularz zapisany",
  lead_submit_failed: "Błąd wysyłki formularza",
  report_unlocked: "Odblokowanie pełnego raportu",
  session_closed: "Opuszczenie kalkulatora",
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatDuration(start: string, end: string) {
  const seconds = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes} min ${remainder} s`;
}

function percent(value: number, total: number) {
  return total > 0 ? `${Math.round((value / total) * 100)}%` : "0%";
}

function getSource(session: AnalyticsSession) {
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

function getCreativeLabel(session: AnalyticsSession) {
  if (!session.utm_content) return null;
  const reelMatch = session.utm_content.match(/^reel[_-]?(\d+)$/i);
  if (reelMatch) return `Reel ${reelMatch[1].padStart(2, "0")}`;
  return session.utm_content.replaceAll("_", " ");
}

function getStepQuestion(event: AnalyticsEvent) {
  if (event.event_name !== "step_view" || !event.step_number) return null;
  const hasPv = event.payload?.has_pv === "yes" || event.step_key?.endsWith("_yes");

  if (event.step_number === 1) return "Czy masz już instalację fotowoltaiczną?";
  if (hasPv) {
    return {
      2: "Podaj szczegóły obecnej instalacji",
      3: "Jaki masz rachunek za energię?",
      4: "Z jakiej taryfy korzystasz?",
      5: "Co jest dla Ciebie najważniejsze?",
    }[event.step_number] || null;
  }
  return {
    2: "Jaki masz rachunek za energię?",
    3: "Z jakiej taryfy korzystasz?",
    4: "Co jest dla Ciebie najważniejsze?",
  }[event.step_number] || null;
}

function getEventLabel(event: AnalyticsEvent) {
  if (event.event_name === "step_view" && typeof event.payload?.answer === "string") {
    return "Udzielona odpowiedź";
  }
  return EVENT_LABELS[event.event_name] || event.event_name;
}

const PAYLOAD_LABELS: Record<string, string> = {
  has_pv: "Fotowoltaika",
  recommendation_type: "Rekomendacja",
  recommended_storage_kwh: "Rekomendowana pojemność",
  lead_client_id: "ID klienta CRM",
};

function formatPayloadValue(key: string, value: string | number | boolean) {
  if (key === "has_pv") return value === "yes" ? "Tak" : value === "no" ? "Nie" : String(value);
  if (key === "recommendation_type") {
    return value === "recommended" ? "Rekomendujemy magazyn" : value === "not_recommended" ? "Nie rekomendujemy magazynu" : String(value);
  }
  if (key === "recommended_storage_kwh") return `${value} kWh`;
  return String(value);
}

function getLocation(session: AnalyticsSession) {
  const cityLine = [session.city, session.region].filter(Boolean).join(", ");
  return cityLine || session.country_code || "Brak danych lokalizacyjnych";
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function initialDateFrom() {
  const date = new Date();
  date.setDate(date.getDate() - 29);
  return toDateInputValue(date);
}

function getIsoDateRange(dateFrom: string, dateTo: string) {
  const from = new Date(`${dateFrom}T00:00:00`);
  const to = new Date(`${dateTo}T00:00:00`);
  to.setDate(to.getDate() + 1);

  if (
    !dateFrom ||
    !dateTo ||
    Number.isNaN(from.getTime()) ||
    Number.isNaN(to.getTime()) ||
    to.getTime() <= from.getTime()
  ) {
    throw new Error("Wybierz prawidłowy zakres dat.");
  }

  return { from: from.toISOString(), to: to.toISOString() };
}

function formatRangeLabel(dateFrom: string, dateTo: string) {
  const formatter = new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return `${formatter.format(new Date(`${dateFrom}T00:00:00`))} – ${formatter.format(new Date(`${dateTo}T00:00:00`))}`;
}

export default function CalculatorAnalyticsAdmin() {
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(() => toDateInputValue(new Date()));
  const [includeTest, setIncludeTest] = useState(false);
  const [page, setPage] = useState(1);
  const [sessions, setSessions] = useState<AnalyticsSession[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary>(EMPTY_SUMMARY);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSession, setSelectedSession] = useState<AnalyticsSession | null>(null);
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [spamReason, setSpamReason] = useState("Fałszywe dane kontaktowe");
  const [spamSaving, setSpamSaving] = useState(false);

  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  const authorizedFetch = useCallback(async (path: string, init: RequestInit = {}) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Sesja wygasła. Zaloguj się ponownie.");

    return fetch(path, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      cache: "no-store",
    });
  }, []);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const range = getIsoDateRange(dateFrom, dateTo);
      const query = new URLSearchParams({
        from: range.from,
        to: range.to,
        includeTest: String(includeTest),
        page: String(page),
        pageSize: String(pageSize),
      });
      const response = await authorizedFetch(`/api/admin/calculator-analytics?${query}`);
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Nie udało się pobrać danych.");

      setSessions(data.sessions || []);
      setSummary({ ...EMPTY_SUMMARY, ...(data.summary || {}) });
      setCount(data.count || 0);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać danych.");
    } finally {
      setLoading(false);
    }
  }, [authorizedFetch, dateFrom, dateTo, includeTest, page]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSessions();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadSessions]);

  async function openSession(session: AnalyticsSession) {
    setSelectedSession(session);
    setSpamReason(session.spam_reason || "Fałszywe dane kontaktowe");
    setEvents([]);
    setEventsLoading(true);

    try {
      const response = await authorizedFetch(
        `/api/admin/calculator-analytics?sessionId=${encodeURIComponent(session.id)}`
      );
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Nie udało się pobrać osi czasu.");
      setSelectedSession(data.session);
      setSpamReason(data.session.spam_reason || "Fałszywe dane kontaktowe");
      setEvents(data.events || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać osi czasu.");
    } finally {
      setEventsLoading(false);
    }
  }

  async function updateSpam(isSpam: boolean) {
    if (!selectedSession) return;
    setSpamSaving(true);
    setError("");

    try {
      const response = await authorizedFetch("/api/admin/calculator-analytics", {
        method: "PATCH",
        body: JSON.stringify({
          sessionId: selectedSession.id,
          isSpam,
          reason: isSpam ? spamReason : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Nie udało się zmienić statusu wizyty.");
      }

      setSelectedSession(data.session);
      setSpamReason(data.session.spam_reason || "Fałszywe dane kontaktowe");
      await loadSessions();
    } catch (spamError) {
      setError(spamError instanceof Error ? spamError.message : "Nie udało się zmienić statusu wizyty.");
    } finally {
      setSpamSaving(false);
    }
  }

  async function exportXls() {
    setExportLoading(true);
    setError("");

    try {
      const range = getIsoDateRange(dateFrom, dateTo);
      const query = new URLSearchParams({
        from: range.from,
        to: range.to,
        includeTest: String(includeTest),
      });
      const response = await authorizedFetch(
        `/api/admin/calculator-analytics/export?${query}`
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Nie udało się przygotować eksportu.");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const fileNameMatch = disposition.match(/filename="([^"]+)"/);
      const fileName = fileNameMatch?.[1] || "analityka-kalkulatora.xls";
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "Nie udało się przygotować eksportu."
      );
    } finally {
      setExportLoading(false);
    }
  }

  const cards = [
    { label: "Wizyty", value: summary.visits, note: "Każde wejście do kalkulatora" },
    { label: "Rozpoczęte", value: summary.started, note: `${percent(summary.started, summary.visits)} wszystkich wizyt` },
    { label: "Rekomendacje", value: summary.recommendations, note: `${percent(summary.recommendations, summary.visits)} wszystkich wizyt` },
    {
      label: "Leady istniejące w CRM",
      value: summary.leads,
      note: `${summary.successful_submissions} prawidłowych wysłań · ${summary.spam} oznaczonych jako spam`,
    },
  ];

  const funnel = [
    { label: "Wejście", value: summary.visits },
    { label: "Start", value: summary.started },
    { label: "Analiza", value: summary.analysis_started },
    { label: "Rekomendacja", value: summary.recommendations },
    { label: "Próba formularza", value: summary.form_attempts },
    { label: "Formularz zapisany", value: summary.successful_submissions },
    { label: "Pełny raport", value: summary.reports_unlocked },
  ];

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <div className="flex flex-col gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Analityka kalkulatora</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Pełna ścieżka użytkowników</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Wejścia, osiągnięte etapy, rekomendacje, próby formularza i potwierdzone leady w CRM.
              Lokalizacja jest przybliżona na podstawie adresu IP.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Od
              <input
                type="date"
                value={dateFrom}
                max={dateTo}
                onChange={(event) => { setDateFrom(event.target.value); setPage(1); }}
                className="mt-1 block h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900"
              />
            </label>
            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Do
              <input
                type="date"
                value={dateTo}
                min={dateFrom}
                max={toDateInputValue(new Date())}
                onChange={(event) => { setDateTo(event.target.value); setPage(1); }}
                className="mt-1 block h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900"
              />
            </label>
            <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold">
              <input
                type="checkbox"
                checked={includeTest}
                onChange={(event) => { setIncludeTest(event.target.checked); setPage(1); }}
                className="h-4 w-4 accent-emerald-700"
              />
              Pokaż testy lokalne
            </label>
            <button
              type="button"
              onClick={() => void loadSessions()}
              className="h-11 rounded-xl bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-emerald-800"
            >
              Odśwież
            </button>
            <button
              type="button"
              onClick={() => void exportXls()}
              disabled={exportLoading}
              className="h-11 rounded-xl bg-emerald-700 px-5 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
            >
              {exportLoading ? "Tworzenie .xls…" : "Eksport .xls"}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-800">{error}</div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-bold text-slate-500">{card.label}</p>
              <p className="mt-2 text-4xl font-black tracking-tight">{card.value}</p>
              <p className="mt-2 text-xs font-semibold text-slate-500">{card.note}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Lejek użycia</h2>
                <p className="mt-1 text-sm text-slate-500">Liczba wizyt, które dotarły co najmniej do danego etapu.</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">
                {formatRangeLabel(dateFrom, dateTo)}
              </span>
            </div>
            <div className="mt-6 space-y-3">
              {funnel.map((item) => {
                const width = summary.visits ? Math.max(3, (item.value / summary.visits) * 100) : 0;
                return (
                  <div key={item.label} className="grid grid-cols-[130px_1fr_72px] items-center gap-3 text-sm">
                    <span className="font-bold text-slate-700">{item.label}</span>
                    <div className="h-9 overflow-hidden rounded-xl bg-slate-100">
                      <div className="flex h-full items-center rounded-xl bg-gradient-to-r from-emerald-700 to-teal-500 px-3 text-xs font-black text-white" style={{ width: `${width}%` }}>
                        {width >= 18 ? percent(item.value, summary.visits) : ""}
                      </div>
                    </div>
                    <span className="text-right font-black">{item.value}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">Wynik rekomendacji</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-2xl bg-emerald-400/15 p-5">
                <p className="text-sm font-bold text-emerald-200">Rekomendujemy magazyn</p>
                <p className="mt-2 text-4xl font-black">{summary.recommended}</p>
              </div>
              <div className="rounded-2xl bg-rose-400/15 p-5">
                <p className="text-sm font-bold text-rose-200">Nie rekomendujemy</p>
                <p className="mt-2 text-4xl font-black">{summary.not_recommended}</p>
              </div>
            </div>
          </section>
        </div>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
            <div>
              <h2 className="text-xl font-black">Wszystkie wizyty</h2>
              <p className="mt-1 text-sm text-slate-500">{count} zapisanych wejść w wybranym okresie</p>
            </div>
            {loading && <span className="text-sm font-bold text-emerald-700">Pobieranie…</span>}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-black">Wejście</th>
                  <th className="px-5 py-3 font-black">Lokalizacja / IP</th>
                  <th className="px-5 py-3 font-black">Źródło</th>
                  <th className="px-5 py-3 font-black">Osiągnięty etap</th>
                  <th className="px-5 py-3 font-black">Wynik</th>
                  <th className="px-5 py-3 font-black">Czas</th>
                  <th className="px-5 py-3 font-black"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!loading && sessions.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-500">Brak wizyt w wybranym okresie.</td></tr>
                )}
                {sessions.map((session) => (
                  <tr key={session.id} className={`align-top ${session.is_spam ? "bg-rose-50/70 hover:bg-rose-50" : "hover:bg-slate-50/80"}`}>
                    <td className="whitespace-nowrap px-5 py-4">
                      <p className="font-bold">{formatDate(session.first_seen_at)}</p>
                      <p className="mt-1 text-xs text-slate-500">{session.device_type || "nieznane urządzenie"}</p>
                      {session.is_test && <span className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">TEST</span>}
                      {session.is_spam && <span className="ml-1 mt-2 inline-flex rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-black text-white">SPAM</span>}
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-bold">{getLocation(session)}</p>
                      <p className="mt-1 font-mono text-xs text-slate-500">{session.ip_address || "IP niedostępne"}</p>
                    </td>
                    <td className="max-w-[220px] px-5 py-4">
                      <p className="truncate font-bold" title={getSource(session)}>{getSource(session)}</p>
                      {session.utm_medium && <p className="mt-1 text-xs text-slate-500">medium: {session.utm_medium}</p>}
                      {getCreativeLabel(session) && <p className="mt-1 text-xs font-bold text-emerald-700">materiał: {getCreativeLabel(session)}</p>}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${session.is_spam ? "bg-rose-100 text-rose-800" : session.lead_client_id ? "bg-emerald-100 text-emerald-800" : session.max_step >= 7 ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-700"}`}>
                        {PROGRESS_LABELS[session.max_step] || `Etap ${session.max_step}`}
                      </span>
                      <p className="mt-2 text-xs text-slate-500">{session.event_count} zdarzeń</p>
                      {session.lead_client_id ? (
                        <p className="mt-1 text-xs font-bold text-emerald-700">Lead istnieje w CRM</p>
                      ) : session.lead_submitted_at ? (
                        <p className="mt-1 text-xs font-bold text-amber-700">Brak rekordu w CRM</p>
                      ) : null}
                    </td>
                    <td className="px-5 py-4">
                      {session.recommendation_type ? (
                        <>
                          <p className={`font-black ${session.recommendation_type === "recommended" ? "text-emerald-700" : "text-rose-700"}`}>
                            {session.recommendation_type === "recommended" ? "TAK" : "NIE"}
                          </p>
                          {session.recommended_storage_kwh && <p className="mt-1 text-xs text-slate-500">{session.recommended_storage_kwh} kWh</p>}
                        </>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-600">{formatDuration(session.first_seen_at, session.last_seen_at)}</td>
                    <td className="px-5 py-4 text-right">
                      <button type="button" onClick={() => void openSession(session)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black transition hover:border-slate-950 hover:bg-slate-950 hover:text-white">
                        Szczegóły
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 text-sm">
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-xl border border-slate-200 px-4 py-2 font-bold disabled:opacity-40">Poprzednia</button>
            <span className="font-semibold text-slate-500">Strona {page} z {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded-xl border border-slate-200 px-4 py-2 font-bold disabled:opacity-40">Następna</button>
          </div>
        </section>
      </div>

      {selectedSession && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedSession(null); }}>
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Audyt pojedynczej wizyty</p>
                <h2 className="mt-1 text-2xl font-black">{formatDate(selectedSession.first_seen_at)}</h2>
                <p className="mt-1 font-mono text-xs text-slate-500">{selectedSession.id}</p>
              </div>
              <button type="button" onClick={() => setSelectedSession(null)} aria-label="Zamknij" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl font-black hover:bg-slate-200">×</button>
            </div>

            <div className="grid gap-4 border-b border-slate-200 bg-slate-50 p-6 sm:grid-cols-2 lg:grid-cols-4">
              <div><p className="text-xs font-bold uppercase text-slate-500">IP</p><p className="mt-1 font-mono text-sm font-bold">{selectedSession.ip_address || "Brak"}</p></div>
              <div><p className="text-xs font-bold uppercase text-slate-500">Lokalizacja</p><p className="mt-1 text-sm font-bold">{getLocation(selectedSession)}</p></div>
              <div>
                <p className="text-xs font-bold uppercase text-slate-500">Źródło</p>
                <p className="mt-1 break-words text-sm font-bold">{getSource(selectedSession)}</p>
                {getCreativeLabel(selectedSession) && <p className="mt-1 text-xs font-black text-emerald-700">{getCreativeLabel(selectedSession)}</p>}
              </div>
              <div><p className="text-xs font-bold uppercase text-slate-500">Czas wizyty</p><p className="mt-1 text-sm font-bold">{formatDuration(selectedSession.first_seen_at, selectedSession.last_seen_at)}</p></div>
            </div>

            <div className="p-6">
              <section className={`mb-7 rounded-2xl border p-5 ${selectedSession.is_spam ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className={`text-xs font-black uppercase tracking-[0.16em] ${selectedSession.is_spam ? "text-rose-700" : "text-slate-500"}`}>
                      Klasyfikacja wizyty
                    </p>
                    <h3 className="mt-1 text-lg font-black">
                      {selectedSession.is_spam ? "Oznaczono jako spam" : "Prawidłowa wizyta"}
                    </h3>
                    {selectedSession.is_spam && (
                      <div className="mt-2 text-sm text-rose-900">
                        <p><span className="font-black">Powód:</span> {selectedSession.spam_reason || "Brak powodu"}</p>
                        {selectedSession.spam_marked_at && (
                          <p className="mt-1 text-xs text-rose-700">
                            {formatDate(selectedSession.spam_marked_at)} · {selectedSession.spam_marked_by_name || "System"}
                          </p>
                        )}
                        <p className="mt-2 text-xs font-semibold text-rose-700">
                          Ta wizyta pozostaje w audycie ruchu, ale nie jest liczona jako lead, skuteczna konwersja ani pełny raport.
                        </p>
                      </div>
                    )}
                  </div>

                  {selectedSession.is_spam ? (
                    <button
                      type="button"
                      onClick={() => void updateSpam(false)}
                      disabled={spamSaving}
                      className="shrink-0 rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-black text-rose-800 transition hover:bg-rose-100 disabled:opacity-50"
                    >
                      {spamSaving ? "Zapisywanie…" : "Przywróć jako prawidłowy"}
                    </button>
                  ) : (
                    <div className="w-full sm:max-w-sm">
                      <label className="block text-xs font-black uppercase tracking-wide text-slate-500" htmlFor="spam-reason">
                        Powód oznaczenia
                      </label>
                      <input
                        id="spam-reason"
                        value={spamReason}
                        onChange={(event) => setSpamReason(event.target.value)}
                        maxLength={500}
                        className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-200"
                      />
                      <button
                        type="button"
                        onClick={() => void updateSpam(true)}
                        disabled={spamSaving || spamReason.trim().length < 3}
                        className="mt-2 w-full rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-rose-700 disabled:opacity-50"
                      >
                        {spamSaving ? "Zapisywanie…" : "Oznacz jako spam"}
                      </button>
                    </div>
                  )}
                </div>
              </section>

              <h3 className="text-lg font-black">Oś czasu</h3>
              {eventsLoading ? (
                <p className="mt-5 text-sm font-semibold text-slate-500">Pobieranie zdarzeń…</p>
              ) : (
                <ol className="relative mt-5 space-y-0 border-l-2 border-slate-200 pl-6">
                  {events.map((event) => {
                    const question = typeof event.payload?.question === "string"
                      ? event.payload.question
                      : getStepQuestion(event);
                    const answer = typeof event.payload?.answer === "string"
                      ? event.payload.answer
                      : null;
                    const additionalPayload = Object.entries(event.payload || {})
                      .filter(([key]) => key !== "question" && key !== "answer");

                    return (
                    <li key={event.id} className="relative pb-6 last:pb-0">
                      <span className={`absolute -left-[31px] top-1 h-3 w-3 rounded-full ring-4 ring-white ${event.event_name === "lead_submit_failed" ? "bg-rose-500" : event.event_name === "lead_submit_success" || event.event_name === "report_unlocked" ? "bg-emerald-500" : "bg-slate-400"}`} />
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <p className="font-black">{getEventLabel(event)}</p>
                        <time className="text-xs font-semibold text-slate-500">{formatDate(event.created_at)}</time>
                      </div>
                      {event.step_key && <p className="mt-1 text-sm text-slate-500">Etap: {event.step_key.replaceAll("_", " ")}</p>}
                      {question && (
                        <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="text-sm font-black text-slate-900">{question}</p>
                          {answer ? (
                            <p className="mt-1 text-sm text-slate-700"><span className="font-black">Odpowiedź:</span> {answer}</p>
                          ) : (
                            <p className="mt-1 text-xs text-slate-500">Pytanie wyświetlone. W tej wersji kalkulatora odpowiedź nie była jeszcze zapisywana w audycie.</p>
                          )}
                        </div>
                      )}
                      {additionalPayload.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {additionalPayload.map(([key, value]) => (
                            <span key={key} className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{PAYLOAD_LABELS[key] || key.replaceAll("_", " ")}: {formatPayloadValue(key, value)}</span>
                          ))}
                        </div>
                      )}
                    </li>
                    );
                  })}
                </ol>
              )}
              <div className="mt-7 rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-500">
                Urządzenie: {selectedSession.user_agent || "brak danych"}. Lokalizacja ma charakter orientacyjny i wynika z danych sieciowych przypisanych do adresu IP.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
