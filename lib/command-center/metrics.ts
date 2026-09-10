import type { SupabaseClient } from "@supabase/supabase-js";
import type { CommandCenterMetrics, CommandCenterRankingRow } from "./types";

type ClientRow = {
  id: string;
  created_at: string;
  status: string | null;
  lead_source: string | null;
  assigned_user_id: string | null;
};

type ActivityRow = {
  id: string;
  client_id: string | null;
  created_at: string;
};

type CalendarRow = {
  id: string;
  client_id: string | null;
  event_at: string;
  event_type: string | null;
  status: string | null;
};

type OfferRow = { id: string; client_id: string | null };
type SaleRow = {
  id: string;
  client_id: string | null;
  seller_id: string | null;
  sale_date: string;
  created_at: string;
  contract_value: number | string | null;
  status: string | null;
};
type ProfileRow = { id: string; display_name: string | null; role: string | null };

type QueryPageResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

async function fetchAllRows<Row>(
  buildPage: (from: number, to: number) => PromiseLike<QueryPageResult>
): Promise<Row[]> {
  const pageSize = 1000;
  const rows: Row[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildPage(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = (data || []) as Row[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

function normalize(value: unknown) {
  return String(value || "").trim().toLocaleLowerCase("pl-PL");
}

function numberValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value || "0").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function getZonedParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function zonedDateToUtc(
  value: { year: number; month: number; day: number; hour?: number; minute?: number; second?: number },
  timezone: string
) {
  const intended = Date.UTC(value.year, value.month - 1, value.day, value.hour || 0, value.minute || 0, value.second || 0);
  let guess = intended;
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const actual = getZonedParts(new Date(guess), timezone);
    const actualWallTime = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    guess += intended - actualWallTime;
  }
  return new Date(guess);
}

function getRanges(now: Date, timezone: string) {
  const current = getZonedParts(now, timezone);
  const dayStart = zonedDateToUtc({ year: current.year, month: current.month, day: current.day }, timezone);
  const localWeekday = new Date(Date.UTC(current.year, current.month - 1, current.day)).getUTCDay();
  const mondayOffset = localWeekday === 0 ? -6 : 1 - localWeekday;
  const monday = new Date(Date.UTC(current.year, current.month - 1, current.day + mondayOffset));
  const weekStart = zonedDateToUtc(
    { year: monday.getUTCFullYear(), month: monday.getUTCMonth() + 1, day: monday.getUTCDate() },
    timezone
  );
  const monthStart = zonedDateToUtc({ year: current.year, month: current.month, day: 1 }, timezone);
  const nextDay = new Date(Date.UTC(current.year, current.month - 1, current.day + 1));
  const dayEnd = zonedDateToUtc(
    { year: nextDay.getUTCFullYear(), month: nextDay.getUTCMonth() + 1, day: nextDay.getUTCDate() },
    timezone
  );
  return { dayStart, dayEnd, weekStart, monthStart, queryStart: new Date(Math.min(weekStart.getTime(), monthStart.getTime())) };
}

function inRange(value: string | null | undefined, start: Date, end: Date) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return timestamp >= start.getTime() && timestamp < end.getTime();
}

function isCountedSale(row: SaleRow) {
  const status = normalize(row.status);
  return !status.includes("anul") && !status.includes("utrac") && !status.includes("rezygn") && !status.includes("nieurat");
}

function isCancelledMeeting(row: CalendarRow) {
  const status = normalize(row.status);
  return status.includes("cancel") || status.includes("anul");
}

function group(values: Array<string | null>, fallback: string) {
  const counts = new Map<string, number>();
  values.forEach((value) => {
    const label = value?.trim() || fallback;
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return Array.from(counts, ([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "pl"));
}

export async function loadCommandCenterMetrics(
  supabase: SupabaseClient,
  timezone = "Europe/Warsaw",
  now = new Date()
): Promise<CommandCenterMetrics> {
  const ranges = getRanges(now, timezone);
  const queryStartIso = ranges.queryStart.toISOString();
  const dayEndIso = ranges.dayEnd.toISOString();

  const [clients, activities, calendar, offers, unfilteredSales, profiles] = await Promise.all([
    fetchAllRows<ClientRow>((from, to) => supabase.from("clients").select("id, created_at, status, lead_source, assigned_user_id").gte("created_at", queryStartIso).lt("created_at", dayEndIso).order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to)),
    fetchAllRows<ActivityRow>((from, to) => supabase.from("client_activities").select("id, client_id, created_at").gte("created_at", queryStartIso).lt("created_at", dayEndIso).order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to)),
    fetchAllRows<CalendarRow>((from, to) => supabase.from("calendar_events").select("id, client_id, event_at, event_type, status").gte("event_at", ranges.monthStart.toISOString()).lt("event_at", dayEndIso).order("event_at", { ascending: true }).order("id", { ascending: true }).range(from, to)),
    fetchAllRows<OfferRow>((from, to) => supabase.from("client_offers").select("id, client_id").gte("created_at", ranges.monthStart.toISOString()).lt("created_at", dayEndIso).order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to)),
    fetchAllRows<SaleRow>((from, to) => supabase.from("sales").select("id, client_id, seller_id, sale_date, created_at, contract_value, status").gte("sale_date", queryStartIso).lt("sale_date", dayEndIso).order("sale_date", { ascending: true }).order("id", { ascending: true }).range(from, to)),
    fetchAllRows<ProfileRow>((from, to) => supabase.from("profiles").select("id, display_name, role").order("id", { ascending: true }).range(from, to)),
  ]);
  const sales = unfilteredSales.filter(isCountedSale);
  const monthClients = clients.filter((row) => inRange(row.created_at, ranges.monthStart, ranges.dayEnd));
  const monthClientIds = new Set(monthClients.map((row) => row.id));

  const activitiesByClient = new Map<string, ActivityRow[]>();
  activities.forEach((activity) => {
    if (!activity.client_id || !monthClientIds.has(activity.client_id)) return;
    activitiesByClient.set(activity.client_id, [...(activitiesByClient.get(activity.client_id) || []), activity]);
  });

  const contactedClientIds = new Set(activitiesByClient.keys());
  const firstActivityMinutes = monthClients.flatMap((client) => {
    const firstActivity = (activitiesByClient.get(client.id) || [])
      .filter((activity) => new Date(activity.created_at).getTime() >= new Date(client.created_at).getTime())
      .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
    if (!firstActivity) return [];
    return [(new Date(firstActivity.created_at).getTime() - new Date(client.created_at).getTime()) / 60000];
  });

  const meetingClientIds = new Set(
    calendar
      .filter((row) => normalize(row.event_type) === "meeting" && !isCancelledMeeting(row) && row.client_id && monthClientIds.has(row.client_id))
      .map((row) => row.client_id as string)
  );
  const offerClientIds = new Set(offers.filter((row) => row.client_id && monthClientIds.has(row.client_id)).map((row) => row.client_id as string));
  const saleClientIds = new Set(sales.filter((row) => row.client_id && monthClientIds.has(row.client_id)).map((row) => row.client_id as string));

  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const rankingMap = new Map<string, CommandCenterRankingRow>();
  profiles
    .filter((profile) => ["seller", "manager", "owner", "admin"].includes(normalize(profile.role)))
    .forEach((profile) => rankingMap.set(profile.id, {
      advisorId: profile.id,
      advisorName: profile.display_name || "Doradca",
      leads: 0,
      contactedLeads: 0,
      contactRate: 0,
      sales: 0,
      salesValue: 0,
      conversion: 0,
    }));

  monthClients.forEach((client) => {
    if (!client.assigned_user_id) return;
    const row = rankingMap.get(client.assigned_user_id);
    if (!row) return;
    row.leads += 1;
    if (contactedClientIds.has(client.id)) row.contactedLeads += 1;
  });
  sales.filter((sale) => inRange(sale.sale_date || sale.created_at, ranges.monthStart, ranges.dayEnd)).forEach((sale) => {
    if (!sale.seller_id) return;
    const profile = profileMap.get(sale.seller_id);
    const row = rankingMap.get(sale.seller_id) || {
      advisorId: sale.seller_id,
      advisorName: profile?.display_name || "Doradca",
      leads: 0,
      contactedLeads: 0,
      contactRate: 0,
      sales: 0,
      salesValue: 0,
      conversion: 0,
    };
    row.sales += 1;
    row.salesValue += numberValue(sale.contract_value);
    rankingMap.set(sale.seller_id, row);
  });
  const ranking = Array.from(rankingMap.values()).map((row) => ({
    ...row,
    contactRate: row.leads > 0 ? Math.round((row.contactedLeads / row.leads) * 100) : 0,
    conversion: row.leads > 0 ? Math.round((row.sales / row.leads) * 100) : 0,
  })).filter((row) => row.leads > 0 || row.sales > 0);

  const salesIn = (start: Date) => sales.filter((row) => inRange(row.sale_date || row.created_at, start, ranges.dayEnd));
  const todaySales = salesIn(ranges.dayStart);
  const weekSales = salesIn(ranges.weekStart);
  const monthSales = salesIn(ranges.monthStart);
  const sumSales = (rows: SaleRow[]) => rows.reduce((sum, row) => sum + numberValue(row.contract_value), 0);
  const meetingsToday = calendar.filter((row) => normalize(row.event_type) === "meeting" && inRange(row.event_at, ranges.dayStart, ranges.dayEnd));

  return {
    generatedAt: now.toISOString(),
    leads: {
      today: clients.filter((row) => inRange(row.created_at, ranges.dayStart, ranges.dayEnd)).length,
      week: clients.filter((row) => inRange(row.created_at, ranges.weekStart, ranges.dayEnd)).length,
      month: monthClients.length,
      contactedMonth: contactedClientIds.size,
      contactRateMonth: monthClients.length ? Math.round((contactedClientIds.size / monthClients.length) * 100) : 0,
      averageFirstActivityMinutes: firstActivityMinutes.length
        ? Math.round(firstActivityMinutes.reduce((sum, value) => sum + value, 0) / firstActivityMinutes.length)
        : null,
      sources: group(monthClients.map((row) => row.lead_source), "Brak źródła"),
      statuses: group(monthClients.map((row) => row.status), "Brak statusu"),
    },
    sales: {
      today: todaySales.length,
      week: weekSales.length,
      month: monthSales.length,
      valueToday: sumSales(todaySales),
      valueWeek: sumSales(weekSales),
      valueMonth: sumSales(monthSales),
    },
    funnel: {
      leads: monthClients.length,
      contacted: contactedClientIds.size,
      meetings: meetingClientIds.size,
      offers: offerClientIds.size,
      sales: saleClientIds.size,
    },
    meetings: {
      today: meetingsToday.filter((row) => !isCancelledMeeting(row)).length,
      upcomingToday: meetingsToday.filter((row) => !isCancelledMeeting(row) && new Date(row.event_at) >= now).length,
    },
    ranking,
    reliability: [
      "Leady są liczone z rekordów clients według created_at.",
      "Podjęty lead oznacza co najmniej jedną zarejestrowaną aktywność w CRM.",
      "Sprzedaż wyklucza statusy anulowane, utracone i rezygnacje; wartość pochodzi z sales.contract_value.",
      "Command Center nie wylicza liczby ani czasu połączeń telefonicznych.",
    ],
  };
}
