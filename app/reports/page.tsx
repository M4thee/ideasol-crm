
 "use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/lib/supabase";

type PeriodPreset = "day" | "week" | "month" | "quarter" | "year" | "custom";

type MetricCard = {
  label: string;
  value: string;
  change?: string;
  hint?: string;
};

type ActivityRow = {
  id?: string;
  created_at?: string;
  created_by?: string | null;
  user_id?: string | null;
  owner_id?: string | null;
  assigned_user_id?: string | null;
  activity_type?: string | null;
  type?: string | null;
  category?: string | null;
  phone_status?: string | null;
  contact_type?: string | null;
  contact_status?: string | null;
  status?: string | null;
  outcome?: string | null;
  result?: string | null;
  description?: string | null;
  note?: string | null;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  role: string | null;
};

type CcUserSummary = {
  userId: string;
  name: string;
  phoneCalls: number;
  emails: number;
  sms: number;
  meetingsScheduled: number;
  conversionRate: number;
};

type CcReportSummary = {
  phoneCalls: number;
  emails: number;
  sms: number;
  meetingsScheduled: number;
  noAnswer: number;
  callBackRequests: number;
  notInterested: number;
  conversionRate: number;
  users: CcUserSummary[];
};

const emptyCcSummary: CcReportSummary = {
  phoneCalls: 0,
  emails: 0,
  sms: 0,
  meetingsScheduled: 0,
  noAnswer: 0,
  callBackRequests: 0,
  notInterested: 0,
  conversionRate: 0,
  users: [],
};

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getPresetRange(preset: PeriodPreset) {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (preset === "day") return { from: formatDateInput(start), to: formatDateInput(end) };

  if (preset === "week") {
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
    return { from: formatDateInput(start), to: formatDateInput(end) };
  }

  if (preset === "month") {
    start.setDate(1);
    return { from: formatDateInput(start), to: formatDateInput(end) };
  }

  if (preset === "quarter") {
    const quarterStartMonth = Math.floor(start.getMonth() / 3) * 3;
    start.setMonth(quarterStartMonth, 1);
    return { from: formatDateInput(start), to: formatDateInput(end) };
  }

  if (preset === "year") {
    start.setMonth(0, 1);
    return { from: formatDateInput(start), to: formatDateInput(end) };
  }

  return { from: formatDateInput(start), to: formatDateInput(end) };
}

function getDateRangeBoundaries(dateFrom: string, dateTo: string) {
  const start = new Date(`${dateFrom}T00:00:00`);
  const end = new Date(`${dateTo}T23:59:59.999`);

  return { start, end, startIso: start.toISOString(), endIso: end.toISOString() };
}

function getPreviousDateRange(dateFrom: string, dateTo: string) {
  const { start, end } = getDateRangeBoundaries(dateFrom, dateTo);
  const durationMs = end.getTime() - start.getTime();
  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - durationMs);

  return { fromIso: previousStart.toISOString(), toIso: previousEnd.toISOString() };
}

function normalizeText(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("ą", "a")
    .replaceAll("ć", "c")
    .replaceAll("ę", "e")
    .replaceAll("ł", "l")
    .replaceAll("ń", "n")
    .replaceAll("ó", "o")
    .replaceAll("ś", "s")
    .replaceAll("ż", "z")
    .replaceAll("ź", "z");
}

function getActivityType(row: ActivityRow) {
  return normalizeText(row.activity_type);
}

function getContactStatus(row: ActivityRow) {
  return normalizeText(row.status || row.phone_status || row.contact_status || row.outcome || row.result);
}

function isPhoneActivity(row: ActivityRow) {
  return getActivityType(row) === "phone";
}

function isEmailActivity(row: ActivityRow) {
  return getActivityType(row) === "email";
}

function isSmsActivity(row: ActivityRow) {
  return getActivityType(row) === "sms";
}

function isMeetingScheduled(row: ActivityRow) {
  const status = getContactStatus(row);
  return status === "umowione spotkanie" || status === "meeting_scheduled";
}

function isNoAnswer(row: ActivityRow) {
  const status = getContactStatus(row);
  return status === "nie odbiera" || status === "no_answer";
}

function isCallBackRequest(row: ActivityRow) {
  const status = getContactStatus(row);
  return status === "prosba o ponowny kontakt" || status === "call_back_request";
}

function isNotInterested(row: ActivityRow) {
  const status = getContactStatus(row);
  return status === "niezainteresowany" || status === "not_interested";
}

function getActivityOwnerId(row: ActivityRow) {
  return row.created_by || row.user_id || row.owner_id || row.assigned_user_id || "unknown";
}

