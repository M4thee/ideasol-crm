

"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type InteractionFilter = "all" | "phone" | "mail" | "sms" | "meeting";


type ActivityRow = {
  id: string;
  created_at: string | null;
  created_by?: string | null;
  user_id?: string | null;
  owner_id?: string | null;
  assigned_user_id?: string | null;
  client_id?: string | null;
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
  title?: string | null;
};

type CalendarEventRow = {
  id: string;
  created_at: string | null;
  created_by?: string | null;
  assigned_user_id?: string | null;
  client_id?: string | null;
  source_activity_id?: string | null;
  event_type?: string | null;
  status?: string | null;
  title?: string | null;
  event_at?: string | null;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  role: string | null;
};

type ClientRow = {
  id: string;
  full_name?: string | null;
  company_name?: string | null;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
};

type StatusSlice = {
  label: string;
  count: number;
  percent: number;
};

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

function formatDisplayDate(dateValue: string | null) {
  if (!dateValue) return "—";
  return new Date(dateValue).toLocaleDateString("pl-PL");
}

function formatDisplayTime(dateValue: string | null) {
  if (!dateValue) return "—";
  return new Date(dateValue).toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}



function getActivityType(row: ActivityRow) {
  return normalizeText(row.activity_type);
}

function getContactStatus(row: ActivityRow) {
  return normalizeText(row.status || row.phone_status || row.contact_status || row.outcome || row.result);
}

function getInteractionType(row: ActivityRow): InteractionFilter {
  const activityType = getActivityType(row);

  if (activityType === "email") return "mail";
  if (activityType === "sms") return "sms";
  if (activityType === "phone") return "phone";
  if (activityType === "meeting" || activityType === "spotkanie" || activityType === "calendar_event") return "meeting";

  return "phone";
}

function getInteractionTypeLabel(type: InteractionFilter) {
  if (type === "phone") return "Telefon";
  if (type === "mail") return "Mail";
  if (type === "sms") return "SMS";
  if (type === "meeting") return "Spotkanie";
  return "Wszystkie";
}

function getStatusLabel(row: ActivityRow) {
  const rawStatus = row.status || row.phone_status || row.contact_status || row.outcome || row.result || "brak_statusu";
  const status = getContactStatus(row);
  const activityType = getActivityType(row);

  if (activityType === "meeting" || activityType === "spotkanie" || activityType === "calendar_event") {
    return "Umówione spotkanie";
  }

  if (status.includes("meeting_scheduled") || status.includes("umowione spotkanie") || status.includes("umowiono spotkanie")) {
    return "Umówione spotkanie";
  }

  if (status.includes("no_answer") || status.includes("nie odbiera")) {
    return "Nie odbiera";
  }

  if (status.includes("call_back_request") || status.includes("ponowny kontakt")) {
    return "Prośba o ponowny kontakt";
  }

  if (status.includes("not_interested") || status.includes("niezainteresowany")) {
    return "Niezainteresowany";
  }

  if (status.includes("complaint") || status.includes("reklamacja")) {
    return "Reklamacja";
  }

  if (status.includes("technical") || status.includes("techniczne")) {
    return "Pytania techniczne";
  }

  if (status.includes("interest") || status.includes("zainteresowanie")) {
    return "Zainteresowanie ofertą";
  }

  return rawStatus && rawStatus !== "brak_statusu" ? String(rawStatus) : "Brak statusu";
}
function buildMeetingActivityFromCalendarEvent(row: CalendarEventRow): ActivityRow {
  return {
    id: `calendar-event-${row.id}`,
    created_at: row.created_at || row.event_at || null,
    created_by: row.created_by,
    assigned_user_id: row.assigned_user_id,
    client_id: row.client_id,
    activity_type: "meeting",
    contact_type: "Kalendarz",
    status: "Umówione spotkanie",
    title: row.title || "Spotkanie w kalendarzu",
  };
}

function isNoAnswer(row: ActivityRow) {
  const status = getContactStatus(row);
  return status === "nie odbiera" || status === "no_answer";
}

