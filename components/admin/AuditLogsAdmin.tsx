"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { AuditLogRow } from "@/lib/auditLogQuery";

type FilterOptions = {
  users: Array<{
    id: string;
    display_name: string | null;
    email: string | null;
    role: string | null;
  }>;
  modules: string[];
  eventTypes: string[];
};

type AuditResponse = {
  ok: boolean;
  error?: string;
  logs: AuditLogRow[];
  count: number;
  page: number;
  pageSize: number;
  options: FilterOptions;
};

const EVENT_LABELS: Record<string, string> = {
  data_change: "Zmiana danych",
  session_started: "Wejście do CRM",
  session_resumed: "Powrót do CRM",
  session_ended: "Wyjście z CRM",
  page_view: "Otwarcie widoku",
  calculation_completed: "Kalkulacja",
  offer_saved: "Zapis oferty",
  offer_sent: "Wysłanie oferty",
  offer_send_failed: "Błąd wysyłki oferty",
  offer_queued: "Oferta w kolejce",
};

const ACTION_LABELS: Record<string, string> = {
  create: "Utworzenie",
  update: "Edycja",
  delete: "Usunięcie",
  view: "Podgląd",
  login: "Logowanie",
  logout: "Wylogowanie",
  resume: "Wznowienie sesji",
  calculate: "Przeliczenie",
  save: "Zapis",
  send: "Wysłanie",
  error: "Błąd",
  queue: "Kolejka",
};

const MODULE_LABELS: Record<string, string> = {
  dashboard: "Pulpit",
  clients: "Klienci",
  sales: "Sprzedaż",
  offers: "Oferty",
  calculator: "Kalkulator",
  calendar: "Kalendarz",
  calendar_events: "Zdarzenia kalendarza",
  tasks: "Zadania",
  reports: "Raporty",
  admin: "Panel administratora",
  profiles: "Użytkownicy",
  client_offers: "Oferty klientów",
  client_activities: "Kontakty z klientem",
  client_notes: "Notatki klientów",
  calendar_events_table: "Zdarzenia kalendarza",
  crm: "CRM",
};

const FIELD_LABELS: Record<string, string> = {
  full_name: "Imię i nazwisko",
  email: "E-mail",
  phone: "Telefon",
  status: "Status",
  assigned_user_id: "Przypisany użytkownik",
  role: "Rola",
  display_name: "Nazwa użytkownika",
  address: "Adres",
  city: "Miasto",
  postal_code: "Kod pocztowy",
  contract_number: "Numer umowy",
  contract_value: "Wartość umowy",
  final_gross: "Kwota brutto",
  final_net: "Kwota netto",
  description: "Opis",
  title: "Tytuł",
  follow_up_at: "Termin kontaktu",
  meeting_at: "Termin spotkania",
  updated_at: "Data aktualizacji",
  created_at: "Data utworzenia",
};

function startOfMonthInput() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function todayInput() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Tak" : "Nie";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function getActorName(log: AuditLogRow) {
  return log.actor?.display_name || log.actor?.email || (log.actor_user_id ? log.actor_user_id : "System");
}

function getEntityLink(log: AuditLogRow) {
  if (log.client_id) return `/clients/${log.client_id}`;
  if (log.sale_id) return `/sales/${log.sale_id}`;
  if (log.offer_id) return `/offers/${log.offer_id}`;
  return null;
}