function summarizeCcRows(rows: ActivityRow[], profileMap: Map<string, ProfileRow>): CcReportSummary {
  const phoneRows = rows.filter(isPhoneActivity);
  const emailRows = rows.filter(isEmailActivity);
  const smsRows = rows.filter(isSmsActivity);
  const interactionRows = rows.filter((row) => isPhoneActivity(row) || isEmailActivity(row) || isSmsActivity(row));

  const phoneCalls = phoneRows.length;
  const emails = emailRows.length;
  const sms = smsRows.length;
  const meetingsScheduled = phoneRows.filter(isMeetingScheduled).length;
  const noAnswer = phoneRows.filter(isNoAnswer).length;
  const callBackRequests = phoneRows.filter(isCallBackRequest).length;
  const notInterested = phoneRows.filter(isNotInterested).length;
  const userMap = new Map<string, CcUserSummary>();

  interactionRows.forEach((row) => {
    const userId = getActivityOwnerId(row);
    const profile = profileMap.get(userId);
    const current = userMap.get(userId) || {
      userId,
      name: profile?.display_name || profile?.email || "Nieznany użytkownik",
      phoneCalls: 0,
      emails: 0,
      sms: 0,
      meetingsScheduled: 0,
      conversionRate: 0,
    };

    if (isPhoneActivity(row)) {
      current.phoneCalls += 1;

      if (isMeetingScheduled(row)) {
        current.meetingsScheduled += 1;
      }
    }

    if (isEmailActivity(row)) {
      current.emails += 1;
    }

    if (isSmsActivity(row)) {
      current.sms += 1;
    }

    current.conversionRate = current.phoneCalls > 0
      ? Math.round((current.meetingsScheduled / current.phoneCalls) * 100)
      : 0;

    userMap.set(userId, current);
  });

  return {
    phoneCalls,
    emails,
    sms,
    meetingsScheduled,
    noAnswer,
    callBackRequests,
    notInterested,
    conversionRate: phoneCalls > 0 ? Math.round((meetingsScheduled / phoneCalls) * 100) : 0,
    users: Array.from(userMap.values()).sort((a, b) => b.phoneCalls - a.phoneCalls),
  };
}

function formatPercentChange(current: number, previous: number) {
  if (previous === 0 && current === 0) return "—";
  if (previous === 0) return "+100%";
  const change = Math.round(((current - previous) / previous) * 100);
  return `${change > 0 ? "+" : ""}${change}%`;
}

function formatNumberChange(current: number, previous: number) {
  if (previous === current) return "—";
  const change = current - previous;
  return `${change > 0 ? "+" : ""}${change}`;
}

const periodButtons: Array<{ key: PeriodPreset; label: string }> = [
  { key: "day", label: "Dzień" },
  { key: "week", label: "Tydzień" },
  { key: "month", label: "Miesiąc" },
  { key: "quarter", label: "Kwartał" },
  { key: "year", label: "Rok" },
  { key: "custom", label: "Od daty do daty" },
];

const advisorMetrics: MetricCard[] = [
  { label: "Odbyte spotkania", value: "0", change: "—", hint: "Spotkania zakończone w okresie" },
  { label: "Taski", value: "0", change: "—", hint: "Zamknięte i zaległe zadania" },
  { label: "Pozyskani klienci", value: "0", change: "—", hint: "Nowi klienci przypisani do doradcy" },
  { label: "Sprzedaże szt.", value: "0", change: "—", hint: "Liczba sprzedaży" },
  { label: "Sprzedaże obrót", value: "0 zł", change: "—", hint: "Wartość podpisanych umów" },
  { label: "Kompletność dokumentacji", value: "0%", change: "—", hint: "Sprzedaże z kompletem wymaganych plików" },
];

const boardMetrics: MetricCard[] = [
  { label: "Nowe leady", value: "0", hint: "Wszystkie nowe kontakty w okresie" },
  { label: "Spotkania", value: "0", hint: "Utworzone i odbyte spotkania" },
  { label: "Oferty", value: "0", hint: "Oferty zapisane / wysłane" },
  { label: "Sprzedaże", value: "0", hint: "Liczba sprzedaży" },
  { label: "Obrót", value: "0 zł", hint: "Suma wartości umów" },
  { label: "Konwersja lead → sprzedaż", value: "0%", hint: "Sprzedaże / nowe leady" },
];

function MetricGrid({ metrics }: { metrics: MetricCard[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {metrics.map((metric) => (
        <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">{metric.label}</p>
          <div className="mt-3 flex items-end justify-between gap-4">
            <p className="text-3xl font-semibold tracking-tight text-slate-950">{metric.value}</p>
            {metric.change ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {metric.change}
              </span>
            ) : null}
          </div>
          {metric.hint ? <p className="mt-3 text-sm text-slate-500">{metric.hint}</p> : null}
        </div>
      ))}
    </div>
  );
}

function ReportSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5 md:p-6">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      {children}
    </section>
  );
}

export default function ReportsPage() {
  const [preset, setPreset] = useState<PeriodPreset>("month");
  const initialRange = useMemo(() => getPresetRange("month"), []);
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);
  const [ccSummary, setCcSummary] = useState<CcReportSummary>(emptyCcSummary);
  const [previousCcSummary, setPreviousCcSummary] = useState<CcReportSummary>(emptyCcSummary);
  const [loadingCcReport, setLoadingCcReport] = useState(false);
  const [ccReportError, setCcReportError] = useState("");

  function handlePresetChange(nextPreset: PeriodPreset) {
    setPreset(nextPreset);
    if (nextPreset !== "custom") {
      const range = getPresetRange(nextPreset);
      setDateFrom(range.from);
      setDateTo(range.to);
    }
  }

  async function loadCcReport() {
    setLoadingCcReport(true);
    setCcReportError("");

    try {
      const currentRange = getDateRangeBoundaries(dateFrom, dateTo);
      const previousRange = getPreviousDateRange(dateFrom, dateTo);

      const { data: activityRows, error: activitiesError } = await supabase
        .from("client_activities")
        .select("*")
        .gte("created_at", previousRange.fromIso)
        .lte("created_at", currentRange.endIso);

      if (activitiesError) throw activitiesError;

      const { data: profileRows, error: profilesError } = await supabase
        .from("profiles")
        .select("id, display_name, email, role");

      if (profilesError) throw profilesError;

      const profileMap = new Map<string, ProfileRow>(
        ((profileRows || []) as ProfileRow[]).map((profile) => [profile.id, profile])
      );

      const allRows = (activityRows || []) as ActivityRow[];
      const currentRows = allRows.filter((row) => {
        const createdAt = new Date(row.created_at || "").getTime();
        return createdAt >= currentRange.start.getTime() && createdAt <= currentRange.end.getTime();
      });
      const previousRows = allRows.filter((row) => {
        const createdAt = new Date(row.created_at || "").getTime();
        return createdAt >= new Date(previousRange.fromIso).getTime() && createdAt <= new Date(previousRange.toIso).getTime();
      });

      setCcSummary(summarizeCcRows(currentRows, profileMap));
      setPreviousCcSummary(summarizeCcRows(previousRows, profileMap));
    } catch (error) {
      console.error("Błąd ładowania raportu CC", error);
      setCcReportError(error instanceof Error ? error.message : "Nie udało się załadować raportu CC.");
    } finally {
      setLoadingCcReport(false);
    }
  }

  useEffect(() => {
    loadCcReport();
  }, [dateFrom, dateTo]);

  const ccMetrics: MetricCard[] = [
    {
      label: "Telefony",
      value: String(ccSummary.phoneCalls),
      change: formatNumberChange(ccSummary.phoneCalls, previousCcSummary.phoneCalls),
      hint: "Liczba wykonanych kontaktów CC w wybranym okresie",
    },
    {
      label: "Maile",
      value: String(ccSummary.emails),
      change: formatNumberChange(ccSummary.emails, previousCcSummary.emails),
      hint: "Liczba zapisanych aktywności mailowych w wybranym okresie",
    },
    {
      label: "SMS",
      value: String(ccSummary.sms),
      change: formatNumberChange(ccSummary.sms, previousCcSummary.sms),
      hint: "Liczba zapisanych aktywności SMS w wybranym okresie",
    },
    {
      label: "Umówione spotkania",
      value: String(ccSummary.meetingsScheduled),
      change: formatNumberChange(ccSummary.meetingsScheduled, previousCcSummary.meetingsScheduled),
      hint: "Kontakty telefoniczne zakończone statusem: umówione spotkanie",
    },
    {
      label: "Konwersja",
      value: `${ccSummary.conversionRate}%`,
      change: formatPercentChange(ccSummary.conversionRate, previousCcSummary.conversionRate),
      hint: "Umówione spotkania / telefony",
    },
    {
      label: "Nie odbiera",
      value: String(ccSummary.noAnswer),
      change: formatNumberChange(ccSummary.noAnswer, previousCcSummary.noAnswer),
      hint: "Kontakty zakończone statusem: nie odbiera",
    },
    {
      label: "Prośba o ponowny kontakt",
      value: String(ccSummary.callBackRequests),
      change: formatNumberChange(ccSummary.callBackRequests, previousCcSummary.callBackRequests),
      hint: "Kontakty wymagające kolejnego follow-upu",
    },
    {
      label: "Niezainteresowany",
      value: String(ccSummary.notInterested),
      change: formatNumberChange(ccSummary.notInterested, previousCcSummary.notInterested),
      hint: "Kontakty zakończone odmową",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">IdeaSol CRM</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Raporty i zestawienia</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                Panel raportowy dla CC, doradców, managerów i zarządu. Pierwsza wersja buduje
                strukturę widoku, zakresy dat i KPI, które następnie podepniemy pod dane CRM.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-slate-200">
              Zakres: <span className="font-semibold text-white">{dateFrom}</span> —{" "}
              <span className="font-semibold text-white">{dateTo}</span>
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Zakres raportu</h2>
              <p className="mt-1 text-sm text-slate-500">Wybierz gotowy okres albo ustaw własny zakres od daty do daty.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {periodButtons.map((button) => (
                <button
                  key={button.key}
                  type="button"
                  onClick={() => handlePresetChange(button.key)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    preset === button.key
                      ? "bg-slate-950 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {button.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:max-w-2xl">
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Data od
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => {
                  setPreset("custom");
                  setDateFrom(event.target.value);
                }}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none ring-0 transition focus:border-slate-400"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Data do
              <input
                type="date"
                value={dateTo}
                onChange={(event) => {
                  setPreset("custom");
                  setDateTo(event.target.value);
                }}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none ring-0 transition focus:border-slate-400"
              />
            </label>
          </div>
        </section>

        <ReportSection
          title="Raport CC"
          description="Telefony, umówione spotkania, konwersja i progres/regres względem poprzedniego okresu."
        >
          {loadingCcReport ? (
            <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm">
              Ładowanie raportu CC...
            </div>
          ) : null}
          {ccReportError ? (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {ccReportError}
            </div>
          ) : null}
          <MetricGrid metrics={ccMetrics} />
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="font-semibold text-slate-950">Telefony per doradca / CC</h3>
              <p className="mt-1 text-sm text-slate-500">Ranking użytkowników według liczby kontaktów telefonicznych w wybranym okresie.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Użytkownik</th>
                    <th className="px-5 py-3">Telefony</th>
                    <th className="px-5 py-3">Maile</th>
                    <th className="px-5 py-3">SMS</th>
                    <th className="px-5 py-3">Spotkania</th>
                    <th className="px-5 py-3">Konwersja</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {ccSummary.users.length > 0 ? (
                    ccSummary.users.map((user) => (
                      <tr key={user.userId} className="transition hover:bg-slate-50">
                        <td className="px-5 py-4 font-semibold text-slate-900">
                          <a
                            href={`/reports/users/${user.userId}?from=${dateFrom}&to=${dateTo}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-700 underline-offset-2 hover:underline"
                          >
                            {user.name}
                          </a>
                        </td>
                        <td className="px-5 py-4 text-slate-700">
                          <a
                            href={`/reports/users/${user.userId}?from=${dateFrom}&to=${dateTo}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-blue-700 underline-offset-2 hover:underline"
                          >
                            {user.phoneCalls}
                          </a>
                        </td>
                        <td className="px-5 py-4 text-slate-700">{user.emails}</td>
                        <td className="px-5 py-4 text-slate-700">{user.sms}</td>
                        <td className="px-5 py-4 text-slate-700">{user.meetingsScheduled}</td>
                        <td className="px-5 py-4 text-slate-700">{user.conversionRate}%</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-5 py-5 text-slate-500" colSpan={6}>Brak kontaktów telefonicznych w wybranym zakresie.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </ReportSection>

        <ReportSection title="Raport doradcy" description="Spotkania, taski, pozyskani klienci, źródła klientów, sprzedaże i kompletność dokumentacji.">
          <MetricGrid metrics={advisorMetrics} />
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-slate-950">Źródła klientów</h3>
              <p className="mt-2 text-sm text-slate-500">Tu podepniemy porównanie: kontakty z kampanii wewnętrznych vs klienci pozyskani samodzielnie przez doradcę.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-slate-950">Ranking doradców</h3>
              <p className="mt-2 text-sm text-slate-500">Docelowo: spotkania, sprzedaże szt., obrót, konwersja, zaległe taski i dokumenty.</p>
            </div>
          </div>
        </ReportSection>

        <ReportSection title="Raport managera" description="Te same KPI co u doradcy, ale liczone zespołowo po przypisaniu doradców do managera.">
          <MetricGrid metrics={advisorMetrics} />
        </ReportSection>

        <ReportSection title="Raport zarządu" description="Widok ogólny: leady, spotkania, oferty, sprzedaże, obrót i konwersja lejka.">
          <MetricGrid metrics={boardMetrics} />
        </ReportSection>
      </div>
    </main>
  );
}