function isAnsweredPhoneActivity(row: ActivityRow) {
  return getInteractionType(row) === "phone" && !isNoAnswer(row);
}


function getConversationClientKey(row: ActivityRow) {
  return row.client_id || row.id || `${row.created_by || row.assigned_user_id || "unknown"}-${row.created_at || "unknown"}`;
}

function isMeetingCalendarEvent(row: CalendarEventRow) {
  const eventType = normalizeText(row.event_type);
  const title = normalizeText(row.title);

  return eventType === "meeting" || eventType === "spotkanie" || title.includes("spotkanie");
}

function getNote(row: ActivityRow) {
  return row.description || row.note || row.title || "—";
}

function getClientName(client?: ClientRow) {
  if (!client) return "Brak klienta";
  return client.full_name || client.company_name || client.contact_person || client.email || client.phone || "Klient bez nazwy";
}

function escapeCsvValue(value: unknown) {
  const text = String(value ?? "").replaceAll('"', '""');
  return `"${text}"`;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csvContent = rows
    .map((row) => row.map(escapeCsvValue).join(";"))
    .join("\n");
  const blob = new Blob([`\uFEFF${csvContent}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function buildStatusSlices(rows: ActivityRow[]): StatusSlice[] {
  if (rows.length === 0) return [];

  const map = new Map<string, number>();

  rows.forEach((row) => {
    const status = getStatusLabel(row);
    map.set(status, (map.get(status) || 0) + 1);
  });

  return Array.from(map.entries())
    .map(([label, count]) => ({
      label,
      count,
      percent: Math.round((count / rows.length) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}

function buildPieGradient(slices: StatusSlice[]) {
  if (slices.length === 0) return "#e2e8f0";

  const colors = ["#0f172a", "#2563eb", "#059669", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2"];
  let start = 0;

  return `conic-gradient(${slices
    .map((slice, index) => {
      const end = start + slice.percent;
      const color = colors[index % colors.length];
      const part = `${color} ${start}% ${end}%`;
      start = end;
      return part;
    })
    .join(", ")})`;
}

function getInteractionSummary(rows: ActivityRow[], calendarEvents: CalendarEventRow[] = []) {
  const phoneRows = rows.filter((row) => getInteractionType(row) === "phone");
  const phones = phoneRows.length;
  const mails = rows.filter((row) => getInteractionType(row) === "mail").length;
  const sms = rows.filter((row) => getInteractionType(row) === "sms").length;
  const scheduledPhoneRows = rows.filter((row) => getStatusLabel(row) === "Umówione spotkanie");
  const scheduledPhoneActivityIds = new Set(
    scheduledPhoneRows.map((row) => row.id).filter(Boolean)
  );
  const meetingEventRows = calendarEvents
    .filter(isMeetingCalendarEvent)
    .filter((event) => !event.source_activity_id || !scheduledPhoneActivityIds.has(event.source_activity_id));
  const meetings = scheduledPhoneRows.length + meetingEventRows.length;
  const uniqueClientConversations = new Set(
    phoneRows.filter(isAnsweredPhoneActivity).map(getConversationClientKey)
  ).size;
  const conversion = phones > 0 ? Math.round((meetings / phones) * 100) : 0;

  return {
    total: rows.length,
    phones,
    uniqueClientConversations,
    mails,
    sms,
    meetings,
    conversion,
  };
}

export default function UserReportDetailsPage() {
  const params = useParams<{ userId: string }>();
  const searchParams = useSearchParams();
  const userId = params.userId;
  const dateFrom = searchParams.get("from") || new Date().toISOString().slice(0, 10);
  const dateTo = searchParams.get("to") || new Date().toISOString().slice(0, 10);
  const reportsBackUrl = `/reports?from=${encodeURIComponent(dateFrom)}&to=${encodeURIComponent(dateTo)}`;
  const [interactionFilter, setInteractionFilter] = useState<InteractionFilter>("all");
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventRow[]>([]);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [clientMap, setClientMap] = useState<Map<string, ClientRow>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeStatusLabel, setActiveStatusLabel] = useState<string | null>(null);

  const filteredActivities = useMemo(() => {
    if (interactionFilter === "all") return activities;
    return activities.filter((activity) => getInteractionType(activity) === interactionFilter);
  }, [activities, interactionFilter]);

  const statusSlices = useMemo(() => buildStatusSlices(filteredActivities), [filteredActivities]);
  const pieGradient = useMemo(() => buildPieGradient(statusSlices), [statusSlices]);
  const activeStatusSlice = useMemo(() => {
    if (!activeStatusLabel) return statusSlices[0] || null;
    return statusSlices.find((slice) => slice.label === activeStatusLabel) || statusSlices[0] || null;
  }, [activeStatusLabel, statusSlices]);

  const interactionSummary = useMemo(
    () => getInteractionSummary(filteredActivities),
    [filteredActivities]
  );

  function handleExportToExcel() {
    const advisorName = profile?.display_name || profile?.email || userId;
    const safeAdvisorName = advisorName
      .replaceAll(" ", "_")
      .replaceAll("/", "-")
      .replaceAll("\\", "-");

    const statusSummaryRows = statusSlices.map((slice) => [
      slice.label,
      String(slice.count),
      `${slice.percent}%`,
    ]);

    const rows = [
      ["Raport interakcji użytkownika"],
      ["Użytkownik", advisorName],
      ["Zakres od", dateFrom],
      ["Zakres do", dateTo],
      ["Filtr", getInteractionTypeLabel(interactionFilter)],
      [],
      ["Podsumowanie"],
      ["Wszystkie interakcje", String(interactionSummary.total)],
      ["Telefony", String(interactionSummary.phones)],
      ["Odbyte rozmowy", String(interactionSummary.uniqueClientConversations)],
      ["Maile", String(interactionSummary.mails)],
      ["SMS", String(interactionSummary.sms)],
      ["Umówione spotkania", String(interactionSummary.meetings)],
      ["Konwersja spotkania / telefony", `${interactionSummary.conversion}%`],
      [],
      ["Podsumowanie statusów"],
      ["Status", "Liczba", "Udział"],
      ...statusSummaryRows,
      [],
      ["Szczegóły interakcji"],
      [
        "Data",
        "Godzina",
        "Klient",
        "Link do klienta",
        "Typ interakcji",
        "Typ kontaktu",
        "Status",
        "Notatka",
      ],
      ...filteredActivities.map((activity) => {
        const client = activity.client_id ? clientMap.get(activity.client_id) : undefined;
        const clientUrl = activity.client_id
          ? `${window.location.origin}/clients/${activity.client_id}`
          : "";

        return [
          formatDisplayDate(activity.created_at),
          formatDisplayTime(activity.created_at),
          getClientName(client),
          clientUrl,
          getInteractionTypeLabel(getInteractionType(activity)),
          activity.contact_type || "—",
          getStatusLabel(activity),
          getNote(activity),
        ];
      }),
    ];

    downloadCsv(
      `raport_interakcji_${safeAdvisorName}_${dateFrom}_${dateTo}.csv`,
      rows
    );
  }

  async function loadDetails() {
    setLoading(true);
    setError("");

    try {
      const startIso = new Date(`${dateFrom}T00:00:00`).toISOString();
      const endIso = new Date(`${dateTo}T23:59:59.999`).toISOString();

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, display_name, email, role")
        .eq("id", userId)
        .maybeSingle();

      if (profileError) throw profileError;
      setProfile((profileData || null) as ProfileRow | null);

      const { data: activityRows, error: activitiesError } = await supabase
        .from("client_activities")
        .select("*")
        .eq("created_by", userId)
        .gte("created_at", startIso)
        .lte("created_at", endIso)
        .order("created_at", { ascending: false });

      if (activitiesError) throw activitiesError;

      const rows = (activityRows || []) as ActivityRow[];
      setActivities(rows);

      const { data: calendarEventRows, error: calendarEventsError } = await supabase
        .from("calendar_events")
        .select("id, created_at, created_by, assigned_user_id, client_id, source_activity_id, event_type, status, title, event_at")
        .eq("created_by", userId)
        .gte("created_at", startIso)
        .lte("created_at", endIso);

      if (calendarEventsError) throw calendarEventsError;

      const events = (calendarEventRows || []) as CalendarEventRow[];
      setCalendarEvents(events);

      const scheduledActivityIds = new Set(
        rows
          .filter((row) => getStatusLabel(row) === "Umówione spotkanie")
          .map((row) => row.id)
          .filter(Boolean)
      );

      const meetingActivityRows = events
        .filter(isMeetingCalendarEvent)
        .filter((event) => !event.source_activity_id || !scheduledActivityIds.has(event.source_activity_id))
        .map(buildMeetingActivityFromCalendarEvent);

      const reportRows = [...rows, ...meetingActivityRows].sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });

      setActivities(reportRows);

      const clientIds = Array.from(new Set(reportRows.map((row) => row.client_id).filter(Boolean))) as string[];

      if (clientIds.length === 0) {
        setClientMap(new Map());
        return;
      }

      const { data: clientRows, error: clientsError } = await supabase
        .from("clients")
        .select("id, full_name, company_name, contact_person, phone, email")
        .in("id", clientIds);

      if (clientsError) throw clientsError;

      setClientMap(
        new Map(((clientRows || []) as ClientRow[]).map((client) => [client.id, client]))
      );
    } catch (loadError) {
      console.error("Błąd ładowania szczegółowego raportu użytkownika", loadError);
      setError(loadError instanceof Error ? loadError.message : "Nie udało się załadować szczegółów raportu.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDetails();
  }, [userId, dateFrom, dateTo]);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">
                Szczegóły raportu
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
                {profile?.display_name || profile?.email || "Użytkownik"}
              </h1>
              <p className="mt-3 text-sm text-slate-300 md:text-base">
                Zakres: <span className="font-semibold text-white">{dateFrom}</span> —{" "}
                <span className="font-semibold text-white">{dateTo}</span>
              </p>
            </div>

            <div className="flex w-fit flex-col gap-2">
              <a
                href={reportsBackUrl}
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                ← Wróć do raportów
              </a>
              <button
                type="button"
                onClick={handleExportToExcel}
                disabled={filteredActivities.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-slate-400"
              >
                <span aria-hidden="true">📊</span>
                Eksport do Excela
              </button>
            </div>
          </div>
        </header>

        <section className="grid min-w-0 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Statystyki użytkownika</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Podsumowanie interakcji, statusów i konwersji w wybranym zakresie.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Interakcje</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">{interactionSummary.total}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Konwersja</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">{interactionSummary.conversion}%</p>
                <p className="mt-1 text-xs text-slate-500">Umówione spotkania / telefony</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Telefony</p>
                <p className="mt-2 text-xl font-bold text-slate-950">{interactionSummary.phones}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Odbyte rozmowy</p>
                <p className="mt-2 text-xl font-bold text-slate-950">{interactionSummary.uniqueClientConversations}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Maile</p>
                <p className="mt-2 text-xl font-bold text-slate-950">{interactionSummary.mails}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">SMS</p>
                <p className="mt-2 text-xl font-bold text-slate-950">{interactionSummary.sms}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Umówione spotkania</p>
                <p className="mt-2 text-xl font-bold text-slate-950">{interactionSummary.meetings}</p>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-200 pt-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Statusy kontaktów
              </h3>
            </div>

            <div className="mt-6 flex flex-col items-center justify-center gap-4">
              <div className="relative flex h-56 w-56 items-center justify-center">
                <div
                  className="h-56 w-56 rounded-full border border-slate-200 shadow-inner transition duration-300 hover:scale-[1.03]"
                  style={{ background: pieGradient }}
                  title={activeStatusSlice ? `${activeStatusSlice.label}: ${activeStatusSlice.count} / ${activeStatusSlice.percent}%` : "Brak danych"}
                />
                <div className="absolute flex h-28 w-28 flex-col items-center justify-center rounded-full border border-slate-200 bg-white text-center shadow-sm">
                  {activeStatusSlice ? (
                    <>
                      <span className="text-2xl font-bold text-slate-950">{activeStatusSlice.percent}%</span>
                      <span className="mt-1 text-xs font-semibold text-slate-500">{activeStatusSlice.count} szt.</span>
                    </>
                  ) : (
                    <span className="text-xs font-semibold text-slate-500">Brak danych</span>
                  )}
                </div>
              </div>

              {activeStatusSlice ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm">
                  <p className="font-semibold text-slate-950">{activeStatusSlice.label}</p>
                  <p className="mt-1 text-slate-500">
                    {activeStatusSlice.count} interakcji, {activeStatusSlice.percent}% wybranego zakresu
                  </p>
                </div>
              ) : null}
            </div>

            <div className="mt-4 space-y-2">
              {statusSlices.length > 0 ? (
                statusSlices.map((slice, index) => {
                  const colors = ["bg-slate-950", "bg-blue-600", "bg-emerald-600", "bg-amber-500", "bg-red-600", "bg-violet-600", "bg-cyan-600"];
                  const isActive = activeStatusSlice?.label === slice.label;

                  return (
                    <button
                      key={slice.label}
                      type="button"
                      onMouseEnter={() => setActiveStatusLabel(slice.label)}
                      onFocus={() => setActiveStatusLabel(slice.label)}
                      onClick={() => setActiveStatusLabel(slice.label)}
                      className={`flex w-full items-center justify-between gap-4 rounded-2xl border px-3 py-3 text-left text-sm transition ${
                        isActive
                          ? "border-slate-300 bg-slate-100 shadow-sm"
                          : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className={`h-3 w-3 shrink-0 rounded-full ${colors[index % colors.length]}`} />
                        <span className="truncate font-medium text-slate-700">{slice.label}</span>
                      </span>
                      <span className="shrink-0 font-semibold text-slate-950">
                        {slice.count} / {slice.percent}%
                      </span>
                    </button>
                  );
                })
              ) : (
                <p className="text-sm text-slate-500">Brak danych do wykresu.</p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Interakcje użytkownika</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Telefony, maile i SMS-y z wybranego zakresu dat.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {([
                  ["all", "Wszystkie"],
                  ["phone", "Telefon"],
                  ["mail", "Mail"],
                  ["sms", "SMS"],
                  ["meeting", "Spotkanie"],
                ] as Array<[InteractionFilter, string]>).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setInteractionFilter(value)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      interactionFilter === value
                        ? "bg-slate-950 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                Ładowanie szczegółów...
              </div>
            ) : null}

            {error ? (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {error}
              </div>
            ) : null}

            <div className="mt-5 min-w-0 overflow-hidden rounded-2xl border border-slate-200">
              <div className="w-full overflow-x-auto">
                <table className="min-w-[980px] divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Data</th>
                      <th className="px-5 py-3">Godzina</th>
                      <th className="px-5 py-3">Klient</th>
                      <th className="px-5 py-3">Typ</th>
                      <th className="px-5 py-3">Typ kontaktu</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Notatka</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredActivities.length > 0 ? (
                      filteredActivities.map((activity) => {
                        const client = activity.client_id ? clientMap.get(activity.client_id) : undefined;

                        return (
                          <tr key={activity.id}>
                            <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                              {formatDisplayDate(activity.created_at)}
                            </td>
                            <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                              {formatDisplayTime(activity.created_at)}
                            </td>
                            <td className="px-5 py-4 font-semibold text-slate-900">
                              {activity.client_id ? (
                                <a
                                  href={`/clients/${activity.client_id}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-700 underline-offset-2 hover:underline"
                                >
                                  {getClientName(client)}
                                </a>
                              ) : (
                                "Brak klienta"
                              )}
                            </td>
                            <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                              {getInteractionTypeLabel(getInteractionType(activity))}
                            </td>
                            <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                              {activity.contact_type || "—"}
                            </td>
                            <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                              {getStatusLabel(activity)}
                            </td>
                            <td className="min-w-[320px] max-w-[520px] whitespace-normal px-5 py-4 leading-6 text-slate-600">
                              {getNote(activity)}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td className="px-5 py-5 text-slate-500" colSpan={7}>
                          Brak interakcji w wybranym zakresie lub filtrze.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}