export default function AuditLogsAdmin() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [options, setOptions] = useState<FilterOptions>({
    users: [],
    modules: [],
    eventTypes: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"xls" | "pdf" | null>(null);
  const [fromDate, setFromDate] = useState(startOfMonthInput());
  const [toDate, setToDate] = useState(todayInput());
  const [userId, setUserId] = useState("");
  const [eventType, setEventType] = useState("");
  const [moduleName, setModuleName] = useState("");
  const [search, setSearch] = useState("");
  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  const params = useMemo(() => {
    const next = new URLSearchParams();

    if (fromDate) next.set("from", new Date(`${fromDate}T00:00:00`).toISOString());
    if (toDate) next.set("to", new Date(`${toDate}T23:59:59.999`).toISOString());
    if (userId) next.set("userId", userId);
    if (eventType) next.set("eventType", eventType);
    if (moduleName) next.set("module", moduleName);
    if (search.trim()) next.set("search", search.trim());

    return next;
  }, [eventType, fromDate, moduleName, search, toDate, userId]);

  useEffect(() => {
    let cancelled = false;

    async function loadLogs() {
      setLoading(true);
      setError("");

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) throw new Error("Sesja wygasła.");

        const query = new URLSearchParams(params);
        query.set("page", String(page));
        query.set("pageSize", String(pageSize));

        const response = await fetch(`/api/admin/audit-logs?${query.toString()}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        const payload = (await response.json()) as AuditResponse;

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Nie udało się pobrać logów.");
        }

        if (cancelled) return;
        setLogs(payload.logs || []);
        setCount(payload.count || 0);
        setOptions(payload.options || { users: [], modules: [], eventTypes: [] });
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać logów.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadLogs();

    return () => {
      cancelled = true;
    };
  }, [page, params]);

  async function exportLogs(format: "xls" | "pdf") {
    setExporting(format);
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) throw new Error("Sesja wygasła.");

      const query = new URLSearchParams(params);
      query.set("format", format);

      const response = await fetch(`/api/admin/audit-logs/export?${query.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Nie udało się przygotować eksportu.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const disposition = response.headers.get("content-disposition") || "";
      const fileName = disposition.match(/filename="([^"]+)"/)?.[1] || `logi-crm.${format}`;

      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Nie udało się przygotować eksportu.");
    } finally {
      setExporting(null);
    }
  }

  function clearFilters() {
    setPage(1);
    setFromDate("");
    setToDate("");
    setUserId("");
    setEventType("");
    setModuleName("");
    setSearch("");
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-600">Dziennik audytowy</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-950">Aktywność użytkowników CRM</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Logowania, odwiedzane widoki, kalkulacje, wysyłki ofert oraz każda zmiana danych z wartościami przed i po operacji.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => exportLogs("xls")}
            disabled={Boolean(exporting) || count === 0}
            className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50"
          >
            {exporting === "xls" ? "Tworzenie Excel..." : "Eksport Excel (.xls)"}
          </button>
          <button
            type="button"
            onClick={() => exportLogs("pdf")}
            disabled={Boolean(exporting) || count === 0}
            className="rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:opacity-50"
          >
            {exporting === "pdf" ? "Tworzenie PDF..." : "Eksport PDF"}
          </button>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-6">
        <label className="text-xs font-semibold text-slate-600">
          Od daty
          <input
            type="date"
            value={fromDate}
            onChange={(event) => {
              setPage(1);
              setFromDate(event.target.value);
            }}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Do daty
          <input
            type="date"
            value={toDate}
            onChange={(event) => {
              setPage(1);
              setToDate(event.target.value);
            }}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Użytkownik
          <select
            value={userId}
            onChange={(event) => {
              setPage(1);
              setUserId(event.target.value);
            }}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
          >
            <option value="">Wszyscy</option>
            {options.users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.display_name || user.email || user.id}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Zdarzenie
          <select
            value={eventType}
            onChange={(event) => {
              setPage(1);
              setEventType(event.target.value);
            }}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
          >
            <option value="">Wszystkie</option>
            {options.eventTypes.map((value) => (
              <option key={value} value={value}>
                {EVENT_LABELS[value] || value}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Moduł
          <select
            value={moduleName}
            onChange={(event) => {
              setPage(1);
              setModuleName(event.target.value);
            }}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
          >
            <option value="">Wszystkie</option>
            {options.modules.map((value) => (
              <option key={value} value={value}>
                {MODULE_LABELS[value] || value}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Szukaj
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
            placeholder="Klient, ID, ścieżka..."
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <div className="md:col-span-2 xl:col-span-6 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500">Znaleziono: <strong className="text-slate-900">{count}</strong></p>
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            Wyczyść filtry
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Ładowanie historii...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">Brak logów dla wybranych filtrów.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {logs.map((log) => {
              const expanded = expandedId === log.id;
              const entityLink = getEntityLink(log);
              const changedFields = log.changed_fields || [];

              return (
                <article key={log.id} className="p-4">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : log.id)}
                    className="grid w-full gap-3 text-left md:grid-cols-[170px_1.1fr_1fr_1fr_2fr_auto] md:items-center"
                  >
                    <span className="text-xs font-semibold text-slate-500">{formatDate(log.created_at)}</span>
                    <span className="text-sm font-bold text-slate-900">{getActorName(log)}</span>
                    <span className="text-xs font-semibold text-slate-600">{MODULE_LABELS[log.module] || log.module}</span>
                    <span className="text-xs font-semibold text-blue-700">{EVENT_LABELS[log.event_type] || log.event_type}</span>
                    <span className="text-sm text-slate-700">
                      {log.summary}
                      {log.event_type === "calculation_completed" ? (
                        <span className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          log.calculation_sent
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}>
                          {log.calculation_sent ? "wysłana" : "niewysłana"}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-sm font-bold text-slate-400">{expanded ? "−" : "+"}</span>
                  </button>

                  {expanded ? (
                    <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <p><strong>Działanie:</strong> {ACTION_LABELS[log.action] || log.action}</p>
                        <p><strong>Obiekt:</strong> {log.entity_type || "—"}</p>
                        <p className="break-all"><strong>ID:</strong> {log.entity_id || "—"}</p>
                        <p><strong>IP:</strong> {log.ip_address || "—"}</p>
                        {log.path ? <p className="md:col-span-2"><strong>Widok:</strong> {log.path}</p> : null}
                        {entityLink ? (
                          <p>
                            <a href={entityLink} className="font-semibold text-blue-700 underline">Otwórz powiązany rekord</a>
                          </p>
                        ) : null}
                      </div>

                      {changedFields.length > 0 ? (
                        <div className="mt-4 overflow-x-auto">
                          <table className="min-w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 text-slate-500">
                                <th className="px-2 py-2">Pole</th>
                                <th className="px-2 py-2">Przed zmianą</th>
                                <th className="px-2 py-2">Po zmianie</th>
                              </tr>
                            </thead>
                            <tbody>
                              {changedFields.map((field) => (
                                <tr key={field} className="border-b border-slate-100 align-top last:border-0">
                                  <th className="px-2 py-2 font-semibold text-slate-700">{FIELD_LABELS[field] || field}</th>
                                  <td className="max-w-md whitespace-pre-wrap break-words px-2 py-2 text-red-700">{formatValue(log.old_values?.[field])}</td>
                                  <td className="max-w-md whitespace-pre-wrap break-words px-2 py-2 text-emerald-700">{formatValue(log.new_values?.[field])}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}

                      {Object.keys(log.metadata || {}).length > 0 ? (
                        <details className="mt-4">
                          <summary className="cursor-pointer font-semibold text-slate-600">Dodatkowe dane techniczne</summary>
                          <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-900 p-3 text-xs text-slate-100">{JSON.stringify(log.metadata, null, 2)}</pre>
                        </details>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setPage((current) => Math.max(1, current - 1))}
          disabled={page <= 1 || loading}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
        >
          Poprzednia
        </button>
        <p className="text-sm text-slate-500">Strona {page} z {totalPages}</p>
        <button
          type="button"
          onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          disabled={page >= totalPages || loading}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
        >
          Następna
        </button>
      </div>
    </section>
  );
}
